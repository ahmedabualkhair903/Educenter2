import { logAudit } from "../middleware/audit.js";
import type { AppSettings } from "../models/index.js";
import { settingsRepository } from "../repositories/settingsRepository.js";
import { AppError } from "../utils/response.js";

export const settingsService = {
  getSettings(): AppSettings {
    return settingsRepository.getAll();
  },

  getRooms(): string[] {
    const rooms = settingsRepository.get<string[]>("rooms", []);
    if (Array.isArray(rooms) && rooms.length > 0) {
      return rooms;
    }
    return ["قاعة 1", "قاعة 2", "قاعة 3", "قاعة 4"];
  },

  addRoom(name: string, userId?: string, ip?: string): string[] {
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      throw new AppError("اسم القاعة يجب أن يكون حرفين على الأقل", 400, "INVALID_ROOM_NAME");
    }

    const rooms = this.getRooms();
    const exists = rooms.some(
      (room) => room.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (exists) {
      throw new AppError("هذه القاعة مسجلة بالفعل", 409, "ROOM_EXISTS");
    }

    const updated = [...rooms, cleanName];
    settingsRepository.set("rooms", updated);

    logAudit({
      userId,
      action: "ADD_ROOM",
      entityType: "SETTINGS",
      entityId: "rooms",
      newData: { name: cleanName },
      ip,
    });

    return updated;
  },

  getSubjects(): string[] {
    const subjects = settingsRepository.get<string[]>("subjects", []);
    if (Array.isArray(subjects) && subjects.length > 0) {
      return subjects;
    }
    return [
      "اللغة العربية",
      "اللغة الإنجليزية",
      "الرياضيات",
      "الفيزياء",
      "الكيمياء",
      "الأحياء",
      "الدراسات الاجتماعية",
      "العلوم",
    ];
  },

  addSubject(name: string, userId?: string, ip?: string): string[] {
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      throw new AppError("اسم المادة يجب أن يكون حرفين على الأقل", 400, "INVALID_SUBJECT_NAME");
    }

    const subjects = this.getSubjects();
    const exists = subjects.some(
      (subject) => subject.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (exists) {
      throw new AppError("هذه المادة مسجلة بالفعل", 409, "SUBJECT_EXISTS");
    }

    const updated = [...subjects, cleanName];
    settingsRepository.set("subjects", updated);

    logAudit({
      userId,
      action: "ADD_SUBJECT",
      entityType: "SETTINGS",
      entityId: "subjects",
      newData: { name: cleanName },
      ip,
    });

    return updated;
  },

  updateSettings(updates: Partial<AppSettings>, updaterId?: string, ip?: string): AppSettings {
    const oldSettings = settingsRepository.getAll();
    const updated = settingsRepository.saveAll(updates);

    logAudit({
      userId: updaterId,
      action: "UPDATE_SETTINGS",
      entityType: "SETTINGS",
      oldData: oldSettings,
      newData: updates,
      ip,
    });

    return updated;
  },
};
