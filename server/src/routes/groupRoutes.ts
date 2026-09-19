import { Router } from "express";
import { groupController } from "../controllers/groupController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin, requireRoles } from "../middleware/permissions.js";
import { validateBody } from "../middleware/validate.js";
import { CreateGroupSchema, EnrollStudentSchema, UpdateGroupSchema } from "../validators/index.js";
import { CreateLessonSchema, UpdateLessonSchema } from "../validators/index.js";

import { lessonController } from "../controllers/lessonController.js";

const router = Router();

router.use(authenticate);

// ─── Lesson endpoints (must precede /:id to prevent matching 'lessons' as id) ─
router.get("/lessons/all", asyncHandler(lessonController.list));
router.get("/lessons/:id", asyncHandler(lessonController.getById));
router.put("/lessons/:id", requireAdmin, validateBody(UpdateLessonSchema), asyncHandler(lessonController.update));
router.delete("/lessons/:id", requireAdmin, asyncHandler(lessonController.delete));
router.post(
  "/lessons/:id/cancel-alert",
  requireRoles(["admin", "owner", "teacher"]),
  asyncHandler(lessonController.cancelAlert),
);

// ─── Group CRUD ─────────────────────────────────────────────────────────────
router.get("/", asyncHandler(groupController.list));
router.get("/:id", asyncHandler(groupController.getById));
router.post("/", requireAdmin, validateBody(CreateGroupSchema), asyncHandler(groupController.create));
router.put("/:id", requireAdmin, validateBody(UpdateGroupSchema), asyncHandler(groupController.update));
router.delete("/:id", requireAdmin, asyncHandler(groupController.delete));

// ─── Group Lessons creation ──────────────────────────────────────────────────
router.post("/:groupId/lessons", requireAdmin, validateBody(CreateLessonSchema), asyncHandler(lessonController.create));
router.post("/:id/lessons/generate", requireAdmin, asyncHandler(lessonController.generate));

// ─── Group Students Membership ───────────────────────────────────────────────
router.get("/:id/students", asyncHandler(groupController.listStudents));
router.post("/:id/students", validateBody(EnrollStudentSchema), asyncHandler(groupController.enrollStudent));
router.delete("/:id/students/:studentId", asyncHandler(groupController.removeStudent));

// Frontend alias endpoints (/groups/:id/enroll)
router.post("/:id/enroll", validateBody(EnrollStudentSchema), asyncHandler(groupController.enrollStudent));
router.delete("/:id/enroll/:studentId", asyncHandler(groupController.removeStudent));

export default router;
