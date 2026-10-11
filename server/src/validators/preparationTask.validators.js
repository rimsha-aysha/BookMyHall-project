import { body } from "express-validator";
import { ALL_TASK_STATUSES } from "../config/taskStatus.js";

// Status is the only thing a coordinator can change on a task.
export const taskStatusUpdateRules = [
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .bail()
    .isIn(ALL_TASK_STATUSES)
    .withMessage("Status must be one of: pending, in_progress, completed"),
];
