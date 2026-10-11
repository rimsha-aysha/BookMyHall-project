import { body } from "express-validator";

// Razorpay ids are short ASCII tokens ("order_…", "pay_…"); the signature is
// a hex HMAC. Shape checks only — authenticity is proven by the signature.
const razorpayId = (field, prefix) =>
  body(field)
    .isString()
    .withMessage(`${field} is required`)
    .bail()
    .matches(new RegExp(`^${prefix}_[A-Za-z0-9]{6,40}$`))
    .withMessage(`Invalid ${field}`);

export const paymentVerifyRules = [
  razorpayId("razorpay_order_id", "order"),
  razorpayId("razorpay_payment_id", "pay"),
  body("razorpay_signature")
    .isString()
    .withMessage("razorpay_signature is required")
    .bail()
    .matches(/^[a-f0-9]{64}$/)
    .withMessage("Invalid razorpay_signature"),
];

export const paymentFailureRules = [
  razorpayId("razorpay_order_id", "order"),
  body("reason").optional().isString().isLength({ max: 500 }),
];
