import { body } from "express-validator";

export const reviewCreateRules = [
  body("rating")
    .notEmpty()
    .withMessage("Rating is required")
    .bail()
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),
  body("comment").optional().isString(),
];
