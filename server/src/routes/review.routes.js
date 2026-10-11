import { Router } from "express";
import { param } from "express-validator";
import { protect, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { ROLES } from "../config/roles.js";
import { reviewCreateRules } from "../validators/review.validators.js";
import { createReview, getReviewForBooking, getHallReviews } from "../controllers/review.controller.js";

const router = Router();

router.get("/hall/:hallId", param("hallId").isMongoId().withMessage("Invalid hall id"), validate, getHallReviews);

router.post(
  "/booking/:bookingId",
  protect,
  authorize(ROLES.CUSTOMER),
  reviewCreateRules,
  validate,
  createReview
);

router.get(
  "/booking/:bookingId",
  protect,
  authorize(ROLES.CUSTOMER, ROLES.MANAGER, ROLES.OWNER),
  getReviewForBooking
);

export default router;
