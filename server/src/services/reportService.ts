import { getDatabase } from "../database/db.js";

export const reportService = {
  getDashboardStats() {
    const db = getDatabase();
    const today = new Date().toISOString().split("T")[0];

    // Total active students
    const totalStudentsRow = db.prepare("SELECT COUNT(*) as count FROM students WHERE is_deleted = 0 AND status = 'active'").get() as { count: number };

    // Today's attendance
    const todayAttendanceRow = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'present' OR status = 'late' THEN 1 ELSE 0 END), 0) as present_count,
        COALESCE(SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END), 0) as absent_count
      FROM attendance_records
      WHERE DATE(created_at) = ?
    `).get(today) as { present_count: number; absent_count: number };

    // Today's payments revenue
    const todayPaymentsRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_amount, COUNT(*) as count
      FROM payments
      WHERE payment_date = ?
    `).get(today) as { total_amount: number; count: number };

    // Active groups
    const activeGroupsRow = db.prepare("SELECT COUNT(*) as count FROM groups WHERE is_deleted = 0 AND status = 'active'").get() as { count: number };

    // Active open sessions
    const activeSessionsRow = db.prepare("SELECT COUNT(*) as count FROM attendance_sessions WHERE status = 'open'").get() as { count: number };

    // Unpaid/partially paid students count
    const unpaidStudentsRow = db.prepare(`
      SELECT COUNT(DISTINCT student_id) as count
      FROM fees
      WHERE status IN ('unpaid', 'partial')
    `).get() as { count: number };

    // Recent activities (from audit_logs)
    const recentActivities = db.prepare(`
      SELECT a.*, u.name as user_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 10
    `).all() as any[];

    return {
      totalStudents: totalStudentsRow.count,
      todayPresent: todayAttendanceRow.present_count,
      todayAbsent: todayAttendanceRow.absent_count,
      todayPayments: todayPaymentsRow.total_amount,
      todayPaymentsCount: todayPaymentsRow.count,
      activeGroups: activeGroupsRow.count,
      activeSessions: activeSessionsRow.count,
      unpaidStudentsCount: unpaidStudentsRow.count,
      recentActivities: recentActivities.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        userName: r.user_name || "النظام",
        createdAt: r.created_at,
      })),
    };
  },

  getFinancialReport(params?: { startDate?: string; endDate?: string }) {
    const db = getDatabase();
    const startDate = params?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const endDate = params?.endDate || new Date().toISOString().split("T")[0];

    // Total income
    const incomeRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_income, COUNT(*) as count
      FROM payments
      WHERE payment_date >= ? AND payment_date <= ?
    `).get(startDate, endDate) as { total_income: number; count: number };

    // Total expenses
    const expenseRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_expense, COUNT(*) as count
      FROM expenses
      WHERE expense_date >= ? AND expense_date <= ?
    `).get(startDate, endDate) as { total_expense: number; count: number };

    const totalIncome = incomeRow.total_income;
    const totalExpenses = expenseRow.total_expense;
    const netRevenue = totalIncome - totalExpenses;

    // Revenue by payment method
    const byMethodRows = db.prepare(`
      SELECT payment_method, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM payments
      WHERE payment_date >= ? AND payment_date <= ?
      GROUP BY payment_method
    `).all(startDate, endDate) as any[];

    // Revenue by teacher
    const byTeacherRows = db.prepare(`
      SELECT t.id, t.name, COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN fees f ON p.fee_id = f.id
      JOIN groups g ON f.group_id = g.id
      JOIN teachers t ON g.teacher_id = t.id
      WHERE p.payment_date >= ? AND p.payment_date <= ?
      GROUP BY t.id, t.name
      ORDER BY total DESC
    `).all(startDate, endDate) as any[];

    // Revenue by group
    const byGroupRows = db.prepare(`
      SELECT g.id, g.name, COALESCE(SUM(p.amount), 0) as total, COUNT(p.id) as count
      FROM payments p
      JOIN fees f ON p.fee_id = f.id
      JOIN groups g ON f.group_id = g.id
      WHERE p.payment_date >= ? AND p.payment_date <= ?
      GROUP BY g.id, g.name
      ORDER BY total DESC
    `).all(startDate, endDate) as any[];

    // Expenses by category
    const byCategoryRows = db.prepare(`
      SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM expenses
      WHERE expense_date >= ? AND expense_date <= ?
      GROUP BY category
      ORDER BY total DESC
    `).all(startDate, endDate) as any[];

    // Outstanding / unpaid fees - calculated per fee: fee balance = amount_after_discount - payments for this fee
    const outstandingRow = db.prepare(`
      SELECT COALESCE(SUM(
        f.amount_after_discount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.fee_id = f.id), 0)
      ), 0) as outstanding
      FROM fees f
      WHERE f.status IN ('unpaid', 'partial')
    `).get() as { outstanding: number };

    // Daily breakdown for charts
    const dailyIncomeRows = db.prepare(`
      SELECT payment_date as date, COALESCE(SUM(amount), 0) as income
      FROM payments
      WHERE payment_date >= ? AND payment_date <= ?
      GROUP BY payment_date
      ORDER BY payment_date ASC
    `).all(startDate, endDate) as any[];

    return {
      startDate,
      endDate,
      totalIncome,
      totalExpenses,
      netRevenue,
      outstandingFees: Math.max(0, outstandingRow?.outstanding || 0),
      byPaymentMethod: byMethodRows.map((r) => ({
        method: r.payment_method,
        amount: Number(r.total),
        count: Number(r.count),
      })),
      byTeacher: byTeacherRows.map((r) => ({
        teacherId: r.id,
        teacherName: r.name,
        amount: Number(r.total),
      })),
      byGroup: byGroupRows.map((r) => ({
        groupId: r.id,
        groupName: r.name,
        amount: Number(r.total),
        count: Number(r.count),
      })),
      byCategory: byCategoryRows.map((r) => ({
        category: r.category,
        amount: Number(r.total),
        count: Number(r.count),
      })),
      dailyIncome: dailyIncomeRows.map((r) => ({
        date: r.date,
        income: Number(r.income),
      })),
    };
  },

  getAttendanceReport(params?: { groupId?: string; startDate?: string; endDate?: string }) {
    const db = getDatabase();
    const conditions: string[] = [];
    const values: any[] = [];

    if (params?.groupId) {
      conditions.push("r.group_id = ?");
      values.push(params.groupId);
    }
    if (params?.startDate) {
      conditions.push("DATE(r.created_at) >= ?");
      values.push(params.startDate);
    }
    if (params?.endDate) {
      conditions.push("DATE(r.created_at) <= ?");
      values.push(params.endDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const statsRow = db.prepare(`
      SELECT 
        COUNT(*) as total_records,
        COALESCE(SUM(CASE WHEN r.status = 'present' THEN 1 ELSE 0 END), 0) as present_count,
        COALESCE(SUM(CASE WHEN r.status = 'absent' THEN 1 ELSE 0 END), 0) as absent_count,
        COALESCE(SUM(CASE WHEN r.status = 'late' THEN 1 ELSE 0 END), 0) as late_count,
        COALESCE(SUM(CASE WHEN r.status = 'excused' THEN 1 ELSE 0 END), 0) as excused_count
      FROM attendance_records r
      ${where}
    `).get(...values) as any;

    const total = statsRow.total_records || 0;
    const presentRate = total > 0 ? Math.round(((statsRow.present_count + statsRow.late_count) / total) * 100) : 0;

    return {
      totalRecords: total,
      presentCount: statsRow.present_count,
      absentCount: statsRow.absent_count,
      lateCount: statsRow.late_count,
      excusedCount: statsRow.excused_count,
      attendanceRatePercentage: presentRate,
    };
  },
};
