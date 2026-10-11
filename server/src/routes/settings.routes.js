import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { ROLES } from "../config/roles.js";
import { settingsUpdateRules } from "../validators/settings.validators.js";
import { getSettings, updateSettings, getPublicSettings } from "../controllers/settings.controller.js";

const router = Router();

router.get("/public", getPublicSettings);
router.get("/", protect, authorize(ROLES.OWNER), getSettings);
router.put("/", protect, authorize(ROLES.OWNER), settingsUpdateRules, validate, updateSettings);

export default router;
