import { body } from "express-validator";
import { ALL_ISSUE_STATUSES } from "../config/issueStatus.js";

export const issueCreateRules = [
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("description").optional().isString(),
];

export const issueStatusUpdateRules = [
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .bail()
    .isIn(ALL_ISSUE_STATUSES)
    .withMessage("Status must be one of: open, resolved"),
];
