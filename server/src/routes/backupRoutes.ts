import { Router } from "express";
import { backupController } from "../controllers/backupController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/permissions.js";

const router = Router();

router.use(authenticate, requireAdmin);

router.get("/", asyncHandler(backupController.list));
router.post("/create", asyncHandler(backupController.create));
router.post("/restore", asyncHandler(backupController.restore));

export default router;
