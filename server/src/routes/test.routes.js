import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import { ROLES } from "../config/roles.js";

// Minimal routes to verify JWT auth + role authorization work end-to-end.
// Not a real business module.
const router = Router();

router.get("/protected", protect, (req, res) => {
  res.json({ success: true, message: `Hello, your role is ${req.user.role}` });
});

router.get(
  "/manager-only",
  protect,
  authorize(ROLES.MANAGER, ROLES.OWNER),
  (req, res) => {
    res.json({ success: true, message: "Manager/Owner access granted" });
  }
);

export default router;
