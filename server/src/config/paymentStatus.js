// PENDING: a Razorpay order was created and checkout hasn't succeeded yet.
// SUCCESS: payment verified server-side — the only status reports count.
// FAILED: the customer's last checkout attempt for that order failed (they
// can retry the same order, which can still turn it into SUCCESS).
export const PAYMENT_STATUS = Object.freeze({
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
});

export const ALL_PAYMENT_STATUSES = Object.values(PAYMENT_STATUS);

// "mock" = records from the earlier simulated flow (kept as history).
export const PAYMENT_GATEWAY = Object.freeze({
  MOCK: "mock",
  RAZORPAY: "razorpay",
});

export const ALL_PAYMENT_GATEWAYS = Object.values(PAYMENT_GATEWAY);

// card/bank_transfer/cash come from the mock flow; the rest are the methods
// Razorpay reports for a captured payment.
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
]);

export const PAYMENT_CURRENCY = "INR";
