export type GroupStatus = "active" | "inactive";

export type GroupSchedule = {
  day: string;
  startTime: string;
  endTime?: string;
};

export type Group = {
  id: string;
  name: string;
  subject: string;
  grade: string;
  teacher: string;
  teacherId?: string;
  room?: string;
  maxStudents: number;
  capacity?: number;
  schedule: GroupSchedule[];
  status: GroupStatus;
  studentCount?: number;
  createdAt: string;
  updatedAt: string;
};
