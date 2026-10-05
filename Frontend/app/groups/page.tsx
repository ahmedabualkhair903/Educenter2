
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiEdit2,
  FiEye,
  FiMoreHorizontal,
  FiPauseCircle,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUsers,
  FiX,
} from "react-icons/fi";

import { groupService, studentService, teacherService } from "@/services";

import TimePicker from "@/components/common/TimePicker";

type GroupStatus = "نشطة" | "متوقفة";

type Group = {
  id: string;
  name: string;
  subject: string;
  grade: string;
  teacher: string;
  room: string;
  students: number;
  maxStudents: number;
  schedule: string;
  time: string;
  status: GroupStatus;
};

const GROUP_STATUSES: GroupStatus[] = ["نشطة", "متوقفة"];

const STATUS_MAP: Record<string, GroupStatus> = {
  active: "نشطة",
  inactive: "متوقفة",
};

const STATUS_REVERSE: Record<GroupStatus, "active" | "inactive"> = {
  "نشطة": "active",
  "متوقفة": "inactive",
};

const PAGE_SIZE = 5;

const subjects = [
  "الرياضيات",
  "اللغة الإنجليزية",
  "الفيزياء",
  "الكيمياء",
  "اللغة العربية",
  "أخرى",
];

const WEEKDAYS = [
  "السبت",
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
];

const grades = [
  "أولى إعدادي",
  "ثانية إعدادي",
  "ثالثة إعدادي",
  "أولى ثانوي",
  "ثانية ثانوي",
  "ثالثة ثانوي",
];

const teachers = [
  "أحمد محمود",
  "محمد علي",
  "خالد حسن",
  "محمود أحمد",
  "سارة محمد",
];

const rooms = ["قاعة 1", "قاعة 2", "قاعة 3", "قاعة 4"];

const toArabicTime = (time: string): string => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());

  if (!match) {
    return time;
  }

  const hours = Number(match[1]);
  const minutes = match[2];
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;

  return `${String(displayHours).padStart(2, "0")}:${minutes} ${
    hours >= 12 ? "م" : "ص"
  }`;
};

const to24HourTime = (time: string): string => {
  const parts = time.trim().split(/\s+/);
  const match = /^(\d{1,2}):(\d{2})$/.exec(parts[0] ?? "");

  if (!match) {
    return time;
  }

  let hours = Number(match[1]);
  const minutes = match[2];
  const marker = parts.slice(1).join(" ");

  if (marker.includes("م") && hours < 12) {
    hours += 12;
  }

  if (marker.includes("ص") && hours === 12) {
    hours = 0;
  }

  return `${String(hours).padStart(2, "0")}:${minutes}`;
};

function mapServiceGroup(
  g: {
    id: string;
    name: string;
    subject: string;
    grade: string;
    teacher?: string;
    room?: string;
    maxStudents: number;
    schedule: { day: string; startTime: string; endTime?: string }[];
    status: "active" | "inactive";
  },
): Group {
  return {
    id: g.id,
    name: g.name,
    subject: g.subject,
    grade: g.grade,
    teacher: g.teacher ?? "",
    room: g.room ?? "",
    students: 0,
    maxStudents: g.maxStudents,
    schedule: g.schedule.map((s) => s.day).join(" - "),
    time:
      g.schedule.length > 0
        ? g.schedule[0].startTime
        : "",
    status: STATUS_MAP[g.status] ?? "نشطة",
  };
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const [allTeachers, setAllTeachers] = useState<
    { id: string; name: string }[]
  >([]);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState<"الكل" | GroupStatus>("الكل");

  const [subjectFilter, setSubjectFilter] = useState("الكل");

  const [currentPage, setCurrentPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);

  const [detailsOpen, setDetailsOpen] = useState(false);

  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [deleteGroup, setDeleteGroup] = useState<Group | null>(null);

  /*
   * Used as a remount key for GroupModal.
   * This allows the modal form to initialize directly from its props
   * without synchronously calling setState inside an effect.
   */
  const [modalInstance, setModalInstance] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [groupList, studentList, teacherList] = await Promise.all([
          groupService.list(),
          studentService.list(),
          teacherService.list().catch(() => []),
        ]);

        if (mounted) {
          const counts: Record<string, number> = {};

          for (const student of studentList) {
            if (student.groupId) {
              counts[student.groupId] =
                (counts[student.groupId] ?? 0) + 1;
            }
          }

          setAllTeachers(
            teacherList.map((teacher) => ({
              id: teacher.id,
              name: teacher.name,
            })),
          );

          setGroups(
            groupList.map((group) => ({
              ...mapServiceGroup(group),
              students: counts[group.id] ?? 0,
            })),
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadData();
    return () => { mounted = false; };
  }, []);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();

    return groups.filter((group) => {
      const matchesSearch =
        !query ||
        group.name.toLowerCase().includes(query) ||
        group.subject.toLowerCase().includes(query) ||
        group.teacher.toLowerCase().includes(query) ||
        group.grade.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "الكل" || group.status === statusFilter;

      const matchesSubject =
        subjectFilter === "الكل" || group.subject === subjectFilter;

      return matchesSearch && matchesStatus && matchesSubject;
    });
  }, [groups, search, statusFilter, subjectFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredGroups.length / PAGE_SIZE),
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedGroups = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;

    return filteredGroups.slice(start, start + PAGE_SIZE);
  }, [filteredGroups, safeCurrentPage]);

  const activeGroups = groups.filter(
    (group) => group.status === "نشطة",
  ).length;

  const totalStudents = groups.reduce(
    (total, group) => total + group.students,
    0,
  );

  const totalCapacity = groups.reduce(
    (total, group) => total + group.maxStudents,
    0,
  );

  const availableSeats = Math.max(
    totalCapacity - totalStudents,
    0,
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (deleteGroup) {
        setDeleteGroup(null);
        return;
      }

      if (modalOpen) {
        setModalOpen(false);
        setEditingGroup(null);
        return;
      }

      if (detailsOpen) {
        setDetailsOpen(false);
        setSelectedGroup(null);
        return;
      }

      if (openMenuId !== null) {
        setOpenMenuId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [deleteGroup, modalOpen, detailsOpen, openMenuId]);

  useEffect(() => {
    const hasOverlay =
      modalOpen || detailsOpen || Boolean(deleteGroup);

    document.body.style.overflow = hasOverlay ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen, detailsOpen, deleteGroup]);

  const openAddModal = () => {
    setOpenMenuId(null);
    setEditingGroup(null);
    setModalInstance((value) => value + 1);
    setModalOpen(true);
  };

  const openEditModal = (group: Group) => {
    setOpenMenuId(null);
    setDetailsOpen(false);
    setSelectedGroup(null);
    setEditingGroup(group);
    setModalInstance((value) => value + 1);
    setModalOpen(true);
  };

  const openDetails = (group: Group) => {
    setOpenMenuId(null);
    setSelectedGroup(group);
    setDetailsOpen(true);
  };

  const toggleGroupStatus = async (group: Group) => {
    const newStatus = group.status === "نشطة" ? "inactive" : "active";
    const result = await groupService.update(group.id, { status: newStatus });
    if (result) {
      setGroups((current) =>
        current.map((item) =>
          item.id === group.id
            ? { ...item, status: newStatus === "active" ? "نشطة" : "متوقفة" }
            : item,
        ),
      );
    }
    setOpenMenuId(null);
  };

  const requestDelete = (group: Group) => {
    setOpenMenuId(null);
    setDeleteGroup(group);
  };

  const confirmDelete = async () => {
    if (!deleteGroup) {
      return;
    }

    const success = await groupService.delete(deleteGroup.id);

    if (success) {
      setGroups((current) =>
        current.filter((group) => group.id !== deleteGroup.id),
      );

      if (selectedGroup?.id === deleteGroup.id) {
        setSelectedGroup(null);
        setDetailsOpen(false);
      }
    }

    setDeleteGroup(null);
  };

  const handleSaveGroup = async (
    groupData: Omit<Group, "id" | "students" | "schedule"> & {
      schedule: string[];
      teacherId?: string;
    },
  ) => {
    const nextSchedule = (Array.isArray(groupData.schedule)
      ? groupData.schedule
      : String(groupData.schedule)
          .split(" - ")
          .map((day) => day.trim())
          .filter(Boolean)
    ).map((day) => ({
      day,
      startTime: groupData.time,
    }));

    const groupForState = {
      ...groupData,
      schedule: Array.isArray(groupData.schedule)
        ? groupData.schedule.join(" - ")
        : String(groupData.schedule),
    };

    try {
      if (editingGroup) {
        const result = await groupService.update(editingGroup.id, {
          name: groupData.name,
          subject: groupData.subject,
          grade: groupData.grade,
          teacher: groupData.teacher,
          teacherId: groupData.teacherId,
          room: groupData.room,
          maxStudents: groupData.maxStudents,
          capacity: groupData.maxStudents,
          schedule: nextSchedule,
          status: STATUS_REVERSE[groupData.status],
        });
        if (result) {
          setGroups((current) =>
            current.map((group) =>
              group.id === editingGroup.id
                ? { ...group, ...groupForState }
                : group,
            ),
          );
        }
      } else {
        const result = await groupService.create({
          name: groupData.name,
          subject: groupData.subject,
          grade: groupData.grade,
          teacher: groupData.teacher,
          teacherId: groupData.teacherId,
          room: groupData.room,
          maxStudents: groupData.maxStudents,
          capacity: groupData.maxStudents,
          schedule: nextSchedule,
          status: STATUS_REVERSE[groupData.status],
        });
        setGroups((current) => [
          { ...groupForState, id: result.id, students: 0 },
          ...current,
        ]);
      }

      setModalOpen(false);
      setEditingGroup(null);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "تعذر حفظ المجموعة. حاول مرة أخرى.",
      );
    }
  };

  const resultStart =
    filteredGroups.length === 0
      ? 0
      : (safeCurrentPage - 1) * PAGE_SIZE + 1;

  const resultEnd = Math.min(
    safeCurrentPage * PAGE_SIZE,
    filteredGroups.length,
  );

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#F3F6FC]"
    >
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>الرئيسية</span>
              <span>/</span>
              <span className="font-semibold text-[#1748EF]">
                المجموعات
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#10275B] sm:text-3xl">
              المجموعات والحصص
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              إدارة المجموعات الدراسية ومواعيد الحصص والمدرسين.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1748EF] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(23,72,239,0.55)] transition hover:bg-[#123BC7] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1748EF]/20 active:scale-[0.98] sm:h-12 sm:w-auto"
          >
            <FiPlus size={17} />
            إضافة مجموعة
          </button>
        </div>

        <section className="mb-7 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          <StatCard
            icon={<FiBookOpen size={19} />}
            label="إجمالي المجموعات"
            value={groups.length.toLocaleString("ar-EG")}
          />

          <StatCard
            icon={<FiCheckCircle size={19} />}
            label="المجموعات النشطة"
            value={activeGroups.toLocaleString("ar-EG")}
            valueClass="text-emerald-600"
          />

          <StatCard
            icon={<FiUsers size={19} />}
            label="إجمالي الطلاب"
            value={totalStudents.toLocaleString("ar-EG")}
          />

          <StatCard
            icon={<FiClock size={19} />}
            label="الأماكن المتاحة"
            value={availableSeats.toLocaleString("ar-EG")}
            valueClass="text-amber-600"
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_36px_-24px_rgba(16,39,91,0.28)]">
          <div className="border-b border-slate-100 p-4 sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <FiSearch
                  size={17}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="ابحث باسم المجموعة أو المادة أو المدرس..."
                  aria-label="البحث في المجموعات"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-[#F7F9FD] pr-10 pl-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#1748EF] focus:bg-white focus:ring-4 focus:ring-[#1748EF]/10"
                />
              </div>

              <Select
                value={statusFilter}
                onChange={(value) => {
                  if (
                    value === "الكل" ||
                    GROUP_STATUSES.includes(
                      value as GroupStatus,
                    )
                  ) {
                    setStatusFilter(
                      value as "الكل" | GroupStatus,
                    );
                    setCurrentPage(1);
                  }
                }}
                options={["الكل", ...GROUP_STATUSES]}
                placeholder="الحالة"
              />

              <Select
                value={subjectFilter}
                onChange={(value) => {
                  setSubjectFilter(value);
                  setCurrentPage(1);
                }}
                options={["الكل", ...subjects]}
                placeholder="المادة"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <p className="text-xs text-slate-400">
              عرض{" "}
              <span className="font-semibold text-slate-600">
                {filteredGroups.length}
              </span>{" "}
              مجموعة
            </p>

            {(search ||
              statusFilter !== "الكل" ||
              subjectFilter !== "الكل") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("الكل");
                  setSubjectFilter("الكل");
                  setCurrentPage(1);
                }}
                className="rounded px-1 text-xs font-semibold text-[#1748EF] transition hover:text-[#123BC7] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1748EF]/15"
              >
                إعادة ضبط الفلاتر
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-right">
              <thead>
                <tr className="border-b border-slate-100 bg-[#F6F8FC]">
                  <TableHeader>المجموعة</TableHeader>
                  <TableHeader>المادة</TableHeader>
                  <TableHeader>المدرس</TableHeader>
                  <TableHeader>الموعد</TableHeader>
                  <TableHeader>الطلاب</TableHeader>
                  <TableHeader>الحالة</TableHeader>

                  <th className="w-32 px-5 py-3 text-xs font-semibold text-slate-500">
                    إجراءات
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-16 text-center text-sm text-slate-400"
                    >
                      جاري تحميل بيانات المجموعات...
                    </td>
                  </tr>
                ) : (
                  paginatedGroups.map((group) => {
                  const occupancy =
                    group.maxStudents === 0
                      ? 0
                      : Math.round(
                          (group.students /
                            group.maxStudents) *
                            100,
                        );

                  const isMenuOpen =
                    openMenuId === group.id;

                  return (
                    <tr
                      key={group.id}
                      className="border-b border-slate-100/80 transition-colors last:border-0 hover:bg-[#F7F9FF]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF3FF] text-[#1748EF]">
                            <FiBookOpen size={16} />
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {group.name}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-400">
                              {group.grade}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {group.subject}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {group.teacher}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <FiCalendar
                            size={14}
                            className="text-slate-400"
                          />

                          <div>
                            <p className="text-xs font-medium text-slate-600">
                              {toArabicTime(group.time)}
                            </p>

                            <p className="mt-0.5 whitespace-nowrap text-[10px] text-slate-400">
                              {group.schedule}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="w-28">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-700">
                              {group.students}/{group.maxStudents}
                            </span>

                            <span className="text-[10px] text-slate-400">
                              {occupancy}%
                            </span>
                          </div>

                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${
                                occupancy >= 90
                                  ? "bg-amber-400"
                                  : "bg-[#1748EF]"
                              }`}
                              style={{
                                width: `${Math.min(
                                  occupancy,
                                  100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            group.status === "نشطة"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {group.status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="relative flex items-center gap-1">
                          <ActionButton
                            label="عرض المجموعة"
                            onClick={() =>
                              openDetails(group)
                            }
                          >
                            <FiEye size={16} />
                          </ActionButton>

                          <ActionButton
                            label="تعديل المجموعة"
                            onClick={() =>
                              openEditModal(group)
                            }
                          >
                            <FiEdit2 size={15} />
                          </ActionButton>

                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuId(
                                isMenuOpen
                                  ? null
                                  : group.id,
                              )
                            }
                            className={`flex h-9 w-9 items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1748EF]/30 ${
                              isMenuOpen
                                ? "bg-slate-100 text-slate-700"
                                : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            }`}
                            aria-label="المزيد"
                            aria-expanded={isMenuOpen}
                          >
                            <FiMoreHorizontal size={16} />
                          </button>

                          {isMenuOpen && (
                            <div className="absolute left-0 top-10 z-30 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                              <MenuButton
                                icon={<FiEye size={15} />}
                                onClick={() =>
                                  openDetails(group)
                                }
                              >
                                عرض التفاصيل
                              </MenuButton>

                              <MenuButton
                                icon={<FiEdit2 size={15} />}
                                onClick={() =>
                                  openEditModal(group)
                                }
                              >
                                تعديل المجموعة
                              </MenuButton>

                              <MenuButton
                                icon={
                                  group.status === "نشطة" ? (
                                    <FiPauseCircle size={15} />
                                  ) : (
                                    <FiCheckCircle size={15} />
                                  )
                                }
                                onClick={() =>
                                  toggleGroupStatus(group)
                                }
                              >
                                {group.status === "نشطة"
                                  ? "إيقاف المجموعة"
                                  : "تفعيل المجموعة"}
                              </MenuButton>

                              <div className="my-1 border-t border-slate-100" />

                              <MenuButton
                                danger
                                icon={<FiTrash2 size={15} />}
                                onClick={() =>
                                  requestDelete(group)
                                }
                              >
                                حذف المجموعة
                              </MenuButton>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>

            {filteredGroups.length === 0 && (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <FiSearch size={20} />
                </div>

                <h3 className="mt-4 text-sm font-bold text-slate-800">
                  لا توجد مجموعات
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  جرّب تغيير البحث أو الفلاتر.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("الكل");
                    setSubjectFilter("الكل");
                    setCurrentPage(1);
                  }}
                  className="mt-4 rounded px-2 py-1 text-xs font-semibold text-[#1748EF] hover:text-[#123BC7] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1748EF]/15"
                >
                  إعادة ضبط البحث
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs text-slate-400">
              {filteredGroups.length > 0 ? (
                <>
                  عرض{" "}
                  <span className="font-semibold text-slate-600">
                    {resultStart}
                  </span>
                  -
                  <span className="font-semibold text-slate-600">
                    {resultEnd}
                  </span>{" "}
                  من{" "}
                  <span className="font-semibold text-slate-600">
                    {filteredGroups.length}
                  </span>
                </>
              ) : (
                "لا توجد نتائج"
              )}
            </p>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safeCurrentPage === 1}
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.max(page - 1, 1),
                  )
                }
                className="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition hover:border-[#C8D5FF] hover:bg-[#F7F9FF] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1748EF]/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FiChevronRight size={14} />
                السابق
              </button>

              {Array.from(
                { length: totalPages },
                (_, index) => index + 1,
              ).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() =>
                    setCurrentPage(page)
                  }
                  aria-current={
                    safeCurrentPage === page
                      ? "page"
                      : undefined
                  }
                  className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-semibold transition ${
                    safeCurrentPage === page
                      ? "bg-[#1748EF] text-white shadow-sm"
                      : "border border-slate-200 text-slate-500 hover:border-[#C8D5FF] hover:bg-[#F7F9FF]"
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                disabled={safeCurrentPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.min(page + 1, totalPages),
                  )
                }
                className="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition hover:border-[#C8D5FF] hover:bg-[#F7F9FF] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1748EF]/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                التالي
                <FiChevronLeft size={14} />
              </button>
            </div>
          </div>
        </section>
      </div>

      <GroupModal
        key={`${editingGroup?.id ?? "new"}-${modalInstance}`}
        open={modalOpen}
        group={editingGroup}
        teacherOptions={allTeachers}
        onTeacherCreated={(created) => {
          setAllTeachers((current) =>
            current.some((item) => item.id === created.id)
              ? current
              : [...current, created],
          );
        }}
        onClose={() => {
          setModalOpen(false);
          setEditingGroup(null);
        }}
        onSubmit={handleSaveGroup}
      />

      <GroupDetailsModal
        open={detailsOpen}
        group={selectedGroup}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedGroup(null);
        }}
        onEdit={openEditModal}
      />

      <DeleteGroupModal
        open={Boolean(deleteGroup)}
        group={deleteGroup}
        onClose={() => setDeleteGroup(null)}
        onConfirm={confirmDelete}
      />
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared Components                                                          */
/* -------------------------------------------------------------------------- */

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

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-[#EEF3FF] hover:text-[#1748EF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1748EF]/30"
      aria-label={label}
    >
      {children}
    </button>
  );
}

function MenuButton({
  children,
  icon,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-right text-xs font-medium transition ${
        danger
          ? "text-red-600 hover:bg-red-50"
        : "text-slate-600 hover:bg-[#F3F6FC] hover:text-[#10275B]"
      } focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1748EF]/30`}
    >
      {icon}
      {children}
    </button>
  );
}

function StatCard({
  icon,
  label,
  value,
  valueClass = "text-[#10275B]",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_28px_-22px_rgba(16,39,91,0.35)] transition-shadow hover:shadow-[0_12px_32px_-20px_rgba(16,39,91,0.32)] sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p
            className={`mt-2 text-2xl font-bold tracking-tight ${valueClass}`}
          >
            {value}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF3FF] text-[#1748EF]">
          {icon}
        </div>
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        aria-label={placeholder}
        className="h-11 min-w-36 appearance-none rounded-xl border border-slate-200 bg-white px-3 pl-9 text-sm text-slate-600 outline-none transition hover:border-slate-300 focus:border-[#1748EF] focus:ring-4 focus:ring-[#1748EF]/10"
      >
        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {option === "الكل"
              ? `كل ${placeholder}`
              : option}
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

function GroupModal({
  open,
  group,
  onClose,
  onSubmit,
  teacherOptions = [],
  onTeacherCreated,
}: {
  open: boolean;
  group: Group | null;
  onClose: () => void;
  onSubmit: (
    data: Omit<Group, "id" | "students" | "schedule"> & {
      schedule: string[];
      teacherId?: string;
    },
  ) => void;
  teacherOptions?: { id: string; name: string }[];
  onTeacherCreated?: (teacher: {
    id: string;
    name: string;
  }) => void;
}) {
  /*
   * The component is intentionally remounted by the parent whenever
   * the modal is opened for a new/edit operation.
   *
   * This lets us initialize the form from props directly and avoids
   * calling setState synchronously inside useEffect.
   */
  const [name, setName] = useState(
    () => group?.name ?? "",
  );

  const [subject, setSubject] = useState(
    () => {
      const current = group?.subject ?? "";
      return subjects.includes(current) ? current : "أخرى";
    },
  );

  const [customSubject, setCustomSubject] = useState(
    () => {
      const current = group?.subject ?? "";
      if (current && !subjects.includes(current) && current !== "أخرى") {
        return current;
      }
      return "";
    },
  );

  const [grade, setGrade] = useState(
    () => group?.grade ?? "",
  );

  const NEW_TEACHER_VALUE = "__new__";

  const [teacher, setTeacher] = useState(
    () => group?.teacher ?? "",
  );

  const [newTeacherName, setNewTeacherName] =
    useState("");

  const [newTeacherPhone, setNewTeacherPhone] =
    useState("");

  const [saving, setSaving] = useState(false);

  /*
   * Dropdown source of truth is the teachers registry from the API.
   * The hardcoded list is only an offline fallback, and the group's
   * current teacher is always kept so edit mode never loses it.
   */
  const teacherNames = Array.from(
    new Set(
      [
        ...(teacherOptions.length > 0
          ? teacherOptions.map((item) => item.name)
          : teachers),
        ...(group?.teacher ? [group.teacher] : []),
      ]
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  );

  const [room, setRoom] = useState(
    () => group?.room ?? "",
  );

  const [maxStudents, setMaxStudents] = useState(
    () => String(group?.maxStudents ?? 25),
  );

  const [schedule, setSchedule] = useState<string[]>(
    () => {
      if (
        typeof group?.schedule === "string"
      ) {
        return group.schedule
          .split(" - ")
          .map((day) => day.trim())
          .filter(Boolean);
      }

      if (Array.isArray(group?.schedule)) {
        return (group.schedule as unknown as string[])
          .map((item) =>
            typeof item === "string"
              ? item
              : (item as { day?: string })
                .day ?? "",
          )
          .filter(Boolean);
      }

      return [];
    },
  );

  const [time, setTime] = useState(
    () => to24HourTime(group?.time ?? ""),
  );

  const [status, setStatus] =
    useState<GroupStatus>(
      () => group?.status ?? "نشطة",
    );

  const [error, setError] = useState("");

  if (!open) {
    return null;
  }

  const isEdit = Boolean(group);

  const submit = async () => {
    const finalSubject =
      subject === "أخرى"
        ? customSubject.trim()
        : subject;

    const isNewTeacher =
      teacher === NEW_TEACHER_VALUE;

    const finalTeacherName = isNewTeacher
      ? newTeacherName.trim()
      : teacher;

    if (
      !name.trim() ||
      !finalSubject ||
      !grade ||
      !finalTeacherName ||
      !room ||
      schedule.length === 0 ||
      !time
    ) {
      setError(
        "يرجى إدخال جميع البيانات المطلوبة.",
      );
      return;
    }

    const capacity = Number(maxStudents);

    if (
      !Number.isFinite(capacity) ||
      capacity < 1 ||
      !Number.isInteger(capacity)
    ) {
      setError(
        "عدد الطلاب يجب أن يكون رقمًا صحيحًا أكبر من صفر.",
      );
      return;
    }

    if (
      group &&
      capacity < group.students
    ) {
      setError(
        `عدد المقاعد لا يمكن أن يكون أقل من عدد الطلاب الحالي (${group.students}).`,
      );
      return;
    }

    if (
      isNewTeacher &&
      finalTeacherName.length < 2
    ) {
      setError(
        "اسم المدرس الجديد يجب أن يكون حرفين على الأقل.",
      );
      return;
    }

    let teacherId: string | undefined =
      teacherOptions.find(
        (item) => item.name === finalTeacherName,
      )?.id;

    if (isNewTeacher) {
      setSaving(true);

      try {
        const created =
          await teacherService.create({
            name: finalTeacherName,
            subject: finalSubject,
            phone:
              newTeacherPhone.trim() ||
              null,
            status: "active",
          });

        teacherId = created.id;

        onTeacherCreated?.({
          id: created.id,
          name: created.name,
        });
      } catch {
        setError(
          "تعذر إنشاء المدرس الجديد. تحقق من الاتصال وحاول مرة أخرى.",
        );
        setSaving(false);
        return;
      }

      setSaving(false);
    }

    onSubmit({
      name: name.trim(),
      subject: finalSubject,
      grade,
      teacher: finalTeacherName,
      teacherId,
      room,
      maxStudents: capacity,
      schedule,
      time,
      status,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#10275B]/45 p-4 backdrop-blur-[2px]"
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
        aria-labelledby="group-modal-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2
              id="group-modal-title"
              className="text-base font-bold text-slate-900"
            >
              {isEdit
                ? "تعديل المجموعة"
                : "إضافة مجموعة جديدة"}
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              {isEdit
                ? "حدّث بيانات المجموعة ثم احفظ التغييرات."
                : "أدخل بيانات المجموعة الدراسية الجديدة."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
            aria-label="إغلاق"
          >
            <FiX size={19} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
            >
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="اسم المجموعة"
              required
            >
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (error) setError("");
                }}
                placeholder="مثال: مجموعة أ"
                className="field"
              />
            </FormField>

            <FormField
              label="المادة"
              required
            >
              <select
                value={subject}
                onChange={(event) => {
                  setSubject(event.target.value);
                  if (error) setError("");
                }}
                className="field"
              >
                <option value="">
                  اختر المادة
                </option>

                {subjects.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>

              {subject === "أخرى" && (
                <input
                  type="text"
                  value={customSubject}
                  onChange={(event) => {
                    setCustomSubject(event.target.value);
                    if (error) setError("");
                  }}
                  placeholder="اكتب اسم المادة الجديدة"
                  className="field mt-2"
                />
              )}
            </FormField>

            <FormField
              label="المرحلة الدراسية"
              required
            >
              <select
                value={grade}
                onChange={(event) => {
                  setGrade(event.target.value);
                  if (error) setError("");
                }}
                className="field"
              >
                <option value="">
                  اختر المرحلة
                </option>

                {grades.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="المدرس"
              required
            >
              <select
                value={teacher}
                onChange={(event) => {
                  setTeacher(event.target.value);
                  if (error) setError("");
                }}
                className="field"
              >
                <option value="">
                  اختر المدرس
                </option>

                {teacherNames.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}

                <option value={NEW_TEACHER_VALUE}>
                  + إضافة مدرس جديد
                </option>
              </select>

              {teacher === NEW_TEACHER_VALUE && (
                <div className="mt-2 space-y-2 rounded-xl border border-[#E1E9FF] bg-[#EEF3FF]/50 p-3">
                  <input
                    type="text"
                    value={newTeacherName}
                    onChange={(event) => {
                      setNewTeacherName(
                        event.target.value,
                      );
                      if (error) setError("");
                    }}
                    placeholder="اسم المدرس الجديد"
                    className="field"
                  />

                  <input
                    type="tel"
                    value={newTeacherPhone}
                    onChange={(event) => {
                      setNewTeacherPhone(
                        event.target.value,
                      );
                      if (error) setError("");
                    }}
                    placeholder="رقم الهاتف (اختياري)"
                    dir="ltr"
                    className="field text-left"
                  />

                  <p className="text-[11px] leading-5 text-slate-500">
                    سيتم إنشاء المدرس وربطه بهذه المجموعة مباشرة دون مغادرة النافذة.
                  </p>
                </div>
              )}
            </FormField>

            <FormField
              label="القاعة"
              required
            >
              <select
                value={room}
                onChange={(event) => {
                  setRoom(event.target.value);
                  if (error) setError("");
                }}
                className="field"
              >
                <option value="">
                  اختر القاعة
                </option>

                {rooms.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="السعة القصوى"
              required
            >
              <input
                type="number"
                min="1"
                step="1"
                value={maxStudents}
                onChange={(event) => {
                  setMaxStudents(
                    event.target.value,
                  );
                  if (error) setError("");
                }}
                className="field"
              />
            </FormField>

            <FormField
              label="أيام الحصص"
              required
            >
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-4">
                {WEEKDAYS.map((day) => (
                  <label
                    key={day}
                    className="flex cursor-pointer select-none items-center gap-2 rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-600 transition hover:border-[#A8B9FF] hover:bg-[#EEF3FF]"
                  >
                    <input
                      type="checkbox"
                      checked={schedule.includes(day)}
                      onChange={() => {
                        setSchedule((current) =>
                          current.includes(day)
                            ? current.filter((d) => d !== day)
                            : [...current, day],
                        );
                        if (error) setError("");
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-[#1748EF] focus:ring-[#1748EF]"
                    />

                    {day}
                  </label>
                ))}
              </div>
            </FormField>

            <FormField
              label="وقت الحصة"
              required
            >
              <TimePicker
                value={time}
                onChange={(next) => {
                  setTime(next);
                  if (error) setError("");
                }}
              />
            </FormField>

            <FormField
              label="الحالة"
              required
            >
              <select
                value={status}
                onChange={(event) => {
                  const nextStatus =
                    event.target.value;

                  if (
                    GROUP_STATUSES.includes(
                      nextStatus as GroupStatus,
                    )
                  ) {
                    setStatus(
                      nextStatus as GroupStatus,
                    );
                  }
                }}
                className="field"
              >
                {GROUP_STATUSES.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="h-10 rounded-lg bg-[#1748EF] px-5 text-sm font-semibold text-white transition hover:bg-[#123BC7] focus:outline-none focus:ring-4 focus:ring-[#1748EF]/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "جاري الحفظ..."
              : isEdit
                ? "حفظ التعديلات"
                : "إضافة المجموعة"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupDetailsModal({
  open,
  group,
  onClose,
  onEdit,
}: {
  open: boolean;
  group: Group | null;
  onClose: () => void;
  onEdit: (group: Group) => void;
}) {
  if (!open || !group) {
    return null;
  }

  const occupancy =
    group.maxStudents === 0
      ? 0
      : Math.round(
          (group.students /
            group.maxStudents) *
            100,
        );

  const availableSeats = Math.max(
    group.maxStudents - group.students,
    0,
  );

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#10275B]/45 p-4 backdrop-blur-[2px]"
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
        aria-labelledby="group-details-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF3FF] text-[#1748EF]">
              <FiBookOpen size={19} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="group-details-title"
                  className="text-base font-bold text-slate-900"
                >
                  {group.name}
                </h2>

                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    group.status === "نشطة"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {group.status}
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-400">
                {group.subject} · {group.grade}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
            aria-label="إغلاق"
          >
            <FiX size={19} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoBox
              icon={<FiBookOpen size={16} />}
              label="المادة"
              value={group.subject}
            />

            <InfoBox
              icon={<FiUsers size={16} />}
              label="المرحلة"
              value={group.grade}
            />

            <InfoBox
              icon={<FiUsers size={16} />}
              label="المدرس"
              value={group.teacher}
            />

            <InfoBox
              icon={<FiBookOpen size={16} />}
              label="القاعة"
              value={group.room}
            />

            <InfoBox
              icon={<FiCalendar size={16} />}
              label="الأيام"
              value={group.schedule}
            />

            <InfoBox
              icon={<FiClock size={16} />}
              label="وقت الحصة"
              value={toArabicTime(group.time)}
            />
          </div>

          <div className="mt-6 border-t border-slate-100 pt-6">
            <h3 className="text-sm font-bold text-slate-800">
              إشغال المجموعة
            </h3>

            <p className="mt-1 text-xs text-slate-400">
              عدد الطلاب مقارنة بالسعة القصوى
            </p>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-slate-400">
                    الطلاب المسجلون
                  </p>

                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {group.students}{" "}
                    <span className="text-sm font-medium text-slate-400">
                      / {group.maxStudents}
                    </span>
                  </p>
                </div>

                <span
                  className={`text-sm font-semibold ${
                    occupancy >= 90
                      ? "text-amber-600"
                      : "text-[#1748EF]"
                  }`}
                >
                  {occupancy}%
                </span>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${
                    occupancy >= 90
                      ? "bg-amber-400"
                      : "bg-[#1748EF]"
                  }`}
                  style={{
                    width: `${Math.min(
                      occupancy,
                      100,
                    )}%`,
                  }}
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                <span>الأماكن المتاحة</span>

                <span className="font-semibold text-slate-600">
                  {availableSeats}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-6">
            <h3 className="text-sm font-bold text-slate-800">
              موعد المجموعة
            </h3>

            <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#E1E9FF] bg-[#EEF3FF]/50 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#1748EF] shadow-sm">
                <FiCalendar size={17} />
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {toArabicTime(group.time)}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {group.schedule}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            إغلاق
          </button>

          <button
            type="button"
            onClick={() => onEdit(group)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1748EF] px-5 text-sm font-semibold text-white transition hover:bg-[#123BC7] focus:outline-none focus:ring-4 focus:ring-[#1748EF]/20"
          >
            <FiEdit2 size={15} />
            تعديل المجموعة
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteGroupModal({
  open,
  group,
  onClose,
  onConfirm,
}: {
  open: boolean;
  group: Group | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open || !group) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#10275B]/45 p-4 backdrop-blur-[2px]"
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
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-group-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <FiTrash2 size={19} />
            </div>

            <div>
              <h2
                id="delete-group-title"
                className="text-base font-bold text-slate-900"
              >
                حذف المجموعة؟
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                هل أنت متأكد من حذف{" "}
                <span className="font-semibold text-slate-700">
                  {group.name}
                </span>
                ؟ لا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-500/20"
          >
            <FiTrash2 size={15} />
            حذف المجموعة
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}

        {required && (
          <span className="mr-1 text-red-500">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}

function InfoBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}

        <span className="text-[11px] font-medium">
          {label}
        </span>
      </div>

      <p className="mt-2 text-sm font-semibold text-slate-700">
        {value}
      </p>
    </div>
  );
}
