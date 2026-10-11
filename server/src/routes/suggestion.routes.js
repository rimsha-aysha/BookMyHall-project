import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { ROLES } from "../config/roles.js";
import { suggestionRules } from "../validators/suggestion.validators.js";
import { getSuggestions } from "../services/suggestions/index.js";

const router = Router();

// Customer-only, like the booking flow it lives in — it also reveals which
// halls are free for a slot, which is the same information check-availability
// gives a customer.
router.post("/", protect, authorize(ROLES.CUSTOMER), suggestionRules, validate, async (req, res, next) => {
  try {
    const data = await getSuggestions(req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
