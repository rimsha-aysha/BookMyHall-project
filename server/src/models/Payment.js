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
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
    // Last checkout failure reported for this order (shown for support only).
    failureReason: { type: String, default: undefined },
    paidAt: { type: Date },
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
// A booking can only ever have one successful payment.
paymentSchema.index(
  { booking: 1 },
  { unique: true, partialFilterExpression: { status: PAYMENT_STATUS.SUCCESS }, name: "one_success_per_booking" }
);

// The signature is kept as proof of verification but never sent to clients.
paymentSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.razorpaySignature;
    return ret;
  },
});

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
