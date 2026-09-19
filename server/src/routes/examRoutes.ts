import { Router } from "express";
import { examController } from "../controllers/examController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/permissions.js";
import { validateBody } from "../middleware/validate.js";
import { CreateExamSchema, UpdateExamSchema, UpsertExamResultSchema } from "../validators/index.js";

const router = Router();

router.use(authenticate);

// ─── Grade utility endpoints (must come before /:id to avoid param conflicts) ──
router.get("/grades/all", asyncHandler(examController.listAllResults));
router.get("/student/:studentId/results", asyncHandler(examController.listResultsByStudent));
router.put("/grades/:id", asyncHandler(examController.updateGrade));
router.delete("/grades/:id", requireAdmin, asyncHandler(examController.deleteGrade));

// ─── Exam CRUD ──────────────────────────────────────────────────────────────
router.get("/", asyncHandler(examController.list));
router.get("/:id", asyncHandler(examController.getById));
router.post("/", requireAdmin, validateBody(CreateExamSchema), asyncHandler(examController.create));
router.put("/:id", requireAdmin, validateBody(UpdateExamSchema), asyncHandler(examController.update));
router.delete("/:id", requireAdmin, asyncHandler(examController.delete));

// ─── Results per exam ────────────────────────────────────────────────────────
router.get("/:id/results", asyncHandler(examController.listResults));
router.get("/:examId/results/:studentId", asyncHandler(examController.getResultByStudent));
router.post("/:id/results", validateBody(UpsertExamResultSchema), asyncHandler((req, res) => {
  return examController.submitResults(req, res);
}));

export default router;
