import { body } from "express-validator";
import { isImageRef } from "./gallery.validators.js";

const listRules = [
  body("amenities").optional().isArray().withMessage("amenities must be an array of strings"),
  body("amenities.*").optional().isString(),
  body("images").optional().isArray({ max: 30 }).withMessage("images must be an array (max 30)"),
  body("images.*")
    .optional()
    .custom(isImageRef)
    .withMessage("Each image must be an uploaded image or an http(s) URL"),
];

export const hallCreateRules = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("capacity")
    .isInt({ min: 1 })
    .withMessage("Capacity must be a positive number"),
  body("price").isFloat({ min: 0 }).withMessage("Price must not be negative"),
  ...listRules,
];

export const hallUpdateRules = [
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
  body("capacity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Capacity must be a positive number"),
  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must not be negative"),
  ...listRules,
];
