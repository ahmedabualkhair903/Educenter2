import { Router } from "express";
import { reportController } from "../controllers/reportController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/permissions.js";

const router = Router();

router.use(authenticate);

router.get("/dashboard", asyncHandler(reportController.getDashboardStats));
router.get("/financial", requireAdmin, asyncHandler(reportController.getFinancialReport));
router.get("/attendance", asyncHandler(reportController.getAttendanceReport));

export default router;
