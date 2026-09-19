import { api } from "@/lib/api";
import type { Payment } from "@/types";

export type CreatePaymentInput = Omit<Payment, "id" | "createdAt">;

export interface StudentFeeStatus {
  studentId: string;
  totalFees: number;
  totalPaid: number;
  balance: number;
  fees: Array<{
    id: string;
    feeName: string;
    amount: number;
    paidAmount: number;
    balance: number;
    dueDate: string | null;
    status: "paid" | "partial" | "unpaid";
  }>;
}

export const paymentService = {
  list: async (params?: {
    studentId?: string;
    groupId?: string;
    page?: number;
    limit?: number;
  }): Promise<Payment[]> => {
    const res = await api.get<Payment[]>("/payments", params as Record<string, string>);
    return res.data;
  },

  listByStudent: async (studentId: string): Promise<Payment[]> => {
    const res = await api.get<Payment[]>("/payments", { studentId });
    return res.data;
  },

  getStudentFeeStatus: async (
    studentId: string,
  ): Promise<StudentFeeStatus> => {
    const res = await api.get<StudentFeeStatus>(
      `/fees/student/${studentId}`,
    );
    return res.data;
  },

  createFee: async (fee: {
    studentId: string;
    groupId?: string | null;
    amountRequired: number;
    discount?: number;
    period: string;
    dueDate: string;
  }) => {
    const res = await api.post("/fees", fee);
    return res.data;
  },

  create: async (payment: CreatePaymentInput): Promise<Payment> => {
    const res = await api.post<Payment>("/payments", payment);
    return res.data;
  },

  update: async (
    id: string,
    updates: Partial<Payment>,
  ): Promise<Payment | null> => {
    try {
      const res = await api.put<Payment>(`/payments/${id}`, updates);
      return res.data;
    } catch {
      return null;
    }
  },

  delete: async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/payments/${id}`);
      return true;
    } catch {
      return false;
    }
  },
};
