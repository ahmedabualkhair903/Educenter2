import type { Payment } from "@/types";

export const mockPayments: Payment[] = [
  {
    id: "payment-001",
    studentId: "student-001",
    amount: 1500,
    paymentMethod: "cash",
    paymentDate: "2026-08-20",
    notes: "دفع المصروفات الشهرية",
    createdAt: "2026-08-20",
  },
  {
    id: "payment-002",
    studentId: "student-002",
    amount: 1000,
    paymentMethod: "vodafone_cash",
    paymentDate: "2026-08-21",
    notes: "دفعة جزئية",
    createdAt: "2026-08-21",
  },
  {
    id: "payment-003",
    studentId: "student-003",
    amount: 2000,
    paymentMethod: "bank_transfer",
    paymentDate: "2026-08-22",
    createdAt: "2026-08-22",
  },
  {
    id: "payment-004",
    studentId: "student-004",
    amount: 750,
    paymentMethod: "instapay",
    paymentDate: "2026-08-23",
    notes: "دفعة أولى",
    createdAt: "2026-08-23",
  },
];