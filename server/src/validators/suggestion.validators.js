import { body } from "express-validator";
import { TIME_FORMAT } from "./booking.validators.js";

export const suggestionRules = [
  body("eventType").trim().notEmpty().withMessage("Event type is required"),
  body("guestCount")
    .notEmpty()
    .withMessage("Guest count is required")
    .bail()
    .isInt({ min: 1, max: 100000 })
    .withMessage("Guest count must be a positive number"),
  body("budget")
    .optional({ values: "falsy" })
    .isFloat({ min: 1 })
    .withMessage("Budget must be a positive amount"),
  body("foodPreference")
    .optional({ values: "falsy" })
    .isIn(["any", "veg", "non_veg"])
    .withMessage("Food preference must be any, veg or non_veg"),
  body("decorationStyle").optional({ values: "falsy" }).isString().isLength({ max: 40 }),
  body("serviceInterests").optional().isArray({ max: 10 }).withMessage("serviceInterests must be a list"),
  body("serviceInterests.*").optional().isString().isLength({ max: 40 }),
  body("requirements").optional().isString().isLength({ max: 500 }),
  body("eventDate").optional({ values: "falsy" }).isISO8601().withMessage("Event date must be a valid date"),
  body("startTime").optional({ values: "falsy" }).matches(TIME_FORMAT).withMessage("Start time must be HH:mm"),
  body("endTime")
    .optional({ values: "falsy" })
    .matches(TIME_FORMAT)
    .withMessage("End time must be HH:mm")
    .bail()
    .custom((value, { req }) => {
      if (req.body.startTime && value <= req.body.startTime) {
        throw new Error("End time must be after start time");
      }
      return true;
    }),
];
