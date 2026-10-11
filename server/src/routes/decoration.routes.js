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
  listActiveDecorations,
  getActiveDecorationById,
  listAllDecorations,
  createDecoration,
  updateDecoration,
  setDecorationStatus,
  deleteDecoration,
} from "../controllers/decoration.controller.js";

const router = Router();
const manageOnly = [
  protect,
  authorize(ROLES.MANAGER, ROLES.OWNER),
  requirePermission(PERMISSIONS.CATALOG_MANAGEMENT),
];

router.get("/", listActiveDecorations);
router.get("/manage/all", ...manageOnly, listAllDecorations);
router.get("/:id", getActiveDecorationById);

router.post("/", ...manageOnly, catalogCreateRules, validate, createDecoration);
router.put("/:id", ...manageOnly, catalogUpdateRules, validate, updateDecoration);
router.patch("/:id/status", ...manageOnly, setDecorationStatus);
router.delete("/:id", ...manageOnly, deleteDecoration);

export default router;
