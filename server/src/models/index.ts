export type Role = "admin" | "employee" | "owner" | "secretary" | "teacher";

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  password_hash: string;
  role: Role;
  is_active: number;
  last_login_at?: string | null;
  sync_id?: string | null;
  sync_status?: string;
  created_at: string;
  updated_at: string;
}

export type StudentStatus = "active" | "inactive" | "suspended";

export interface StudentCustomFieldValue {
  fieldId: string;
  value: string | number | boolean | null;
}

export interface StudentCustomFieldDefinition {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea" | "boolean";
  required?: boolean;
  options?: string[];
  active: boolean;
  order: number;
  created_at?: string;
}

export interface StudentFinancialSummary {
  totalRequired: number;
  paid: number;
  remaining: number;
  status?: "paid" | "partial" | "unpaid";
}

export interface Student {
  id: string;
  studentId: string; // student_code
  name: string;      // full_name
  phone?: string;
  guardianName: string;
  guardianPhone: string;
  gender?: string;
  birthDate?: string;
  schoolName?: string;
  schoolGrade?: string;
  grade: string;
  groupId?: string;
  groupName?: string;
  address?: string;
  notes?: string;
  status: StudentStatus;
  barcode: string;
  guardianBarcode?: string;
  customFields: StudentCustomFieldValue[];
  financial?: StudentFinancialSummary;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  createdBy?: string;
  syncId?: string;
  syncStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Teacher {
  id: string;
  name: string;
  phone?: string;
  subject: string;
  notes?: string;
  status: "active" | "inactive";
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  syncId?: string;
  syncStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupSchedule {
  day: string;
  startTime: string;
  endTime?: string;
}

export interface Group {
  id: string;
  name: string;
  teacherId?: string;
  teacher?: string;
  subject: string;
  grade: string;
  room?: string;
  capacity?: number;
  maxStudents?: number;
  schedule: GroupSchedule[];
  status: "active" | "inactive";
  studentCount?: number;
  isDeleted?: boolean;
  deletedAt?: string;
  syncId?: string;
  syncStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentGroup {
  id: string;
  studentId: string;
  groupId: string;
  joinDate: string;
  leaveDate?: string | null;
  status: "active" | "left" | "suspended";
  createdAt: string;
}

export interface Lesson {
  id: string;
  groupId: string;
  title: string;
  date: string;
  startTime: string;
  endTime?: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface Fee {
  id: string;
  studentId: string;
  groupId?: string;
  amountRequired: number;
  discount: number;
  amountAfterDiscount: number;
  period: string;
  dueDate: string;
  status: "unpaid" | "partial" | "paid";
  paidAmount?: number;
  remainingAmount?: number;
  studentName?: string;
  studentCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  studentId: string;
  studentName?: string;
  studentCode?: string;
  feeId?: string;
  amount: number;
  paymentMethod: "cash" | "bank_transfer" | "vodafone_cash" | "instapay" | "other";
  paymentDate: string;
  paidAt?: string;
  notes?: string;
  receivedBy?: string;
  receivedByName?: string;
  idempotencyKey?: string;
  createdAt: string;
}

export interface AttendanceSession {
  id: string;
  groupId: string;
  groupName?: string;
  lessonId?: string;
  date: string;
  startTime: string;
  endTime?: string;
  status: "open" | "closed";
  passwordEnabled?: boolean;
  password?: string;
  qrCode?: string;
  openedBy?: string;
  closedBy?: string;
  openedAt?: string;
  closedAt?: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  groupId: string;
  lessonId?: string;
  student?: string;
  studentName?: string;
  studentCode?: string;
  phone?: string;
  status: "present" | "absent" | "late" | "excused" | "unrecorded";
  checkedInAt?: string;
  checkedOutAt?: string;
  method?: "barcode" | "qr" | "manual";
  locationStatus?: "allowed" | "outside" | "unknown";
  deviceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SuspiciousAttendanceCase {
  id: string;
  attendanceIds: string[];
  studentIds: string[];
  studentNames?: string[];
  reason: string;
  deviceId?: string;
  status: "pending" | "approved" | "rejected";
  note?: string;
  detectedAt: string;
  createdAt: string;
}

export interface Exam {
  id: string;
  groupId: string;
  groupName?: string;
  name: string;
  subject: string;
  examDate: string;
  date?: string;
  maxScore: number;
  notes?: string;
  resultsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExamResult {
  id: string;
  examId: string;
  studentId: string;
  studentName?: string;
  studentCode?: string;
  score: number | null;
  status: "pending" | "approved";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  category: "Rent" | "Electricity" | "Salaries" | "Printing" | "Maintenance" | "Internet" | "Supplies" | "Other";
  amount: number;
  description?: string;
  expenseDate: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  studentId?: string;
  recipientPhone: string;
  type: "check_in" | "check_out" | "exam_result" | "fee_reminder" | "payment_receipt" | "absence" | "general";
  message: string;
  status: "pending" | "processing" | "sent" | "failed";
  retryCount: number;
  scheduledAt: string;
  sentAt?: string;
  error?: string;
  createdAt: string;
  whatsappAccountId?: string;
}

export interface WhatsAppAccount {
  id: string;
  phoneNumber: string;
  providerName: string;
  apiUrl: string;
  apiToken: string;
  isDefault: boolean;
  status: "active" | "inactive";
  syncId?: string;
  syncStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldData?: any;
  newData?: any;
  ip?: string;
  createdAt: string;
}

export interface CenterSettings {
  centerName: string;
  logoUrl?: string;
  phone?: string;
  secondaryPhone?: string;
  address?: string;
  academicYear?: string;
  currency?: string;
}

export interface AttendanceSettings {
  enabled: boolean;
  checkOutEnabled: boolean;
  locationEnabled: boolean;
  passwordEnabled: boolean;
  allowedRadiusMeters: number;
}

export interface NotificationSettings {
  whatsappEnabled: boolean;
  resultMessagesEnabled: boolean;
  attendanceMessagesEnabled: boolean;
  checkOutMessagesEnabled: boolean;
  absenceMessagesEnabled: boolean;
}

export interface AppSettings {
  center: CenterSettings;
  attendance: AttendanceSettings;
  notifications: NotificationSettings;
  modules: Record<string, boolean>;
  paymentsEnabled: boolean;
  reportsEnabled: boolean;
  parentPortal: {
    enabled: boolean;
    syncMode: "manual" | "auto";
    lastSync: string | null;
    syncStatus: "idle" | "syncing" | "success" | "error";
    pendingSync: number;
  };
  backupEnabled?: boolean;
}
