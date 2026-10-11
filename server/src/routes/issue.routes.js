import { Router } from "express";
import { query } from "express-validator";
import { ALL_ISSUE_STATUSES } from "../config/issueStatus.js";
import { protect, authorize, requirePermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { ROLES } from "../config/roles.js";
import { PERMISSIONS } from "../config/permissions.js";
import { issueCreateRules, issueStatusUpdateRules } from "../validators/issue.validators.js";
import { createIssue, listIssuesForBooking, updateIssueStatus, listAllIssues } from "../controllers/issue.controller.js";

const router = Router();

router.get(
  "/",
  protect,
  authorize(ROLES.MANAGER, ROLES.OWNER),
  requirePermission(PERMISSIONS.ISSUE_MANAGEMENT),
  query("status").optional().isIn(ALL_ISSUE_STATUSES).withMessage("Invalid status"),
  validate,
  listAllIssues
);

router.post(
  "/booking/:bookingId",
  protect,
  authorize(ROLES.COORDINATOR),
  issueCreateRules,
  validate,
  createIssue
);

router.get(
  "/booking/:bookingId",
  protect,
  authorize(ROLES.COORDINATOR, ROLES.MANAGER, ROLES.OWNER),
  requirePermission(PERMISSIONS.ISSUE_MANAGEMENT),
  listIssuesForBooking
);

router.patch(
  "/:issueId/status",
  protect,
  authorize(ROLES.MANAGER, ROLES.OWNER),
  requirePermission(PERMISSIONS.ISSUE_MANAGEMENT),
  issueStatusUpdateRules,
  validate,
  updateIssueStatus
);

export default router;
