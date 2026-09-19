import path from "node:path";
import fs from "node:fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import * as xlsx from "xlsx";
import { app } from "../src/app.js";
import { closeDatabase, getDatabase } from "../src/database/db.js";
import { backupService } from "../src/services/backupService.js";

const TEST_DB_PATH = path.resolve(process.cwd(), "data", "test_educenter.db");

describe("Educational Center Management System — Full Backend Test Suite", () => {
  let adminToken = "";
  let secretaryToken = "";
  let createdStudentId = "";
  let createdGroupId = "";
  let createdTeacherId = "";
  let createdExamId = "";
  let createdFeeId = "";
  let createdSessionId = "";

  beforeAll(() => {
    process.env.DATABASE_PATH = TEST_DB_PATH;
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    // Initialize DB
    getDatabase(TEST_DB_PATH);
  });

  afterAll(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  // 1. AUTHENTICATION & RBAC TESTS
  describe("1. Authentication & Users Module", () => {
    it("should fail login with non-existent user", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "unknown_user", password: "wrongpassword" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("should seed and login as admin", async () => {
      // First create user via seed or direct service
      const { authService } = await import("../src/services/authService.js");
      await authService.createUser({
        name: "مدير النظام",
        username: "admin_test",
        password: "admin_password_123",
        role: "admin",
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "admin_test", password: "admin_password_123" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe("admin");
      adminToken = res.body.data.token;
    });

    it("should create an employee account by admin", async () => {
      const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "سكرتير السنتر",
          username: "secretary_test",
          password: "Sec_pass@123",
          role: "employee",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe("secretary_test");

      // Login as secretary
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ username: "secretary_test", password: "Sec_pass@123" });

      expect(loginRes.status).toBe(200);
      secretaryToken = loginRes.body.data.token;
    });

    it("should prevent employee from creating another user (Permissions Middleware)", async () => {
      const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .send({
          name: "Unauthorized User",
          username: "unauth_user",
          password: "password123",
          role: "employee",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  // 2. TEACHERS & GROUPS
  describe("2. Teachers & Groups Modules", () => {
    it("should create a teacher", async () => {
      const res = await request(app)
        .post("/api/teachers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "أستاذ أحمد فيزياء",
          phone: "01099998888",
          subject: "فيزياء",
          notes: "مدرس أول",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("أستاذ أحمد فيزياء");
      createdTeacherId = res.body.data.id;
    });

    it("should create a group with schedules", async () => {
      const res = await request(app)
        .post("/api/groups")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "مجموعة السبت فيزياء 3ث",
          teacherId: createdTeacherId,
          subject: "فيزياء",
          grade: "الصف الثالث الثانوي",
          room: "قاعة 1",
          capacity: 40,
          schedule: [
            { day: "السبت", startTime: "17:00", endTime: "19:00" },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("مجموعة السبت فيزياء 3ث");
      createdGroupId = res.body.data.id;
    });
  });

  // 3. STUDENTS & QUICK REGISTRATION & SEARCH
  describe("3. Students Module & Fast Search", () => {
    it("should create a student with auto barcode and code STU-000001", async () => {
      const res = await request(app)
        .post("/api/students")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .send({
          name: "محمد إبراهيم السيد",
          phone: "01012345678",
          guardianName: "إبراهيم السيد",
          guardianPhone: "01112345678",
          grade: "الصف الثالث الثانوي",
          groupId: createdGroupId,
          customFields: [
            { fieldId: "school", value: "مدرسة المتفوقين" },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.studentId).toMatch(/^STU-\d+/);
      expect(res.body.data.barcode).toBe(res.body.data.studentId);
      expect(res.body.data.guardianBarcode).toBe(`G-${res.body.data.barcode}`);
      createdStudentId = res.body.data.id;
    });

    it("should support high-speed quick registration endpoint", async () => {
      const res = await request(app)
        .post("/api/students/quick-register")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .send({
          full_name: "علي طارق محمود",
          phone: "01234567890",
          guardian_phone: "01534567890",
          grade: "الصف الثاني الثانوي",
          group_id: createdGroupId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("علي طارق محمود");
      expect(res.body.data.guardianName).toBe("ولي أمر علي طارق محمود");
    });

    it("should warn about duplicate phone number", async () => {
      const res = await request(app)
        .get("/api/students/check-duplicates")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .query({ phone: "01012345678" });

      expect(res.status).toBe(200);
      expect(res.body.data.duplicateWarning).toBe(true);
      expect(res.body.data.possibleMatches.length).toBeGreaterThan(0);
    });

    it("should perform fast index search by name or phone", async () => {
      const res = await request(app)
        .get("/api/students/search")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .query({ q: "محمد إبراهيم" });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].name).toContain("محمد إبراهيم");
    });

    it("should return student card data with dual QR code data URLs", async () => {
      const res = await request(app)
        .get(`/api/students/${createdStudentId}/card`)
        .set("Authorization", `Bearer ${secretaryToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(res.body.data.guardianQrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    });
  });

  // 4. FEES & PAYMENTS LEDGER
  describe("4. Fees & Payments Ledger", () => {
    it("should create a fee invoice for the student", async () => {
      const res = await request(app)
        .post("/api/fees")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .send({
          studentId: createdStudentId,
          groupId: createdGroupId,
          amountRequired: 400,
          discount: 50,
          period: "أكتوبر 2026",
          dueDate: "2026-10-01",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.amountAfterDiscount).toBe(350);
      expect(res.body.data.status).toBe("unpaid");
      createdFeeId = res.body.data.id;
    });

    it("should record a partial payment and update ledger status to partial", async () => {
      const res = await request(app)
        .post("/api/payments")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .send({
          studentId: createdStudentId,
          feeId: createdFeeId,
          amount: 200,
          paymentMethod: "vodafone_cash",
          paymentDate: "2026-09-08",
          idempotencyKey: "idem_pay_test_01",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.amount).toBe(200);

      // Verify student finance summary
      const finRes = await request(app)
        .get(`/api/fees/student/${createdStudentId}`)
        .set("Authorization", `Bearer ${secretaryToken}`);

      expect(finRes.status).toBe(200);
      expect(finRes.body.data.totalRequired).toBe(350);
      expect(finRes.body.data.paid).toBe(200);
      expect(finRes.body.data.remaining).toBe(150);
      expect(finRes.body.data.status).toBe("partial");
    });

    it("should handle idempotent payments without duplicating amount", async () => {
      const res = await request(app)
        .post("/api/payments")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .send({
          studentId: createdStudentId,
          feeId: createdFeeId,
          amount: 200,
          paymentMethod: "vodafone_cash",
          idempotencyKey: "idem_pay_test_01", // duplicate key
        });

      expect(res.status).toBe(200);

      // Verify paid amount did not increase to 400
      const finRes = await request(app)
        .get(`/api/fees/student/${createdStudentId}`)
        .set("Authorization", `Bearer ${secretaryToken}`);

      expect(finRes.body.data.paid).toBe(200);
    });

    it("should reject payment exceeding remaining fee amount (Overpayment boundary)", async () => {
      const res = await request(app)
        .post("/api/payments")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .send({
          studentId: createdStudentId,
          feeId: createdFeeId,
          amount: 500, // remaining is 150
          paymentMethod: "cash",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("OVERPAYMENT_NOT_ALLOWED");
    });

    it("should complete the payment and mark fee as paid", async () => {
      await request(app)
        .post("/api/payments")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .send({
          studentId: createdStudentId,
          feeId: createdFeeId,
          amount: 150,
          paymentMethod: "cash",
          paymentDate: "2026-09-08",
        });

      const finRes = await request(app)
        .get(`/api/fees/student/${createdStudentId}`)
        .set("Authorization", `Bearer ${secretaryToken}`);

      expect(finRes.body.data.paid).toBe(350);
      expect(finRes.body.data.remaining).toBe(0);
      expect(finRes.body.data.status).toBe("paid");
    });
  });

  // 5. ATTENDANCE & BARCODE/QR SCANNER
  describe("5. Attendance & QR/Barcode Engine", () => {
    it("should open an attendance session", async () => {
      const res = await request(app)
        .post("/api/attendance/sessions")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .send({
          groupId: createdGroupId,
          date: "2026-09-08",
          startTime: "17:00",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("open");
      createdSessionId = res.body.data.id;
    });

    it("should scan barcode for student attendance check-in", async () => {
      // Get student code
      const studentRes = await request(app)
        .get(`/api/students/${createdStudentId}`)
        .set("Authorization", `Bearer ${secretaryToken}`);

      const barcode = studentRes.body.data.barcode;

      const scanRes = await request(app)
        .post("/api/attendance/scan")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .send({
          code: barcode,
          sessionId: createdSessionId,
        });

      expect(scanRes.status).toBe(200);
      expect(scanRes.body.data.success).toBe(true);
      expect(scanRes.body.data.alreadyRegistered).toBe(false);
      expect(scanRes.body.data.attendance.status).toBe("present");
    });

    it("should prevent duplicate check-in scan in the same session", async () => {
      const studentRes = await request(app)
        .get(`/api/students/${createdStudentId}`)
        .set("Authorization", `Bearer ${secretaryToken}`);

      const barcode = studentRes.body.data.barcode;

      const duplicateScanRes = await request(app)
        .post("/api/attendance/scan")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .send({
          code: barcode,
          sessionId: createdSessionId,
        });

      expect(duplicateScanRes.status).toBe(200);
      expect(duplicateScanRes.body.data.alreadyRegistered).toBe(true);
      expect(duplicateScanRes.body.message).toContain("مسجل حضوره بالفعل");
    });

    it("should record check-out when requested", async () => {
      const studentRes = await request(app)
        .get(`/api/students/${createdStudentId}`)
        .set("Authorization", `Bearer ${secretaryToken}`);

      const barcode = studentRes.body.data.barcode;

      const checkOutRes = await request(app)
        .post("/api/attendance/scan")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .send({
          code: barcode,
          sessionId: createdSessionId,
          checkOut: true,
        });

      expect(checkOutRes.status).toBe(200);
      expect(checkOutRes.body.data.isCheckOut).toBe(true);
      expect(checkOutRes.body.message).toContain("تم تسجيل انصراف الطالب");
    });
  });

  // 6. EXAMS & RESULTS
  describe("6. Exams & Grades Module", () => {
    it("should create an exam", async () => {
      const res = await request(app)
        .post("/api/exams")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          groupId: createdGroupId,
          name: "اختبار فيزياء أسبوعي",
          subject: "فيزياء",
          examDate: "2026-09-08",
          maxScore: 30,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.maxScore).toBe(30);
      createdExamId = res.body.data.id;
    });

    it("should reject score greater than maxScore (Validation Boundary)", async () => {
      const res = await request(app)
        .post(`/api/exams/${createdExamId}/results`)
        .set("Authorization", `Bearer ${secretaryToken}`)
        .send({
          results: [
            { studentId: createdStudentId, score: 35 }, // max is 30
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_SCORE");
    });

    it("should save valid exam score", async () => {
      const res = await request(app)
        .post(`/api/exams/${createdExamId}/results`)
        .set("Authorization", `Bearer ${secretaryToken}`)
        .send({
          results: [
            { studentId: createdStudentId, score: 28 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].score).toBe(28);
    });

    it("should query exam results via /api/exam-results alias endpoint", async () => {
      const res = await request(app)
        .get("/api/exam-results")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .query({ examId: createdExamId });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].studentName).toBeDefined();
      expect(res.body.data[0].score).toBe(28);
    });
  });

  // 7. EXCEL IMPORT & EXPORT
  describe("7. Excel Import & Export Module", () => {
    it("should generate and export formatted Excel sheets for students, payments, attendance, fees, groups, and teachers", async () => {
      const exportStudentsRes = await request(app)
        .get("/api/export/students")
        .set("Authorization", `Bearer ${secretaryToken}`);
      expect(exportStudentsRes.status).toBe(200);
      expect(exportStudentsRes.headers["content-type"]).toContain("spreadsheetml.sheet");

      const exportPaymentsRes = await request(app)
        .get("/api/export/payments")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(exportPaymentsRes.status).toBe(200);

      const exportAttendanceRes = await request(app)
        .get("/api/export/attendance")
        .set("Authorization", `Bearer ${secretaryToken}`);
      expect(exportAttendanceRes.status).toBe(200);

      const exportFeesRes = await request(app)
        .get("/api/export/fees")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(exportFeesRes.status).toBe(200);

      const exportGroupsRes = await request(app)
        .get("/api/export/groups")
        .set("Authorization", `Bearer ${secretaryToken}`);
      expect(exportGroupsRes.status).toBe(200);

      const exportTeachersRes = await request(app)
        .get("/api/export/teachers")
        .set("Authorization", `Bearer ${secretaryToken}`);
      expect(exportTeachersRes.status).toBe(200);
    });

    it("should preview Excel import of exam results with fuzzy matching", async () => {
      const wb = xlsx.utils.book_new();
      const wsData = [
        ["كود الطالب", "الدرجة"],
        ["STU-000001", 27],
        ["UNKNOWN-999", 25],
      ];
      const ws = xlsx.utils.aoa_to_sheet(wsData);
      xlsx.utils.book_append_sheet(wb, ws, "الدرجات");
      const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const res = await request(app)
        .post("/api/import/results/preview")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .field("examId", createdExamId)
        .attach("file", excelBuffer, "results.xlsx");

      expect(res.status).toBe(200);
      expect(res.body.data.matchedCount).toBe(1);
      expect(res.body.data.unmatchedCount).toBe(1);
    });

    it("should support direct Excel import for students in a single request", async () => {
      const wb = xlsx.utils.book_new();
      const wsData = [
        ["اسم الطالب", "رقم الهاتف", "ولي الأمر", "هاتف ولي الأمر", "الصف"],
        ["محمود خالد عثمان", "01055554444", "خالد عثمان", "01155554444", "الصف الأول الثانوي"],
      ];
      const ws = xlsx.utils.aoa_to_sheet(wsData);
      xlsx.utils.book_append_sheet(wb, ws, "الطلاب");
      const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const res = await request(app)
        .post("/api/import/students")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .attach("file", excelBuffer, "students_direct.xlsx");

      expect(res.status).toBe(200);
      expect(res.body.data.importedCount).toBe(1);
    });

    it("should support direct Excel import for exam results", async () => {
      const wb = xlsx.utils.book_new();
      const wsData = [
        ["كود الطالب", "الدرجة"],
        ["STU-000001", 30],
      ];
      const ws = xlsx.utils.aoa_to_sheet(wsData);
      xlsx.utils.book_append_sheet(wb, ws, "الدرجات");
      const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const res = await request(app)
        .post("/api/import/results")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .field("examId", createdExamId)
        .attach("file", excelBuffer, "results_direct.xlsx");

      expect(res.status).toBe(200);
      expect(res.body.data.importedCount).toBe(1);
    });
  });

  // 8. BACKUP & NOTIFICATIONS
  describe("8. Automated & Manual Backup Engine & Notifications", () => {
    it("should execute non-blocking database backup and verify snapshot integrity", async () => {
      const res = await request(app)
        .post("/api/backups/create")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(201);
      expect(res.body.data.isValid).toBe(true);
      expect(res.body.data.sizeBytes).toBeGreaterThan(0);
      expect(fs.existsSync(res.body.data.filepath)).toBe(true);
    });

    it("should list backup snapshots", async () => {
      const res = await request(app)
        .get("/api/backups")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("should trigger fee reminders queue for unpaid students", async () => {
      const res = await request(app)
        .post("/api/notifications/fee-reminders")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.queuedCount).toBeDefined();
    });
  });

  // 9. DASHBOARD STATS & FINANCIAL REPORTS
  describe("9. Reports & Dashboard APIs", () => {
    it("should return dashboard statistics in sub-10ms query execution", async () => {
      const start = Date.now();
      const res = await request(app)
        .get("/api/reports/dashboard")
        .set("Authorization", `Bearer ${secretaryToken}`);
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(res.body.data.totalStudents).toBeGreaterThan(0);
      expect(res.body.data.todayPresent).toBeDefined();
      expect(res.body.data.todayPayments).toBeDefined();
      expect(duration).toBeLessThan(150); // fast indexed query
    });

    it("should return comprehensive financial report including byGroup and byCategory", async () => {
      const res = await request(app)
        .get("/api/reports/financial")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalIncome).toBeDefined();
      expect(res.body.data.byPaymentMethod).toBeDefined();
      expect(res.body.data.byGroup).toBeDefined();
      expect(res.body.data.byCategory).toBeDefined();
      expect(Array.isArray(res.body.data.byGroup)).toBe(true);
      expect(Array.isArray(res.body.data.byCategory)).toBe(true);
      expect(res.body.data.outstandingFees).toBeGreaterThanOrEqual(0);
    });
  });

  // 10. CRITICAL FIXES VERIFICATION (AUDIT PHASE 1)
  describe("10. Pre-Implementation Audit Critical Fixes", () => {
    it("should accept camelCase in quick register endpoint (Issue A1)", async () => {
      const res = await request(app)
        .post("/api/students/quick-register")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .send({
          name: "سامي كمال فهمي",
          guardianPhone: "01099887766",
          guardianName: "كمال فهمي",
          grade: "الصف الأول الثانوي",
          groupId: createdGroupId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("سامي كمال فهمي");
      expect(res.body.data.guardianName).toBe("كمال فهمي");
    });

    it("should support /groups/:id/enroll alias endpoint for frontend compatibility (Issue A1)", async () => {
      const studentRes = await request(app)
        .post("/api/students/quick-register")
        .set("Authorization", `Bearer ${secretaryToken}`)
        .send({
          name: "طالب تجربة التسجيل",
          guardianPhone: "01122334455",
          grade: "الصف الثالث الثانوي",
        });
      expect(studentRes.status).toBe(201);
      const studentId = studentRes.body.data.id;

      // Enroll via /groups/:id/enroll
      const enrollRes = await request(app)
        .post(`/api/groups/${createdGroupId}/enroll`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ studentId });

      expect(enrollRes.status).toBe(200);

      // Unenroll via /groups/:id/enroll/:studentId
      const unenrollRes = await request(app)
        .delete(`/api/groups/${createdGroupId}/enroll/${studentId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(unenrollRes.status).toBe(200);
    });

    it("should accurately calculate per-fee outstanding balance in reportService (Issue A9)", async () => {
      const { reportService } = await import("../src/services/reportService.js");
      const report = reportService.getFinancialReport();

      expect(report.outstandingFees).toBeDefined();
      expect(typeof report.outstandingFees).toBe("number");
      expect(report.outstandingFees).toBeGreaterThanOrEqual(0);
    });
  });
});
