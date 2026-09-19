import crypto from "node:crypto";
import { getDatabase } from "../database/db.js";
import { logAudit } from "../middleware/audit.js";
import { lessonRepository, type LessonRow } from "../repositories/lessonRepository.js";
import { groupRepository } from "../repositories/groupRepository.js";
import { teacherRepository } from "../repositories/teacherRepository.js";
import { notificationService } from "./notificationService.js";
import { AppError } from "../utils/response.js";

const ARABIC_WEEKDAYS: Record<string, number> = {
  "الأحد": 0,
  "الاثنين": 1,
  "الثلاثاء": 2,
  "الأربعاء": 3,
  "الخميس": 4,
  "الجمعة": 5,
  "السبت": 6,
};

function addMinutes(time: string, minutes: number): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return time;
  const total =
    (Number(match[1]) * 60 + Number(match[2]) + minutes) % (24 * 60);
  const normalized = total < 0 ? total + 24 * 60 : total;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export const lessonService = {
  list(filters?: { groupId?: string }): LessonRow[] {
    return lessonRepository.listAll(filters);
  },

  getById(id: string): LessonRow {
    const lesson = lessonRepository.findById(id);
    if (!lesson) {
      throw new AppError("الحصة غير موجودة", 404, "LESSON_NOT_FOUND");
    }
    return lesson;
  },

  create(groupId: string, data: any, creatorId?: string, ip?: string): LessonRow {
    const cleanGroupId = typeof groupId === "string" ? groupId.trim() : "";
    if (!cleanGroupId) {
      throw new AppError("معرّف المجموعة مطلوب", 400, "INVALID_GROUP_ID");
    }
    const group = groupRepository.findById(cleanGroupId);
    if (!group) {
      throw new AppError("المجموعة غير موجودة", 404, "GROUP_NOT_FOUND");
    }

    if (data.teacherId) {
      const teacher = teacherRepository.findById(data.teacherId);
      if (!teacher) {
        throw new AppError("المدرس المحدد غير موجود", 404, "TEACHER_NOT_FOUND");
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const startTime = (data.startTime || data.time || "12:00").trim();
    const rawStatus = typeof data.status === "string" ? data.status.trim() : "scheduled";
    const statusMap: Record<string, string> = {
      upcoming: "scheduled",
      scheduled: "scheduled",
      ongoing: "in_progress",
      in_progress: "in_progress",
      completed: "completed",
      cancelled: "cancelled",
      canceled: "cancelled",
    };
    const status = statusMap[rawStatus] ?? "scheduled";

    lessonRepository.create({
      id,
      groupId: cleanGroupId,
      title: data.title?.trim() || data.subject?.trim() || `${group.name} - حصة`,
      subject: data.subject?.trim() || null,
      teacherId: data.teacherId || null,
      room: data.room?.trim() || null,
      date: data.date || new Date().toISOString().split("T")[0],
      time: startTime,
      endTime: data.endTime || null,
      status,
      notes: data.notes,
      syncId: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });

    logAudit({
      userId: creatorId,
      action: "CREATE_LESSON",
      entityType: "LESSON",
      entityId: id,
      newData: { groupId, ...data },
      ip,
    });

    return lessonRepository.findById(id)!;
  },

  update(id: string, updates: any, updaterId?: string, ip?: string): LessonRow {
    const existing = this.getById(id);

    if (updates.teacherId) {
      const teacher = teacherRepository.findById(updates.teacherId);
      if (!teacher) {
        throw new AppError("المدرس المحدد غير موجود", 404, "TEACHER_NOT_FOUND");
      }
    }

    if (updates.groupId) {
      const group = groupRepository.findById(updates.groupId);
      if (!group) {
        throw new AppError("المجموعة غير موجودة", 404, "GROUP_NOT_FOUND");
      }
    }

    const normalized: any = { ...updates };
    if (normalized.startTime && !normalized.time) {
      normalized.time = normalized.startTime;
    }
    if (normalized.time && !normalized.startTime) {
      normalized.startTime = normalized.time;
    }
    if (typeof normalized.status === "string") {
      const statusMap: Record<string, string> = {
        upcoming: "scheduled",
        scheduled: "scheduled",
        ongoing: "in_progress",
        in_progress: "in_progress",
        completed: "completed",
        cancelled: "cancelled",
        canceled: "cancelled",
      };
      const mapped = statusMap[normalized.status.trim()];
      if (mapped) normalized.status = mapped;
    }
    if (normalized.subject && !normalized.title) {
      normalized.title = normalized.subject;
    }
    if (!normalized.teacherId) {
      delete normalized.teacherId;
    }
    if (!normalized.groupId) {
      delete normalized.groupId;
    }
    if (!normalized.room) {
      delete normalized.room;
    }

    lessonRepository.update(id, normalized);

    logAudit({
      userId: updaterId,
      action: "UPDATE_LESSON",
      entityType: "LESSON",
      entityId: id,
      oldData: existing,
      newData: updates,
      ip,
    });

    return lessonRepository.findById(id)!;
  },

  delete(id: string, deleterId?: string, ip?: string): boolean {
    const existing = this.getById(id);
    lessonRepository.delete(id);

    logAudit({
      userId: deleterId,
      action: "DELETE_LESSON",
      entityType: "LESSON",
      entityId: id,
      oldData: existing,
      ip,
    });

    return true;
  },

  /**
   * Auto-generate lesson rows for a group from its weekly schedule.
   * Idempotent: existing (date + start_time) rows are skipped.
   */
  generateForGroup(
    groupId: string,
    options?: { months?: number },
  ): { created: number; skipped: number } {
    const group = groupRepository.findById(groupId);
    if (!group) {
      throw new AppError("المجموعة غير موجودة", 404, "GROUP_NOT_FOUND");
    }

    const schedule = group.schedule || [];
    if (schedule.length === 0) {
      return { created: 0, skipped: 0 };
    }

    const months = Math.min(
      Math.max(options?.months ?? 3, 1),
      6,
    );

    const existingKeys = new Set(
      lessonRepository
        .listAll({ groupId })
        .map((lesson) => `${lesson.date}|${lesson.time}`),
    );

    const toAdd: Array<{
      date: string;
      time: string;
      endTime?: string;
    }> = [];

    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(cursor);
    end.setMonth(end.getMonth() + months);

    while (cursor <= end && toAdd.length < 1000) {
      const weekday = cursor.getDay();
      const year = cursor.getFullYear();
      const month = String(cursor.getMonth() + 1).padStart(2, "0");
      const day = String(cursor.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      for (const entry of schedule) {
        if (ARABIC_WEEKDAYS[entry.day?.trim()] !== weekday) {
          continue;
        }

        const startTime = (entry.startTime || "").trim();
        if (!/^\d{1,2}:\d{2}$/.test(startTime)) {
          continue;
        }

        const key = `${dateStr}|${startTime}`;
        if (existingKeys.has(key)) {
          continue;
        }
        existingKeys.add(key);

        toAdd.push({
          date: dateStr,
          time: startTime,
          endTime:
            entry.endTime?.trim() ||
            addMinutes(startTime, 60),
        });
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    if (toAdd.length === 0) {
      return { created: 0, skipped: 0 };
    }

    const db = getDatabase();
    const now = new Date().toISOString();
    let created = 0;

    db.transaction(() => {
      for (const item of toAdd) {
        lessonRepository.create({
          id: crypto.randomUUID(),
          groupId,
          title: group.subject || group.name,
          subject: group.subject || null,
          teacherId: group.teacherId || null,
          room: group.room || null,
          date: item.date,
          time: item.time,
          endTime: item.endTime,
          status: "scheduled",
          syncId: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        });
        created += 1;
      }
    })();

    return { created, skipped: 0 };
  },

  /**
   * Cancel a lesson and queue a WhatsApp alert to every
   * enrolled student of its group (guardian phone first).
   */
  cancelWithAlert(
    id: string,
    data: { message?: string },
    userId?: string,
    ip?: string,
  ): { lesson: LessonRow; notifiedCount: number } {
    const lesson = this.getById(id);
    const group = groupRepository.findById(lesson.groupId);
    if (!group) {
      throw new AppError("المجموعة غير موجودة", 404, "GROUP_NOT_FOUND");
    }

    lessonRepository.update(id, { status: "cancelled" } as Partial<LessonRow>);

    const reason = data.message?.trim();
    const text =
      `تنبيه من سنتر المنارة: تم إلغاء حصة ${lesson.subject || group.subject} ` +
      `لمجموعة ${group.name} المقررة بتاريخ ${lesson.date} الساعة ${lesson.time}.` +
      (reason ? ` ملاحظة: ${reason}` : "");

    const students =
      groupRepository.listStudentsInGroup(group.id);

    let notifiedCount = 0;
    for (const student of students) {
      const phone =
        student.guardianPhone || student.phone;
      if (!phone) {
        continue;
      }

      const queued = notificationService.queueMessage({
        studentId: student.id,
        recipientPhone: phone,
        type: "general",
        message: text,
      });

      if (queued) {
        notifiedCount += 1;
      }
    }

    logAudit({
      userId,
      action: "CANCEL_LESSON_WITH_ALERT",
      entityType: "LESSON",
      entityId: id,
      oldData: { status: lesson.status },
      newData: {
        status: "cancelled",
        notifiedCount,
      },
      ip,
    });

    return {
      lesson: lessonRepository.findById(id)!,
      notifiedCount,
    };
  },
};
