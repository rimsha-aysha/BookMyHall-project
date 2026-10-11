import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.json({ success: true, message: "BookMyHall API is running" });
});

export default router;
