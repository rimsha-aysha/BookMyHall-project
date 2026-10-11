import { body } from "express-validator";

export const settingsUpdateRules = [
  body("businessName").optional().trim().notEmpty().withMessage("Business name cannot be empty"),
  body("tagline").optional().isString(),
  body("contactEmail")
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage("Contact email must be a valid email"),
  body("contactPhone").optional().isString(),
  body("address").optional().isString(),
  body("policyNotes").optional().isString(),
  body("advancePaymentPercentage")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Advance payment percentage must be between 1 and 100"),
];
