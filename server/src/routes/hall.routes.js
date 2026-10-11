import { Router } from "express";
import { protect, authorize, requirePermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { ROLES } from "../config/roles.js";
import { PERMISSIONS } from "../config/permissions.js";
import { hallCreateRules, hallUpdateRules } from "../validators/hall.validators.js";
import {
  listActiveHalls,
  getActiveHallById,
  listAllHalls,
  createHall,
  updateHall,
  setHallStatus,
  deleteHall,
} from "../controllers/hall.controller.js";

const router = Router();
const manageOnly = [
  protect,
  authorize(ROLES.MANAGER, ROLES.OWNER),
  requirePermission(PERMISSIONS.CATALOG_MANAGEMENT),
];

router.get("/", listActiveHalls);
router.get("/manage/all", ...manageOnly, listAllHalls);
router.get("/:id", getActiveHallById);

router.post("/", ...manageOnly, hallCreateRules, validate, createHall);
router.put("/:id", ...manageOnly, hallUpdateRules, validate, updateHall);
router.patch("/:id/status", ...manageOnly, setHallStatus);
router.delete("/:id", ...manageOnly, deleteHall);

export default router;
