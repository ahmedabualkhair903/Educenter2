import { Router } from "express";
import { getDatabase } from "../database/db.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/permissions.js";
import { sendSuccess } from "../utils/response.js";

const router = Router();

router.use(authenticate, requireAdmin);

router.get("/", asyncHandler(async (req, res) => {
  const db = getDatabase();
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const logs = db.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?").all(limit, offset);
  return sendSuccess(res, logs);
}));

export default router;
