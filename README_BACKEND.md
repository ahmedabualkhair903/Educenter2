# Educational Center Management System — Backend API
نظام إدارة السنتر التعليمي — الخادم الخلفي (Offline-First Backend)

نظام خادم خلفي متكامل، سريع، عالي الكفاءة ومصمم خصيصًا للعمل **Offline داخل السنتر التعليمي** عبر الشبكة المحلية (LAN Multi-PC)، مع جاهزية معمارية كاملة للمزامنة السحابية (Online Sync Readiness) دون الحاجة لإعادة هيكلة النظام.

---

## 🚀 المميزات المعمارية الرئيسية

1. **Offline-First & LAN Concurrency**:
   - قاعدة بيانات SQLite مدمجة تعمل بنظام **Write-Ahead Logging (WAL)**.
   - معالجة طلبات متزامنة من أكثر من موظف وسكرتارية على أجهزة متعددة بدون Deadlocks أو تضارب بيانات.
   - مهلة انتظار للمعاملات `PRAGMA busy_timeout = 5000` وقيود سلامة صارمة (Foreign Keys & Unique Constraints).

2. **الأمان وصلاحيات الأدوار (RBAC & Security)**:
   - تشفير كلمات المرور باستخدام `bcryptjs` (Cost factor = 10).
   - توثيق الجلسات باستخدام JWT Tokens (`Bearer Token`).
   - فحص الصلاحيات بواسطة Middleware مخصص (`admin`, `owner`, `employee`, `secretary`).
   - حماية ضد هجمات القوة الغاشمة (Rate Limiting على `/api/auth/login` ومحدد عام للطلبات).
   - حماية العناوين بواسطة `Helmet` و `CORS`.

3. **إدارة الطلاب والباركود والتسجيل السريع**:
   - توليد تسلسلي تلقائي لكود الطالب والباركود (`STU-000001`, `STU-000002`...).
   - توليد QR Code فوري للطباعة مع دعم الباركود المزدوج (باركود الطالب + باركود ولي الأمر لبوابة أولياء الأمور `G-STU-000001`).
   - فحص وتنبيه التكرار الذكي (Duplicate Warnings) بالهاتف أو الكود أو الاسم.
   - نقطة نهاية للتسجيل السريع في الاستقبال (`POST /api/students/quick-register`).
   - دعم الحقول المخصصة الديناميكية (`custom_fields`).

4. **دفتر الحسابات والمدفوعات (Financial Ledger)**:
   - حساب تلقائي وصارم في الخادم للقيم (`المطلوب`, `المدفوع`, `المتبقي`, `الحالة`).
   - دعم المعاملات الذرية (Transactions) لمنع تكرار أو ضياع الدفعات.
   - دعم مفاتيح منع التكرار (`Idempotency Keys`).
   - طرق الدفع: نقدي، فودافون كاش، انستاباي، تحويل بنكي، أخرى.

5. **الحضور والانصراف السريع (Barcode / QR Scanner)**:
   - ماسح موحد فائق السرعة (`POST /api/attendance/scan`).
   - كشف الجلسة المفتوحة تلقائيًا ومنع تكرار تسجيل حضور الطالب في نفس الجلسة.
   - دعم تسجيل الحضور والانصراف مع تسجيل التوقيت بالدقيقة.
   - رصد الحالات المشبوهة (Suspicious Attendance) عند المسح المتتالي من نفس الجهاز في أجزاء من الثانية.

6. **طابور رسائل الواتساب وقابلية التبديل (WhatsApp Queue & Provider)**:
   - فصل تام لمعالجة الرسائل عن دورة استجابة الـ HTTP (`notifications` queue).
   - خلفية مجدولة دورية (`whatsappWorker`) لمعالجة الرسائل مع إعادة المحاولة حتى 3 مرات.
   - واجهة برمجية موحدة (`WhatsAppProvider`) تتيح الربط بأي مزود سحابي أو محلي أو محاكي (Mock Provider).
   - إرسال إشعارات تلقائية عند: الحضور، الانصراف، نتائج الاختبارات، إيصالات الدفع، ورسائل الغياب.

7. **استيراد وتصدير ملفات الإكسيل (Excel Engine)**:
   - محرك استيراد مع ميزة المعاينة والتحقق (`Preview`) قبل الحفظ النهائي (`Commit`).
   - مطابقة ذكية للطلاب بالأكواد وأرقام الهواتف والأسماء.
   - تصدير كشوفات الطلاب، الحضور، المدفوعات، ونتائج الامتحانات بصيغة `.xlsx` منسقة.

8. **النسخ الاحتياطي التلقائي وسجل العمليات (Backup & Audit Trail)**:
   - إنشاء نسخ احتياطية لحظية (Online Non-blocking Backup) لقاعدة البيانات دون إيقاف الخادم.
   - فحص سلامة النسخة الاحتياطية تلقائيًا (`PRAGMA integrity_check`) والاحتفاظ بآخر 30 نسخة.
   - جدولة يومية تلقائية (Daily Cron Job).
   - تسجيل تدقيق شامل لجميع العمليات الحساسة في جدول `audit_logs`.

9. **الجاهزية للمزامنة السحابية (Online Sync Readiness)**:
   - تزويد كل السجلات المعنية بأعمدة `sync_id` (UUIDv4) و `sync_status` (`local`, `pending`, `synced`, `conflict`) مع تواريخ ISO 8601 موحدة.

---

## 🛠 المتطلبات والتثبيت

### المتطلبات:
- **Node.js**: v18 أو أعلى (يوصى بـ v20 أو v22 أو v24)
- **NPM**: v9 أو أعلى

### خطوات التثبيت:

```bash
# الانتقال لمجلد الخادم
cd server

# تثبيت الحزم البرمجية
npm install

# نسخ ملف البيئة
copy .env.example .env

# تجهيز قاعدة البيانات وتعبئة البيانات التجريبية (اختياري)
npm run seed
```

---

## ⚙️ متغيرات البيئة (.env)

| المتغير | الوصف | القيمة الافتراضية |
| :--- | :--- | :--- |
| `PORT` | منفذ تشغيل الخادم | `5000` |
| `NODE_ENV` | بيئة التشغيل (`development` / `production`) | `development` |
| `JWT_SECRET` | المفتاح السري لتشفير الـ JWT Tokens | `manara_super_secret_jwt_key_educenter_2026_offline_security` |
| `JWT_EXPIRES_IN` | مدة صلاحية الرمز | `7d` |
| `DATABASE_PATH` | مسار ملف قاعدة بيانات SQLite | `./data/educenter.db` |
| `BACKUP_PATH` | مسار حفظ النسخ الاحتياطية | `./backups` |
| `CORS_ORIGIN` | النطاقات المسموح لها بالاتصال | `*` |
| `BACKUP_SCHEDULE` | توقيت النسخ الاحتياطي التلقائي (Cron) | `0 3 * * *` (يوميًا الساعة 3 فجرًا) |
| `WHATSAPP_WORKER_INTERVAL_MS` | الفاصل الزمني لمعالجة طابور الواتساب | `10000` (كل 10 ثوانٍ) |

---

## 🏃 تشغيل الخادم

### 1. وضع التطوير (Development):
```bash
npm run dev
```

### 2. البناء والتشغيل في الإنتاج (Production):
```bash
npm run build
npm start
```

### 3. تشغيل الاختبارات الآلية (Automated Tests):
```bash
npm test
```

### 4. أخذ نسخة احتياطية يدويًا (Manual Backup CLI):
```bash
npm run backup
```

---

## 🔐 الحسابات الافتراضية بعد الـ Seed

| المستخدم | كلمة المرور | الدور | الصلاحيات |
| :--- | :--- | :--- | :--- |
| `admin` | `admin123` | **Admin / Owner** | كافة الصلاحيات (إدارة موظفين، تعديل، حذف، تقارير مالية، نسخ احتياطي) |
| `secretary` | `employee123` | **Employee / Secretary** | إدارة الطلاب، الحضور والباركود، تسجيل المدفوعات، ورصد الدرجات |

---

## 📡 دليل الـ API Endpoints

جميع الردود تتبع التنسيق الموحد:

**رد النجاح (Success Response):**
```json
{
  "success": true,
  "data": { ... },
  "message": "تمت العملية بنجاح",
  "pagination": { "page": 1, "limit": 50, "total": 120, "totalPages": 3 }
}
```

**رد الخطأ (Error Response):**
```json
{
  "success": false,
  "error": {
    "code": "STUDENT_NOT_FOUND",
    "message": "الطالب غير موجود",
    "details": null
  }
}
```

---

### قائمة المسارات الرئيسية:

#### 1. التوثيق والمستخدمين (`/api/auth`, `/api/users`)
- `POST /api/auth/login`: تسجيل الدخول وإرجاع JWT Token.
- `POST /api/auth/logout`: تسجيل الخروج.
- `GET /api/auth/me`: بيانات المستخدم الحالي.
- `POST /api/auth/change-password`: تغيير كلمة المرور.
- `GET /api/users`: قائمة المستخدمين والموظفين (Admin).
- `POST /api/users`: إنشاء موظف جديد (Admin).
- `PUT /api/users/:id`: تعديل بيانات موظف (Admin).
- `PATCH /api/users/:id/disable`: تعطيل حساب موظف (Admin).
- `POST /api/users/:id/reset-password`: إعادة تعيين كلمة المرور لموظف (Admin).

#### 2. الطلاب والبحث السريع (`/api/students`)
- `GET /api/students`: جلب الطلاب بصفحات وتصفية (`grade`, `groupId`, `status`, `search`).
- `GET /api/students/search?q=...`: بحث سريع فوري ومفهرس بالاسم، الهاتف، هاتف ولي الأمر، أو الكود.
- `GET /api/students/check-duplicates`: فحص إمكانية تكرار الطالب قبل الحفظ.
- `GET /api/students/:id`: بيانات الطالب + التقرير المالي اللحظي + الحقول المخصصة.
- `GET /api/students/:id/card`: بيانات كارت الطالب مع صور الـ QR Code الجاهزة للطباعة.
- `POST /api/students`: إضافة طالب جديد مع توليد الكود والباركود تلقائيًا.
- `POST /api/students/quick-register`: تسجيل سريع ومختصر في الاستقبال.
- `PUT /api/students/:id`: تعديل بيانات الطالب.
- `DELETE /api/students/:id`: حذف ناعم للطالب (Soft Delete) مع تسجيل التدقيق.
- `GET /api/students/custom-fields` & `POST /api/students/custom-fields`: إدارة الحقول المخصصة.

#### 3. المدرسين والمجموعات (`/api/teachers`, `/api/groups`)
- `GET/POST/PUT/DELETE /api/teachers`: إدارة المدرسين.
- `GET /api/teachers/:id/stats`: إحصائيات المدرس والمجموعات والطلاب.
- `GET/POST/PUT/DELETE /api/groups`: إدارة المجموعات ومواعيد الحصص والقاعات.
- `GET /api/groups/:id/students`: عرض الطلاب المسجلين بالمجموعة.
- `POST /api/groups/:id/students`: تسجيل طالب بالمجموعة.
- `DELETE /api/groups/:id/students/:studentId`: إزالة طالب من المجموعة.

#### 4. الرسوم والمدفوعات (`/api/fees`, `/api/payments`)
- `GET /api/fees`: استعراض فواتير ورسوم الطلاب.
- `POST /api/fees`: إنشاء رسوم شهرية أو سنوية مع الخصومات.
- `GET /api/fees/student/:studentId`: ملخص الحساب المالي للطالب (المطلوب، المدفوع، المتبقي).
- `GET /api/payments`: سجل المدفوعات مع التصفية بالتواريخ والمستلم وطريقة الدفع.
- `POST /api/payments`: تسجيل دفعة مالية جديدة مع دعم الـ Idempotency وإرسال إشعار WhatsApp لولي الأمر.

#### 5. الحضور والباركود (`/api/attendance`)
- `GET /api/attendance/sessions`: استعراض جلسات الحضور.
- `POST /api/attendance/sessions`: فتح جلسة حضور جديدة لمجموعة.
- `PUT /api/attendance/sessions/:id/close`: إغلاق جلسة الحضور.
- `POST /api/attendance/scan`: ماسح الباركود/QR الموحد للحضور والانصراف الفوري.
- `POST /api/attendance/manual`: تسجيل الحضور اليدوي الجماعي لشبكة الطلاب.
- `GET /api/attendance/records`: سجلات الحضور والتصفية بالتواريخ والمجموعات والطلاب.
- `GET /api/attendance/suspicious`: تقرير حالات الحضور المشبوهة.

#### 6. الامتحانات ورصد الدرجات (`/api/exams`, `/api/exam-results`)
- `GET/POST/PUT/DELETE /api/exams`: إدارة الامتحانات والدرجات العظمى.
- `GET /api/exams/:id/results`: عرض درجات الطلاب في الامتحان.
- `GET /api/exam-results`: استعلام عام عن نتائج الامتحانات بتصفية الكود أو الامتحان أو الطالب.
- `POST /api/exams/:id/results`: حفظ ورصد درجات الطلاب مع التحقق من الحدود وإرسال إشعارات الدرجات لأولياء الأمور.

#### 7. استيراد وتصدير الإكسيل (`/api/import`, `/api/export`)
- `POST /api/import/students`: استيراد ملف إكسيل الطلاب مباشرة وحفظ السجلات الصالحة.
- `POST /api/import/students/preview`: معاينة وفحص ملف إكسيل الطلاب وتحديد المكرر وغير الصالح.
- `POST /api/import/students/commit`: استيراد الطلاب نهائيًا في قاعدة البيانات بـ Transaction ذرية.
- `POST /api/import/results`: استيراد درجات الطلاب مباشرة من ملف إكسيل وحفظ النتائج المطابقة.
- `POST /api/import/results/preview`: معاينة درجات الامتحانات مع المطابقة الذكية للطلاب.
- `POST /api/import/results/commit`: حفظ الدرجات المستوردة.
- `GET /api/export/students`: تصدير بيانات الطلاب كملف Excel منسق مع الرسوم والديون.
- `GET /api/export/payments`: تصدير سجل المدفوعات كملف Excel.
- `GET /api/export/attendance`: تصدير سجل الحضور كملف Excel.
- `GET /api/export/fees`: تصدير مستحقات وفواتير الطلاب كملف Excel.
- `GET /api/export/groups`: تصدير المجموعات والمواعيد والطلاب كملف Excel.
- `GET /api/export/teachers`: تصدير بيانات المدرسين والمواد كملف Excel.
- `GET /api/export/exams/:id`: تصدير درجات امتحان كملف Excel.

#### 8. المصروفات والتقارير (`/api/expenses`, `/api/reports`)
- `GET/POST/DELETE /api/expenses`: تسجيل مصروفات السنتر (إيجار، كهرباء، مرتبات، طباعة، صيانة...).
- `GET /api/reports/dashboard`: مؤشرات الصفحة الرئيسية (حضور اليوم، إيراد اليوم، الجلسات النشطة، الطلاب غير المسددين).
- `GET /api/reports/financial`: تقرير الإيرادات والمصروفات وصافي الأرباح ومصادر الدخل وتفصيل الإيراد حسب المجموعة `byGroup` وتفصيل المصروفات حسب الفئة `byCategory`.
- `GET /api/reports/attendance`: تقرير نسب ومعدلات الحضور والغياب.

#### 9. الإشعارات والنسخ الاحتياطي والإعدادات (`/api/notifications`, `/api/backups`, `/api/settings`, `/api/audit-logs`)
- `GET /api/notifications`: استعراض طابور رسائل الواتساب وحالتها.
- `POST /api/notifications/retry`: إعادة محاولة إرسال الرسائل الفاشلة.
- `POST /api/notifications/fee-reminders`: جدولة إشعارات تذكير سداد المستحقات المتأخرة للطلاب غير المسددين.
- `POST /api/notifications/test-send`: تجربة إرسال رسالة واتساب.
- `GET /api/backups`: استعراض ملفات النسخ الاحتياطي وأحجامها.
- `POST /api/backups/create`: أخذ نسخة احتياطية فورية.
- `POST /api/backups/restore`: استعادة نسخة احتياطية بأمان بعد فحص سلامتها.
- `GET /api/settings` & `PUT /api/settings`: تخصيص بيانات السنتر، العملة، وتفعيل/تعطيل الرسائل والموديولات.
- `GET /api/audit-logs`: سجل العمليات الأمنية والتدقيق للمدير.

---

## 🔒 بنية المزامنة السحابية (Online Sync Architecture)

لتحقيق الانتقال السلس للمزامنة السحابية دون الحاجة لإعادة كتابة الكود:
1. تحتوي جميع الجداول الحيوية على معرف عام فريد `sync_id` بتنسيق UUIDv4.
2. تتبع حالة السجل عبر عمود `sync_status` بقيم:
   - `local`: تم إنشاؤه محليًا في السنتر.
   - `pending`: بانتظار الإرسال للبوابة السحابية عند توفر الإنترنت.
   - `synced`: تمت مزامنته بنجاح مع السحابة.
   - `conflict`: وجود تضارب يحتاج حل قبل الاعتماد.
3. اعتماد طوابع زمنية موحدة بتنسيق ISO 8601 UTC في حقلي `created_at` و `updated_at`.
