"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  FiChevronDown,
  FiEdit2,
  FiEye,
  FiPlus,
  FiPrinter,
  FiSearch,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";

import StudentDetailsModal from "@/components/students/StudentDetailsModal";

import StudentModal, {
  type StudentFormData,
} from "@/components/students/StudentModal";

import {
  studentService,
  type CreateStudentInput,
  type UpdateStudentInput,
} from "@/services/studentService";
import { groupService } from "@/services/groupService";

import type {
  Student,
  StudentStatus,
} from "@/types";

const statusLabels: Record<
  StudentStatus,
  string
> = {
  active: "نشط",
  inactive: "غير نشط",
  suspended: "متوقف",
};

export default function StudentsPage() {
  const [students, setStudents] =
    useState<Student[]>([]);

  const [
    availableGroups,
    setAvailableGroups,
  ] = useState<
    { id: string; name: string }[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState<
      "الكل" | StudentStatus
    >("الكل");

  const [group, setGroup] =
    useState("الكل");

  const [addModalOpen, setAddModalOpen] =
    useState(false);

  const [editModalOpen, setEditModalOpen] =
    useState(false);

  const [editingStudent, setEditingStudent] =
    useState<Student | null>(null);

  const [selectedStudent, setSelectedStudent] =
    useState<Student | null>(null);

  const [detailsOpen, setDetailsOpen] =
    useState(false);

  const [deleteStudent, setDeleteStudent] =
    useState<Student | null>(null);

  const [deleting, setDeleting] =
    useState(false);

  const [deleteError, setDeleteError] =
    useState("");

  const [page, setPage] = useState(1);

  useEffect(() => {
    let mounted = true;

    const loadGroups = async () => {
      try {
        const list = await groupService.list({});

        if (mounted) {
          setAvailableGroups(
            list.map((g) => ({
              id: g.id,
              name: g.name,
            })),
          );
        }
      } catch {
        if (mounted) {
          setAvailableGroups([]);
        }
      }
    };

    void loadGroups();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadStudents = async () => {
      try {
        setLoading(true);

        const data =
          await studentService.list();

        if (mounted) {
          setStudents(data);
        }
      } catch {
        if (mounted) {
          setStudents([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadStudents();

    return () => {
      mounted = false;
    };
  }, []);

  const groupNames = useMemo(() => {
    const map: Record<string, string> = {};

    for (const g of availableGroups) {
      map[g.id] = g.name;
    }

    return map;
  }, [availableGroups]);

  const groupFilterOptions = useMemo(
    () => [
      "الكل",
      ...availableGroups.map(
        (g) => g.id,
      ),
    ],
    [availableGroups],
  );

  const activeStudents = useMemo(
    () =>
      students.filter(
        (student) =>
          student.status ===
          "active",
      ).length,
    [students],
  );

  const studentsWithBalance =
    useMemo(
      () =>
        students.filter(
          (student) =>
            student.financial
              .remaining > 0,
        ).length,
      [students],
    );

  const totalBalance = useMemo(
    () =>
      students.reduce(
        (total, student) =>
          total +
          student.financial
            .remaining,
        0,
      ),
    [students],
  );

  const filteredStudents =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return students.filter(
        (student) => {
          const matchesSearch =
            !normalizedSearch ||
            student.name
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            (
              student.phone ?? ""
            ).includes(
              normalizedSearch,
            ) ||
            student.guardianName
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            student.studentId
              .toLowerCase()
              .includes(
                normalizedSearch,
              );

          const matchesStatus =
            status === "الكل" ||
            student.status ===
              status;

          const matchesGroup =
            group === "الكل" ||
            student.groupId ===
              group;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesGroup
          );
        },
      );
    }, [
      students,
      search,
      status,
      group,
    ]);

  const pageSize = 8;

  const pageCount = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(
          filteredStudents.length /
            pageSize,
        ),
      ),
    [filteredStudents],
  );

  const visibleStudents = useMemo(
    () =>
      filteredStudents.slice(
        (page - 1) * pageSize,
        page * pageSize,
      ),
    [filteredStudents, page],
  );

  const firstVisibleIndex =
    filteredStudents.length === 0
      ? 0
      : (page - 1) * pageSize + 1;

  const lastVisibleIndex =
    Math.min(
      page * pageSize,
      filteredStudents.length,
    );

  const handleAddStudent = async (
    data: StudentFormData,
  ) => {
    try {
      const payload: CreateStudentInput = {
        // studentId auto-generated by backend (STU-YYYY-XXXX) — never sent manually
        name: data.name.trim(),
        phone: data.phone.trim() || undefined,
        guardianName: data.guardianName.trim(),
        guardianPhone: data.guardianPhone.trim(),
        grade: data.grade,
        groupId: data.groupId?.trim() || undefined,
        address: data.address.trim() || undefined,
        status: data.status,
        notes: data.notes.trim() || undefined,
        customFields: data.customFields ?? [],
        /*
         * إنشاء ذري واحد في الـ Backend: الطالب + الفاتورة +
         * الدفعة الأولى بطريقة الدفع المختارة + الحالة المحسوبة.
         * الرد يحمل الملخص المالي (financial) جاهزاً — بلا طلبات
         * منفصلة ولا حالات جزئية متضاربة مع صفحة المصروفات.
         */
        finance: (() => {
          const total = Number(
            data.totalRequired ?? 0,
          );

          if (
            !Number.isFinite(total) ||
            total <= 0
          ) {
            return undefined;
          }

          return {
            totalRequired: total,
            initialPayment: Math.max(
              Number(
                data.initialPayment ?? 0,
              ),
              0,
            ),
            paymentMethod:
              data.paymentMethod ?? "cash",
          };
        })(),
      };

      const createdStudent =
        await studentService.create(payload);

      setStudents((current) => [
        createdStudent,
        ...current,
      ]);

      setAddModalOpen(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "تعذر إضافة الطالب";

      window.alert(message);
    }
  };

  const handleViewStudent = (
    student: Student,
  ) => {
    setSelectedStudent(student);
    setDetailsOpen(true);
  };

  const handleEditStudent = (
    student: Student,
  ) => {
    setEditingStudent(student);
    setDetailsOpen(false);
    setEditModalOpen(true);
  };

  const handleUpdateStudent =
    async (
      data: StudentFormData,
    ) => {
      if (!editingStudent) {
        return;
      }

      try {
        const payload: UpdateStudentInput = {
          // student_code is immutable — backend auto-generates it once
          name: data.name.trim(),
          phone: data.phone.trim() || undefined,
          guardianName: data.guardianName.trim(),
          guardianPhone: data.guardianPhone.trim(),
          grade: data.grade,
          groupId: data.groupId?.trim() || undefined,
          address: data.address.trim() || undefined,
          status: data.status,
          notes: data.notes.trim() || undefined,
          customFields: data.customFields ?? [],
        };

        const updatedStudent =
          await studentService.update(
            editingStudent.id,
            payload,
          );

        if (!updatedStudent) {
          window.alert(
            "تعذر العثور على الطالب",
          );
          return;
        }

        setStudents((current) =>
          current.map((student) =>
            student.id ===
            updatedStudent.id
              ? updatedStudent
              : student,
          ),
        );

        setSelectedStudent(
          (current) =>
            current?.id ===
            updatedStudent.id
              ? updatedStudent
              : current,
        );

        setEditModalOpen(false);
        setEditingStudent(null);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "تعذر تعديل بيانات الطالب";

        window.alert(message);
      }
    };

  const handleCloseDetails =
    () => {
      setDetailsOpen(false);
      setSelectedStudent(null);
    };

  const requestDeleteStudent = (
    student: Student,
  ) => {
    setDetailsOpen(false);
    setSelectedStudent(null);
    setDeleteError("");
    setDeleteStudent(student);
  };

  const confirmDeleteStudent =
    async () => {
      if (!deleteStudent || deleting) {
        return;
      }

      setDeleting(true);
      setDeleteError("");

      try {
        await studentService.delete(
          deleteStudent.id,
        );

        setStudents((current) =>
          current.filter(
            (student) =>
              student.id !==
              deleteStudent.id,
          ),
        );

        setDeleteStudent(null);
      } catch (error) {
        setDeleteError(
          error instanceof Error
            ? error.message
            : "تعذر حذف الطالب. حاول مرة أخرى.",
        );
      } finally {
        setDeleting(false);
      }
    };

  const clearFilters = () => {
    setSearch("");
    setStatus("الكل");
    setGroup("الكل");
    setPage(1);
  };

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#F3F6FC]"
    >
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <section className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>الرئيسية</span>
              <span>/</span>
              <span className="font-semibold text-[#1748EF]">
                الطلاب
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#10275B] sm:text-3xl">
              الطلاب
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              إدارة بيانات الطلاب ومتابعة حالتهم الدراسية والمالية.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <Link
              href="/students/bulk-card-printing"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#10275B] shadow-sm transition hover:border-[#C8D5FF] hover:bg-[#F8FAFF] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1748EF]/15 active:scale-[0.98] sm:h-12"
            >
              <FiPrinter size={17} />
              طباعة الكروت
            </Link>

            <button
              type="button"
              onClick={() =>
                setAddModalOpen(true)
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1748EF] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(23,72,239,0.55)] transition hover:bg-[#123BC7] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1748EF]/20 active:scale-[0.98] sm:h-12"
            >
              <FiPlus size={17} />
              إضافة طالب
            </button>
          </div>
        </section>

        <section className="mb-7 grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
          <SummaryCard
            label="إجمالي الطلاب"
            value={students.length}
            icon={
              <FiUsers size={19} />
            }
            iconClassName="bg-[#EEF3FF] text-[#1748EF]"
          />

          <SummaryCard
            label="الطلاب النشطون"
            value={activeStudents}
            description="من إجمالي الطلاب"
            valueClassName="text-emerald-600"
          />

          <SummaryCard
            label="عليهم مستحقات"
            value={
              studentsWithBalance
            }
            description="يحتاجون متابعة مالية"
            valueClassName="text-amber-600"
          />

          <SummaryCard
            label="إجمالي المستحقات"
            value={`${totalBalance.toLocaleString(
              "ar-EG",
            )} ج.م`}
            description="إجمالي الديون الحالية"
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_36px_-24px_rgba(16,39,91,0.28)]">
          <div className="border-b border-slate-100 p-4 sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <FiSearch
                  size={17}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(
                      event.target.value,
                    );

                    setPage(1);
                  }}
                  placeholder="ابحث باسم الطالب أو رقم الطالب أو الهاتف أو ولي الأمر..."
                  aria-label="البحث عن طالب"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-[#F7F9FD] pr-10 pl-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#1748EF] focus:bg-white focus:ring-4 focus:ring-[#1748EF]/10"
                />
              </div>

              <FilterSelect
                value={status}
                onChange={(value) => {
                  setStatus(
                    value as
                      | "الكل"
                      | StudentStatus,
                  );

                  setPage(1);
                }}
                ariaLabel="فلترة حسب الحالة"
              >
                <option value="الكل">
                  كل الحالات
                </option>

                <option value="active">
                  نشط
                </option>

                <option value="inactive">
                  غير نشط
                </option>

                <option value="suspended">
                  متوقف
                </option>
              </FilterSelect>

              <FilterSelect
                value={group}
                onChange={(value) => {
                  setGroup(value);

                  setPage(1);
                }}
                ariaLabel="فلترة حسب المجموعة"
              >
                {groupFilterOptions.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item ===
                      "الكل"
                        ? "كل المجموعات"
                        : groupNames[
                            item
                          ] ?? "غير معروفة"}
                    </option>
                  ),
                )}
              </FilterSelect>

              {(search ||
                status !==
                  "الكل" ||
                group !==
                  "الكل") && (
                <button
                  type="button"
                  onClick={
                    clearFilters
                  }
                  className="h-10 shrink-0 rounded-lg px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1748EF]/15"
                >
                  مسح الفلاتر
                </button>
              )}
            </div>
          </div>

          <div className="border-b border-slate-100 px-5 py-3.5">
            <p className="text-xs text-slate-400">
              تم العثور على{" "}
              <span className="font-semibold text-slate-600">
                {filteredStudents.length.toLocaleString(
                  "ar-EG",
                )}
              </span>{" "}
              طالب
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-right">
              <thead>
                <tr className="border-b border-slate-100 bg-[#F6F8FC]">
                  <TableHeader>
                    الطالب
                  </TableHeader>

                  <TableHeader>
                    ولي الأمر
                  </TableHeader>

                  <TableHeader>
                    المجموعة
                  </TableHeader>

                  <TableHeader>
                    المرحلة
                  </TableHeader>

                  <TableHeader>
                    الحالة
                  </TableHeader>

                  <TableHeader>
                    المستحقات
                  </TableHeader>

                  <TableHeader>
                    إجراءات
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-16 text-center text-sm text-slate-400"
                    >
                      جاري تحميل بيانات الطلاب...
                    </td>
                  </tr>
                ) : (
                  visibleStudents.map(
                    (student) => (
                      <tr
                        key={
                          student.id
                        }
                        className="border-b border-slate-100/80 transition-colors last:border-0 hover:bg-[#F7F9FF]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF3FF] text-xs font-bold text-[#1748EF]">
                              {student.name.charAt(
                                0,
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-800">
                                {student.name}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-400">
                                {
                                  student.studentId
                                }
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm text-slate-600">
                            {
                              student.guardianName
                            }
                          </p>

                          <p
                            dir="ltr"
                            className="mt-0.5 text-right text-xs text-slate-400"
                          >
                            {
                              student.guardianPhone
                            }
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                            {student.groupId
                              ? groupNames[
                                  student.groupId
                                ] ??
                                "غير محددة"
                              : "غير محددة"}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {student.grade}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              student.status ===
                              "active"
                                ? "bg-emerald-50 text-emerald-700"
                                : student.status ===
                                  "suspended"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {
                              statusLabels[
                                student.status
                              ]
                            }
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          {student.financial
                            .remaining ===
                          0 ? (
                            <span className="text-sm font-medium text-emerald-600">
                              لا يوجد
                            </span>
                          ) : (
                            <span className="text-sm font-semibold text-amber-600">
                              {student.financial.remaining.toLocaleString(
                                "ar-EG",
                              )}{" "}
                              ج.م
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            <ActionButton
                              label={`عرض ${student.name}`}
                              onClick={() =>
                                handleViewStudent(
                                  student,
                                )
                              }
                            >
                              <FiEye
                                size={16}
                              />
                            </ActionButton>

                            <ActionButton
                              label={`تعديل ${student.name}`}
                              onClick={() =>
                                handleEditStudent(
                                  student,
                                )
                              }
                            >
                              <FiEdit2
                                size={15}
                              />
                            </ActionButton>

                            <ActionButton
                              href={`/students/${student.id}/card-designer`}
                              label={`تصميم كارت ${student.name}`}
                            >
                              <FiPrinter
                                size={16}
                              />
                            </ActionButton>

                            <ActionButton
                              label={`حذف ${student.name}`}
                              tone="danger"
                              onClick={() =>
                                requestDeleteStudent(
                                  student,
                                )
                              }
                            >
                              <FiTrash2
                                size={15}
                              />
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>

            {!loading &&
              filteredStudents.length ===
                0 && (
                <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <FiSearch
                      size={20}
                    />
                  </div>

                  <h3 className="mt-4 text-sm font-bold text-slate-800">
                    لا توجد نتائج
                  </h3>

                  <p className="mt-1 text-xs text-slate-400">
                    جرّب تغيير كلمات البحث أو الفلاتر.
                  </p>

                  <button
                    type="button"
                    onClick={
                      clearFilters
                    }
                    className="mt-4 rounded-lg bg-[#EEF3FF] px-3 py-2 text-xs font-semibold text-[#123BC7] transition hover:bg-[#E1E9FF] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1748EF]/15"
                  >
                    مسح الفلاتر
                  </button>
                </div>
              )}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs text-slate-400">
              عرض{" "}
              <span className="font-semibold text-slate-600">
                {filteredStudents.length === 0
                  ? 0
                  : firstVisibleIndex.toLocaleString(
                      "ar-EG",
                    )}
              </span>
              {" - "}
              <span className="font-semibold text-slate-600">
                {lastVisibleIndex.toLocaleString(
                  "ar-EG",
                )}
              </span>{" "}
              من أصل{" "}
              <span className="font-semibold text-slate-600">
                {filteredStudents.length.toLocaleString(
                  "ar-EG",
                )}
              </span>{" "}
              طالب
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setPage((current) =>
                    Math.max(1, current - 1),
                  )
                }
                disabled={page === 1}
                className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:border-[#C8D5FF] hover:bg-[#F7F9FF] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1748EF]/15 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                السابق
              </button>

              {Array.from(
                { length: pageCount },
                (_, index) => index + 1,
              ).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() =>
                    setPage(pageNumber)
                  }
                  aria-current={
                    pageNumber === page
                      ? "page"
                      : undefined
                  }
                  className={`h-8 min-w-8 rounded-md px-2 text-xs font-semibold transition ${
                    pageNumber === page
                      ? "bg-[#1748EF] text-white shadow-sm"
                      : "border border-slate-200 text-slate-500 hover:border-[#C8D5FF] hover:bg-[#F7F9FF]"
                  }`}
                >
                  {pageNumber.toLocaleString(
                    "ar-EG",
                  )}
                </button>
              ))}

              <button
                type="button"
                onClick={() =>
                  setPage((current) =>
                    Math.min(
                      pageCount,
                      current + 1,
                    ),
                  )
                }
                disabled={page === pageCount}
                className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:border-[#C8D5FF] hover:bg-[#F7F9FF] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1748EF]/15 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                التالي
              </button>
            </div>
          </div>
        </section>
      </div>

      <StudentModal
        open={addModalOpen}
        onClose={() =>
          setAddModalOpen(false)
        }
        onSubmit={
          handleAddStudent
        }
        mode="add"
        showFinancialFields
      />

      <StudentModal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingStudent(null);
        }}
        onSubmit={
          handleUpdateStudent
        }
        mode="edit"
        initialData={
          editingStudent
        }
      />

      <StudentDetailsModal
        open={detailsOpen}
        student={
          selectedStudent
        }
        onClose={
          handleCloseDetails
        }
        onEdit={
          handleEditStudent
        }
        onDelete={
          requestDeleteStudent
        }
      />

      <DeleteStudentModal
        open={Boolean(deleteStudent)}
        student={deleteStudent}
        deleting={deleting}
        error={deleteError}
        onClose={() => {
          if (!deleting) {
            setDeleteStudent(null);
            setDeleteError("");
          }
        }}
        onConfirm={() =>
          void confirmDeleteStudent()
        }
      />
    </main>
  );
}

function SummaryCard({
  label,
  value,
  description,
  icon,
  iconClassName = "bg-slate-100 text-slate-500",
  valueClassName = "text-slate-900",
}: {
  label: string;
  value: number | string;
  description?: string;
  icon?: React.ReactNode;
  iconClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_28px_-22px_rgba(16,39,91,0.35)] transition-shadow hover:shadow-[0_12px_32px_-20px_rgba(16,39,91,0.32)] sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p
            className={`mt-2 text-2xl font-bold tracking-tight ${valueClassName}`}
          >
            {typeof value ===
            "number"
              ? value.toLocaleString(
                  "ar-EG",
                )
              : value}
          </p>

          {description && (
            <p className="mt-1 text-xs text-slate-400">
              {description}
            </p>
          )}
        </div>

        {icon && (
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  children,
  ariaLabel,
}: {
  value: string;
  onChange: (
    value: string,
  ) => void;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        aria-label={ariaLabel}
        className="h-11 min-w-36 appearance-none rounded-xl border border-slate-200 bg-white px-3 pl-9 text-sm text-slate-600 outline-none transition hover:border-slate-300 focus:border-[#1748EF] focus:ring-4 focus:ring-[#1748EF]/10"
      >
        {children}
      </select>

      <FiChevronDown
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}

function TableHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-5 py-3.5 text-xs font-semibold text-[#52627E]">
      {children}
    </th>
  );
}

function DeleteStudentModal({
  open,
  student,
  deleting,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  student: Student | null;
  deleting: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open || !student) {
    return null;
  }

  const remaining =
    student.financial?.remaining ?? 0;

  const blocked = remaining > 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#10275B]/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-student-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_-24px_rgba(16,39,91,0.5)]"
      >
        <div className="px-5 py-5 sm:px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-500">
            <FiTrash2 size={19} />
          </div>

          <h2
            id="delete-student-title"
            className="mt-3 text-base font-bold text-slate-900"
          >
            حذف الطالب
          </h2>

          <p className="mt-1 text-xs leading-6 text-slate-500">
            سيتم حذف الطالب{" "}
            <span className="font-bold text-slate-800">
              {student.name}
            </span>{" "}
            ({student.studentId}) من النظام
            نهائيًا.
          </p>

          {blocked ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium leading-6 text-amber-800"
            >
              لا يمكن حذف هذا الطالب قبل
              سداد المستحقات المتبقية
              (
              {remaining.toLocaleString(
                "ar-EG",
              )}{" "}
              ج.م). برجاء تحصيل المبلغ أولاً
              من صفحة المدفوعات ثم إعادة
              المحاولة.
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
              لا توجد مستحقات متبقية على
              هذا الطالب — يمكن إتمام
              الحذف بأمان.
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-medium text-red-600"
            >
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1748EF]/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting || blocked}
            className="h-10 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting
              ? "جاري الحذف..."
              : "تأكيد الحذف"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  label,
  onClick,
  href,
  tone = "default",
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  tone?: "default" | "danger";
}) {
  const className =
    tone === "danger"
      ? "flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
      : "flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-[#EEF3FF] hover:text-[#1748EF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1748EF]/30";

  if (href) {
    return (
      <Link
        href={href}
        aria-label={label}
        className={className}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={className}
    >
      {children}
    </button>
  );
}