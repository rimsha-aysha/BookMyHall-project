import mongoose from "mongoose";
import {
  ALL_PAYMENT_STATUSES,
  PAYMENT_STATUS,
  ALL_PAYMENT_GATEWAYS,
  PAYMENT_GATEWAY,
  ALL_PAYMENT_METHODS,
  PAYMENT_CURRENCY,
} from "../config/paymentStatus.js";

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    // The booking's customer account. Offline payments for walk-in bookings
    // without an account have none.
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [
        function customerRequiredOnline() {
          return this.gateway !== PAYMENT_GATEWAY.OFFLINE;
        },
        "Customer is required",
      ],
      default: null,
    },
    // In rupees (whole units), as before. Razorpay itself works in paise.
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount must not be negative"],
    },
    currency: {
      type: String,
      default: PAYMENT_CURRENCY,
    },
    // Records created before Razorpay have no gateway field and read as "mock".
    gateway: {
      type: String,
      enum: ALL_PAYMENT_GATEWAYS,
      default: PAYMENT_GATEWAY.MOCK,
    },
    // Chosen at checkout for mock payments; reported by Razorpay once a
    // Razorpay payment succeeds (empty while still pending).
    method: {
      type: String,
      enum: ALL_PAYMENT_METHODS,
    },
    // The payment's reference shown in the UI. Mock: "MOCK-…". Razorpay: the
    // order id while pending, replaced by the Razorpay payment id on success.
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ALL_PAYMENT_STATUSES,
      default: PAYMENT_STATUS.PENDING,
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    // Last checkout failure reported for this order (shown for support only),
    // or why a manager cancelled an unconfirmed offline record.
    failureReason: { type: String, default: undefined },
    // Razorpay: when it was captured. Offline: the payment date the manager
    // entered (when the money was handed over / transferred).
    paidAt: { type: Date },

    // ---- Offline payments only (gateway "offline") ----
    // UTR / UPI transaction id / cheque or receipt number, as given by the
    // payer. Optional for cash. Never a password, PIN or account credential.
    reference: { type: String, trim: true, default: undefined },
    // Upper-cased reference without spaces — used to refuse recording the
    // same transfer twice.
    referenceKey: { type: String, default: undefined },
    notes: { type: String, trim: true, default: undefined },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: undefined },
    recordedAt: { type: Date, default: undefined },
    // Set only when a manager confirms the money was actually received.
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: undefined },
    confirmedAt: { type: Date, default: undefined },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: undefined },
    cancelledAt: { type: Date, default: undefined },
    // Client-generated id for one submission of the record form, so a
    // double-click / retried request can't create a second record.
    idempotencyKey: { type: String, default: undefined },
  },
  { timestamps: true }
);

// Duplicate protection. Partial, so the earlier mock records (which have no
// Razorpay ids) aren't affected.
paymentSchema.index(
  { razorpayOrderId: 1 },
  { unique: true, partialFilterExpression: { razorpayOrderId: { $type: "string" } } }
);
paymentSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: "string" } } }
);
// Razorpay only ever collects the advance, so a booking can have at most one
// successful Razorpay payment. Offline payments (advance and/or balance, in
// any number of instalments) are bounded by the booking's remaining balance
// instead (see services/paymentLedger.js). This replaces the earlier
// "one_success_per_booking" index, which is dropped at startup.
paymentSchema.index(
  { booking: 1 },
  {
    unique: true,
    partialFilterExpression: { status: PAYMENT_STATUS.SUCCESS, gateway: PAYMENT_GATEWAY.RAZORPAY },
    name: "one_razorpay_success_per_booking",
  }
);
paymentSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);
paymentSchema.index({ booking: 1, status: 1 });
paymentSchema.index({ referenceKey: 1 }, { partialFilterExpression: { referenceKey: { $type: "string" } } });

// The signature is kept as proof of verification but never sent to clients,
// nor are the internal duplicate-detection keys.
paymentSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.razorpaySignature;
    delete ret.referenceKey;
    delete ret.idempotencyKey;
    return ret;
  },
});

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
