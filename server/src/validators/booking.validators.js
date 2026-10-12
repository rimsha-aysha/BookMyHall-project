import { body, param, query } from "express-validator";
import { BOOKING_STATUS } from "../config/bookingStatus.js";
import { ALL_PREPARATION_STATUSES } from "../config/preparationStatus.js";
import { normalizePhone, isValidIndianMobile, INVALID_PHONE_MESSAGE } from "../utils/phone.js";

export const TIME_FORMAT = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Bookings/availability checks are for today or later. Compared as
// YYYY-MM-DD strings in the server's local date, matching the date-only
// value the client's <input type="date"> sends.
const todayLocal = () => new Date().toLocaleDateString("en-CA");
const notInPast = (value) => {
  if (String(value).slice(0, 10) < todayLocal()) {
    throw new Error("Event date cannot be in the past");
  }
  return true;
};

export const bookingCreateRules = [
  body("hall").notEmpty().withMessage("Hall is required").bail().isMongoId().withMessage("Invalid hall id"),

  body("eventType").trim().notEmpty().withMessage("Event type is required"),

  body("eventDate")
    .notEmpty()
    .withMessage("Event date is required")
    .bail()
    .isISO8601()
    .withMessage("Event date must be a valid date")
    .bail()
    .custom(notInPast),

  body("startTime")
    .notEmpty()
    .withMessage("Start time is required")
    .bail()
    .matches(TIME_FORMAT)
    .withMessage("Start time must be in HH:mm 24-hour format"),

  body("endTime")
    .notEmpty()
    .withMessage("End time is required")
    .bail()
    .matches(TIME_FORMAT)
    .withMessage("End time must be in HH:mm 24-hour format")
    .bail()
    .custom((value, { req }) => {
      if (value <= req.body.startTime) {
        throw new Error("End time must be after start time");
      }
      return true;
    }),

  body("guestCount")
    .notEmpty()
    .withMessage("Guest count is required")
    .bail()
    .isInt({ min: 1 })
    .withMessage("Guest count must be at least 1"),

  body("requirements").optional().isString(),

  body("package").optional({ nullable: true }).isMongoId().withMessage("Invalid package id"),

  body("food").optional().isArray().withMessage("food must be an array of ids"),
  body("food.*").isMongoId().withMessage("Invalid food id"),

  body("decorations").optional().isArray().withMessage("decorations must be an array of ids"),
  body("decorations.*").isMongoId().withMessage("Invalid decoration id"),

  body("services").optional().isArray().withMessage("services must be an array of ids"),
  body("services.*").isMongoId().withMessage("Invalid service id"),
];

// confirmed is deliberately excluded — that transition only happens via a
// successful payment (see payment.controller.js), never through this endpoint.
export const bookingStatusUpdateRules = [
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .bail()
    .isIn([
      BOOKING_STATUS.APPROVED,
      BOOKING_STATUS.REJECTED,
      BOOKING_STATUS.UPCOMING,
      BOOKING_STATUS.COMPLETED,
    ])
    .withMessage("Status must be one of: approved, rejected, upcoming, completed"),
];

export const assignCoordinatorRules = [
  body("coordinatorId")
    .notEmpty()
    .withMessage("Coordinator is required")
    .bail()
    .isMongoId()
    .withMessage("Invalid coordinator id"),
];

// Same field shape as bookingCreateRules' date/time checks, but read from
// the query string since this is a read-only GET check.
export const checkAvailabilityRules = [
  query("guestCount").optional().isInt({ min: 1 }).withMessage("Guest count must be at least 1"),

  query("hall").notEmpty().withMessage("Hall is required").bail().isMongoId().withMessage("Invalid hall id"),

  query("eventDate")
    .notEmpty()
    .withMessage("Event date is required")
    .bail()
    .isISO8601()
    .withMessage("Event date must be a valid date")
    .bail()
    .custom(notInPast),

  query("startTime")
    .notEmpty()
    .withMessage("Start time is required")
    .bail()
    .matches(TIME_FORMAT)
    .withMessage("Start time must be in HH:mm 24-hour format"),

  query("endTime")
    .notEmpty()
    .withMessage("End time is required")
    .bail()
    .matches(TIME_FORMAT)
    .withMessage("End time must be in HH:mm 24-hour format")
    .bail()
    .custom((value, { req }) => {
      if (value <= req.query.startTime) {
        throw new Error("End time must be after start time");
      }
      return true;
    }),
];

export const preparationStatusUpdateRules = [
  body("preparationStatus")
    .notEmpty()
    .withMessage("Preparation status is required")
    .bail()
    .isIn(ALL_PREPARATION_STATUSES)
    .withMessage("Preparation status must be one of: not_started, in_progress, completed"),
];

// Calendar views are fetched one month at a time ("YYYY-MM").
const monthQueryRule = () =>
  query("month")
    .notEmpty()
    .withMessage("Month is required")
    .bail()
    .matches(/^(19|20)\d{2}-(0[1-9]|1[0-2])$/)
    .withMessage("Month must be in YYYY-MM format");

export const hallAvailabilityRules = [
  param("hallId").isMongoId().withMessage("Invalid hall id"),
  monthQueryRule(),
];

export const bookingCalendarRules = [
  monthQueryRule(),
  query("hall").optional({ values: "falsy" }).isMongoId().withMessage("Invalid hall id"),
];

// Walk-in booking (manager, at the venue): the same event/hall/selection
// rules as an online request, plus the customer's contact details since
// they may have no account. Phone is required so staff can reach them;
// email is optional.
export const walkInBookingRules = [
  ...bookingCreateRules,
  body("customerName")
    .isString()
    .withMessage("Customer name is required")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Customer name is required")
    .bail()
    .isLength({ max: 100 })
    .withMessage("Customer name must be at most 100 characters"),
  body("customerPhone")
    .isString()
    .withMessage("Customer phone number is required")
    .bail()
    .customSanitizer(normalizePhone)
    .custom((value) => {
      if (!isValidIndianMobile(value)) throw new Error(INVALID_PHONE_MESSAGE);
      return true;
    }),
  body("customerEmail")
    .optional({ values: "falsy" })
    .isString()
    .bail()
    .trim()
    .isEmail()
    .withMessage("Customer email must be a valid email address")
    .bail()
    .normalizeEmail({ gmail_remove_dots: false }),
];
