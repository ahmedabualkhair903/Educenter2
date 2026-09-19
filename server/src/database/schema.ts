export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT DEFAULT '' NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'employee', 'owner', 'secretary', 'teacher')),
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  sync_id TEXT,
  sync_status TEXT DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Teachers Table
CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by TEXT,
  sync_id TEXT,
  sync_status TEXT DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 3. Groups Table
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  room TEXT,
  capacity INTEGER NOT NULL DEFAULT 30,
  schedule TEXT NOT NULL DEFAULT '[]', -- JSON array of GroupSchedule
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by TEXT,
  sync_id TEXT,
  sync_status TEXT DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 4. Students Table
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  student_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  guardian_name TEXT NOT NULL,
  guardian_phone TEXT NOT NULL,
  gender TEXT DEFAULT 'male',
  birth_date TEXT,
  school_name TEXT,
  school_grade TEXT,
  grade TEXT NOT NULL,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  address TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
  barcode TEXT NOT NULL UNIQUE,
  guardian_barcode TEXT,
  custom_fields TEXT NOT NULL DEFAULT '[]', -- JSON array of StudentCustomFieldValue
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  sync_id TEXT,
  sync_status TEXT DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 5. Student Groups (Many-to-Many relationship)
CREATE TABLE IF NOT EXISTS student_groups (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  join_date TEXT NOT NULL,
  leave_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'left', 'suspended')),
  created_at TEXT NOT NULL,
  UNIQUE(student_id, group_id)
);

-- 6. Student Custom Field Definitions
CREATE TABLE IF NOT EXISTS student_custom_field_definitions (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('text', 'number', 'date', 'select', 'textarea', 'boolean')),
  required INTEGER NOT NULL DEFAULT 0,
  options TEXT DEFAULT '[]', -- JSON array of strings
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- 7. Lessons Table
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT,
  teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  room TEXT,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  sync_id TEXT,
  sync_status TEXT DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 8. Fees Table
CREATE TABLE IF NOT EXISTS fees (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  amount_required REAL NOT NULL CHECK(amount_required > 0),
  discount REAL NOT NULL DEFAULT 0 CHECK(discount >= 0),
  amount_after_discount REAL NOT NULL CHECK(amount_after_discount >= 0),
  period TEXT NOT NULL, -- e.g. '2026-09' or 'Month 1'
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'partial', 'paid')),
  sync_id TEXT,
  sync_status TEXT DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 9. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_id TEXT REFERENCES fees(id) ON DELETE SET NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'bank_transfer', 'vodafone_cash', 'instapay', 'other')),
  payment_date TEXT NOT NULL,
  notes TEXT,
  received_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  idempotency_key TEXT UNIQUE,
  sync_id TEXT,
  sync_status TEXT DEFAULT 'local',
  created_at TEXT NOT NULL
);

-- 10. Attendance Sessions Table
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
  password TEXT,
  qr_code TEXT,
  opened_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  closed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  sync_id TEXT,
  sync_status TEXT DEFAULT 'local',
  created_at TEXT NOT NULL
);

-- 11. Attendance Records Table
CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'present' CHECK(status IN ('present', 'absent', 'late', 'excused', 'unrecorded')),
  check_in_time TEXT,
  check_out_time TEXT,
  method TEXT NOT NULL DEFAULT 'barcode' CHECK(method IN ('barcode', 'qr', 'manual')),
  location_status TEXT DEFAULT 'allowed' CHECK(location_status IN ('allowed', 'outside', 'unknown')),
  device_id TEXT,
  sync_id TEXT,
  sync_status TEXT DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(session_id, student_id)
);

-- 12. Suspicious Attendance Cases Table
CREATE TABLE IF NOT EXISTS suspicious_attendance (
  id TEXT PRIMARY KEY,
  attendance_ids TEXT NOT NULL DEFAULT '[]', -- JSON array
  student_ids TEXT NOT NULL DEFAULT '[]',    -- JSON array
  student_names TEXT NOT NULL DEFAULT '[]',  -- JSON array
  reason TEXT NOT NULL,
  device_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  note TEXT,
  detected_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 13. Exams Table
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  exam_date TEXT NOT NULL,
  max_score REAL NOT NULL CHECK(max_score > 0),
  notes TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by TEXT,
  sync_id TEXT,
  sync_status TEXT DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 14. Exam Results Table
CREATE TABLE IF NOT EXISTS exam_results (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score REAL CHECK(score >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved')),
  notes TEXT,
  sync_id TEXT,
  sync_status TEXT DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(exam_id, student_id)
);

-- 15. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK(category IN ('Rent', 'Electricity', 'Salaries', 'Printing', 'Maintenance', 'Internet', 'Supplies', 'Other')),
  amount REAL NOT NULL CHECK(amount > 0),
  description TEXT,
  expense_date TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  deleted_by TEXT,
  sync_id TEXT,
  sync_status TEXT DEFAULT 'local',
  created_at TEXT NOT NULL
);

-- 16. Notifications (WhatsApp Queue) Table
-- type/status CHECKs intentionally cover both system kinds (check_in, ...)
-- and messages-screen kinds (individual, group, ...) so the UI can persist
-- drafts/scheduled broadcasts without constraint violations.
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
  recipient_phone TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('check_in', 'check_out', 'exam_result', 'fee_reminder', 'payment_receipt', 'absence', 'general', 'individual', 'group', 'notification', 'reminder', 'attendance')),
  title TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'sent', 'failed', 'draft', 'scheduled')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  scheduled_at TEXT NOT NULL,
  sent_at TEXT,
  error TEXT,
  attachment_data TEXT,
  attachment_name TEXT,
  attachment_mime TEXT,
  attachment_size INTEGER,
  whatsapp_account_id TEXT REFERENCES whatsapp_accounts(id) ON DELETE SET NULL,
  sync_id TEXT,
  sync_status TEXT DEFAULT 'local',
  created_at TEXT NOT NULL
);

-- 17. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_data TEXT, -- JSON string
  new_data TEXT, -- JSON string
  ip TEXT,
  created_at TEXT NOT NULL
);

-- 18. Settings Table (Key-Value)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL, -- JSON string
  updated_at TEXT NOT NULL
);

-- 19. Revoked Tokens Table (Token Blacklist for Logout)
CREATE TABLE IF NOT EXISTS revoked_tokens (
  token TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL
);

-- 20. WhatsApp Sender Accounts (DB-managed gateway credentials)
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
  id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL,
  provider_name TEXT NOT NULL DEFAULT 'custom',
  api_url TEXT NOT NULL,
  api_token TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  sync_id TEXT,
  sync_status TEXT DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- INDEXES FOR HIGH-SPEED LOOKUP AND LAN CONCURRENCY
CREATE INDEX IF NOT EXISTS idx_students_student_code ON students(student_code);
CREATE INDEX IF NOT EXISTS idx_students_phone ON students(phone);
CREATE INDEX IF NOT EXISTS idx_students_guardian_phone ON students(guardian_phone);
CREATE INDEX IF NOT EXISTS idx_students_barcode ON students(barcode);
CREATE INDEX IF NOT EXISTS idx_students_group_id ON students(group_id);
CREATE INDEX IF NOT EXISTS idx_students_is_deleted ON students(is_deleted);
CREATE INDEX IF NOT EXISTS idx_students_created_at ON students(created_at);

CREATE INDEX IF NOT EXISTS idx_student_groups_student ON student_groups(student_id);
CREATE INDEX IF NOT EXISTS idx_student_groups_group ON student_groups(group_id);

CREATE INDEX IF NOT EXISTS idx_fees_student_id ON fees(student_id);
CREATE INDEX IF NOT EXISTS idx_fees_group_id ON fees(group_id);
CREATE INDEX IF NOT EXISTS idx_fees_status ON fees(status);

CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_fee_id ON payments(fee_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);

CREATE INDEX IF NOT EXISTS idx_attendance_records_session_id ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_group_id ON attendance_records(group_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_created_at ON attendance_records(created_at);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_group_id ON attendance_sessions(group_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON attendance_sessions(date);

CREATE INDEX IF NOT EXISTS idx_exam_results_exam_id ON exam_results(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student_id ON exam_results(student_id);

CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notifications(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_default ON whatsapp_accounts(is_default);
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_status ON whatsapp_accounts(status);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
`;
