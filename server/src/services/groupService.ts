import crypto from "node:crypto";
import { logAudit } from "../middleware/audit.js";
import type { Group, GroupSchedule, Student } from "../models/index.js";
import { groupRepository } from "../repositories/groupRepository.js";
import { studentRepository } from "../repositories/studentRepository.js";
import { teacherRepository } from "../repositories/teacherRepository.js";
import { lessonService } from "./lessonService.js";
import { AppError } from "../utils/response.js";

export const groupService = {
  listAll(filters?: { grade?: string; status?: string; teacherId?: string }): Group[] {
    return groupRepository.listAll(filters);
  },

  getById(id: string): Group {
    const group = groupRepository.findById(id);
    if (!group) {
      throw new AppError("المجموعة غير موجودة", 404, "GROUP_NOT_FOUND");
    }
    return group;
  },

  create(data: {
    name: string;
    teacherId?: string | null;
    subject: string;
    grade: string;
    room?: string | null;
    capacity?: number;
    schedule?: GroupSchedule[];
    status?: "active" | "inactive";
  }, creatorId?: string, ip?: string): Group {
    if (data.teacherId) {
      const teacher = teacherRepository.findById(data.teacherId);
      if (!teacher) {
        throw new AppError("المدرس المحدد غير موجود", 404, "TEACHER_NOT_FOUND");
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    groupRepository.create({
      id,
      name: data.name.trim(),
      teacher_id: data.teacherId || null,
      subject: data.subject.trim(),
      grade: data.grade.trim(),
      room: data.room || null,
      capacity: data.capacity || 30,
      schedule: JSON.stringify(data.schedule || []),
      status: data.status || "active",
      sync_id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    });

    logAudit({
      userId: creatorId,
      action: "CREATE_GROUP",
      entityType: "GROUP",
      entityId: id,
      newData: data,
      ip,
    });

    // Best-effort auto-generation of upcoming lessons from the
    // weekly schedule — never blocks group creation on failure.
    try {
      lessonService.generateForGroup(id, { months: 3 });
    } catch {
      // Intentionally silent: lessons can be regenerated on demand.
    }

    return groupRepository.findById(id)!;
  },

  update(id: string, updates: Partial<Group>, updaterId?: string, ip?: string): Group {
    const group = this.getById(id);

    if (updates.teacherId) {
      const teacher = teacherRepository.findById(updates.teacherId);
      if (!teacher) {
        throw new AppError("المدرس المحدد غير موجود", 404, "TEACHER_NOT_FOUND");
      }
    }

    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.teacherId !== undefined) payload.teacher_id = updates.teacherId || null;
    if (updates.subject !== undefined) payload.subject = updates.subject.trim();
    if (updates.grade !== undefined) payload.grade = updates.grade.trim();
    if (updates.room !== undefined) payload.room = updates.room;
    if (updates.capacity !== undefined) payload.capacity = updates.capacity;
    if (updates.schedule !== undefined) payload.schedule = JSON.stringify(updates.schedule);
    if (updates.status !== undefined) payload.status = updates.status;

    groupRepository.update(id, payload);

    logAudit({
      userId: updaterId,
      action: "UPDATE_GROUP",
      entityType: "GROUP",
      entityId: id,
      oldData: group,
      newData: updates,
      ip,
    });

    return groupRepository.findById(id)!;
  },

  delete(id: string, deletedBy?: string, ip?: string): boolean {
    const group = this.getById(id);
    groupRepository.softDelete(id, deletedBy);

    logAudit({
      userId: deletedBy,
      action: "DELETE_GROUP",
      entityType: "GROUP",
      entityId: id,
      oldData: group,
      ip,
    });

    return true;
  },

  listStudents(groupId: string): Student[] {
    this.getById(groupId); // verify exists
    return groupRepository.listStudentsInGroup(groupId);
  },

  enrollStudent(groupId: string, studentId: string, enrollerId?: string, ip?: string): void {
    const group = this.getById(groupId);
    const student = studentRepository.findById(studentId);
    if (!student) {
      throw new AppError("الطالب غير موجود", 404, "STUDENT_NOT_FOUND");
    }

    groupRepository.enrollStudent(studentId, groupId);

    logAudit({
      userId: enrollerId,
      action: "ENROLL_STUDENT_GROUP",
      entityType: "STUDENT_GROUP",
      entityId: `${studentId}_${groupId}`,
      newData: { studentName: student.name, groupName: group.name },
      ip,
    });
  },

  removeStudent(groupId: string, studentId: string, removerId?: string, ip?: string): void {
    const group = this.getById(groupId);
    const student = studentRepository.findById(studentId);
    if (!student) {
      throw new AppError("الطالب غير موجود", 404, "STUDENT_NOT_FOUND");
    }

    groupRepository.removeStudentFromGroup(studentId, groupId);

    logAudit({
      userId: removerId,
      action: "REMOVE_STUDENT_GROUP",
      entityType: "STUDENT_GROUP",
      entityId: `${studentId}_${groupId}`,
      oldData: { studentName: student.name, groupName: group.name },
      ip,
    });
  },
};
