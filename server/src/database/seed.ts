import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { closeDatabase, getDatabase } from "./db.js";

async function seed() {
  console.log("🌱 Seeding Educational Center Management System Database...");
  const db = getDatabase();

  const now = new Date().toISOString();
  const today = now.split("T")[0];

  // 1. Admin & Employee Accounts
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const employeePasswordHash = await bcrypt.hash("employee123", 10);

  const adminId = "user_admin_01";
  const employeeId = "user_employee_01";

  db.prepare(`
    INSERT INTO users (id, name, username, password_hash, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash
  `).run(adminId, "مدير السنتر", "admin", adminPasswordHash, "admin", now, now);

  db.prepare(`
    INSERT INTO users (id, name, username, password_hash, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash
  `).run(employeeId, "سارة أحمد - سكرتارية", "secretary", employeePasswordHash, "employee", now, now);

  console.log("✅ Users seeded (admin / admin123, secretary / employee123)");

  // 2. Teachers
  const teacher1Id = "t_01";
  const teacher2Id = "t_02";

  db.prepare(`
    INSERT INTO teachers (id, name, phone, subject, notes, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(teacher1Id, "أ. محمد عبد الله", "01011112222", "فيزياء", "مدرس أول فيزياء ثانوية عامة", now, now);

  db.prepare(`
    INSERT INTO teachers (id, name, phone, subject, notes, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(teacher2Id, "أ. محمود فوزي", "01233334444", "رياضيات", "مدرس أول رياضيات وإحصاء", now, now);

  console.log("✅ Teachers seeded");

  // 3. Groups
  const group1Id = "g_01";
  const group2Id = "g_02";
  const group3Id = "g_03";

  db.prepare(`
    INSERT INTO groups (id, name, teacher_id, subject, grade, room, capacity, schedule, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(
    group1Id,
    "فيزياء - 3ث - مجموعة السبت والثلاثاء",
    teacher1Id,
    "فيزياء",
    "الصف الثالث الثانوي",
    "قاعة 1",
    35,
    JSON.stringify([
      { day: "السبت", startTime: "17:00", endTime: "19:00" },
      { day: "الثلاثاء", startTime: "17:00", endTime: "19:00" },
    ]),
    now,
    now
  );

  db.prepare(`
    INSERT INTO groups (id, name, teacher_id, subject, grade, room, capacity, schedule, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(
    group2Id,
    "فيزياء - 2ث - مجموعة الأحد والأربعاء",
    teacher1Id,
    "فيزياء",
    "الصف الثاني الثانوي",
    "قاعة 2",
    30,
    JSON.stringify([
      { day: "الأحد", startTime: "16:00", endTime: "18:00" },
      { day: "الأربعاء", startTime: "16:00", endTime: "18:00" },
    ]),
    now,
    now
  );

  db.prepare(`
    INSERT INTO groups (id, name, teacher_id, subject, grade, room, capacity, schedule, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(
    group3Id,
    "رياضيات - 3ث - مجموعة التفاضل والتكامل",
    teacher2Id,
    "رياضيات",
    "الصف الثالث الثانوي",
    "قاعة 3",
    40,
    JSON.stringify([
      { day: "الاثنين", startTime: "18:00", endTime: "20:00" },
      { day: "الخميس", startTime: "18:00", endTime: "20:00" },
    ]),
    now,
    now
  );

  console.log("✅ Groups seeded");

  // 4. Seed 20 Students
  const sampleStudents = [
    { name: "أحمد علي إبراهيم", phone: "01091234561", guardianPhone: "01191234561", grade: "الصف الثالث الثانوي", groupId: group1Id },
    { name: "عمر خالد محمود", phone: "01091234562", guardianPhone: "01191234562", grade: "الصف الثالث الثانوي", groupId: group1Id },
    { name: "محمود حسن مصطفى", phone: "01091234563", guardianPhone: "01191234563", grade: "الصف الثالث الثانوي", groupId: group1Id },
    { name: "يوسف محمد سامي", phone: "01091234564", guardianPhone: "01191234564", grade: "الصف الثالث الثانوي", groupId: group1Id },
    { name: "زياد طارق عادل", phone: "01091234565", guardianPhone: "01191234565", grade: "الصف الثالث الثانوي", groupId: group1Id },
    { name: "كريم شريف النجار", phone: "01091234566", guardianPhone: "01191234566", grade: "الصف الثالث الثانوي", groupId: group1Id },
    { name: "حمزة يحيى عبد الرحمن", phone: "01091234567", guardianPhone: "01191234567", grade: "الصف الثالث الثانوي", groupId: group1Id },
    { name: "مريم حسام الدين", phone: "01091234568", guardianPhone: "01191234568", grade: "الصف الثالث الثانوي", groupId: group1Id },
    { name: "نور وائل المصري", phone: "01091234569", guardianPhone: "01191234569", grade: "الصف الثالث الثانوي", groupId: group1Id },
    { name: "سارة هشام توفيق", phone: "01091234570", guardianPhone: "01191234570", grade: "الصف الثالث الثانوي", groupId: group1Id },
    { name: "حبيبة أشرف فتحي", phone: "01091234571", guardianPhone: "01191234571", grade: "الصف الثاني الثانوي", groupId: group2Id },
    { name: "آية تامر صلاح", phone: "01091234572", guardianPhone: "01191234572", grade: "الصف الثاني الثانوي", groupId: group2Id },
    { name: "فاطمة عمار ياسر", phone: "01091234573", guardianPhone: "01191234573", grade: "الصف الثاني الثانوي", groupId: group2Id },
    { name: "جنى وليد السعدني", phone: "01091234574", guardianPhone: "01191234574", grade: "الصف الثاني الثانوي", groupId: group2Id },
    { name: "مازن حازم البدري", phone: "01091234575", guardianPhone: "01191234575", grade: "الصف الثاني الثانوي", groupId: group2Id },
    { name: "إياد رامي عبد السميع", phone: "01091234576", guardianPhone: "01191234576", grade: "الصف الثالث الثانوي", groupId: group3Id },
    { name: "بلال إيهاب نصر", phone: "01091234577", guardianPhone: "01191234577", grade: "الصف الثالث الثانوي", groupId: group3Id },
    { name: "معاذ مصطفى كامل", phone: "01091234578", guardianPhone: "01191234578", grade: "الصف الثالث الثانوي", groupId: group3Id },
    { name: "ملك علاء الدين", phone: "01091234579", guardianPhone: "01191234579", grade: "الصف الثالث الثانوي", groupId: group3Id },
    { name: "فريدة شادي المهدي", phone: "01091234580", guardianPhone: "01191234580", grade: "الصف الثالث الثانوي", groupId: group3Id },
  ];

  const studentIds: string[] = [];

  for (let i = 0; i < sampleStudents.length; i++) {
    const s = sampleStudents[i];
    const sId = `stu_seed_${i + 1}`;
    const code = `STU-${(i + 1).toString().padStart(6, "0")}`;
    const barcode = code;
    studentIds.push(sId);

    db.prepare(`
      INSERT INTO students (
        id, student_code, full_name, phone, guardian_name, guardian_phone,
        grade, group_id, status, barcode, guardian_barcode, custom_fields, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, '[]', ?, ?
      ) ON CONFLICT(id) DO NOTHING
    `).run(
      sId,
      code,
      s.name,
      s.phone,
      `ولي أمر ${s.name}`,
      s.guardianPhone,
      s.grade,
      s.groupId,
      barcode,
      `G-${barcode}`,
      now,
      now
    );

    // Enroll in student_groups
    db.prepare(`
      INSERT INTO student_groups (id, student_id, group_id, join_date, status, created_at)
      VALUES (?, ?, ?, ?, 'active', ?)
      ON CONFLICT(student_id, group_id) DO NOTHING
    `).run(`${sId}_${s.groupId}`, sId, s.groupId, today, now);

    // 5. Create Monthly Fee & Payments
    const feeId = `fee_seed_${i + 1}`;
    const feeAmount = 350;
    const isPaid = i % 2 === 0;
    const paidAmount = isPaid ? feeAmount : (i % 3 === 0 ? 150 : 0);
    const feeStatus = isPaid ? "paid" : (paidAmount > 0 ? "partial" : "unpaid");

    db.prepare(`
      INSERT INTO fees (id, student_id, group_id, amount_required, discount, amount_after_discount, period, due_date, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, 'سبتمبر 2026', ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run(feeId, sId, s.groupId, feeAmount, feeAmount, today, feeStatus, now, now);

    if (paidAmount > 0) {
      const payId = `pay_seed_${i + 1}`;
      db.prepare(`
        INSERT INTO payments (id, student_id, fee_id, amount, payment_method, payment_date, received_by, created_at)
        VALUES (?, ?, ?, ?, 'cash', ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(payId, sId, feeId, paidAmount, today, adminId, now);
    }
  }

  console.log("✅ 20 Students, Fees, and Payments seeded");

  // 6. Attendance Session & Records
  const sessionId = "sess_seed_01";
  db.prepare(`
    INSERT INTO attendance_sessions (id, group_id, date, start_time, status, opened_by, created_at)
    VALUES (?, ?, ?, '17:00', 'open', ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(sessionId, group1Id, today, adminId, now);

  // Mark first 6 students present
  for (let i = 0; i < 6; i++) {
    const sId = studentIds[i];
    const recId = `att_seed_${i + 1}`;
    db.prepare(`
      INSERT INTO attendance_records (id, session_id, student_id, group_id, status, check_in_time, method, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'present', '17:05', 'barcode', ?, ?)
      ON CONFLICT(session_id, student_id) DO NOTHING
    `).run(recId, sessionId, sId, group1Id, now, now);
  }

  console.log("✅ Attendance Session and Records seeded");

  // 7. Exam & Results
  const examId = "exam_seed_01";
  db.prepare(`
    INSERT INTO exams (id, group_id, name, subject, exam_date, max_score, notes, created_at, updated_at)
    VALUES (?, ?, 'امتحان شامل على الفصل الأول', 'فيزياء', ?, 50, 'امتحان الفيزياء الشهري', ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(examId, group1Id, today, now, now);

  const sampleScores = [48, 45, 50, 42, 38, 49, 44, 46, 35, 47];
  for (let i = 0; i < Math.min(10, studentIds.length); i++) {
    const sId = studentIds[i];
    const resId = `res_seed_${i + 1}`;
    db.prepare(`
      INSERT INTO exam_results (id, exam_id, student_id, score, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'approved', ?, ?)
      ON CONFLICT(exam_id, student_id) DO NOTHING
    `).run(resId, examId, sId, sampleScores[i], now, now);
  }

  console.log("✅ Exam and Student Results seeded");

  // 8. Sample Expenses
  db.prepare(`
    INSERT INTO expenses (id, category, amount, description, expense_date, created_by, created_at)
    VALUES ('exp_01', 'Rent', 5000, 'إيجار مقر السنتر لشهر سبتمبر', ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(today, adminId, now);

  db.prepare(`
    INSERT INTO expenses (id, category, amount, description, expense_date, created_by, created_at)
    VALUES ('exp_02', 'Printing', 850, 'طباعة مذكرات الفيزياء والرياضيات', ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(today, adminId, now);

  console.log("✅ Expenses seeded");

  closeDatabase();
  console.log("\n🎉 Database Seeding Completed Successfully!");
}

seed().catch((err) => {
  console.error("❌ Seeding Error:", err);
  process.exit(1);
});
