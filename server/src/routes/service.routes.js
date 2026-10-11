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
  listActiveServices,
  getActiveServiceById,
  listAllServices,
  createService,
  updateService,
  setServiceStatus,
  deleteService,
} from "../controllers/service.controller.js";

const router = Router();
const manageOnly = [
  protect,
  authorize(ROLES.MANAGER, ROLES.OWNER),
  requirePermission(PERMISSIONS.CATALOG_MANAGEMENT),
];

router.get("/", listActiveServices);
router.get("/manage/all", ...manageOnly, listAllServices);
router.get("/:id", getActiveServiceById);

router.post("/", ...manageOnly, catalogCreateRules, validate, createService);
router.put("/:id", ...manageOnly, catalogUpdateRules, validate, updateService);
router.patch("/:id/status", ...manageOnly, setServiceStatus);
router.delete("/:id", ...manageOnly, deleteService);

export default router;
