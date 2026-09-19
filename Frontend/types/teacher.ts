export type TeacherStatus = "active" | "inactive";

export type Teacher = {
  id: string;
  name: string;
  phone?: string | null;
  subject: string;
  notes?: string | null;
  status: TeacherStatus;
  createdAt: string;
  updatedAt: string;
};