import { Router } from "express";
import { teacherController } from "../controllers/teacherController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/permissions.js";
import { validateBody } from "../middleware/validate.js";
import { CreateTeacherSchema, UpdateTeacherSchema } from "../validators/index.js";

const router = Router();

router.use(authenticate);

router.get("/", asyncHandler(teacherController.list));
router.get("/:id", asyncHandler(teacherController.getById));
router.get("/:id/stats", asyncHandler(teacherController.getStats));
router.post("/", requireAdmin, validateBody(CreateTeacherSchema), asyncHandler(teacherController.create));
router.put("/:id", requireAdmin, validateBody(UpdateTeacherSchema), asyncHandler(teacherController.update));
router.delete("/:id", requireAdmin, asyncHandler(teacherController.delete));

export default router;
