# PRD — Educational Center Management System (Backend)
# نظام إدارة المركز التعليمي — تقرير الفحص ومتطلبات الإكمال

**تاريخ الإنشاء:** 2026-09-08
**الإصدار:** 1.0
**الحالة:** مراجعة شاملة + خطة عمل

---

## الجدول المحتويات

1. [ملخص تنفيذي](#1-ملخص-تنفيذي)
2. [Pre-Implementation Audit](#2-pre-implementation-audit)
3. [Tech Stack الحالي](#3-tech-stack-الحالي)
4. [هيكل المشروع](#4-هيكل-المشروع)
5. [حالة قاعدة البيانات](#5-حالة-قاعدة-البيانات)
6. [حالة API Endpoints](#6-حالة-api-endpoints)
7. [المشاكل المعمارية](#7-المشاكل-المعمارية)
8. [الأولويات المتبقية — PRD](#8-الأولويات-المتبقية)
9. [خطة التنفيذ المقترحة](#9-خطة-التنفيذ-المقترح)

---

## 1. ملخص تنفيذي

### النتيجة العامة
المشروع נמצא في حالة **متقدمة بشكل ملحوظ**. الغالبية العظمى من Features الموجودة في التask موجودة وقابلة للعمل. النظام يشمل:

- **Backend كامل** (Express + TypeScript + SQLite)
- **Frontend كامل** (Next.js 16 + React 19)
- **قاعدة بيانات** بـ 19 Table مع Foreign Keys وIndexes
- **نظام مصادقة** كامل (JWT + RBAC + Blacklist)
- **Background Jobs** (Backup scheduler + WhatsApp worker)
- **API موحد** بالشكل المطلوب

### النسبة التقديرية للإنجاز

| الوحدة | الحالة | النسبة |
|--------|--------|--------|
| Database Schema | مكتمل | 95% |
| Authentication & Users | مكتمل | 90% |
| Students | مكتمل | 85% |
| Teachers | مكتمل | 85% |
| Groups | مكتمل | 85% |
| Fees & Payments | مكتمل | 85% |
| Attendance | مكتمل | 80% |
| Exams | مكتمل | 80% |
| Excel Import/Export | مكتمل | 75% |
| WhatsApp Queue | مكتمل (Mock) | 40% |
| Reports | مكتمل جزئياً | 60% |
| Backup | مكتمل | 85% |
| Settings | مكتمل | 70% |
| Audit Log | مكتمل جزئياً | 55% |
| Online Sync | Prepared (أعمدة موجودة) | 10% |
| Multi-PC | Architecture جاهز | 20% |
| Testing | مبدئي | 25% |
| Documentation | موجود لكن غير مكتمل | 50% |

---

## 2. Pre-Implementation Audit

### EXISTS — مكتمل بالكامل

| # | الميزة | الملفات | ملاحظات |
|---|--------|---------|---------|
| 1 | Database Schema (19 Tables) | `database/schema.ts` | مكتمل مع Indexes وConstraints |
| 2 | Database Connection & WAL | `database/db.ts` | SQLite WAL + foreign_keys + busy_timeout |
| 3 | Auth Login/Logout | `authService.ts`, `authController.ts` | JWT + Refresh + Blacklist |
| 4 | Auth Change Password | `authService.ts` | + Strong password policy |
| 5 | Users CRUD | `userRepository.ts`, `authService.ts` | Admin only |
| 6 | Users Disable/Reset | `authService.ts` | Admin only |
| 7 | RBAC Middleware | `middleware/permissions.ts` | requireAdmin, requireEmployeeOrAdmin, requireFinance |
| 8 | Students CRUD | `studentService.ts`, `studentController.ts` | + Custom fields |
| 9 | Student Quick Register | `studentService.ts` | Minimal fields endpoint |
| 10 | Student Search (Fast) | `studentRepository.ts` | Indexed search |
| 11 | Student Barcode/QR | `studentService.ts` | Auto-generated STU-XXXXXX |
| 12 | Student Card Data | `studentService.ts` | `/students/:id/card` |
| 13 | Student Duplicate Check | `studentRepository.ts` | `findPossibleDuplicates` |
| 14 | Custom Fields (Dynamic) | `studentRepository.ts` | `student_custom_field_definitions` table |
| 15 | Teachers CRUD | `teacherService.ts` | + Soft delete |
| 16 | Teachers Stats | `teacherService.ts` | Groups count + students count |
| 17 | Groups CRUD | `groupService.ts` | + Soft delete + JSON schedule |
| 18 | Group Enrollment | `groupRepository.ts` | `student_groups` join table |
| 19 | Lessons CRUD | `lessonService.ts` | Scheduled/in-progress/completed |
| 20 | Fees CRUD | `feePaymentService.ts` | Amount after discount auto-calc |
| 21 | Payments (Idempotent) | `feePaymentService.ts` | `x-idempotency-key` header |
| 22 | Overpayment Prevention | `feePaymentService.ts` | Checks remaining before insert |
| 23 | Fee Status Auto-Update | `feePaymentService.ts` | unpaid→partial→paid |
| 24 | Attendance Sessions | `attendanceService.ts` | Open/close/QR code |
| 25 | Attendance Scan (Barcode/QR) | `attendanceService.ts` | Unified check-in/out |
| 26 | Attendance Manual | `attendanceService.ts` | Bulk manual attendance |
| 27 | Duplicate Attendance Prevention | `attendanceRepository.ts` | UNIQUE(session_id, student_id) |
| 28 | Suspicious Attendance | `attendanceService.ts` | Multi-scan detection |
| 29 | Exams CRUD | `examService.ts` | + Soft delete |
| 30 | Exam Results | `examService.ts` | UNIQUE(exam_id, student_id) |
| 31 | Excel Import Students | `excelService.ts` | Preview + Commit flow |
| 32 | Excel Import Results | `excelService.ts` | Student matching by code/phone/name |
| 33 | Excel Export (7 types) | `excelService.ts` | Students/Payments/Attendance/Fees/Groups/Teachers/Exams |
| 34 | Expenses CRUD | `expenseService.ts` | + Soft delete |
| 35 | Dashboard Stats | `reportService.ts` | Quick summary |
| 36 | Financial Report | `reportService.ts` | By method/teacher/group |
| 37 | Attendance Report | `reportService.ts` | By group/date |
| 38 | Notifications Queue | `notificationService.ts` | Full queue system |
| 39 | WhatsApp Worker | `jobs/whatsappWorker.ts` | Polls pending + retry |
| 40 | Backup Scheduler | `jobs/backupScheduler.ts` | Daily cron |
| 41 | Manual Backup/Restore | `backupService.ts` | + Integrity verify |
| 42 | Settings CRUD | `settingsService.ts` | Key-value store |
| 43 | Audit Log Recording | `middleware/audit.ts` | `logAudit()` function |
| 44 | Rate Limiting | `middleware/rateLimiter.ts` | Login + global |
| 45 | Validation (Zod) | `validators/index.ts` | Arabic error messages |
| 46 | Error Handling | `middleware/errorHandler.ts` | Global + SQLite errors |
| 47 | CORS Configuration | `app.ts` | Configurable |
| 48 | Security Headers | `app.ts` | Helmet |
| 49 | Logging | `utils/logger.ts` | Winston + Morgan |
| 50 | Seed Data | `database/seed.ts` | Idempotent |
| 51 | Sync Columns (Schema) | `schema.ts` | `sync_id`, `sync_status` on all tables |
| 52 | Frontend Integration | `EduCenter/services/` | Real API calls via `lib/api.ts` |

### PARTIAL — موجود جزئياً

| # | الميزة | ما يوجد | ما ناقص |
|---|--------|---------|---------|
| P1 | Students Pagination | Repository يدعم page/limit | Controller لا يمرر pagination metadata دائماً |
| P2 | Students Filtering | Basic filters موجودة | paymentStatus filter غير مكتمل |
| P3 | Audit Log Coverage | `logAudit()` موجود | لا يُستخدم في كل العمليات الحساسة (عدم اتساق) |
| P4 | Reports | Dashboard + Financial + Attendance موجودة | Revenue by teacher/group ممكن تحسينها |
| P5 | Settings Validation | `UpdateSettingsSchema = z.record(z.any())` | لا يوجد validation على القيم المسموحة |
| P6 | Notifications Validation | Notifications endpoints موجودة | لا يوجد Zod schema على POST/PATCH |
| P7 | WhatsApp Provider | Interface + Mock موجودان | لا يوجد Real provider |
| P8 | Testing | `tests/api.test.ts` موجود | Tests محدودة، لا تغطي كل السيناريوهات |
| P9 | Documentation | `README_BACKEND.md` موجود | غير مكتمل، لا يشرح كل شيء |
| P10 | Frontend-Backend Field Mapping | Backend uses snake_case | Frontend uses camelCase — **Risk of runtime errors** |
| P11 | Attendance Records | Session + Record + Scan موجودان | `location_status` و `device_id` لا يُستخدمان |
| P12 | Student Card QR | Card data endpoint موجود | Guardian barcode functionality غير مكتملة |
| P13 | Parent Portal | Frontend page موجود | **لا يوجد Backend endpoint** لـ parent portal |

### MISSING — غير موجودة

| # | الميزة | الأولوية | ملاحظات |
|---|--------|----------|---------|
| M1 | Real WhatsApp Integration | عالية | Mock فقط |
| M2 | Parent Portal Backend | عالية | Frontend page موجود بدون API |
| M3 | Per-Role Module Gating | متوسطة | كل الأدوار ترى كل الوحدات |
| M4 | Pagination Metadata على كل Lists | عالية | فقط students list يرجع pagination |
| M5 | Query Validation (validateQuery) | منخفضة | الدالة موجودة لكن لا تُستخدم |
| M6 | Settings Value Validation | متوسطة | لا يوجد schema للقيم المسموحة |
| M7 | Offline Sync Engine | منخفضة | الأعمدة موجودة لكن لا يوجد Engine |
| M8 | Multi-PC Real-time Sync | منخفضة | Architecture جاهز لكن غير مُndo |
| M9 | Docker/Deployment Config | متوسطة | لا يوجد Dockerfile |
| M10 | E2E Tests | عالية | لا يوجد Playwright/Cypress tests |
| M11 | API Documentation (Swagger/OpenAPI) | متوسطة | لا يوجد |
| M12 | Student Export Filters | منخفضة | Export موجود لكن Filters محدودة |

### المشاكل المعمارية (Architectural Issues)

| # | المشكلة | الخطورة | الحل المقترح |
|---|---------|---------|-------------|
| A1 | **Frontend-Backend Field Name Mismatch** — Frontend uses camelCase (studentId, guardianName) while Backend expects snake_case (student_code, guardian_name) | عالية | إنشاء DTO mapper أو تعديل Validators |
| A2 | **auditLogRoutes imports from settingsController** — Audit controller مُعرّف في settingsController.ts | منخفضة | نقله لملف مستقل `auditLogController.ts` |
| A3 | **Duplicate methods in attendanceRepository** — `listSuspiciousCases` و `createSuspiciousCase` مُعرّفتين مرتين | متوسطة | حذف التعريفات المكررة |
| A4 | **attendanceController mixes repo + service** — بعض الـ logic يتجاوز service layer | متوسطة | نقل كل logic للـ service |
| A5 | **No schema migration versioning** — لا يوجد `schema_migrations` table | متوسطة | إنشاء migration tracking |
| A6 | **JWT Secret in .env.example** — Default secret مُعرّف | عالية | حذفه من .env.example |
| A7 | **CORS allows `*` in production** — ضعف أمني | عالية | تقييد CORS في production |
| A8 | **No `amount_after_discount` CHECK constraint** — يمكن أن يختلف المبلغ المحسوب | منخفضة | إضافة CHECK constraint |
| A9 | **ReportService outstanding fees query** — يحسب كل المدفوعات عالمياً بدل per-fee | عالية | إصلاح query |
| A10 | **Students table has both `group_id` FK و `student_groups` join** — redundancy | منخفضة | يمكن دمجهم مستقبلاً |

---

## 3. Tech Stack الحالي

### Backend
- **Runtime:** Node.js + Express 4.21.2
- **Language:** TypeScript 5.8.2 (ES2022, strict)
- **Database:** SQLite via better-sqlite3 11.9.1
- **ORM/Query:** Raw SQL (hand-written prepared statements)
- **Auth:** jsonwebtoken + bcryptjs (cost 10)
- **Validation:** Zod
- **File Upload:** Multer (memoryStorage, 10MB)
- **Excel:** xlsx library
- **QR:** qrcode library
- **Logging:** Winston + Morgan
- **Security:** Helmet + CORS + express-rate-limit
- **Scheduling:** node-cron
- **Testing:** Vitest + Supertest
- **ESM:** YES (`.js` import suffixes)

### Frontend
- **Framework:** Next.js 16.3.2 (App Router)
- **React:** 19.2.8
- **CSS:** Tailwind CSS 4
- **Font:** Cairo (Google Fonts)
- **Charts:** Recharts
- **Excel:** xlsx
- **QR:** qrcode
- **Icons:** Lucide React + React Icons
- **Language:** TypeScript

### ملاحظة: لا يجب تغيير الـ Stack — مناسب تماماً للمتطلبات

---

## 4. هيكل المشروع

### Backend (`server/`)
```
server/
├── package.json
├── tsconfig.json
├── vitest.config.mjs
├── .env / .env.example
├── data/                    (SQLite DB)
├── backups/                 (DB backups)
├── tests/
│   └── api.test.ts
└── src/
    ├── index.ts             (entry point)
    ├── app.ts               (Express config)
    ├── config/index.ts      (env vars)
    ├── database/
    │   ├── db.ts            (connection + migrations)
    │   ├── schema.ts        (DDL SQL)
    │   └── seed.ts          (test data)
    ├── controllers/         (16 files)
    ├── routes/              (17 files)
    ├── services/            (14 files)
    ├── repositories/        (14 files)
    ├── models/index.ts      (TypeScript interfaces)
    ├── middleware/          (7 files)
    ├── validators/index.ts  (Zod schemas)
    ├── utils/               (response.ts, logger.ts)
    ├── providers/whatsapp/  (Mock provider)
    └── jobs/                (backup, whatsapp worker)
```

### Frontend (`EduCenter/`)
```
EduCenter/
├── app/                    (24 pages)
├── components/             (layout, common, students)
├── services/               (15 API services)
├── lib/                    (api.ts, auth.ts, excel.ts, qr.ts)
├── types/                  (15 type modules)
└── config/modules.ts       (module definitions)
```

---

## 5. حالة قاعدة البيانات

### Tables (19 مكتملة)

| # | Table | Records (Seed) | Indexes | Constraints |
|---|-------|----------------|---------|-------------|
| 1 | users | 2 | username UNIQUE | role CHECK |
| 2 | teachers | 2 | — | status CHECK, soft delete |
| 3 | groups | 3 | teacher_id | capacity DEFAULT 30, soft delete |
| 4 | students | 20 | student_code, phone, guardian_phone, barcode, group_id, is_deleted, created_at | student_code UNIQUE, barcode UNIQUE, soft delete |
| 5 | student_groups | 20+ | student_id, group_id | UNIQUE(student_id, group_id) |
| 6 | student_custom_field_definitions | 0 | — | type CHECK |
| 7 | lessons | 0 | group_id | status CHECK |
| 8 | fees | 20+ | student_id, group_id, status | amount_required > 0, discount >= 0 |
| 9 | payments | 10+ | student_id, fee_id, payment_date | amount > 0, idempotency_key UNIQUE |
| 10 | attendance_sessions | 1 | group_id, date | status CHECK |
| 11 | attendance_records | 6 | session_id, student_id, group_id, created_at | UNIQUE(session_id, student_id) |
| 12 | suspicious_attendance | 0 | — | status CHECK |
| 13 | exams | 1 | group_id | max_score > 0, soft delete |
| 14 | exam_results | 10 | exam_id, student_id | UNIQUE(exam_id, student_id), score >= 0 |
| 15 | expenses | 2 | — | category CHECK, amount > 0, soft delete |
| 16 | notifications | 0 | status, scheduled_at | type CHECK, status CHECK |
| 17 | audit_logs | 0 | (entity_type, entity_id), user_id, created_at | — |
| 18 | settings | 1 | key UNIQUE | — |
| 19 | revoked_tokens | 0 | — | token PK |

### Foreign Keys مكتملة ✅
### Indexes كافية للـ LAN usage ✅
### WAL Mode مُفعّل ✅
### ملاحظة: لا يوجد schema_migrations table (يجب إضافته)

---

## 6. حالة API Endpoints

### ملخص

| Module | Endpoints | الحالة |
|--------|-----------|--------|
| Auth | 5 | ✅ مكتمل |
| Users | 5 | ✅ مكتمل |
| Students | 12 | ✅ مكتمل (needs pagination fixes) |
| Teachers | 6 | ✅ مكتمل |
| Groups | 12 | ✅ مكتمل |
| Fees | 3 | ✅ مكتمل |
| Payments | 4 | ✅ مكتمل |
| Attendance | 14 | ✅ مكتمل |
| Exams | 11 | ✅ مكتمل |
| Expenses | 4 | ✅ مكتمل |
| Reports | 3 | ⚠️ مكتمل جزئياً |
| Notifications | 9 | ⚠️ Mock provider |
| Backups | 3 | ✅ مكتمل |
| Settings | 2 | ⚠️ Validation ضعيف |
| Audit Logs | 1 | ⚠️ Coverage غير متسق |
| Excel Import | 6 | ✅ مكتمل |
| Excel Export | 7 | ✅ مكتمل |
| **المجموع** | **107** | |

### Endpoints ناقصة (Missing)

| Endpoint | الوصف | الأولوية |
|----------|-------|----------|
| `POST /api/students/:id/enroll` | تسجيل الطالب في مجموعة (بديل `/groups/:id/students`) | منخفضة |
| `GET /api/parent-portal/:studentId` | وصول ولي الأمر لبيانات الطالب | عالية |
| `GET /api/attendance/sessions/:id/stats` | إحصائيات الجلسة | متوسطة |
| `GET /api/reports/revenue-by-teacher` | إيرادات حسب المدرس | متوسطة |
| `GET /api/reports/revenue-by-group` | إيرادات حسب المجموعة | متوسطة |
| `POST /api/exams/:id/results/batch` | إدخال درجات دفعة واحدة | متوسطة |

---

## 7. المشاكل المعمارية

### CRITICAL (يجب حلها قبل أي feature جديدة)

**A1. Frontend-Backend Field Name Mismatch**
- **المشكلة:** Frontend يرسل camelCase (`studentId`, `guardianName`) والـ Backend يتوقع snake_case (`student_code`, `guardian_name`)
- **الملفات المتأثرة:** `server/src/validators/index.ts`, `EduCenter/app/page.tsx`, `EduCenter/services/studentService.ts`
- **الحل:** إنشاء DTO mapper في Backend أو تعديل Validators لقبول كلا الشكلين

**A9. ReportService Outstanding Fees Query**
- **المشكلة:** يحسب `SUM(amount_after_discount)` من كل الـ fees غير المدفوعة ثم يطرح **كل** المدفوعات عالمياً
- **الحل:** تعديل query ليحسب المدفوعات Per-Fee

### HIGH

**A7. CORS allows `*` in production**
- **الحل:** التأكد من تقييد `CORS_ORIGIN` في production

**A6. JWT Secret in .env.example**
- **الحل:** حذف القيمة الافتراضية من .env.example

### MEDIUM

**A2. Audit Log Controller Code Smell**
- **الحل:** نقل `auditLogController` لملف مستقل

**A3. Duplicate Methods in attendanceRepository**
- **الحل:** حذف التعريفات المكررة

**A4. attendanceController Layering Issue**
- **الحل:** نقل logic الـ repository إلى service

**A5. No Migration Versioning**
- **الحل:** إنشاء `schema_migrations` table

### LOW

**A8. No CHECK on amount_after_discount**
- **الحل:** إضافة trigger أو CHECK constraint

**A10. Redundant group_id on students table**
- **الحل:** يمكن حذفه مستقبلاً بعد التأكد من استخدام student_groups everywhere

---

## 8. الأولويات المتبقية — PRD

### المرحلة 1: Critical Fixes (أسبوع 1)

#### 1.1 Frontend-Backend Field Name Resolution
- **الحالة:** MISSING
- **الأولوية:** CRITICAL
- **الوصف:** حل مشكلة عدم تطابق أسماء الحقول بين Frontend و Backend
- **المطلوب:**
  - [ ] إنشاء DTO mapper في `studentService.ts` (Backend) يحول camelCase → snake_case
  - [ ] أو تعديل Zod validators لقبول كلا الشكلين
  - [ ] اختبار Student Create/Update من Frontend
- **الملفات:** `server/src/validators/index.ts`, `server/src/services/studentService.ts`
- **التكلفة التقديرية:** 4-6 ساعات

#### 1.2 ReportService Outstanding Fees Fix
- **الحالة:** MISSING
- **الأولوية:** CRITICAL
- **الوصف:** إصلاح query حساب المستحققات المالية
- **المطلوب:**
  - [ ] تعديل query ليحسب المدفوعات لكل fee على حدة
  - [ ] اختبار Financial Report
- **الملفات:** `server/src/services/reportService.ts`
- **التكلفة التقديرية:** 2-3 ساعات

#### 1.3 Security Hardening
- **الحالة:** PARTIAL
- **الأولوية:** HIGH
- **المطلوب:**
  - [ ] حذف JWT Secret الافتراضي من `.env.example`
  - [ ] تقييد CORS في production mode
  - [ ] مراجعة إرجاع `req.user` (قد يحتوي `password_hash`)
- **الملفات:** `.env.example`, `app.ts`, `middleware/auth.ts`
- **التكلفة التقديرية:** 2-3 ساعات

---

### المرحلة 2: Database & Core Improvements (أسبوع 2)

#### 2.1 Schema Migration Versioning
- **الحالة:** MISSING
- **الأولوية:** متوسطة
- **الوصف:** إنشاء نظام migration versioning
- **المطلوب:**
  - [ ] إنشاء `schema_migrations` table
  - [ ] تسجيل كل migration يعمل
  - [ ] منع تكرار migration
  - [ ] تحويل migrations الحالية لاستخدام النظام الجديد
- **الملفات:** `database/db.ts`, `database/schema.ts`
- **التكلفة التقديرية:** 6-8 ساعات

#### 2.2 Audit Log Coverage
- **الحالة:** PARTIAL
- **الأولوية:** متوسطة
- **الوصف:** تغطية كل العمليات الحساسة بـ audit logging
- **المطلوب:**
  - [ ] استخدام `logAudit()` في كل تعديل (update)
  - [ ] استخدام `logAudit()` في كل حذف (delete)
  - [ ] استخدام `logAudit()` في كل دفع (payment)
  - [ ] استخدام `logAudit()` في تعديل attendance
  - [ ] استخدام `logAudit()` في تعديل exam results
  - [ ] استخدام `logAudit()` في تغيير user data
  - [ ] نقل `auditLogController` لملف مستقل
- **الملفات:** كل service file + `middleware/audit.ts`
- **التكلفة التقديرية:** 6-8 ساعات

#### 2.3 Attendance Repository Cleanup
- **الحالة:** PARTIAL
- **الأولوية:** متوسطة
- **المطلوب:**
  - [ ] حذف التعريفات المكررة في `attendanceRepository.ts`
  - [ ] نقل attendance record logic من controller إلى service
- **الملفات:** `repositories/attendanceRepository.ts`, `controllers/attendanceController.ts`
- **التكلفة التقديرية:** 3-4 ساعات

#### 2.4 Settings Validation
- **الحالة:** MISSING
- **الأولوية:** متوسطة
- **المطلوب:**
  - [ ] إنشاء Zod schema لكل setting مسموح
  - [ ] تقييد القيم (مثلاً: `center_name` string، `backup_enabled` boolean)
  - [ ] منع إضافة settings عشوائية
- **الملفات:** `validators/index.ts`, `services/settingsService.ts`
- **التكلفة التقديرية:** 4-6 ساعات

#### 2.5 Notification Validation
- **الحالة:** MISSING
- **الأولوية:** منخفضة
- **المطلوب:**
  - [ ] إنشاء Zod schema لإنشاء notification
  - [ ] Validation على نوع الرسالة ورقم الهاتف
- **الملفات:** `validators/index.ts`, `routes/notificationRoutes.ts`
- **التكلفة التقديرية:** 2-3 ساعات

---

### المرحلة 3: Pagination & Filtering (أسبوع 3)

#### 3.1 Standardized Pagination Response
- **الحالة:** PARTIAL
- **الأولوية:** عالية
- **الوصف:** كل list endpoint يرجع pagination metadata
- **المطلوب:**
  - [ ] تعديل `sendSuccess` لدعم pagination
  - [ ] Students: page/limit/search/total ✅ (موجود جزئياً)
  - [ ] Teachers: page/limit/total
  - [ ] Groups: page/limit/total
  - [ ] Fees: page/limit/total
  - [ ] Payments: page/limit/total
  - [ ] Attendance Records: page/limit/total
  - [ ] Exam Results: page/limit/total
  - [ ] Expenses: page/limit/total
  - [ ] Audit Logs: page/limit/total
  - [ ] Notifications: page/limit/total
- **الملفات:** كل controller + repository
- **التكلفة التقديرية:** 12-16 ساعات

#### 3.2 Advanced Filtering
- **الحالة:** PARTIAL
- **الأولوية:** متوسطة
- **المطلوب:**
  - [ ] Students: grade, group, status, payment_status (comprehensive)
  - [ ] Payments: date range, student, group, payment_method, employee
  - [ ] Attendance: date range, group, status, student
  - [ ] Expenses: date range, category, created_by
  - [ ] Fees: period, status, student, group
- **الملفات:** كل controller + repository
- **التكلفة التقديرية:** 10-14 ساعات

#### 3.3 Query Validation
- **الحالة:** MISSING
- **الأولوية:** منخفضة
- **المطلوب:**
  - [ ] استخدام `validateQuery` في كل list endpoint
  - [ ] التحقق من صحة pagination params (page > 0, limit > 0, limit <= 100)
  - [ ] التحقق من صحة filter params
- **الملفات:** `middleware/validate.ts` + كل route
- **التكلفة التقديرية:** 6-8 ساعات

---

### المرحلة 4: Missing Features (أسبوع 4)

#### 4.1 Parent Portal Backend
- **الحالة:** MISSING
- **الأولوية:** عالية
- **الوصف:** Endpoint لولي الأمر لعرض بيانات الطالب
- **المطلوب:**
  - [ ] `GET /api/parent-portal/:studentId` (بطاقة الطالب + الحضور + الدرجات + الرسوم)
  - [ ] Authentication خاص بـ parent (PIN أو QR-based)
  - [ ] ربط بـ guardian_barcode
- **الملفات:** Controllers + Routes + Services جديدة
- **التكلفة التقديرية:** 8-10 ساعات

#### 4.2 Teacher Role Scoping
- **الحالة:** MISSING
- **الأولوية:** متوسطة
- **الوصف:** المدرس يرى فقط مجموعاته وطلابه
- **المطلوب:**
  - [ ] Middleware خاص بـ teacher role
  - [ ] Teacher dashboard يعرض مجموعاته فقط
  - [ ] Attendance filtered by teacher's groups
  - [ ] Exam results filtered by teacher's groups
- **الملفات:** `middleware/permissions.ts` + controllers
- **التكلفة التقديرية:** 8-10 ساعات

#### 4.3 Module-Based Permissions
- **الحالة:** MISSING
- **الأولوية:** متوسطة
- **الوصف:** كل دور يرى فقط الوحدات المسموحة له
- **المطلوب:**
  - [ ] جدول `role_modules` أو JSON في settings
  - [ ] Middleware يتحقق من صلاحية الوصول للوحدة
  - [ ] Frontend يخفي الوحدات غير المسموحة
- **الملفات:** `database/schema.ts`, `middleware/permissions.ts`, `config/modules.ts`
- **التكلفة التقديرية:** 10-12 ساعات

#### 4.4 Attendance Session Stats
- **الحالة:** MISSING
- **الأولوية:** منخفضة
- **المطلوب:**
  - [ ] `GET /api/attendance/sessions/:id/stats` — present/absent/late counts
- **التكلفة التقديرية:** 2-3 ساعات

---

### المرحلة 5: Excel & Reports Enhancement (أسبوع 5)

#### 5.1 Excel Import Improvements
- **الحالة:** PARTIAL
- **الأولوية:** متوسطة
- **المطلوب:**
  - [ ] تحسين Student matching (code → phone → name fallback)
  - [ ] تحسين duplicate detection
  - [ ] تحسين error messages بالعربي
  - [ ] Download template endpoint
- **الملفات:** `services/excelService.ts`, `controllers/excelController.ts`
- **التكلفة التقديرية:** 6-8 ساعات

#### 5.2 Enhanced Reports
- **الحالة:** PARTIAL
- **الأولوية:** متوسطة
- **المطلوب:**
  - [ ] Revenue by Teacher
  - [ ] Revenue by Group
  - [ ] Attendance trend report
  - [ ] Student retention report
  - [ ] Payment history per student
  - [ ] Expense breakdown by month
- **الملفات:** `services/reportService.ts`, `controllers/reportController.ts`
- **التكلفة التقديرية:** 10-14 ساعات

#### 5.3 Excel Export with Filters
- **الحالة:** PARTIAL
- **الأولوية:** منخفضة
- **المطلوب:**
  - [ ] Students export: filter by grade, group, status
  - [ ] Payments export: filter by date, method, student
  - [ ] Attendance export: filter by date, group, status
- **الملفات:** `services/excelService.ts`
- **التكلفة التقديرية:** 4-6 ساعات

---

### المرحلة 6: WhatsApp & Notifications (أسبوع 6)

#### 6.1 Real WhatsApp Provider
- **الحالة:** MISSING
- **الأولوية:** عالية
- **المطلوب:**
  - [ ] إنشاء `RealWhatsAppProvider` (wa-automate أو whatsmeow أو API مثل CallMeBot)
  - [ ] أو استخدام Email/SMS كبديل
  - [ ] Configuration في Settings
  - [ ] Error handling و retry logic
- **الملفات:** `providers/whatsapp/`, `services/notificationService.ts`
- **التكلفة التقديرية:** 12-16 ساعات

#### 6.2 Notification Events Enhancement
- **الحالة:** PARTIAL
- **الأولوية:** متوسطة
- **المطلوب:**
  - [ ] ربط كل حدث (check-in/out, exam, fee, payment) بإرسال فعلي
  - [ ] تفعيل/تعطيل كل نوع رسالة من الإعدادات
  - [ ] templates قابلة للتعديل
- **الملفات:** `services/notificationService.ts`, `services/settingsService.ts`
- **التكلفة التقديرية:** 6-8 ساعات

#### 6.3 Fee Reminders
- **الحالة:** PARTIAL
- **الأولوية:** متوسطة
- **المطلوب:**
  - [ ] Automated fee reminders (cron job)
  - [ ] Customizable reminder schedule
  - [ ] Reminder template
- **الملفات:** `jobs/`, `services/notificationService.ts`
- **التكلفة التقديرية:** 4-6 ساعات

---

### المرحلة 7: Testing (أسبوع 7-8)

#### 7.1 Critical Path Tests
- **الحالة:** PARTIAL
- **الأولوية:** عالية
- **المطلوب:**
  - [ ] Student CRUD tests
  - [ ] Duplicate student detection test
  - [ ] Payment recording + overpayment prevention test
  - [ ] Attendance duplicate prevention test
  - [ ] Attendance scan test (barcode/QR)
  - [ ] Exam result duplicate prevention test
  - [ ] Quick register test
  - [ ] Auth (login/logout/refresh) tests
  - [ ] Permission tests (admin vs employee)
  - [ ] Backup/restore test
  - [ ] Transaction tests (payment + fee update atomic)
  - [ ] Excel import validation tests
  - [ ] Rate limiting tests
- **الملفات:** `tests/`
- **التكلفة التقديرية:** 20-25 ساعات

#### 7.2 Edge Cases
- **المطلوب:**
  - [ ] Concurrent payment on same fee
- [ ] Concurrent attendance scan for same student
- [ ] Large dataset performance (20K students)
- [ ] Empty state handling
- [ ] Invalid token handling
- [ ] Expired refresh token handling
- **التكلفة التقديرية:** 10-12 ساعات

---

### المرحلة 8: Documentation & Deployment (أسبوع 9)

#### 8.1 Backend Documentation
- **الحالة:** PARTIAL
- **المطلوب:**
  - [ ] إكمال `README_BACKEND.md`
  - [ ] Installation instructions
  - [ ] Environment variables documentation
  - [ ] API structure overview
  - [ ] Database schema documentation
  - [ ] Backup/Restore guide
  - [ ] Development setup
  - [ ] Production deployment
- **التكلفة التقديرية:** 4-6 ساعات

#### 8.2 API Documentation
- **الحالة:** MISSING
- **المطلوب:**
  - [ ] Swagger/OpenAPI spec
  - [ ] أو توثيق يدوي لكل endpoint
- **التكلفة التقديرية:** 8-10 ساعات

#### 8.3 Deployment Configuration
- **الحالة:** MISSING
- **المطلوب:**
  - [ ] Dockerfile
  - [ ] docker-compose.yml (server + frontend)
  - [ ] Production .env template
  - [ ] PM2 configuration (optional)
- **التكلفة التقديرية:** 4-6 ساعات

---

### المرحلة 9: Online Sync & Multi-PC (مستقبلي — ليس الآن)

#### 9.1 Sync Engine
- **الحالة:** Schema جاهز، Engine غير موجود
- **ملاحظة:** لا يُنفَّذ الآن — الأعمدة (`sync_id`, `sync_status`) موجودة وungebraucht
- **عند التنفيذ:**
  - [ ] Sync conflict resolution strategy
  - [ ] Delta sync (only changed records)
  - [ ] Conflict detection and resolution UI
  - [ ] Background sync worker

#### 9.2 Multi-PC
- **الحالة:** Architecture جاهز (Server → LAN → PCs)
- **ملاحظة:** يعمل حالياً عبر `0.0.0.0:5000` — كل PCs تتصل بالـ Server
- **لا يحتاج تنفيذ إضافي الآن**

---

## 9. خطة التنفيذ المقترحة

### الجدول الزمني

| الأسبوع | المرحلة | Hours (تقديري) |
|---------|---------|----------------|
| 1 | Critical Fixes | 10-13 |
| 2 | Database & Core | 18-22 |
| 3 | Pagination & Filtering | 28-38 |
| 4 | Missing Features | 20-25 |
| 5 | Excel & Reports | 20-28 |
| 6 | WhatsApp & Notifications | 22-30 |
| 7-8 | Testing | 30-37 |
| 9 | Documentation & Deployment | 16-22 |
| **المجموع** | | **164-215 ساعة** |

### الأولوية القصوى (ابدأ بها)

1. **Fix Frontend-Backend field mapping** (A1)
2. **Fix outstanding fees query** (A9)
3. **Security hardening** (A6, A7)
4. **Pagination for all lists** (3.1)
5. **Critical path tests** (7.1)

### ما لا يجب فعله الآن

- ❌ Online Sync Engine — الأعمدة موجودة، لا يوجد داعي للتنفيذ الآن
- ❌ Multi-PC real-time sync — يعمل عبر LAN كما هو
- ❌ Real WhatsApp — يمكن تأجيله بعد التأكد من أن النظام الأساسي يعمل
- ❌ Swagger/OpenAPI — التوثيق اليدوي كافٍ حالياً
- ❌ Docker — يعمل على Windows كما هو

---

## ملخص

### ما تم إنجازه (ممتاز)
- قاعدة بيانات مكتملة بـ 19 table
- نظام مصادقة كامل
- Students CRUD مع search و duplicate detection
- Groups مع enrollment
- Fees/ Payments مع idempotency و overpayment prevention
- Attendance مع barcode/QR scan
- Exams و results
- Excel import/export
- Backup system
- Notification queue
- Frontend كامل يتصل بالـ API

### ما يحتاج عمل (مهم)
- **Critical:** Fix field name mapping, fix fees query, security hardening
- **High:** Pagination for all lists, parent portal, real WhatsApp
- **Medium:** Audit coverage, teacher role scoping, module permissions, advanced reports
- **Low:** Query validation, schema migration versioning, export filters

### تقدير العمل المتبقي: 164-215 ساعة (حوالي 4-5 أسابيع عمل مكثف)
