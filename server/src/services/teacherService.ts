import crypto from "node:crypto";
import { logAudit } from "../middleware/audit.js";
import type { Teacher } from "../models/index.js";
import { teacherRepository } from "../repositories/teacherRepository.js";
import { AppError } from "../utils/response.js";

export const teacherService = {
  listAll(): Teacher[] {
    return teacherRepository.listAll();
  },

  getById(id: string): Teacher {
    const teacher = teacherRepository.findById(id);
    if (!teacher) {
      throw new AppError("المدرس غير موجود", 404, "TEACHER_NOT_FOUND");
    }
    return teacher;
  },

  getStats(teacherId: string) {
    const teacher = this.getById(teacherId);
    const stats = teacherRepository.getTeacherStats(teacherId);
    return {
      teacher,
      ...stats,
    };
  },

  create(data: { name: string; phone?: string | null; subject: string; notes?: string | null; status?: "active" | "inactive" }, creatorId?: string, ip?: string): Teacher {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    teacherRepository.create({
      id,
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      subject: data.subject.trim(),
      notes: data.notes || null,
      status: data.status || "active",
      sync_id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    });

    logAudit({
      userId: creatorId,
      action: "CREATE_TEACHER",
      entityType: "TEACHER",
      entityId: id,
      newData: data,
      ip,
    });

    return teacherRepository.findById(id)!;
  },

  update(id: string, updates: Partial<Teacher>, updaterId?: string, ip?: string): Teacher {
    const teacher = this.getById(id);

    teacherRepository.update(id, {
      name: updates.name?.trim(),
      phone: updates.phone?.trim(),
      subject: updates.subject?.trim(),
      notes: updates.notes,
      status: updates.status,
    });

    logAudit({
      userId: updaterId,
      action: "UPDATE_TEACHER",
      entityType: "TEACHER",
      entityId: id,
      oldData: teacher,
      newData: updates,
      ip,
    });

    return teacherRepository.findById(id)!;
  },

  delete(id: string, deletedBy?: string, ip?: string): boolean {
    const teacher = this.getById(id);
    teacherRepository.softDelete(id, deletedBy);

    logAudit({
      userId: deletedBy,
      action: "DELETE_TEACHER",
      entityType: "TEACHER",
      entityId: id,
      oldData: teacher,
      ip,
    });

    return true;
  },
};
