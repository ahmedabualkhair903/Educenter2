import type { ModuleKey } from "@/types";

export const DEFAULT_MODULES: Record<ModuleKey, boolean> = {
  students: true,
  groups: true,
  lessons: true,
  payments: true,
  exams: true,
  excel: true,
  attendance: true,
  checkOut: true,
  location: false,
  attendancePassword: false,
  whatsapp: true,
  resultMessages: true,
  attendanceMessages: true,
  checkOutMessages: false,
  absenceMessages: true,
  reports: true,
};
