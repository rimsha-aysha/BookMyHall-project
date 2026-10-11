import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import { ROLES } from "../config/roles.js";
import {
  getOverview,
  getManagerOverview,
  getCustomerDirectory,
  getPaymentList,
} from "../controllers/report.controller.js";

const router = Router();

router.get("/overview", protect, authorize(ROLES.OWNER), getOverview);
router.get(
  "/manager-overview",
  protect,
  authorize(ROLES.MANAGER, ROLES.OWNER),
  getManagerOverview
);
router.get("/customers", protect, authorize(ROLES.OWNER), getCustomerDirectory);
router.get("/payments", protect, authorize(ROLES.OWNER), getPaymentList);

export default router;
