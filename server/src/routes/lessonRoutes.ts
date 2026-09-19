import { Router } from "express";
import { lessonController } from "../controllers/lessonController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/permissions.js";
import { validateBody } from "../middleware/validate.js";
import { CreateLessonSchema, UpdateLessonSchema } from "../validators/index.js";

const router = Router();

router.use(authenticate);

router.get("/", asyncHandler(lessonController.list));
router.get("/:id", asyncHandler(lessonController.getById));
router.post("/", validateBody(CreateLessonSchema), asyncHandler(lessonController.create));
router.put("/:id", validateBody(UpdateLessonSchema), asyncHandler(lessonController.update));
router.delete("/:id", requireAdmin, asyncHandler(lessonController.delete));

export default router;
