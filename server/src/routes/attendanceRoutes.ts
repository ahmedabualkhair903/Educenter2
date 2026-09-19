import { Router } from "express";
import { attendanceController } from "../controllers/attendanceController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { BarcodeAttendanceSchema, OpenAttendanceSessionSchema, RecordAttendanceSchema } from "../validators/index.js";

const router = Router();

router.use(authenticate);

// Sessions
router.get("/sessions", asyncHandler(attendanceController.listSessions));
router.post("/sessions", validateBody(OpenAttendanceSessionSchema), asyncHandler(attendanceController.createSession));
router.put("/sessions/:id/close", asyncHandler(attendanceController.closeSession));

// Checkouts (must be before /:id)
router.get("/checkouts", asyncHandler(attendanceController.listCheckouts));
router.get("/checkouts/:id", asyncHandler(attendanceController.getCheckoutById));
router.patch("/checkouts/:id", asyncHandler(attendanceController.updateCheckout));
router.delete("/checkouts/:id", asyncHandler(attendanceController.deleteCheckout));

// Suspicious cases (must be before /:id)
router.get("/suspicious", asyncHandler(attendanceController.listSuspicious));
router.post("/suspicious", asyncHandler(attendanceController.createSuspicious));
router.patch("/suspicious/:id", asyncHandler(attendanceController.updateSuspicious));

// Records — GET /attendance = alias for GET /attendance/records
router.get("/", asyncHandler(attendanceController.listRecords));
router.get("/records", asyncHandler(attendanceController.listRecords));
router.get("/:id", asyncHandler(attendanceController.getById));
router.patch("/:id", asyncHandler(attendanceController.updateStatus));
router.delete("/:id", asyncHandler(attendanceController.deleteRecord));
router.post("/:id/checkout", asyncHandler(attendanceController.checkOutRecord));

// Scanning
router.post("/scan", validateBody(BarcodeAttendanceSchema), asyncHandler(attendanceController.scan));
router.post("/check-in", validateBody(BarcodeAttendanceSchema), asyncHandler((req, res) => {
  req.body.checkOut = false;
  return attendanceController.scan(req, res);
}));
router.post("/check-out", validateBody(BarcodeAttendanceSchema), asyncHandler((req, res) => {
  req.body.checkOut = true;
  return attendanceController.scan(req, res);
}));
router.post("/manual", validateBody(RecordAttendanceSchema), asyncHandler(attendanceController.recordManual));

export default router;
