import { Router } from "express";
import { protect, authorize, requirePermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { ROLES } from "../config/roles.js";
import { PERMISSIONS } from "../config/permissions.js";
import { taskStatusUpdateRules } from "../validators/preparationTask.validators.js";
import { listTasksForBooking, updateTaskStatus } from "../controllers/preparationTask.controller.js";

const router = Router();

// No create route: preparation tasks are generated from the booking's data
// when a coordinator is assigned (see services/preparationTasks.js).

router.get(
  "/booking/:bookingId",
  protect,
  authorize(ROLES.COORDINATOR, ROLES.MANAGER, ROLES.OWNER),
  requirePermission(PERMISSIONS.PREPARATION_MONITORING),
  listTasksForBooking
);

router.patch(
  "/:taskId/status",
  protect,
  authorize(ROLES.COORDINATOR),
  taskStatusUpdateRules,
  validate,
  updateTaskStatus
);

export default router;
