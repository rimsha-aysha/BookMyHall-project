import crypto from "crypto";
import Payment from "../models/Payment.js";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import { ROLES } from "../config/roles.js";
import { BOOKING_STATUS } from "../config/bookingStatus.js";
import {
  PAYMENT_STATUS,
  PAYMENT_GATEWAY,
  PAYMENT_CURRENCY,
  ALL_PAYMENT_METHODS,
} from "../config/paymentStatus.js";
import {
  calculateAdvanceAmount,
  getPaymentTotals,
  remainingBalanceOf,
  refreshBookingPayment,
  buildPaymentSummary,
  withBookingPaymentLock,
} from "../services/paymentLedger.js";
import {
  isRazorpayConfigured,
  getRazorpay,
  getRazorpayKeyId,
  isValidPaymentSignature,
  toPaise,
} from "../config/razorpay.js";
import { getOrCreateSettings } from "./settings.controller.js";
import { toE164India } from "../utils/phone.js";

// Payments go through Razorpay (TEST MODE keys only):
//   1. createPaymentOrder — server prices the advance and opens a Razorpay
//      order, saved locally as a PENDING Payment.
//   2. The browser runs Razorpay Checkout for that order.
//   3. verifyPayment — server checks Razorpay's signature, re-fetches the
//      payment from Razorpay, and only then marks the Payment SUCCESS and
//      the booking CONFIRMED.
// The booking is never confirmed on the browser's word alone.

const NOT_PAYABLE_REASONS = {
  [BOOKING_STATUS.PENDING]: "This booking is still awaiting approval — payment opens once it's approved",
  [BOOKING_STATUS.REJECTED]: "This booking was rejected and can't be paid for",
};

const fail = (res, next, status, message) => {
  res.status(status);
  return next(new Error(message));
};

// Loads the booking and checks the caller is the customer who owns it.
const loadOwnBooking = async (req, res, next) => {
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) {
    fail(res, next, 404, "Booking not found");
    return null;
  }
  // Walk-in bookings may have no customer account — nobody can pay those
  // online; staff record their payments offline instead.
  if (booking.customer?.toString() !== req.user.id) {
    fail(res, next, 403, "Not authorized to pay for this booking");
    return null;
  }
  return booking;
};

const findSuccessfulRazorpayPayment = (bookingId) =>
  Payment.findOne({ booking: bookingId, gateway: PAYMENT_GATEWAY.RAZORPAY, status: PAYMENT_STATUS.SUCCESS });

const describeRazorpayError = (error) => error?.error?.description || error?.message || "Unknown error";

// What the payment page shows after a successful payment. The balance comes
// from every successful payment (online and offline), not just this one.
const paymentResult = async (payment, booking) => {
  const { totalPaid } = await getPaymentTotals(booking._id);
  return {
    payment,
    booking: { _id: booking._id, status: booking.status, paymentStatus: booking.paymentStatus },
    totalCost: booking.estimatedCost,
    totalPaid,
    remainingBalance: remainingBalanceOf(booking.estimatedCost, totalPaid),
  };
};

class PaymentError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Marks a pending Razorpay Payment successful and confirms its booking, from
// a payment object fetched directly from Razorpay's API (trusted data).
// Idempotent and race-safe: only one caller can flip the record to SUCCESS,
// and the one_razorpay_success_per_booking index rejects a second successful
// Razorpay payment. This is the only path that marks a Razorpay payment
// SUCCESS — staff can't confirm Razorpay records by hand.
const finalizePayment = async (payment, rzpPayment, signature) => {
  if (rzpPayment.order_id !== payment.razorpayOrderId) {
    throw new PaymentError(400, "Payment does not belong to this order");
  }
  if (rzpPayment.amount !== toPaise(payment.amount) || rzpPayment.currency !== payment.currency) {
    throw new PaymentError(400, "Paid amount does not match the amount due");
  }

  // Accounts set to manual capture leave payments "authorized"; capture so
  // the advance is actually collected rather than auto-refunded later.
  if (rzpPayment.status === "authorized") {
    rzpPayment = await getRazorpay().payments.capture(rzpPayment.id, rzpPayment.amount, rzpPayment.currency);
  }
  if (rzpPayment.status !== "captured") {
    throw new PaymentError(402, `Payment was not completed (status: ${rzpPayment.status})`);
  }

  let updated;
  try {
    updated = await Payment.findOneAndUpdate(
      { _id: payment._id, status: { $ne: PAYMENT_STATUS.SUCCESS } },
      {
        $set: {
          status: PAYMENT_STATUS.SUCCESS,
          razorpayPaymentId: rzpPayment.id,
          ...(signature && { razorpaySignature: signature }),
          transactionId: rzpPayment.id,
          method: ALL_PAYMENT_METHODS.includes(rzpPayment.method) ? rzpPayment.method : undefined,
          paidAt: new Date(rzpPayment.created_at * 1000),
        },
        $unset: { failureReason: "" },
      },
      { new: true }
    );
  } catch (error) {
    if (error?.code === 11000) {
      throw new PaymentError(409, "This booking has already been paid for");
    }
    throw error;
  }

  // Lost the race to a concurrent verification of the same payment — fine.
  const result = updated || (await Payment.findById(payment._id));
  if (result.status !== PAYMENT_STATUS.SUCCESS || result.razorpayPaymentId !== rzpPayment.id) {
    throw new PaymentError(409, "This order was already settled by a different payment");
  }

  // Payment is the only way a booking becomes confirmed (managers can't
  // set approved -> confirmed). Conditional, so re-running is harmless.
  await Booking.updateOne(
    { _id: result.booking, status: BOOKING_STATUS.APPROVED },
    { $set: { status: BOOKING_STATUS.CONFIRMED } }
  );
  await refreshBookingPayment(result.booking);
  return result;
};

// POST /api/payments/:bookingId/order — customer who owns an approved, unpaid
// booking. Returns only what Razorpay Checkout needs.
export const createPaymentOrder = async (req, res, next) => {
  try {
    if (!isRazorpayConfigured()) {
      return fail(res, next, 503, "Online payment is not available right now. Please try again later.");
    }

    const booking = await loadOwnBooking(req, res, next);
    if (!booking) return;

    if (await findSuccessfulRazorpayPayment(booking._id)) {
      return fail(res, next, 409, "This booking has already been paid for");
    }
    if (booking.status !== BOOKING_STATUS.APPROVED) {
      return fail(
        res,
        next,
        400,
        NOT_PAYABLE_REASONS[booking.status] || "This booking is not awaiting payment"
      );
    }

    // Amount comes from the booking and Owner settings — never the client.
    // Whatever was already received offline (confirmed by staff) counts
    // towards the advance, so only the rest of it is charged online.
    const settings = await getOrCreateSettings();
    const { totalPaid } = await getPaymentTotals(booking._id);
    const advanceAmount = Math.max(
      0,
      calculateAdvanceAmount(booking.estimatedCost, settings.advancePaymentPercentage) - totalPaid
    );
    if (totalPaid > 0 && advanceAmount < 1) {
      return fail(res, next, 409, "The advance for this booking has already been received");
    }
    if (advanceAmount < 1) {
      return fail(res, next, 400, "The advance amount for this booking is too small to pay online");
    }

    // Reuse this booking's open order (same amount) so clicking Pay again, or
    // retrying after a failure, doesn't pile up orders.
    let payment = await Payment.findOne({
      booking: booking._id,
      gateway: PAYMENT_GATEWAY.RAZORPAY,
      status: { $in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED] },
      amount: advanceAmount,
    }).sort({ createdAt: -1 });

    if (payment) {
      // The customer may have paid but never got back to us (closed the tab
      // before verification). Razorpay's own record settles it. An order
      // Razorpay no longer knows (e.g. created under other API keys) is
      // abandoned and replaced with a fresh one.
      const order = await getRazorpay()
        .orders.fetch(payment.razorpayOrderId)
        .catch((error) => {
          console.error("Razorpay order lookup failed, creating a new order:", describeRazorpayError(error));
          return null;
        });
      if (!order) payment = null;
      if (order?.status === "paid") {
        const { items } = await getRazorpay().orders.fetchPayments(payment.razorpayOrderId);
        const paid = items.find((p) => p.status === "captured" || p.status === "authorized");
        if (paid) {
          const result = await finalizePayment(payment, paid);
          const fresh = await Booking.findById(booking._id);
          return res.json({ success: true, data: { alreadyPaid: true, ...(await paymentResult(result, fresh)) } });
        }
      }
    }
    // Razorpay Checkout needs a contact number; customers registered before
    // phone numbers were collected add one from their account page first.
    const customer = await User.findById(req.user.id).select("name email phone");
    if (!customer?.phone) {
      return fail(
        res,
        next,
        400,
        "Please add your phone number to your profile before making a payment."
      );
    }

    if (!payment) {
      const order = await getRazorpay().orders.create({
        amount: toPaise(advanceAmount),
        currency: PAYMENT_CURRENCY,
        receipt: `bmh_${booking._id}`,
        notes: { bookingId: booking._id.toString(), customerId: req.user.id },
      });
      payment = await Payment.create({
        booking: booking._id,
        customer: req.user.id,
        amount: advanceAmount,
        currency: PAYMENT_CURRENCY,
        gateway: PAYMENT_GATEWAY.RAZORPAY,
        transactionId: order.id,
        razorpayOrderId: order.id,
        status: PAYMENT_STATUS.PENDING,
      });
    }

    res.status(201).json({
      success: true,
      data: {
        keyId: getRazorpayKeyId(),
        orderId: payment.razorpayOrderId,
        amount: toPaise(payment.amount), // paise, exactly as the order was created
        currency: payment.currency,
        advanceAmount: payment.amount,
        bookingId: booking._id,
        description: `Advance for ${booking.eventType} booking`,
        customer: { name: customer.name, email: customer.email, contact: toE164India(customer.phone) },
      },
    });
  } catch (error) {
    if (error instanceof PaymentError) return fail(res, next, error.status, error.message);
    if (error?.error?.description) {
      console.error("Razorpay order error:", describeRazorpayError(error));
      return fail(res, next, 502, "Could not start the payment. Please try again.");
    }
    next(error);
  }
};

// POST /api/payments/:bookingId/verify — called with Checkout's success
// callback. Safe to call more than once for the same payment.
export const verifyPayment = async (req, res, next) => {
  try {
    if (!isRazorpayConfigured()) {
      return fail(res, next, 503, "Online payment is not available right now. Please try again later.");
    }

    const booking = await loadOwnBooking(req, res, next);
    if (!booking) return;

    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body;

    const payment = await Payment.findOne({ booking: booking._id, razorpayOrderId: orderId });
    if (!payment) {
      return fail(res, next, 400, "This payment does not match any order for this booking");
    }

    // Already processed: return the same result instead of a second record.
    if (payment.status === PAYMENT_STATUS.SUCCESS) {
      if (payment.razorpayPaymentId !== paymentId) {
        return fail(res, next, 409, "This booking has already been paid for");
      }
      await Booking.updateOne(
        { _id: booking._id, status: BOOKING_STATUS.APPROVED },
        { $set: { status: BOOKING_STATUS.CONFIRMED } }
      );
      const fresh = await refreshBookingPayment(booking._id);
      return res.json({ success: true, data: { alreadyProcessed: true, ...(await paymentResult(payment, fresh)) } });
    }

    if (!isValidPaymentSignature(orderId, paymentId, signature)) {
      return fail(res, next, 400, "Payment verification failed. Your booking has not been confirmed.");
    }

    let rzpPayment;
    try {
      rzpPayment = await getRazorpay().payments.fetch(paymentId);
    } catch (error) {
      console.error("Razorpay payment fetch error:", describeRazorpayError(error));
      return fail(res, next, 502, "Could not confirm the payment with Razorpay. Please try again in a moment.");
    }

    const result = await finalizePayment(payment, rzpPayment, signature);
    const fresh = await Booking.findById(booking._id);
    res.json({ success: true, data: await paymentResult(result, fresh) });
  } catch (error) {
    if (error instanceof PaymentError) return fail(res, next, error.status, error.message);
    if (error?.error?.description) {
      console.error("Razorpay verification error:", describeRazorpayError(error));
      return fail(res, next, 502, "Could not confirm the payment with Razorpay. Please try again in a moment.");
    }
    next(error);
  }
};

// POST /api/payments/:bookingId/failure — Checkout reported a failed attempt.
// Recorded for reference only; never changes the booking. The customer can
// retry the same order.
export const recordPaymentFailure = async (req, res, next) => {
  try {
    const booking = await loadOwnBooking(req, res, next);
    if (!booking) return;

    await Payment.updateOne(
      {
        booking: booking._id,
        razorpayOrderId: req.body.razorpay_order_id,
        status: { $in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED] },
      },
      {
        $set: {
          status: PAYMENT_STATUS.FAILED,
          failureReason: String(req.body.reason || "Payment failed").slice(0, 300),
        },
      }
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// Owning customer or manager/owner. Returns the total cost, the configured
// advance percentage/amount (so the customer can see what's due before
// paying), the total paid so far (online + confirmed offline), the remaining
// balance and the payment history. Customers see only their successful
// payments; managers also see unconfirmed/cancelled offline records and who
// recorded/confirmed each one.
export const getPaymentForBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
      res.status(404);
      return next(new Error("Booking not found"));
    }

    const isOwner = Boolean(booking.customer) && booking.customer.toString() === req.user.id;
    const isManagement = [ROLES.MANAGER, ROLES.OWNER].includes(req.user.role);
    if (!isOwner && !isManagement) {
      res.status(403);
      return next(new Error("Not authorized to view payment information for this booking"));
    }

    res.json({ success: true, data: await buildPaymentSummary(booking, { forManagement: isManagement }) });
  } catch (error) {
    next(error);
  }
};

// ---- Offline payments (cash / UPI / bank transfer / other) ----
// Recorded by a manager/owner against a booking. A record only counts towards
// the booking's total once a manager confirms the money was actually
// received (status SUCCESS). Records are never deleted or edited after the
// fact — an unconfirmed one entered by mistake is cancelled (kept as FAILED).

// Payment can be taken once a booking has been approved — including the
// balance on (or after) the event day.
const OFFLINE_PAYABLE_STATUSES = [
  BOOKING_STATUS.APPROVED,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.UPCOMING,
  BOOKING_STATUS.COMPLETED,
];

const normalizeReference = (reference) => reference.replace(/\s+/g, "").toUpperCase();

const OFFLINE_STAFF_POPULATE = [
  { path: "recordedBy", select: "name email" },
  { path: "confirmedBy", select: "name email" },
  { path: "cancelledBy", select: "name email" },
];

const offlineResponse = async (payment) => {
  const booking = await Booking.findById(payment.booking);
  await payment.populate(OFFLINE_STAFF_POPULATE);
  return {
    payment,
    booking: { _id: booking._id, status: booking.status, paymentStatus: booking.paymentStatus },
    summary: await buildPaymentSummary(booking, { forManagement: true }),
  };
};

// POST /api/payments/booking/:bookingId/offline — records money received
// outside Razorpay. With confirmReceived: true the same manager also
// confirms it in one step (they have the money/transfer verified in hand);
// otherwise it waits, unconfirmed, for a "Confirm payment received" action.
export const recordOfflinePayment = async (req, res, next) => {
  try {
    const { amount, method, paymentDate, reference, notes, idempotencyKey, confirmReceived } = req.body;

    const payment = await withBookingPaymentLock(req.params.bookingId, async () => {
      const booking = await Booking.findById(req.params.bookingId);
      if (!booking) throw new PaymentError(404, "Booking not found");
      if (!OFFLINE_PAYABLE_STATUSES.includes(booking.status)) {
        throw new PaymentError(
          400,
          booking.status === BOOKING_STATUS.PENDING
            ? "Approve this booking before recording a payment for it"
            : "Payments can't be recorded for a rejected booking"
        );
      }

      if (idempotencyKey && (await Payment.exists({ idempotencyKey }))) {
        throw new PaymentError(409, "This payment has already been recorded");
      }

      // A transfer reference (UTR etc.) identifies one real transfer, so it
      // can't be recorded twice — on this or any other booking.
      const referenceKey = reference ? normalizeReference(reference) : undefined;
      if (
        referenceKey &&
        (await Payment.exists({
          gateway: PAYMENT_GATEWAY.OFFLINE,
          referenceKey,
          status: { $ne: PAYMENT_STATUS.FAILED },
        }))
      ) {
        throw new PaymentError(409, "A payment with this transaction reference has already been recorded");
      }

      // Recorded-but-unconfirmed amounts count here too, so open records can
      // never add up to more than is actually owed.
      const { totalPaid, pendingOfflineAmount } = await getPaymentTotals(booking._id);
      const remaining = remainingBalanceOf(booking.estimatedCost, totalPaid);
      const available = Math.max(0, remaining - pendingOfflineAmount);
      if (remaining <= 0) throw new PaymentError(409, "This booking is already fully paid");
      if (amount > available) {
        throw new PaymentError(
          400,
          pendingOfflineAmount > 0
            ? `Amount exceeds the outstanding balance: Rs. ${pendingOfflineAmount} of the Rs. ${remaining} due is already recorded and awaiting confirmation, so at most Rs. ${available} can be recorded`
            : `Amount exceeds the outstanding balance of Rs. ${remaining}`
        );
      }

      const now = new Date();
      const confirmNow = confirmReceived === true;
      try {
        return await Payment.create({
          booking: booking._id,
          customer: booking.customer || null,
          amount,
          currency: PAYMENT_CURRENCY,
          gateway: PAYMENT_GATEWAY.OFFLINE,
          method,
          transactionId: `OFF-${crypto.randomUUID()}`,
          status: confirmNow ? PAYMENT_STATUS.SUCCESS : PAYMENT_STATUS.PENDING,
          paidAt: new Date(paymentDate),
          reference: reference || undefined,
          referenceKey,
          notes: notes || undefined,
          recordedBy: req.user.id,
          recordedAt: now,
          ...(confirmNow && { confirmedBy: req.user.id, confirmedAt: now }),
          idempotencyKey: idempotencyKey || undefined,
        });
      } catch (error) {
        if (error?.code === 11000) throw new PaymentError(409, "This payment has already been recorded");
        throw error;
      }
    });

    await refreshBookingPayment(payment.booking);
    res.status(201).json({ success: true, data: await offlineResponse(payment) });
  } catch (error) {
    if (error instanceof PaymentError) return fail(res, next, error.status, error.message);
    next(error);
  }
};

// Loads an offline payment for confirm/cancel, refusing anything else — in
// particular Razorpay records, which only Razorpay's verification settles.
const loadOfflinePayment = async (paymentId) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new PaymentError(404, "Payment not found");
  if (payment.gateway !== PAYMENT_GATEWAY.OFFLINE) {
    throw new PaymentError(
      400,
      "Online (Razorpay) payments are confirmed only through Razorpay verification and can't be confirmed manually"
    );
  }
  return payment;
};

// POST /api/payments/offline/:paymentId/confirm — the manager confirms the
// money has actually been received. Only now does it count as paid.
export const confirmOfflinePayment = async (req, res, next) => {
  try {
    const { booking: bookingId } = await loadOfflinePayment(req.params.paymentId);

    const confirmed = await withBookingPaymentLock(bookingId, async () => {
      const payment = await loadOfflinePayment(req.params.paymentId);
      if (payment.status === PAYMENT_STATUS.SUCCESS) {
        throw new PaymentError(409, "This payment has already been confirmed");
      }
      if (payment.status !== PAYMENT_STATUS.PENDING) {
        throw new PaymentError(400, "This payment record was cancelled and can't be confirmed");
      }

      const booking = await Booking.findById(payment.booking);
      if (!booking) throw new PaymentError(404, "Booking not found");
      const { totalPaid } = await getPaymentTotals(booking._id);
      const remaining = remainingBalanceOf(booking.estimatedCost, totalPaid);
      if (payment.amount > remaining) {
        throw new PaymentError(
          400,
          `Confirming Rs. ${payment.amount} would exceed the outstanding balance of Rs. ${remaining}. Cancel this record instead.`
        );
      }

      // Conditional on PENDING, so a double-click can't confirm it twice.
      const updated = await Payment.findOneAndUpdate(
        { _id: payment._id, status: PAYMENT_STATUS.PENDING },
        { $set: { status: PAYMENT_STATUS.SUCCESS, confirmedBy: req.user.id, confirmedAt: new Date() } },
        { returnDocument: "after" }
      );
      if (!updated) throw new PaymentError(409, "This payment has already been confirmed");
      return updated;
    });

    await refreshBookingPayment(confirmed.booking);
    res.json({ success: true, data: await offlineResponse(confirmed) });
  } catch (error) {
    if (error instanceof PaymentError) return fail(res, next, error.status, error.message);
    next(error);
  }
};

// POST /api/payments/offline/:paymentId/cancel — withdraws an unconfirmed
// record (entered by mistake, or the transfer never arrived). Kept in the
// history as FAILED; confirmed payments can't be cancelled.
export const cancelOfflinePayment = async (req, res, next) => {
  try {
    const payment = await loadOfflinePayment(req.params.paymentId);
    if (payment.status === PAYMENT_STATUS.SUCCESS) {
      return fail(res, next, 400, "A confirmed payment can't be cancelled");
    }

    const updated = await Payment.findOneAndUpdate(
      { _id: payment._id, status: PAYMENT_STATUS.PENDING },
      {
        $set: {
          status: PAYMENT_STATUS.FAILED,
          failureReason: String(req.body.reason || "Cancelled by staff").slice(0, 300),
          cancelledBy: req.user.id,
          cancelledAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );
    if (!updated) return fail(res, next, 409, "This payment record has already been cancelled");

    await refreshBookingPayment(updated.booking);
    res.json({ success: true, data: await offlineResponse(updated) });
  } catch (error) {
    if (error instanceof PaymentError) return fail(res, next, error.status, error.message);
    next(error);
  }
};
