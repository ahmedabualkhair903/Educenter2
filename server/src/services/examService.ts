import crypto from "node:crypto";
import { getDatabase } from "../database/db.js";
import { logAudit } from "../middleware/audit.js";
import type { Exam, ExamResult } from "../models/index.js";
import { examRepository } from "../repositories/examRepository.js";
import { groupRepository } from "../repositories/groupRepository.js";
import { studentRepository } from "../repositories/studentRepository.js";
import { AppError } from "../utils/response.js";
import { notificationService } from "./notificationService.js";

export const examService = {
  listAll(filters?: { groupId?: string; subject?: string }): Exam[] {
    return examRepository.listAll(filters);
  },

  getById(id: string): Exam {
    const exam = examRepository.findById(id);
    if (!exam) {
      throw new AppError("الاختبار غير موجود", 404, "EXAM_NOT_FOUND");
    }
    return exam;
  },

  create(data: {
    groupId: string;
    name: string;
    subject: string;
    examDate: string;
    maxScore: number;
    notes?: string | null;
  }, creatorId?: string, ip?: string): Exam {
    const group = groupRepository.findById(data.groupId);
    if (!group) {
      throw new AppError("المجموعة غير موجودة", 404, "GROUP_NOT_FOUND");
    }

    if (data.maxScore <= 0) {
      throw new AppError("الدرجة النهائية يجب أن تكون أكبر من صفر", 400, "INVALID_MAX_SCORE");
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    examRepository.create({
      id,
      group_id: data.groupId,
      name: data.name.trim(),
      subject: data.subject.trim(),
      exam_date: data.examDate,
      max_score: data.maxScore,
      notes: data.notes || null,
      sync_id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    });

    logAudit({
      userId: creatorId,
      action: "CREATE_EXAM",
      entityType: "EXAM",
      entityId: id,
      newData: data,
      ip,
    });

    return examRepository.findById(id)!;
  },

  update(id: string, updates: Partial<Exam>, updaterId?: string, ip?: string): Exam {
    const exam = this.getById(id);

    // تحقق مبكر من المجموعة لتفادي FOREIGN KEY / GROUP_NOT_FOUND الغامض
    if (updates.groupId !== undefined && updates.groupId !== null) {
      const groupId = String(updates.groupId).trim();
      if (!groupId) {
        throw new AppError("معرّف المجموعة مطلوب", 400, "INVALID_GROUP_ID");
      }
      const group = groupRepository.findById(groupId);
      if (!group) {
        throw new AppError("المجموعة غير موجودة", 404, "GROUP_NOT_FOUND");
      }
    }

    const payload: any = {};
    if (updates.groupId !== undefined) payload.group_id = updates.groupId;
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.subject !== undefined) payload.subject = updates.subject.trim();
    if (updates.examDate !== undefined) payload.exam_date = updates.examDate;
    if (updates.maxScore !== undefined) {
      if (updates.maxScore <= 0) throw new AppError("الدرجة النهائية يجب أن تكون أكبر من صفر", 400, "INVALID_MAX_SCORE");
      payload.max_score = updates.maxScore;
    }
    if (updates.notes !== undefined) payload.notes = updates.notes;

    examRepository.update(id, payload);

    logAudit({
      userId: updaterId,
      action: "UPDATE_EXAM",
      entityType: "EXAM",
      entityId: id,
      oldData: exam,
      newData: updates,
      ip,
    });

    return examRepository.findById(id)!;
  },

  delete(id: string, deleterId?: string, ip?: string): boolean {
    const exam = this.getById(id);
    examRepository.delete(id, deleterId);

    logAudit({
      userId: deleterId,
      action: "DELETE_EXAM",
      entityType: "EXAM",
      entityId: id,
      oldData: exam,
      ip,
    });

    return true;
  },

  listResults(examId: string): ExamResult[] {
    this.getById(examId);
    return examRepository.listResults(examId);
  },

  listAllResults(filters?: { examId?: string; studentId?: string }): ExamResult[] {
    return examRepository.listAllResults(filters);
  },

  submitResults(examId: string, results: { studentId: string; score: number | null; status?: "pending" | "approved"; notes?: string | null }[], recorderId?: string, ip?: string): ExamResult[] {
    const exam = this.getById(examId);
    const db = getDatabase();
    const now = new Date().toISOString();

    if (!Array.isArray(results) || results.length === 0) {
      throw new AppError("لا توجد درجات للإرسال", 400, "EMPTY_RESULTS");
    }

    for (const r of results) {
      if (!r.studentId || typeof r.studentId !== "string" || !r.studentId.trim()) {
        throw new AppError("معرّف الطالب مطلوب في كل نتيجة", 400, "INVALID_STUDENT_ID");
      }
      // تطبيع الدرجة: يقبل أرقام نصية من الـ Frontend
      if (typeof r.score === "string") {
        const trimmed = (r.score as unknown as string).trim();
        (r as any).score = trimmed === "" ? null : Number(trimmed);
      }
      const student = studentRepository.findById(r.studentId);
      if (!student) {
        throw new AppError("الطالب غير موجود", 404, "STUDENT_NOT_FOUND");
      }
      if (r.score !== null && r.score !== undefined && (typeof r.score !== "number" || Number.isNaN(r.score) || r.score < 0 || r.score > exam.maxScore)) {
        throw new AppError(`درجة الطالب يجب أن تكون بين 0 و ${exam.maxScore}`, 400, "INVALID_SCORE");
      }
    }

    db.transaction(() => {
      for (const r of results) {
        const id = crypto.randomUUID();
        examRepository.upsertResult({
          id,
          exam_id: examId,
          student_id: r.studentId,
          score: r.score,
          status: r.status || "approved",
          notes: r.notes || null,
          sync_id: crypto.randomUUID(),
          created_at: now,
          updated_at: now,
        });

        // WhatsApp trigger for approved score
        if (r.score !== null && r.status !== "pending") {
          const student = studentRepository.findById(r.studentId);
          if (student && (student.guardianPhone || student.phone)) {
            notificationService.onExamResult(
              student.name,
              student.guardianPhone || student.phone!,
              exam.name,
              r.score,
              exam.maxScore,
              student.id
            );
          }
        }
      }
    })();

    logAudit({
      userId: recorderId,
      action: "SUBMIT_EXAM_RESULTS",
      entityType: "EXAM",
      entityId: examId,
      newData: { examName: exam.name, count: results.length },
      ip,
    });

    return examRepository.listResults(examId);
  },

  listResultsByStudent(studentId: string): ExamResult[] {
    return examRepository.listAllResults({ studentId });
  },

  getResultByStudent(examId: string, studentId: string): ExamResult {
    const result = examRepository.findResultByStudent(examId, studentId);
    if (!result) {
      throw new AppError("نتيجة الاختبار غير موجودة", 404, "RESULT_NOT_FOUND");
    }
    return result;
  },

  updateGrade(id: string, updates: { score?: number | null; status?: string; notes?: string | null }, updaterId?: string, ip?: string): ExamResult {
    const existing = examRepository.findResultById(id);
    if (!existing) {
      throw new AppError("نتيجة الاختبار غير موجودة", 404, "RESULT_NOT_FOUND");
    }
    examRepository.updateResult(id, updates);
    logAudit({
      userId: updaterId,
      action: "UPDATE_GRADE",
      entityType: "EXAM_RESULT",
      entityId: id,
      oldData: { score: existing.score, status: existing.status },
      newData: updates,
      ip,
    });
    return examRepository.findResultById(id)!;
  },

  deleteGrade(id: string, deleterId?: string, ip?: string): void {
    const existing = examRepository.findResultById(id);
    if (!existing) {
      throw new AppError("نتيجة الاختبار غير موجودة", 404, "RESULT_NOT_FOUND");
    }
    examRepository.deleteResult(id);
    logAudit({
      userId: deleterId,
      action: "DELETE_GRADE",
      entityType: "EXAM_RESULT",
      entityId: id,
      ip,
    });
  },
};
