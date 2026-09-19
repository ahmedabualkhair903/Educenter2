
"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  FiCalendar,
  FiChevronDown,
  FiCreditCard,
  FiDollarSign,
  FiEdit2,
  FiEye,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi";

import type {
  Payment,
  PaymentMethod,
  PaymentStatus,
  Student,
} from "@/types";

import {
  paymentService,
  studentService,
} from "@/services";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const STATUS_OPTIONS: Array<
  "all" | PaymentStatus
> = [
  "all",
  "paid",
  "partial",
  "unpaid",
];

const METHOD_LABELS: Record<
  PaymentMethod,
  string
> = {
  cash: "نقدي",
  bank_transfer: "تحويل بنكي",
  vodafone_cash: "فودافون كاش",
  instapay: "إنستاباي",
  other: "أخرى",
};

const STATUS_LABELS: Record<
  PaymentStatus,
  string
> = {
  paid: "مدفوعة",
  partial: "جزئي",
  unpaid: "غير مدفوعة",
};

function formatMoney(value: number) {
  return `${value.toLocaleString("ar-EG")} ج.م`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "ط";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 1);
  }

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`;
}

function getStudentFinance(
  student: Student,
  payments: Payment[],
  excludedPaymentId?: string,
) {
  const paid = payments
    .filter(
      (payment) =>
        payment.studentId === student.id &&
        payment.id !== excludedPaymentId,
    )
    .reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );

  const totalRequired =
    student.financial.totalRequired;

  const remaining = Math.max(
    totalRequired - paid,
    0,
  );

  let status: PaymentStatus;

  if (remaining === 0) {
    status = "paid";
  } else if (paid > 0) {
    status = "partial";
  } else {
    status = "unpaid";
  }

  return {
    totalRequired,
    paid,
    remaining,
    status,
  };
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function PaymentsPage() {
  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [students, setStudents] =
    useState<Student[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<"all" | PaymentStatus>("all");

  const [paymentModalOpen, setPaymentModalOpen] =
    useState(false);

  const [detailsModalOpen, setDetailsModalOpen] =
    useState(false);

  const [editingPayment, setEditingPayment] =
    useState<Payment | null>(null);

  const [statementStudent, setStatementStudent] =
    useState<Student | null>(null);

  const [presetStudentId, setPresetStudentId] =
    useState("");

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const [
          paymentsData,
          studentsData,
        ] = await Promise.all([
          paymentService.list(),
          studentService.list(),
        ]);

        if (!mounted) {
          return;
        }

        setPayments(paymentsData);
        setStudents(studentsData);
      } catch (error) {
        console.error(
          "Failed to load payment data:",
          error,
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const studentsMap = useMemo(() => {
    return new Map(
      students.map((student) => [
        student.id,
        student,
      ]),
    );
  }, [students]);

  /*
   * One row per student (dues statement) so the table always
   * matches the header stats, even before any payment exists.
   */
  const studentRows = useMemo(() => {
    return students.map((student) => {
      const finance = getStudentFinance(
        student,
        payments,
      );

      const studentPayments = payments
        .filter(
          (payment) =>
            payment.studentId ===
            student.id,
        )
        .sort((a, b) =>
          (
            b.paymentDate ??
            b.paidAt ??
            ""
          ).localeCompare(
            a.paymentDate ??
              a.paidAt ??
              "",
          ),
        );

      return {
        student,
        finance,
        payments: studentPayments,
        lastPayment:
          studentPayments[0] ?? null,
      };
    });
  }, [students, payments]);

  const filteredRows = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return studentRows.filter(
      ({ student, finance }) => {
        const matchesSearch =
          !query ||
          student.name
            .toLowerCase()
            .includes(query) ||
          student.phone
            ?.toLowerCase()
            .includes(query) ||
          student.guardianName
            .toLowerCase()
            .includes(query) ||
          student.guardianPhone
            .toLowerCase()
            .includes(query) ||
          student.studentId
            .toLowerCase()
            .includes(query);

        const matchesStatus =
          statusFilter === "all" ||
          finance.status === statusFilter;

        return (
          matchesSearch && matchesStatus
        );
      },
    );
  }, [
    studentRows,
    search,
    statusFilter,
  ]);

  const totalPaid = payments.reduce(
    (sum, payment) =>
      sum + payment.amount,
    0,
  );

  const totalRequired = students.reduce(
    (sum, student) =>
      sum + student.financial.totalRequired,
    0,
  );

  /*
   * إجمالي المتبقي = مجموع المتبقي لكل طالب على حدة (unpaid + partial)
   * وليس الصافي العام (totalRequired - totalPaid)، لأن الصافي يلتهم
   * المستحقات الحقيقية عند وجود مدفوعات غير مربوطة بفواتير أو دفعات
   * زائدة، فيظهر صفراً رغم وجود فواتير غير مدفوعة وجزئية.
   */
  const totalRemaining = studentRows.reduce(
    (sum, row) => sum + row.finance.remaining,
    0,
  );

  const partialRemaining = studentRows
    .filter(
      (row) =>
        row.finance.status === "partial",
    )
    .reduce(
      (sum, row) => sum + row.finance.remaining,
      0,
    );

  const unpaidRemaining = studentRows
    .filter(
      (row) =>
        row.finance.status === "unpaid",
    )
    .reduce(
      (sum, row) => sum + row.finance.remaining,
      0,
    );

  const paidCount = studentRows.filter(
    (row) => row.finance.status === "paid",
  ).length;

  const partialCount = studentRows.filter(
    (row) => row.finance.status === "partial",
  ).length;

  const unpaidCount = studentRows.filter(
    (row) => row.finance.status === "unpaid",
  ).length;

  const openAddModal = (
    studentId?: string,
  ) => {
    setEditingPayment(null);
    setPresetStudentId(studentId ?? "");
    setPaymentModalOpen(true);
  };

  const openEditModal = (
    payment: Payment,
  ) => {
    setDetailsModalOpen(false);
    setStatementStudent(null);
    setEditingPayment(payment);
    setPresetStudentId("");
    setPaymentModalOpen(true);
  };

  const openStatement = (
    student: Student,
  ) => {
    setStatementStudent(student);
    setDetailsModalOpen(true);
  };

  const statementFinance =
    statementStudent
      ? getStudentFinance(
          statementStudent,
          payments,
        )
      : null;

  const statementPayments =
    statementStudent
      ? payments
          .filter(
            (payment) =>
              payment.studentId ===
              statementStudent.id,
          )
          .sort((a, b) =>
            (
              b.paymentDate ??
              b.paidAt ??
              ""
            ).localeCompare(
              a.paymentDate ??
                a.paidAt ??
                "",
            ),
          )
      : [];

  const refreshData = async () => {
    const [
      paymentsData,
      studentsData,
    ] = await Promise.all([
      paymentService.list(),
      studentService.list(),
    ]);

    setPayments(paymentsData);
    setStudents(studentsData);
  };

  const handleSavePayment = async (
    data: Omit<Payment, "id" | "createdAt">,
  ) => {
    if (editingPayment) {
      const updated =
        await paymentService.update(
          editingPayment.id,
          {
            amount: data.amount,
            paymentMethod:
              data.paymentMethod,
            paymentDate:
              data.paymentDate,
            notes: data.notes,
          },
        );

      if (!updated) {
        throw new Error(
          "تعذر تحديث الدفعة.",
        );
      }
    } else {
      await paymentService.create({
        studentId: data.studentId,
        amount: data.amount,
        paymentMethod:
          data.paymentMethod,
        paymentDate: data.paymentDate,
        notes: data.notes,
      });
    }

    await refreshData();

    setPaymentModalOpen(false);
    setEditingPayment(null);
  };

  const handleDeletePayment = async (
    payment: Payment,
  ) => {
    const student =
      studentsMap.get(payment.studentId);

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف عملية الدفع الخاصة بالطالب "${student?.name ?? "الطالب"}"؟`,
    );

    if (!confirmed) {
      return;
    }

    const success =
      await paymentService.delete(
        payment.id,
      );

    if (!success) {
      window.alert("تعذر حذف الدفعة.");
      return;
    }

    await refreshData();
  };

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50"
    >
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        {/* Header */}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>الرئيسية</span>
              <span>/</span>
              <span className="text-teal-600">
                المدفوعات
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              المدفوعات والتحصيل
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              إدارة مدفوعات الطلاب ومتابعة المستحقات والمبالغ المتبقية.
            </p>
          </div>

          <button
            type="button"
            onClick={() => openAddModal()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 active:scale-[0.98]"
          >
            <FiPlus size={17} />
            تسجيل دفعة
          </button>
        </div>

        {/* Stats */}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PaymentStat
            icon={<FiDollarSign size={19} />}
            label="إجمالي المستحق"
            value={formatMoney(totalRequired)}
            valueClass="text-slate-900"
          />

          <PaymentStat
            icon={<FiCreditCard size={19} />}
            label="إجمالي المحصل"
            value={formatMoney(totalPaid)}
            valueClass="text-emerald-600"
          />

          <PaymentStat
            icon={<FiDollarSign size={19} />}
            label="إجمالي المتبقي"
            value={formatMoney(totalRemaining)}
            valueClass="text-red-600"
          />

          <PaymentStat
            icon={<FiUser size={19} />}
            label="عمليات الدفع"
            value={payments.length}
            valueClass="text-teal-600"
          />
        </section>

        {/* Status Summary */}

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <PaymentSummary
            label="مدفوعة بالكامل"
            value={paidCount}
            description="طلاب مكتملة مستحقاتهم"
            type="success"
          />

          <PaymentSummary
            label="مدفوعة جزئيًا"
            value={partialCount}
            description={`طلاب تحتاج متابعة • المتبقي: ${formatMoney(partialRemaining)}`}
            type="warning"
          />

          <PaymentSummary
            label="غير مدفوعة"
            value={unpaidCount}
            description={`طلاب تحتاج تحصيل • المتبقي: ${formatMoney(unpaidRemaining)}`}
            type="danger"
          />
        </section>

        {/* Main Card */}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Filters */}

          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <FiSearch
                  size={17}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="ابحث باسم الطالب أو رقم الطالب أو رقم العملية..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pr-9 pl-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                />
              </div>

              <PaymentFilter
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_OPTIONS}
                label="الحالة"
                getLabel={(value) =>
                  value === "all"
                    ? "كل الحالات"
                    : STATUS_LABELS[value]
                }
              />
            </div>
          </div>

          {/* Results */}

          <div className="border-b border-slate-100 px-5 py-3">
            <p className="text-xs text-slate-400">
              عرض{" "}
              <span className="font-semibold text-slate-600">
                {filteredRows.length}
              </span>{" "}
              طالب
            </p>
          </div>

          {/* Table */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-right">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    الطالب
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    إجمالي المستحق
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    إجمالي المدفوع
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    المتبقي
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    الحالة
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    آخر دفعة
                  </th>

                  <th className="w-36 px-5 py-3 text-xs font-semibold text-slate-500">
                    إجراءات
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map(
                  ({
                    student,
                    finance,
                    lastPayment,
                  }) => (
                    <tr
                      key={student.id}
                      className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">
                            {getInitials(
                              student.name,
                            )}
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {student.name}
                            </p>

                            <p className="mt-0.5 text-[11px] text-slate-400">
                              {student.studentId}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-sm font-semibold text-slate-700">
                          {formatMoney(
                            finance.totalRequired,
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-sm font-bold text-emerald-600">
                          {formatMoney(
                            finance.paid,
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {finance.remaining > 0 ? (
                          <span className="text-sm font-bold text-red-600">
                            {formatMoney(
                              finance.remaining,
                            )}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-emerald-600">
                            مكتمل
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <PaymentStatusBadge
                          status={finance.status}
                        />
                      </td>

                      <td className="px-5 py-4">
                        {lastPayment ? (
                          <div>
                            <p className="text-xs font-semibold text-slate-600">
                              {formatMoney(
                                lastPayment.amount,
                              )}
                            </p>

                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                              <FiCalendar
                                size={11}
                              />

                              {formatDate(
                                lastPayment.paymentDate ??
                                  lastPayment.paidAt ??
                                  "",
                              )}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            —
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              openStatement(
                                student,
                              )
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-teal-50 hover:text-teal-600"
                            title="كشف الحساب"
                            aria-label={`كشف حساب ${student.name}`}
                          >
                            <FiEye size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openAddModal(
                                student.id,
                              )
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600"
                            title="تسجيل دفعة"
                            aria-label={`تسجيل دفعة لـ ${student.name}`}
                          >
                            <FiPlus size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>

            {loading ? (
              <div className="flex min-h-64 items-center justify-center">
                <p className="text-sm text-slate-400">
                  جاري تحميل المدفوعات...
                </p>
              </div>
            ) : students.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <FiUsers size={20} />
                </div>

                <h3 className="mt-4 text-sm font-bold text-slate-800">
                  لا يوجد طلاب مسجلون بعد
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  أضف طالبًا من صفحة الطلاب لتظهر مستحقاته هنا تلقائيًا.
                </p>
              </div>
            ) : (
              filteredRows.length === 0 && (
                <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <FiCreditCard size={20} />
                  </div>

                  <h3 className="mt-4 text-sm font-bold text-slate-800">
                    لا توجد نتائج مطابقة
                  </h3>

                  <p className="mt-1 text-xs text-slate-400">
                    جرّب تغيير البحث أو الفلاتر.
                  </p>
                </div>
              )
            )}
          </div>

          {/* Footer */}

          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">
              إجمالي النتائج:{" "}
              <span className="font-semibold text-slate-600">
                {filteredRows.length}
              </span>
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                className="h-8 rounded-md border border-slate-200 px-3 text-xs text-slate-400"
              >
                السابق
              </button>

              <span className="flex h-8 min-w-8 items-center justify-center rounded-md bg-teal-600 px-2 text-xs font-semibold text-white">
                1
              </span>

              <button
                type="button"
                disabled
                className="h-8 rounded-md border border-slate-200 px-3 text-xs text-slate-400"
              >
                التالي
              </button>
            </div>
          </div>
        </section>
      </div>

      <PaymentModal
        key={`${editingPayment?.id ?? "new"}-${presetStudentId}`}
        open={paymentModalOpen}
        payment={editingPayment}
        students={students}
        payments={payments}
        presetStudentId={presetStudentId}
        onClose={() => {
          setPaymentModalOpen(false);
          setEditingPayment(null);
          setPresetStudentId("");
        }}
        onSubmit={handleSavePayment}
      />

      <StudentStatementModal
        open={detailsModalOpen}
        student={statementStudent}
        finance={statementFinance}
        payments={statementPayments}
        onClose={() => {
          setDetailsModalOpen(false);
          setStatementStudent(null);
        }}
        onAddPayment={(studentId) => {
          setDetailsModalOpen(false);
          setStatementStudent(null);
          openAddModal(studentId);
        }}
        onEditPayment={openEditModal}
        onDeletePayment={(payment) =>
          void handleDeletePayment(payment)
        }
      />
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Payment Stat                                                               */
/* -------------------------------------------------------------------------- */

function PaymentStat({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  valueClass: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p
            className={`mt-1 text-xl font-bold ${valueClass}`}
          >
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Summary                                                                    */
/* -------------------------------------------------------------------------- */

function PaymentSummary({
  label,
  value,
  description,
  type,
}: {
  label: string;
  value: number;
  description: string;
  type:
    | "success"
    | "warning"
    | "danger";
}) {
  const styles = {
    success: {
      box: "border-emerald-100 bg-emerald-50/50",
      dot: "bg-emerald-500",
      value: "text-emerald-700",
    },
    warning: {
      box: "border-amber-100 bg-amber-50/50",
      dot: "bg-amber-500",
      value: "text-amber-700",
    },
    danger: {
      box: "border-red-100 bg-red-50/50",
      dot: "bg-red-500",
      value: "text-red-700",
    },
  };

  const style = styles[type];

  return (
    <div
      className={`rounded-xl border p-4 ${style.box}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${style.dot}`}
          />

          <p className="text-xs font-semibold text-slate-600">
            {label}
          </p>
        </div>

        <span
          className={`text-xl font-bold ${style.value}`}
        >
          {value}
        </span>
      </div>

      <p className="mt-2 text-[11px] text-slate-400">
        {description}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Filter                                                                     */
/* -------------------------------------------------------------------------- */

function PaymentFilter<T extends string>({
  value,
  onChange,
  options,
  label,
  getLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: T[];
  label: string;
  getLabel: (value: T) => string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value as T)
        }
        aria-label={label}
        className="h-10 min-w-40 appearance-none rounded-lg border border-slate-200 bg-white px-3 pl-9 text-sm text-slate-600 outline-none transition hover:border-slate-300 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
      >
        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {getLabel(option)}
          </option>
        ))}
      </select>

      <FiChevronDown
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Status Badge                                                               */
/* -------------------------------------------------------------------------- */

function PaymentStatusBadge({
  status,
}: {
  status: PaymentStatus;
}) {
  const styles: Record<
    PaymentStatus,
    string
  > = {
    paid: "bg-emerald-50 text-emerald-700",
    partial:
      "bg-amber-50 text-amber-700",
    unpaid:
      "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Payment Modal                                                              */
/* -------------------------------------------------------------------------- */

function PaymentModal({
  open,
  payment,
  students,
  payments,
  presetStudentId = "",
  onClose,
  onSubmit,
}: {
  open: boolean;
  payment: Payment | null;
  students: Student[];
  payments: Payment[];
  presetStudentId?: string;
  onClose: () => void;
  onSubmit: (
    data: Omit<Payment, "id" | "createdAt">,
  ) => void | Promise<void>;
}) {
  const [studentId, setStudentId] =
    useState(
      payment?.studentId ??
        presetStudentId ??
        "",
    );

  const [amount, setAmount] =
    useState(String(payment?.amount ?? ""));

  const [method, setMethod] =
    useState<PaymentMethod>(
      payment?.paymentMethod ?? "cash",
    );

  const [paidAt, setPaidAt] =
    useState(
      payment?.paymentDate ??
        payment?.paidAt ??
        new Date()
          .toISOString()
          .slice(0, 10),
    );

  const [notes, setNotes] =
    useState(payment?.notes ?? "");

  const [error, setError] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  /*
   * The form state is intentionally initialized from the
   * current payment when the modal component mounts.
   *
   * When opening a different payment for editing, the parent
   * gives PaymentModal a new key so React remounts this form
   * with the correct initial values.
   */

  if (!open) {
    return null;
  }

  const selectedStudent =
    students.find(
      (student) =>
        student.id === studentId,
    );

  const previousPaid = selectedStudent
    ? getStudentFinance(
        selectedStudent,
        payments,
        payment?.id,
      ).paid
    : 0;

  const numericAmount =
    Number(amount) || 0;

  const projectedRemaining =
    selectedStudent
      ? Math.max(
          selectedStudent.financial
            .totalRequired -
            previousPaid -
            numericAmount,
          0,
        )
      : 0;

  const handleSubmit = async () => {
    if (!studentId) {
      setError("يرجى اختيار الطالب.");
      return;
    }

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setError(
        "قيمة الدفعة يجب أن تكون أكبر من صفر.",
      );
      return;
    }

    if (!paidAt) {
      setError(
        "يرجى تحديد تاريخ الدفع.",
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSubmit({
        studentId,
        amount: numericAmount,
        paymentMethod: method,
        paymentDate: paidAt,
        notes: notes.trim(),
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "تعذر حفظ الدفعة. حاول مرة أخرى.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}

        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {payment
                ? "تعديل عملية الدفع"
                : "تسجيل دفعة جديدة"}
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              أدخل بيانات عملية الدفع.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="إغلاق"
          >
            <FiX size={19} />
          </button>
        </div>

        {/* Body */}

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <PaymentFormField label="الطالب">
              <select
                value={studentId}
                onChange={(event) => {
                  setStudentId(
                    event.target.value,
                  );
                  setError("");
                }}
                className="field"
              >
                <option value="">
                  اختر الطالب
                </option>

                {students.map(
                  (student) => (
                    <option
                      key={student.id}
                      value={student.id}
                    >
                      {student.name} —{" "}
                      {student.studentId}
                    </option>
                  ),
                )}
              </select>
            </PaymentFormField>

            <PaymentFormField label="المبلغ المدفوع">
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => {
                  setAmount(
                    event.target.value,
                  );
                  setError("");
                }}
                placeholder="0"
                className="field"
              />
            </PaymentFormField>

            <PaymentFormField label="طريقة الدفع">
              <select
                value={method}
                onChange={(event) =>
                  setMethod(
                    event.target
                      .value as PaymentMethod,
                  )
                }
                className="field"
              >
                <option value="cash">
                  نقدي
                </option>

                <option value="bank_transfer">
                  تحويل بنكي
                </option>

                <option value="vodafone_cash">
                  فودافون كاش
                </option>

                <option value="instapay">
                  إنستاباي
                </option>

                <option value="other">
                  أخرى
                </option>
              </select>
            </PaymentFormField>

            <PaymentFormField label="تاريخ الدفع">
              <input
                type="date"
                value={paidAt}
                onChange={(event) =>
                  setPaidAt(
                    event.target.value,
                  )
                }
                className="field"
              />
            </PaymentFormField>

            <div className="sm:col-span-2">
              <PaymentFormField label="ملاحظات">
                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(
                      event.target.value,
                    )
                  }
                  placeholder="أضف أي ملاحظات خاصة بعملية الدفع..."
                  className="field min-h-24"
                />
              </PaymentFormField>
            </div>
          </div>

          {selectedStudent && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] text-slate-400">
                    إجمالي المستحق
                  </p>

                  <p className="mt-1 text-lg font-bold text-slate-800">
                    {formatMoney(
                      selectedStudent
                        .financial
                        .totalRequired,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-400">
                    المدفوع سابقًا
                  </p>

                  <p className="mt-1 text-lg font-bold text-emerald-600">
                    {formatMoney(previousPaid)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-400">
                    المتبقي بعد العملية
                  </p>

                  <p
                    className={`mt-1 text-lg font-bold ${
                      projectedRemaining > 0
                        ? "text-red-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {formatMoney(
                      projectedRemaining,
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="h-10 rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "جاري الحفظ..."
              : payment
                ? "حفظ التعديلات"
                : "تسجيل الدفعة"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Details Modal                                                              */
/* -------------------------------------------------------------------------- */

function StudentStatementModal({
  open,
  student,
  finance,
  payments,
  onClose,
  onAddPayment,
  onEditPayment,
  onDeletePayment,
}: {
  open: boolean;
  student: Student | null;
  finance: {
    totalRequired: number;
    paid: number;
    remaining: number;
    status: PaymentStatus;
  } | null;
  payments: Payment[];
  onClose: () => void;
  onAddPayment: (
    studentId: string,
  ) => void;
  onEditPayment: (
    payment: Payment,
  ) => void;
  onDeletePayment: (
    payment: Payment,
  ) => void;
}) {
  if (
    !open ||
    !student ||
    !finance
  ) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}

        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                كشف الحساب
              </h2>

              <PaymentStatusBadge
                status={finance.status}
              />
            </div>

            <p className="mt-1 text-xs text-slate-400">
              سجل مدفوعات الطالب ومستحقاته
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="إغلاق"
          >
            <FiX size={19} />
          </button>
        </div>

        {/* Body */}

        <div className="px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-700">
              {getInitials(student.name)}
            </div>

            <div>
              <p className="text-sm font-bold text-slate-800">
                {student.name}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                {student.studentId}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PaymentInfo
              label="إجمالي المستحق"
              value={formatMoney(
                finance.totalRequired,
              )}
            />

            <PaymentInfo
              label="إجمالي المدفوع"
              value={formatMoney(finance.paid)}
              valueClass="text-emerald-600"
            />

            <PaymentInfo
              label="المبلغ المتبقي"
              value={formatMoney(
                finance.remaining,
              )}
              valueClass={
                finance.remaining > 0
                  ? "text-red-600"
                  : "text-emerald-600"
              }
            />

            <PaymentInfo
              label="عدد عمليات الدفع"
              value={String(
                payments.length,
              )}
            />
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-slate-600">
              سجل العمليات
            </p>

            {payments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
                <p className="text-xs font-medium text-slate-500">
                  لا توجد مدفوعات مسجلة بعد
                </p>

                <p className="mt-1 text-[11px] text-slate-400">
                  سجّل أول دفعة لهذا الطالب من زر &quot;تسجيل دفعة&quot;.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                {payments.map(
                  (payment, index) => (
                    <div
                      key={payment.id}
                      className={`flex items-center gap-3 px-4 py-3 ${
                        index > 0
                          ? "border-t border-slate-100"
                          : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-emerald-600">
                          {formatMoney(
                            payment.amount,
                          )}
                        </p>

                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {
                            METHOD_LABELS[
                              payment.paymentMethod
                            ]
                          }
                          {" · "}
                          {formatDate(
                            payment.paymentDate ??
                              payment.paidAt ??
                              "",
                          )}
                        </p>

                        {payment.notes && (
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">
                            {payment.notes}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onEditPayment(
                            payment,
                          )
                        }
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        title="تعديل العملية"
                        aria-label="تعديل العملية"
                      >
                        <FiEdit2
                          size={15}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onDeletePayment(
                            payment,
                          )
                        }
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        title="حذف العملية"
                        aria-label="حذف العملية"
                      >
                        <FiTrash2
                          size={15}
                        />
                      </button>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            إغلاق
          </button>

          <button
            type="button"
            onClick={() =>
              onAddPayment(student.id)
            }
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            <FiPlus size={15} />
            تسجيل دفعة
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small Components                                                           */
/* -------------------------------------------------------------------------- */

function PaymentFormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </span>

      {children}
    </label>
  );
}

function PaymentInfo({
  label,
  value,
  valueClass = "text-slate-700",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1.5 text-sm font-semibold ${valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}
