export type LessonStatus =
  | "upcoming"
  | "ongoing"
  | "completed"
  | "cancelled";

export type Lesson = {
  id: string;
  subject: string;
  teacher: string;
  teacherId?: string;
  group: string;
  groupId?: string;
  title?: string;
  date: string;
  time: string;
  endTime?: string;
  duration: number;
  room: string;
  students: number;
  status: LessonStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
