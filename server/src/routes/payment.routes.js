import { Router } from "express";
import { protect, authorize, requirePermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { ROLES } from "../config/roles.js";
import { PERMISSIONS } from "../config/permissions.js";
import { paymentVerifyRules, paymentFailureRules } from "../validators/payment.validators.js";
import {
  createPaymentOrder,
  verifyPayment,
  recordPaymentFailure,
  getPaymentForBooking,
} from "../controllers/payment.controller.js";

const router = Router();

// Razorpay (test mode) checkout for the booking's advance. Ownership and
// booking status are checked in the controller.
router.post("/:bookingId/order", protect, authorize(ROLES.CUSTOMER), createPaymentOrder);
router.post(
  "/:bookingId/verify",
  protect,
  authorize(ROLES.CUSTOMER),
  paymentVerifyRules,
  validate,
  verifyPayment
);
router.post(
  "/:bookingId/failure",
  protect,
  authorize(ROLES.CUSTOMER),
  paymentFailureRules,
  validate,
  recordPaymentFailure
);

// Authorization is refined inside the controller (owning customer, or
// manager/owner) — broadened here from manager/owner-only so the customer can
// see the advance amount due before paying. requirePermission only bites a
// Manager (see middleware/auth.js), so the customer's own access is unaffected.
router.get(
  "/booking/:bookingId",
  protect,
  authorize(ROLES.CUSTOMER, ROLES.MANAGER, ROLES.OWNER),
  requirePermission(PERMISSIONS.PAYMENT_VIEWING),
  getPaymentForBooking
);

export default router;
