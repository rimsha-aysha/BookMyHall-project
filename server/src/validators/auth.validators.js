import { body } from "express-validator";
import { ALL_PERMISSIONS } from "../config/permissions.js";
import { INDIAN_MOBILE_REGEX, INVALID_PHONE_MESSAGE, normalizePhone } from "../utils/phone.js";

export const managerPermissionsUpdateRules = [
  body("permissions").isObject().withMessage("permissions must be an object"),
  body("permissions").custom((permissions) => {
    const keys = Object.keys(permissions || {});
    if (keys.length === 0) {
      throw new Error("At least one permission must be provided");
    }
    const invalidKey = keys.find((key) => !ALL_PERMISSIONS.includes(key));
    if (invalidKey) {
      throw new Error(`Unknown permission: ${invalidKey}`);
    }
    const nonBoolean = keys.find((key) => typeof permissions[key] !== "boolean");
    if (nonBoolean) {
      throw new Error(`Permission "${nonBoolean}" must be true or false`);
    }
    return true;
  }),
];

export const registerRules = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").trim().isEmail().withMessage("A valid email is required"),
  body("password")
    .isString()
    .withMessage("Password must be text")
    .bail()
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

export const loginRules = [
  body("email").trim().isEmail().withMessage("A valid email is required"),
  body("password").isString().withMessage("Password is required").bail().notEmpty().withMessage("Password is required"),
];

// Normalized to bare 10 digits before validation, so the stored value never
// carries formatting characters.
const phoneRule = () =>
  body("phone")
    .exists({ values: "falsy" })
    .withMessage("Phone number is required")
    .bail()
    .isString()
    .withMessage(INVALID_PHONE_MESSAGE)
    .bail()
    .customSanitizer(normalizePhone)
    .matches(INDIAN_MOBILE_REGEX)
    .withMessage(INVALID_PHONE_MESSAGE);

// Public customer sign-up. Staff accounts (coordinators/managers) are created
// with registerRules alone and have no phone requirement.
export const customerRegisterRules = [...registerRules, phoneRule()];

// PATCH /api/auth/me — the only field a customer can change on themselves.
export const phoneUpdateRules = [phoneRule()];
