import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Booking from "../models/Booking.js";
import { BOOKING_STATUS } from "../config/bookingStatus.js";
import {
  PAYMENT_STATUS,
  PAYMENT_GATEWAY,
  PAYMENT_CURRENCY,
  BOOKING_PAYMENT_STATUS,
} from "../config/paymentStatus.js";
import { getOrCreateSettings } from "../controllers/settings.controller.js";
import { createKeyedLock } from "../utils/keyedLock.js";

// One place that knows how much of a booking has been paid. Every total is
// summed from the booking's SUCCESS Payment records (Razorpay-verified or
// manager-confirmed offline) — nothing is ever incremented — so the same
// payment can't be counted twice, whichever way it was paid.

// Single source of truth for the advance-amount calculation — used when
// charging online, when recording offline payments and when previewing it.
export const calculateAdvanceAmount = (totalCost, advancePercentage) =>
  Math.round((totalCost * advancePercentage) / 100);

// Serializes payment writes for the same booking (record/confirm offline,
// finalize Razorpay) so two of them can't both pass a balance check.
export const withBookingPaymentLock = (() => {
  const lock = createKeyedLock();
  return (bookingId, fn) => lock(bookingId.toString(), fn);
})();

// { totalPaid, pendingOfflineAmount } from the Payment records.
export const getPaymentTotals = async (bookingId) => {
  const [row] = await Payment.aggregate([
    { $match: { booking: new mongoose.Types.ObjectId(String(bookingId)) } },
    {
      $group: {
        _id: null,
        totalPaid: { $sum: { $cond: [{ $eq: ["$status", PAYMENT_STATUS.SUCCESS] }, "$amount", 0] } },
        pendingOfflineAmount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", PAYMENT_STATUS.PENDING] },
                  { $eq: ["$gateway", PAYMENT_GATEWAY.OFFLINE] },
                ],
              },
              "$amount",
              0,
            ],
          },
        },
      },
    },
  ]);
  return { totalPaid: row?.totalPaid || 0, pendingOfflineAmount: row?.pendingOfflineAmount || 0 };
};

// Only a booking whose whole cost has been received is "paid"; the advance
// alone leaves it partially paid. Nothing received means unpaid.
export const derivePaymentStatus = (totalCost, totalPaid) => {
  if (totalPaid <= 0) return BOOKING_PAYMENT_STATUS.UNPAID;
  if (totalCost > 0 && totalPaid >= totalCost) return BOOKING_PAYMENT_STATUS.PAID;
  return BOOKING_PAYMENT_STATUS.PARTIALLY_PAID;
};

export const remainingBalanceOf = (totalCost, totalPaid) => Math.max(0, totalCost - totalPaid);

// Recomputes the booking's cached amountPaid/paymentStatus from its Payment
// records, and confirms an approved booking once the advance is covered
// (by any mix of online and offline payments) — the same approved ->
// confirmed step a successful Razorpay payment has always made.
export const refreshBookingPayment = async (bookingId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) return null;

  const { totalPaid } = await getPaymentTotals(booking._id);
  const paymentStatus = derivePaymentStatus(booking.estimatedCost, totalPaid);
  await Booking.updateOne({ _id: booking._id }, { $set: { amountPaid: totalPaid, paymentStatus } });

  if (booking.status === BOOKING_STATUS.APPROVED && totalPaid > 0) {
    const settings = await getOrCreateSettings();
    const advanceAmount = calculateAdvanceAmount(booking.estimatedCost, settings.advancePaymentPercentage);
    if (totalPaid >= advanceAmount) {
      // Conditional, so re-running (or racing another refresh) is harmless.
      await Booking.updateOne(
        { _id: booking._id, status: BOOKING_STATUS.APPROVED },
        { $set: { status: BOOKING_STATUS.CONFIRMED } }
      );
    }
  }
  return Booking.findById(booking._id);
};

// Fields of a payment a customer may see about their own booking. Staff
// notes, who recorded it and internal keys stay with management.
const toCustomerPayment = (p) => ({
  _id: p._id,
  amount: p.amount,
  currency: p.currency,
  gateway: p.gateway,
  method: p.method,
  transactionId: p.gateway === PAYMENT_GATEWAY.OFFLINE ? p.reference || null : p.transactionId,
  status: p.status,
  paidAt: p.paidAt,
  createdAt: p.createdAt,
});

const STAFF_POPULATE = [
  { path: "recordedBy", select: "name email" },
  { path: "confirmedBy", select: "name email" },
  { path: "cancelledBy", select: "name email" },
];

// Everything the payment panels show: cost, advance, totals, balance and the
// payment history. `forManagement` adds unconfirmed/cancelled offline
// records and audit details; customers only ever see successful payments.
export const buildPaymentSummary = async (booking, { forManagement }) => {
  const settings = await getOrCreateSettings();
  const advanceAmount = calculateAdvanceAmount(booking.estimatedCost, settings.advancePaymentPercentage);

  // Abandoned Razorpay orders (still PENDING) aren't payments — leave them out.
  const historyFilter = forManagement
    ? {
        booking: booking._id,
        $or: [{ gateway: PAYMENT_GATEWAY.OFFLINE }, { status: { $ne: PAYMENT_STATUS.PENDING } }],
      }
    : { booking: booking._id, status: PAYMENT_STATUS.SUCCESS };

  let query = Payment.find(historyFilter).sort({ paidAt: 1, createdAt: 1 });
  if (forManagement) query = query.populate(STAFF_POPULATE);
  const [history, totals] = await Promise.all([query, getPaymentTotals(booking._id)]);

  const successful = history.filter((p) => p.status === PAYMENT_STATUS.SUCCESS);
  const latestSuccess = successful[successful.length - 1] || null;

  return {
    totalCost: booking.estimatedCost,
    advancePercentage: settings.advancePaymentPercentage,
    advanceAmount,
    currency: PAYMENT_CURRENCY,
    totalPaid: totals.totalPaid,
    remainingBalance: remainingBalanceOf(booking.estimatedCost, totals.totalPaid),
    // Still owed towards the advance (0 once the advance is covered).
    advanceDue: Math.max(0, advanceAmount - totals.totalPaid),
    paymentStatus: derivePaymentStatus(booking.estimatedCost, totals.totalPaid),
    ...(forManagement && { pendingOfflineAmount: totals.pendingOfflineAmount }),
    // Most recent successful payment — kept for pages written before
    // payment history existed.
    payment: latestSuccess && (forManagement ? latestSuccess : toCustomerPayment(latestSuccess)),
    payments: forManagement ? history : history.map(toCustomerPayment),
  };
};

// Startup migrations for offline payments, both idempotent:
//  1. The old index allowed only one successful payment per booking, which
//     would block an offline balance payment after an advance. It is
//     replaced by one_razorpay_success_per_booking (see models/Payment.js).
//  2. Bookings created before amountPaid/paymentStatus existed get them
//     filled in from their existing payments (no payment data is changed).
export const runPaymentMigrations = async () => {
  try {
    await Payment.collection.dropIndex("one_success_per_booking");
    console.log("Dropped legacy payment index one_success_per_booking");
  } catch (error) {
    // 27 = IndexNotFound, 26 = NamespaceNotFound (no payments collection yet)
    if (![26, 27].includes(error?.code)) throw error;
  }
  await Payment.createIndexes();

  const legacy = await Booking.find({ paymentStatus: { $exists: false } }).select("_id").lean();
  for (const { _id } of legacy) {
    const { totalPaid } = await getPaymentTotals(_id);
    const booking = await Booking.findById(_id).select("estimatedCost");
    await Booking.updateOne(
      { _id },
      { $set: { amountPaid: totalPaid, paymentStatus: derivePaymentStatus(booking.estimatedCost, totalPaid) } }
    );
  }
  if (legacy.length) console.log(`Filled in payment status for ${legacy.length} existing booking(s)`);
};
