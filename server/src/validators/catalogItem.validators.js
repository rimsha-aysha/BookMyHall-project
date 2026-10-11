import { body } from "express-validator";

// Shared by Package, Food, Decoration and AdditionalService — all four have
// the same (name, description, price, category-ish) shape.
export const catalogCreateRules = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("price").isFloat({ min: 0 }).withMessage("Price must not be negative"),
];

export const catalogUpdateRules = [
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must not be negative"),
];
