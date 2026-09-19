import { api } from "@/lib/api";
import type { Exam, Grade } from "@/types";

export type CreateExamInput = Omit<Exam, "id" | "createdAt">;
export type UpdateExamInput = Partial<Omit<Exam, "id" | "createdAt">>;

export const examService = {
  list: async (params?: {
    groupId?: string;
    subjectId?: string;
    page?: number;
    limit?: number;
  }): Promise<Exam[]> => {
    const res = await api.get<Exam[]>("/exams", params as Record<string, string>);
    return res.data;
  },

  getById: async (id: string): Promise<Exam | null> => {
    try {
      const res = await api.get<Exam>(`/exams/${id}`);
      return res.data;
    } catch {
      return null;
    }
  },

  create: async (exam: CreateExamInput): Promise<Exam> => {
    const res = await api.post<Exam>("/exams", exam);
    return res.data;
  },

  update: async (
    id: string,
    updates: UpdateExamInput,
  ): Promise<Exam | null> => {
    try {
      const res = await api.put<Exam>(`/exams/${id}`, updates);
      return res.data;
    } catch {
      return null;
    }
  },

  delete: async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/exams/${id}`);
      return true;
    } catch {
      return false;
    }
  },

  // ─── Grades ─────────────────────────────────────────────────────────────────

  grades: async (examId?: string): Promise<Grade[]> => {
    const params = examId ? { examId } : undefined;
    const res = await api.get<Grade[]>("/exams/grades/all", params);
    return res.data;
  },

  gradesByStudent: async (studentId: string): Promise<Grade[]> => {
    const res = await api.get<Grade[]>(`/exams/student/${studentId}/results`);
    return res.data;
  },

  gradeByExamAndStudent: async (
    examId: string,
    studentId: string,
  ): Promise<Grade | null> => {
    try {
      const res = await api.get<Grade>(`/exams/${examId}/results/${studentId}`);
      return res.data;
    } catch {
      return null;
    }
  },

  createGrade: async (grade: Omit<Grade, "id">): Promise<Grade> => {
    // الـ Backend يتوقع {results: [{studentId, score, status}]} — نرسل الصيغة الموثقة
    // مع دعم التوافق الخلفي للكائن المفرد داخل الكنترولر.
    const res = await api.post<Grade>(`/exams/${grade.examId}/results`, {
      results: [
        {
          studentId: grade.studentId,
          score: grade.score,
          status: grade.status ?? "pending",
        },
      ],
    });
    const data = res.data as unknown as Grade | Grade[];
    if (Array.isArray(data)) {
      const match = data.find(
        (r) => (r as Grade).studentId === grade.studentId,
      );
      if (match) return match;
      if (data.length > 0) return data[0];
      throw new Error("تعذر حفظ الدرجة");
    }
    return data;
  },

  updateGrade: async (
    id: string,
    updates: Partial<Grade>,
  ): Promise<Grade | null> => {
    try {
      const res = await api.put<Grade>(`/exams/grades/${id}`, updates);
      return res.data;
    } catch {
      return null;
    }
  },

  deleteGrade: async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/exams/grades/${id}`);
      return true;
    } catch {
      return false;
    }
  },
};
