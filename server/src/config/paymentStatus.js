// PENDING: a Razorpay order was created and checkout hasn't succeeded yet,
// or an offline payment was recorded but not yet confirmed by a manager.
// SUCCESS: payment verified server-side (Razorpay) or confirmed as received
// by a manager (offline) — the only status totals and reports count.
// FAILED: the customer's last checkout attempt for that order failed (they
// can retry the same order, which can still turn it into SUCCESS), or an
// unconfirmed offline record was cancelled by a manager (kept as history).
export const PAYMENT_STATUS = Object.freeze({
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
});

export const ALL_PAYMENT_STATUSES = Object.values(PAYMENT_STATUS);

// "mock" = records from the earlier simulated flow (kept as history).
// "offline" = money received outside Razorpay (cash, UPI, bank transfer…),
// recorded by a manager and counted only once a manager confirms it.
export const PAYMENT_GATEWAY = Object.freeze({
  MOCK: "mock",
  RAZORPAY: "razorpay",
  OFFLINE: "offline",
});

export const ALL_PAYMENT_GATEWAYS = Object.values(PAYMENT_GATEWAY);

// card/bank_transfer/cash come from the mock flow; the rest are the methods
// Razorpay reports for a captured payment. "other" is offline-only.
export const ALL_PAYMENT_METHODS = Object.freeze([
  "card",
  "bank_transfer",
  "cash",
  "upi",
  "netbanking",
  "wallet",
  "emi",
  "cardless_emi",
  "paylater",
  "other",
]);

// Methods a manager can choose when recording an offline payment.
export const OFFLINE_PAYMENT_METHODS = Object.freeze(["cash", "upi", "bank_transfer", "other"]);

export const PAYMENT_CURRENCY = "INR";

// Booking-level payment state, derived from the booking's SUCCESS payments
// (see services/paymentLedger.js) — never set by hand.
export const BOOKING_PAYMENT_STATUS = Object.freeze({
  UNPAID: "unpaid",
  PARTIALLY_PAID: "partially_paid",
  PAID: "paid",
});

export const ALL_BOOKING_PAYMENT_STATUSES = Object.values(BOOKING_PAYMENT_STATUS);
