// Labels for Payment.method — card/bank_transfer/cash from the earlier mock
// payments, the rest as reported by Razorpay; "other" is offline-only.
export const PAYMENT_METHOD_LABELS = Object.freeze({
  card: "Card",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
  upi: "UPI",
  netbanking: "Netbanking",
  wallet: "Wallet",
  emi: "EMI",
  cardless_emi: "Cardless EMI",
  paylater: "Pay Later",
  other: "Other",
});

// Methods staff can choose when recording an offline payment (same list the
// API accepts).
export const OFFLINE_PAYMENT_METHODS = Object.freeze(["cash", "upi", "bank_transfer", "other"]);

// Offline methods where the payer's transaction reference / UTR is required.
export const REFERENCE_REQUIRED_METHODS = Object.freeze(["upi", "bank_transfer"]);

export const PAYMENT_GATEWAY_LABELS = Object.freeze({
  razorpay: "Online · Razorpay",
  offline: "Offline",
  mock: "Mock (legacy)",
});

// One payment record's status. An offline record is "pending" until a
// manager confirms the money was received; "failed" offline = cancelled.
export const paymentRecordStatus = (payment) => {
  if (payment.status === "success") return { label: payment.gateway === "offline" ? "Confirmed" : "Success", tone: "success" };
  if (payment.gateway === "offline") {
    return payment.status === "pending"
      ? { label: "Awaiting confirmation", tone: "warning" }
      : { label: "Cancelled", tone: "neutral" };
  }
  return payment.status === "pending" ? { label: "Pending", tone: "warning" } : { label: "Failed", tone: "danger" };
};

// The booking's overall payment state (Booking.paymentStatus).
export const BOOKING_PAYMENT_STATUS_LABELS = Object.freeze({
  unpaid: "Unpaid",
  partially_paid: "Partially paid",
  paid: "Fully paid",
});

export const BOOKING_PAYMENT_STATUS_TONE = Object.freeze({
  unpaid: "neutral",
  partially_paid: "warning",
  paid: "success",
});
