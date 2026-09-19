export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "vodafone_cash"
  | "instapay"
  | "other";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "كاش",
  bank_transfer: "تحويل بنكي",
  vodafone_cash: "محفظة إلكترونية (فودافون كاش)",
  instapay: "انستاباي",
  other: "أخرى",
};

export type PaymentStatus =
  | "paid"
  | "partial"
  | "unpaid";

export type Payment = {
  id: string;
  studentId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  /** Backend alias of paymentDate, kept for compatibility. */
  paidAt?: string;
  feeId?: string;
  notes?: string;
  createdAt: string;
};

export type StudentFinance = {
  studentId: string;
  totalRequired: number;
  paid: number;
  remaining: number;
  status: PaymentStatus;
};