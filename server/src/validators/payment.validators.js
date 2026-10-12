import { body, param } from "express-validator";
import { OFFLINE_PAYMENT_METHODS } from "../config/paymentStatus.js";

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

// ---- Offline payments ----

const todayLocal = () => new Date().toLocaleDateString("en-CA");

// UTR / UPI ref / cheque or receipt no. Letters, digits and - _ / . only, so
// it can't carry anything else; at least 6 characters, which also keeps a
// 4–6 digit UPI PIN from being typed in by mistake for UPI/bank transfers.
const REFERENCE_FORMAT = /^[A-Za-z0-9\-_/. ]{6,64}$/;
const REFERENCE_REQUIRED_FOR = ["upi", "bank_transfer"];

export const offlinePaymentRecordRules = [
  param("bookingId").isMongoId().withMessage("Invalid booking id"),
  body("amount")
    .exists({ values: "null" })
    .withMessage("Amount is required")
    .bail()
    .isInt({ min: 1, max: 100000000 })
    .withMessage("Amount must be a whole number of rupees, at least Rs. 1")
    .bail()
    .toInt(),
  body("method")
    .isIn(OFFLINE_PAYMENT_METHODS)
    .withMessage(`Payment method must be one of: ${OFFLINE_PAYMENT_METHODS.join(", ")}`),
  body("paymentDate")
    .notEmpty()
    .withMessage("Payment date is required")
    .bail()
    .isISO8601({ strict: true })
    .withMessage("Payment date must be a valid date")
    .bail()
    .custom((value) => {
      if (String(value).slice(0, 10) > todayLocal()) throw new Error("Payment date cannot be in the future");
      return true;
    }),
  body("reference")
    .optional({ values: "falsy" })
    .isString()
    .bail()
    .trim()
    .matches(REFERENCE_FORMAT)
    .withMessage("Transaction reference must be 6–64 letters/digits (e.g. the UTR or UPI reference number)"),
  body("reference").custom((value, { req }) => {
    if (REFERENCE_REQUIRED_FOR.includes(req.body.method) && !String(value || "").trim()) {
      throw new Error("Transaction reference / UTR number is required for UPI and bank transfer payments");
    }
    return true;
  }),
  body("notes").optional({ values: "falsy" }).isString().bail().trim().isLength({ max: 500 }).withMessage("Notes must be at most 500 characters"),
  body("idempotencyKey")
    .optional({ values: "falsy" })
    .isString()
    .bail()
    .matches(/^[A-Za-z0-9-]{8,64}$/)
    .withMessage("Invalid idempotency key"),
  body("confirmReceived").optional().isBoolean({ strict: true }).withMessage("confirmReceived must be true or false"),
];

export const offlinePaymentIdRules = [param("paymentId").isMongoId().withMessage("Invalid payment id")];

export const offlinePaymentCancelRules = [
  ...offlinePaymentIdRules,
  body("reason").optional({ values: "falsy" }).isString().bail().trim().isLength({ max: 300 }),
];
