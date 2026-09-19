import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { sendSuccess } from "../utils/response.js";

const router = Router();

// Stub endpoint — still returns the same "coming soon" shape,
// but now requires authentication so student IDs cannot be probed anonymously.
router.get("/:studentId", authenticate, (req, res) => {
  return sendSuccess(res, null, "Parent portal endpoint - coming soon");
});

export default router;
