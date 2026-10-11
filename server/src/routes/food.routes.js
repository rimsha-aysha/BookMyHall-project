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
  listActiveFoods,
  getActiveFoodById,
  listAllFoods,
  createFood,
  updateFood,
  setFoodStatus,
  deleteFood,
} from "../controllers/food.controller.js";

const router = Router();
const manageOnly = [
  protect,
  authorize(ROLES.MANAGER, ROLES.OWNER),
  requirePermission(PERMISSIONS.CATALOG_MANAGEMENT),
];

router.get("/", listActiveFoods);
router.get("/manage/all", ...manageOnly, listAllFoods);
router.get("/:id", getActiveFoodById);

router.post("/", ...manageOnly, catalogCreateRules, validate, createFood);
router.put("/:id", ...manageOnly, catalogUpdateRules, validate, updateFood);
router.patch("/:id/status", ...manageOnly, setFoodStatus);
router.delete("/:id", ...manageOnly, deleteFood);

export default router;
