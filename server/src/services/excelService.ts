import crypto from "node:crypto";
import * as xlsx from "xlsx";
import { getDatabase } from "../database/db.js";
import { logAudit } from "../middleware/audit.js";
import type { Student } from "../models/index.js";
import { attendanceRepository } from "../repositories/attendanceRepository.js";
import { examRepository } from "../repositories/examRepository.js";
import { groupRepository } from "../repositories/groupRepository.js";
import { paymentRepository } from "../repositories/paymentRepository.js";
import { studentRepository } from "../repositories/studentRepository.js";
import { teacherRepository } from "../repositories/teacherRepository.js";
import { feeRepository } from "../repositories/feeRepository.js";
import { AppError } from "../utils/response.js";
import { examService } from "./examService.js";

/**
 * قراءة ملف Excel مع تحويل أي عطب في الملف إلى خطأ 400 واضح
 * بدل TypeError خام ينتهي كـ 500.
 */
function readWorkbook(fileBuffer: Buffer): xlsx.WorkBook {
  let workbook: xlsx.WorkBook;
  try {
    workbook = xlsx.read(fileBuffer, { type: "buffer" });
  } catch {
    throw new AppError(
      "تعذر قراءة الملف — تأكد أنه ملف Excel صالح (XLSX/XLS/CSV)",
      400,
      "INVALID_FILE"
    );
  }
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName || !workbook.Sheets[firstSheetName]) {
    throw new AppError("الملف لا يحتوي على أوراق عمل صالحة", 400, "EMPTY_EXCEL");
  }
  return workbook;
}

export const excelService = {
  // EXCEL IMPORT - STUDENTS
    previewImportStudents(fileBuffer: Buffer): {
    totalRows: number;
    validCount: number;
    duplicateCount: number;
    invalidCount: number;
    rows: Array<{
      rowNumber: number;
      name: string;
      studentCode?: string;
      phone?: string;
      guardianName?: string;
      guardianPhone: string;
      grade: string;
      groupId?: string;
      status: "valid" | "duplicate" | "invalid";
      reason?: string;
    }>;
  } {
    const workbook = readWorkbook(fileBuffer);
    const firstSheetName = workbook.SheetNames[0];

    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = xlsx.utils.sheet_to_json<any>(worksheet, { header: 1 });

    if (rawData.length <= 1) {
      throw new AppError("ملف الإكسيل فارغ أو يحتوي على العناوين فقط", 400, "EMPTY_EXCEL");
    }

    const headers = (rawData[0] as any[]).map((h) => String(h || "").trim().toLowerCase());
    
    // Find column indexes
    const nameIdx = headers.findIndex((h) => h.includes("اسم") || h.includes("name") || h.includes("طالب"));
    const codeIdx = headers.findIndex((h) => h.includes("كود") || h.includes("code") || h.includes("رقم الطالب") || h.includes("id"));
    const phoneIdx = headers.findIndex((h) => (h.includes("هاتف") || h.includes("phone") || h.includes("موبايل")) && !h.includes("ولي"));
    const guardianNameIdx = headers.findIndex((h) => h.includes("ولي الأمر") || h.includes("guardian"));
    const guardianPhoneIdx = headers.findIndex((h) => (h.includes("ولي") && (h.includes("هاتف") || h.includes("phone") || h.includes("موبايل"))) || h.includes("guardian phone"));
    const gradeIdx = headers.findIndex((h) => h.includes("صف") || h.includes("grade") || h.includes("مرحلة"));

    const rows: any[] = [];
    let validCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i] as any[];
      if (!row || row.length === 0 || row.every((c) => !c)) continue;

      const name = nameIdx !== -1 && row[nameIdx] ? String(row[nameIdx]).trim() : "";
      const studentCode = codeIdx !== -1 && row[codeIdx] ? String(row[codeIdx]).trim() : "";
      const phone = phoneIdx !== -1 && row[phoneIdx] ? String(row[phoneIdx]).trim() : undefined;
      const guardianName = guardianNameIdx !== -1 && row[guardianNameIdx] ? String(row[guardianNameIdx]).trim() : (name ? `ولي أمر ${name}` : "");
      const guardianPhone = guardianPhoneIdx !== -1 && row[guardianPhoneIdx] ? String(row[guardianPhoneIdx]).trim() : (phone || "");
      const grade = gradeIdx !== -1 && row[gradeIdx] ? String(row[gradeIdx]).trim() : "الصف الأول الثانوي";

      if (!name) {
        rows.push({
          rowNumber: i + 1,
          name,
          guardianPhone,
          grade,
          status: "invalid",
          reason: "اسم الطالب مفقود",
        });
        invalidCount++;
        continue;
      }

      if (!guardianPhone && !phone) {
        rows.push({
          rowNumber: i + 1,
          name,
          guardianPhone,
          grade,
          status: "invalid",
          reason: "رقم هاتف ولي الأمر أو الطالب مفقود",
        });
        invalidCount++;
        continue;
      }

      // Duplicate Check
      let isDuplicate = false;
      let duplicateReason = "";

      if (studentCode) {
        const existingByCode = studentRepository.findByCode(studentCode);
        if (existingByCode) {
          isDuplicate = true;
          duplicateReason = `كود الطالب (${studentCode}) مستخدم بالفعل للطالب: ${existingByCode.name}`;
        }
      }

      if (!isDuplicate && (phone || guardianPhone)) {
        const existingByPhone = studentRepository.findByPhone(phone || guardianPhone);
        if (existingByPhone.length > 0) {
          isDuplicate = true;
          duplicateReason = `رقم الهاتف مسجل مسبقاً للطالب: ${existingByPhone[0].name}`;
        }
      }

      if (isDuplicate) {
        rows.push({
          rowNumber: i + 1,
          name,
          studentCode,
          phone,
          guardianName,
          guardianPhone,
          grade,
          status: "duplicate",
          reason: duplicateReason,
        });
        duplicateCount++;
      } else {
        rows.push({
          rowNumber: i + 1,
          name,
          studentCode,
          phone,
          guardianName,
          guardianPhone,
          grade,
          status: "valid",
        });
        validCount++;
      }
    }

    return {
      totalRows: rows.length,
      validCount,
      duplicateCount,
      invalidCount,
      rows,
    };
  },

  commitImportStudents(
    students: Array<{
      name: string;
      studentCode?: string;
      phone?: string;
      guardianName?: string;
      guardianPhone: string;
      grade: string;
      groupId?: string;
    }>,
    creatorId?: string,
    ip?: string
  ): { importedCount: number } {
    const db = getDatabase();
    const now = new Date().toISOString();
    let importedCount = 0;

    db.transaction(() => {
      for (const s of students) {
        // Auto-generation only: any code coming from the Excel file is ignored
        // to guarantee uniqueness. The backend allocates STU-YYYY-XXXX.
        const studentCode = studentRepository.getNextStudentCode();
        const id = crypto.randomUUID();
        const barcode = studentCode;

        try {
          studentRepository.create({
            id,
            student_code: studentCode,
            full_name: s.name.trim(),
            phone: s.phone?.trim() || null,
            guardian_name: (s.guardianName || `ولي أمر ${s.name}`).trim(),
            guardian_phone: s.guardianPhone.trim(),
            grade: s.grade.trim(),
            group_id: s.groupId || null,
            status: "active",
            barcode,
            guardian_barcode: `G-${studentCode}`,
            custom_fields: "[]",
            created_by: creatorId || null,
            sync_id: crypto.randomUUID(),
            created_at: now,
            updated_at: now,
          });
        } catch (err: any) {
          // Race-condition safety inside bulk import: on UNIQUE collision,
          // allocate a fresh code once and retry this row.
          const msg = String(err?.message || "");
          const code = String(err?.code || "");
          const isUniqueViolation =
            code.includes("SQLITE_CONSTRAINT_UNIQUE") ||
            msg.includes("UNIQUE constraint failed: students.student_code") ||
            msg.includes("UNIQUE constraint failed: students.barcode");
          if (!isUniqueViolation) throw err;
          const retryCode = studentRepository.getNextStudentCode();
          studentRepository.create({
            id,
            student_code: retryCode,
            full_name: s.name.trim(),
            phone: s.phone?.trim() || null,
            guardian_name: (s.guardianName || `ولي أمر ${s.name}`).trim(),
            guardian_phone: s.guardianPhone.trim(),
            grade: s.grade.trim(),
            group_id: s.groupId || null,
            status: "active",
            barcode: retryCode,
            guardian_barcode: `G-${retryCode}`,
            custom_fields: "[]",
            created_by: creatorId || null,
            sync_id: crypto.randomUUID(),
            created_at: now,
            updated_at: now,
          });
        }

        if (s.groupId) {
          groupRepository.enrollStudent(id, s.groupId);
        }

        importedCount++;
      }
    })();

    logAudit({
      userId: creatorId,
      action: "EXCEL_IMPORT_STUDENTS",
      entityType: "STUDENT",
      newData: { count: importedCount },
      ip,
    });

    return { importedCount };
  },

  directImportStudents(fileBuffer: Buffer, creatorId?: string, ip?: string): { importedCount: number; skippedCount: number } {
    const preview = this.previewImportStudents(fileBuffer);
    const validStudents = preview.rows
      .filter((r) => r.status === "valid")
      .map((r) => ({
        name: r.name,
        studentCode: r.studentCode,
        phone: r.phone,
        guardianName: r.guardianName,
        guardianPhone: r.guardianPhone,
        grade: r.grade,
        groupId: r.groupId,
      }));

    const result = this.commitImportStudents(validStudents, creatorId, ip);
    return {
      importedCount: result.importedCount,
      skippedCount: preview.duplicateCount + preview.invalidCount,
    };
  },

  // EXCEL IMPORT - EXAM RESULTS
  previewImportResults(examId: string, fileBuffer: Buffer): {
    exam: any;
    totalRows: number;
    matchedCount: number;
    unmatchedCount: number;
    invalidCount: number;
    rows: Array<{
      rowNumber: number;
      rawIdentifier: string;
      studentId?: string;
      studentName?: string;
      score: number | null;
      status: "matched" | "unmatched" | "invalid";
      reason?: string;
    }>;
  } {
    const exam = examRepository.findById(examId);
    if (!exam) {
      throw new AppError("الاختبار غير موجود", 404, "EXAM_NOT_FOUND");
    }

    const workbook = readWorkbook(fileBuffer);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = xlsx.utils.sheet_to_json<any>(worksheet, { header: 1 });

    if (rawData.length <= 1) {
      throw new AppError("ملف الإكسيل فارغ", 400, "EMPTY_EXCEL");
    }

    const headers = (rawData[0] as any[]).map((h) => String(h || "").trim().toLowerCase());
    const idIdx = headers.findIndex((h) => h.includes("كود") || h.includes("code") || h.includes("رقم") || h.includes("هاتف") || h.includes("طالب") || h.includes("name"));
    const scoreIdx = headers.findIndex((h) => h.includes("درجة") || h.includes("score") || h.includes("نتيجة") || h.includes("grade"));

    const rows: any[] = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    let invalidCount = 0;

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i] as any[];
      if (!row || row.length === 0 || row.every((c) => !c)) continue;

      const rawIdentifier = idIdx !== -1 && row[idIdx] !== undefined ? String(row[idIdx]).trim() : "";
      const rawScore = scoreIdx !== -1 && row[scoreIdx] !== undefined ? Number(row[scoreIdx]) : null;

      if (!rawIdentifier) {
        rows.push({
          rowNumber: i + 1,
          rawIdentifier: "",
          score: rawScore,
          status: "invalid",
          reason: "معرف الطالب مفقود",
        });
        invalidCount++;
        continue;
      }

      if (rawScore !== null && (Number.isNaN(rawScore) || rawScore < 0 || rawScore > exam.maxScore)) {
        rows.push({
          rowNumber: i + 1,
          rawIdentifier,
          score: rawScore,
          status: "invalid",
          reason: `الدرجة غير صالحة. يجب أن تكون بين 0 و ${exam.maxScore}`,
        });
        invalidCount++;
        continue;
      }

      // Match student by code -> phone -> name
      let student: Student | undefined = studentRepository.findByCode(rawIdentifier);
      if (!student) {
        const phoneMatches = studentRepository.findByPhone(rawIdentifier);
        if (phoneMatches.length === 1) {
          student = phoneMatches[0];
        }
      }
      if (!student) {
        const nameMatches = studentRepository.searchFast(rawIdentifier, 2);
        if (nameMatches.length === 1) {
          student = nameMatches[0];
        }
      }

      if (student) {
        rows.push({
          rowNumber: i + 1,
          rawIdentifier,
          studentId: student.id,
          studentName: student.name,
          score: rawScore,
          status: "matched",
        });
        matchedCount++;
      } else {
        rows.push({
          rowNumber: i + 1,
          rawIdentifier,
          score: rawScore,
          status: "unmatched",
          reason: `تعذر العثور على طالب يطابق "${rawIdentifier}"`,
        });
        unmatchedCount++;
      }
    }

    return {
      exam,
      totalRows: rows.length,
      matchedCount,
      unmatchedCount,
      invalidCount,
      rows,
    };
  },

  commitImportResults(
    examId: string,
    results: Array<{ studentId: string; score: number | null }>,
    recorderId?: string,
    ip?: string
  ) {
    return examService.submitResults(examId, results, recorderId, ip);
  },

  directImportResults(
    examId: string,
    fileBuffer: Buffer,
    recorderId?: string,
    ip?: string
  ) {
    const preview = this.previewImportResults(examId, fileBuffer);
    const matchedResults = preview.rows
      .filter((r) => r.status === "matched" && r.studentId)
      .map((r) => ({
        studentId: r.studentId!,
        score: r.score,
      }));

    const results = this.commitImportResults(examId, matchedResults, recorderId, ip);
    return {
      importedCount: results.length,
      unmatchedCount: preview.unmatchedCount,
      invalidCount: preview.invalidCount,
    };
  },

  // EXCEL EXPORTS
  exportStudents(filters: any): Buffer {
    const { students } = studentRepository.list({ ...filters, limit: 10000 });
    const data = students.map((s, idx) => ({
      "م": idx + 1,
      "كود الطالب": s.studentId,
      "اسم الطالب": s.name,
      "رقم الهاتف": s.phone || "-",
      "اسم ولي الأمر": s.guardianName,
      "هاتف ولي الأمر": s.guardianPhone,
      "الصف الدراسي": s.grade,
      "المجموعة": s.groupName || "-",
      "المبلغ المطلوب": s.financial?.totalRequired || 0,
      "المدفوع": s.financial?.paid || 0,
      "المتبقي": s.financial?.remaining || 0,
      "حالة السداد": s.financial?.status === "paid" ? "مسدد" : s.financial?.status === "partial" ? "سداد جزئي" : "غير مسدد",
      "الحالة": s.status === "active" ? "نشط" : s.status === "suspended" ? "موقوف" : "غير نشط",
    }));

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "الطلاب");
    return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
  },

  exportPayments(filters: any): Buffer {
    const payments = paymentRepository.list({ ...filters, limit: 10000 });
    const data = payments.map((p, idx) => ({
      "م": idx + 1,
      "كود الطالب": p.studentCode || "-",
      "اسم الطالب": p.studentName,
      "المبلغ": p.amount,
      "طريقة الدفع": p.paymentMethod === "cash" ? "نقدي" : p.paymentMethod === "vodafone_cash" ? "فودافون كاش" : p.paymentMethod === "instapay" ? "انستاباي" : p.paymentMethod,
      "تاريخ الدفع": p.paymentDate,
      "المستلم": p.receivedByName || "-",
      "ملاحظات": p.notes || "-",
    }));

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "المدفوعات");
    return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
  },

  exportAttendance(filters: any): Buffer {
    const records = attendanceRepository.listRecords(filters);
    const data = records.map((r, idx) => ({
      "م": idx + 1,
      "كود الطالب": r.studentCode || "-",
      "اسم الطالب": r.studentName,
      "الحالة": r.status === "present" ? "حاضر" : r.status === "absent" ? "غائب" : r.status === "late" ? "متأخر" : "معذور",
      "وقت الحضور": r.checkedInAt || "-",
      "وقت الانصراف": r.checkedOutAt || "-",
      "طريقة التسجيل": r.method === "barcode" ? "باركود" : r.method === "qr" ? "QR" : "يدوي",
      "تاريخ التسجيل": r.createdAt.split("T")[0],
    }));

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "الحضور");
    return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
  },

  exportFees(filters: any): Buffer {
    const fees = feeRepository.listAll(filters);
    const data = fees.map((f, idx) => ({
      "م": idx + 1,
      "كود الطالب": f.studentCode || "-",
      "اسم الطالب": f.studentName || "-",
      "الفترة": f.period,
      "المبلغ المطلوب": f.amountRequired,
      "الخصم": f.discount,
      "المطلوب بعد الخصم": f.amountAfterDiscount,
      "المدفوع": f.paidAmount || 0,
      "المتبقي": f.remainingAmount || 0,
      "تاريخ الاستحقاق": f.dueDate,
      "حالة السداد": f.status === "paid" ? "مسدد" : f.status === "partial" ? "جزئي" : "غير مسدد",
    }));

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "الفواتير والمستحقات");
    return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
  },

  exportGroups(filters?: any): Buffer {
    const groups = groupRepository.listAll(filters);
    const data = groups.map((g, idx) => ({
      "م": idx + 1,
      "اسم المجموعة": g.name,
      "المدرس": g.teacher || "-",
      "المادة": g.subject,
      "الصف": g.grade,
      "القاعة": g.room || "-",
      "السعة": g.capacity || 30,
      "عدد الطلاب المسجلين": g.studentCount || 0,
      "المواعيد": g.schedule.map((s) => `${s.day} ${s.startTime}${s.endTime ? "-" + s.endTime : ""}`).join(", "),
      "الحالة": g.status === "active" ? "نشطة" : "غير نشطة",
    }));

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "المجموعات");
    return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
  },

  exportTeachers(): Buffer {
    const teachers = teacherRepository.listAll();
    const data = teachers.map((t, idx) => ({
      "م": idx + 1,
      "اسم المدرس": t.name,
      "رقم الهاتف": t.phone || "-",
      "المادة": t.subject,
      "ملاحظات": t.notes || "-",
      "الحالة": t.status === "active" ? "نشط" : "غير نشط",
    }));

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "المدرسين");
    return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
  },

  exportExamResults(examId: string): Buffer {
    const exam = examRepository.findById(examId);
    if (!exam) throw new AppError("الاختبار غير موجود", 404, "EXAM_NOT_FOUND");

    const results = examRepository.listResults(examId);
    const data = results.map((r, idx) => ({
      "م": idx + 1,
      "كود الطالب": r.studentCode || "-",
      "اسم الطالب": r.studentName,
      "الدرجة": r.score !== null ? r.score : "غائب",
      "الدرجة النهائية": exam.maxScore,
      "النسبة المئوية": r.score !== null ? `${Math.round((r.score / exam.maxScore) * 100)}%` : "-",
      "التقييم": r.score !== null ? (r.score >= exam.maxScore * 0.85 ? "ممتاز" : r.score >= exam.maxScore * 0.75 ? "جيد جداً" : r.score >= exam.maxScore * 0.5 ? "مقبول" : "ضعيف") : "-",
      "ملاحظات": r.notes || "-",
    }));

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, exam.name.substring(0, 30));
    return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
  },
};

