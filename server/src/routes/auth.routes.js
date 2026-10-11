import { Router } from "express";
import {
  register,
  login,
  getMe,
  updateMe,
  listCoordinators,
  createCoordinator,
  setCoordinatorActiveStatus,
  listManagers,
  createManager,
  setManagerActiveStatus,
  getManagerPermissions,
  updateManagerPermissions,
} from "../controllers/auth.controller.js";
import {
  registerRules,
  customerRegisterRules,
  phoneUpdateRules,
  loginRules,
  managerPermissionsUpdateRules,
} from "../validators/auth.validators.js";
import { validate } from "../middleware/validate.js";
import { protect, authorize, requirePermission } from "../middleware/auth.js";
import { ROLES } from "../config/roles.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = Router();

router.post("/register", customerRegisterRules, validate, register);
router.post("/login", loginRules, validate, login);
router.get("/me", protect, getMe);
// A customer adds/updates their own phone number (the only editable field).
router.patch("/me", protect, authorize(ROLES.CUSTOMER), phoneUpdateRules, validate, updateMe);
router.get(
  "/coordinators",
  protect,
  authorize(ROLES.MANAGER, ROLES.OWNER),
  requirePermission(PERMISSIONS.COORDINATOR_MANAGEMENT),
  listCoordinators
);

router.post(
  "/coordinators",
  protect,
  authorize(ROLES.MANAGER, ROLES.OWNER),
  requirePermission(PERMISSIONS.COORDINATOR_MANAGEMENT),
  registerRules,
  validate,
  createCoordinator
);
router.patch(
  "/coordinators/:id/status",
  protect,
  authorize(ROLES.MANAGER, ROLES.OWNER),
  requirePermission(PERMISSIONS.COORDINATOR_MANAGEMENT),
  setCoordinatorActiveStatus
);

// Owner-only manager account management — Manager/Coordinator/Customer get 403.
router.get("/managers", protect, authorize(ROLES.OWNER), listManagers);
router.post("/managers", protect, authorize(ROLES.OWNER), registerRules, validate, createManager);
router.patch("/managers/:id/status", protect, authorize(ROLES.OWNER), setManagerActiveStatus);
router.get("/managers/:id/permissions", protect, authorize(ROLES.OWNER), getManagerPermissions);
router.patch(
  "/managers/:id/permissions",
  protect,
  authorize(ROLES.OWNER),
  managerPermissionsUpdateRules,
  validate,
  updateManagerPermissions
);

export default router;
