import { Router } from "express";
import { protect, authorize, requirePermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { ROLES } from "../config/roles.js";
import { PERMISSIONS } from "../config/permissions.js";
import {
  catalogCreateRules,
  catalogUpdateRules,
} from "../validators/catalogItem.validators.js";
import {
  listActivePackages,
  getActivePackageById,
  listAllPackages,
  createPackage,
  updatePackage,
  setPackageStatus,
  deletePackage,
} from "../controllers/package.controller.js";

const router = Router();
const manageOnly = [
  protect,
  authorize(ROLES.MANAGER, ROLES.OWNER),
  requirePermission(PERMISSIONS.CATALOG_MANAGEMENT),
];

router.get("/", listActivePackages);
router.get("/manage/all", ...manageOnly, listAllPackages);
router.get("/:id", getActivePackageById);

router.post("/", ...manageOnly, catalogCreateRules, validate, createPackage);
router.put("/:id", ...manageOnly, catalogUpdateRules, validate, updatePackage);
router.patch("/:id/status", ...manageOnly, setPackageStatus);
router.delete("/:id", ...manageOnly, deletePackage);

export default router;
