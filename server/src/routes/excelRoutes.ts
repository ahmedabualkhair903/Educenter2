import { Router } from "express";
import multer from "multer";
import { excelController } from "../controllers/excelController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin, requireEmployeeOrAdmin } from "../middleware/permissions.js";

const EXCEL_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const EXCEL_MIMETYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "text/plain",
]);

function excelFileFilter(
  _req: unknown,
  file: { originalname: string; mimetype: string },
  cb: (error?: Error | null, accept?: boolean) => void,
): void {
  const name = (file.originalname || "").toLowerCase();
  const extOk = EXCEL_EXTENSIONS.some((ext) => name.endsWith(ext));
  // بعض المتصفحات ترسل CSV كنص عادي — الامتداد هو الفيصل الأساسي
  if (!extOk) {
    cb(new Error("FILE_TYPE_NOT_ALLOWED"), false);
    return;
  }
  if (file.mimetype && !EXCEL_MIMETYPES.has(file.mimetype)) {
    cb(new Error("FILE_TYPE_NOT_ALLOWED"), false);
    return;
  }
  cb(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: excelFileFilter,
});

const router = Router();

router.use(authenticate);

// Import Students
router.post("/import/students", requireEmployeeOrAdmin, upload.single("file"), asyncHandler(excelController.directImportStudents));
router.post("/import/students/preview", requireEmployeeOrAdmin, upload.single("file"), asyncHandler(excelController.previewStudents));
router.post("/import/students/commit", requireEmployeeOrAdmin, asyncHandler(excelController.commitStudents));

// Import Results
router.post("/import/results", requireEmployeeOrAdmin, upload.single("file"), asyncHandler(excelController.directImportResults));
router.post("/import/results/preview", requireEmployeeOrAdmin, upload.single("file"), asyncHandler(excelController.previewResults));
router.post("/import/results/commit", requireEmployeeOrAdmin, asyncHandler(excelController.commitResults));

// Exports
router.get("/export/students", requireEmployeeOrAdmin, asyncHandler(excelController.exportStudents));
router.get("/export/payments", requireAdmin, asyncHandler(excelController.exportPayments));
// Bulk PII exports — aligned with /export/students so any authenticated
// non-staff role cannot dump attendance/groups/teachers/exam data.
router.get("/export/attendance", requireEmployeeOrAdmin, asyncHandler(excelController.exportAttendance));
router.get("/export/fees", requireAdmin, asyncHandler(excelController.exportFees));
router.get("/export/groups", requireEmployeeOrAdmin, asyncHandler(excelController.exportGroups));
router.get("/export/teachers", requireEmployeeOrAdmin, asyncHandler(excelController.exportTeachers));
router.get("/export/exams/:id", requireEmployeeOrAdmin, asyncHandler(excelController.exportExamResults));

export default router;
