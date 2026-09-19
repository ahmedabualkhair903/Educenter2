
"use client";

import {
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  FiBellOff,
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiFilter,
  FiMoreVertical,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUsers,
  FiX,
} from "react-icons/fi";

import { lessonService } from "@/services";
import { groupService } from "@/services/groupService";
import { teacherService } from "@/services/teacherService";
import { settingsService } from "@/services/settingsService";

import type {
  Group,
  Teacher,
} from "@/types";

import TimePicker from "@/components/common/TimePicker";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type LessonStatus =
  | "قادمة"
  | "جارية"
  | "مكتملة"
  | "ملغاة";

type Lesson = {
  id: string;
  subject: string;
  teacher: string;
  teacherId?: string;
  group: string;
  groupId?: string;
  date: string;
  time: string;
  duration: number;
  room: string;
  students: number;
  status: LessonStatus;
  notes: string;
};

type LessonFormData = Omit<Lesson, "id">;

const statusOptions = [
  "الكل",
  "قادمة",
  "جارية",
  "مكتملة",
  "ملغاة",
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const STATUS_MAP: Record<string, LessonStatus> = {
  upcoming: "قادمة",
  ongoing: "جارية",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

const STATUS_REVERSE: Record<LessonStatus, "upcoming" | "ongoing" | "completed" | "cancelled"> = {
  "قادمة": "upcoming",
  "جارية": "ongoing",
  "مكتملة": "completed",
  "ملغاة": "cancelled",
};

function mapServiceLesson(l: {
  id: string;
  subject: string;
  teacher: string;
  teacherId?: string;
  group: string;
  groupId?: string;
  date: string;
  time: string;
  duration: number;
  room: string;
  students: number;
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  notes: string;
}): Lesson {
  return {
    id: l.id,
    subject: l.subject,
    teacher: l.teacher,
    teacherId: l.teacherId,
    group: l.group,
    groupId: l.groupId,
    date: l.date,
    time: l.time,
    duration: l.duration,
    room: l.room,
    students: l.students,
    status: STATUS_MAP[l.status] ?? "قادمة",
    notes: l.notes,
  };
}

function addMinutesToTime(
  time: string,
  minutes: number,
): string {
  const match =
    /^(\d{1,2}):(\d{2})$/.exec(
      time.trim(),
    );

  if (!match) {
    return time;
  }

  const total =
    (Number(match[1]) * 60 +
      Number(match[2]) +
      minutes) %
    (24 * 60);

  const normalized =
    total < 0 ? total + 24 * 60 : total;

  return `${String(
    Math.floor(normalized / 60),
  ).padStart(2, "0")}:${String(
    normalized % 60,
  ).padStart(2, "0")}`;
}

function toFriendlyLessonError(
  error: unknown,
  fallback: string,
): string {
  const statusCode = (
    error as { statusCode?: number }
  )?.statusCode;

  if (statusCode === 403) {
    return "لا تملك صلاحية تنفيذ هذه العملية. سجّل الدخول بحساب مدير ثم حاول مرة أخرى.";
  }

  if (statusCode === 404) {
    return "المجموعة المحددة غير موجودة. حدّث الصفحة وحاول مرة أخرى.";
  }

  return error instanceof Error
    ? error.message
    : fallback;
}

const getDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getTomorrowKey = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return getDateKey(tomorrow);
};

const formatDate = (date: string) => {
  if (!date) {
    return "";
  }

  const parsedDate = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsedDate);
};

const formatTime = (time: string) => {
  if (!time) {
    return "";
  }

  const [hours, minutes] = time.split(":").map(Number);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return time;
  }

  const date = new Date();

  date.setHours(hours, minutes, 0, 0);

  return new Intl.DateTimeFormat("ar-EG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function LessonsPage() {
  const [lessons, setLessons] =
    useState<Lesson[]>([]);

  const [groups, setGroups] =
    useState<Group[]>([]);

  const [teachers, setTeachers] =
    useState<Teacher[]>([]);

  const [rooms, setRooms] =
    useState<string[]>([]);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState("الكل");

  const [selectedDate, setSelectedDate] =
    useState("اليوم");

  const [modalOpen, setModalOpen] =
    useState(false);

  const [editingLesson, setEditingLesson] =
    useState<Lesson | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      const [
        lessonList,
        groupList,
        teacherList,
        roomList,
      ] = await Promise.all([
        lessonService
          .list()
          .catch(() => []),
        groupService
          .list()
          .catch(() => []),
        teacherService
          .list()
          .catch(() => []),
        settingsService
          .getRooms()
          .catch(() => []),
      ]);

      if (!mounted) {
        return;
      }

      setLessons(
        lessonList.map(mapServiceLesson),
      );
      setGroups(groupList);
      setTeachers(teacherList);
      setRooms(roomList);
    };
    void loadData();
    return () => { mounted = false; };
  }, []);

  const todayKey = getDateKey(new Date());
  const tomorrowKey = getTomorrowKey();

  const afterDaysKey = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return getDateKey(date);
  };

  const weekLaterKey = afterDaysKey(7);
  const monthLaterKey = afterDaysKey(30);

  const filteredLessons = useMemo(() => {
    const query = search.trim().toLowerCase();

    return lessons
      .filter((lesson) => {
        const searchableContent = [
          lesson.subject,
          lesson.teacher,
          lesson.group,
          lesson.room,
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !query ||
          searchableContent.includes(query);

        const matchesStatus =
          statusFilter === "الكل" ||
          lesson.status === statusFilter;

        let matchesDate = true;

        if (selectedDate === "اليوم") {
          matchesDate = lesson.date === todayKey;
        }

        if (selectedDate === "غدًا") {
          matchesDate =
            lesson.date === tomorrowKey;
        }

        if (selectedDate === "أسبوع") {
          matchesDate =
            lesson.date >= todayKey &&
            lesson.date <= weekLaterKey;
        }

        if (selectedDate === "شهر") {
          matchesDate =
            lesson.date >= todayKey &&
            lesson.date <= monthLaterKey;
        }

        return (
          matchesSearch &&
          matchesStatus &&
          matchesDate
        );
      })
      .sort((a, b) => {
        const first = `${a.date} ${a.time}`;
        const second = `${b.date} ${b.time}`;

        return first.localeCompare(second);
      });
  }, [
    lessons,
    search,
    statusFilter,
    selectedDate,
    todayKey,
    tomorrowKey,
    weekLaterKey,
    monthLaterKey,
  ]);

  const todayCount = useMemo(
    () =>
      lessons.filter(
        (lesson) => lesson.date === todayKey,
      ).length,
    [lessons, todayKey],
  );

  const upcomingCount = useMemo(
    () =>
      lessons.filter(
        (lesson) => lesson.status === "قادمة",
      ).length,
    [lessons],
  );

  const ongoingCount = useMemo(
    () =>
      lessons.filter(
        (lesson) => lesson.status === "جارية",
      ).length,
    [lessons],
  );

  const completedCount = useMemo(
    () =>
      lessons.filter(
        (lesson) => lesson.status === "مكتملة",
      ).length,
    [lessons],
  );

  const openCreateModal = () => {
    setEditingLesson(null);
    setModalOpen(true);
  };

  const openEditModal = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingLesson(null);
  };

  const handleSaveLesson = async (
    data: LessonFormData & {
      groupId: string;
      endTime?: string;
    },
  ) => {
    if (!data.groupId) {
      throw new Error(
        "يرجى اختيار المجموعة.",
      );
    }

    const payload = {
      ...data,
      title: data.subject,
      status: STATUS_REVERSE[data.status],
    };

    try {
      if (editingLesson) {
        const result =
          await lessonService.update(
            editingLesson.id,
            payload,
          );

        if (!result) {
          throw new Error(
            "تعذر تحديث الحصة.",
          );
        }

        setLessons((current) =>
          current.map((lesson) =>
            lesson.id ===
            editingLesson.id
              ? mapServiceLesson(result)
              : lesson,
          ),
        );
      } else {
        const result =
          await lessonService.create(
            payload,
          );

        setLessons((current) => [
          mapServiceLesson(result),
          ...current,
        ]);
      }

      closeModal();
    } catch (error) {
      throw new Error(
        toFriendlyLessonError(
          error,
          "تعذر حفظ الحصة.",
        ),
      );
    }
  };

  const handleDelete = async (lesson: Lesson) => {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف حصة ${lesson.subject}؟`,
    );

    if (!confirmed) {
      return;
    }

    const success = await lessonService.delete(lesson.id);
    if (success) {
      setLessons((current) =>
        current.filter(
          (item) => item.id !== lesson.id,
        ),
      );
    } else {
      window.alert("تعذر حذف الحصة.");
    }
  };

  const handleCancelWithAlert = async (
    lesson: Lesson,
  ) => {
    const reason = window.prompt(
      `إلغاء حصة ${lesson.subject} لمجموعة ${lesson.group} بتاريخ ${lesson.date}؟\n\nاكتب سببًا لإرفاقه برسالة الواتساب (اختياري):`,
      "",
    );

    if (reason === null) {
      return;
    }

    try {
      const result =
        await lessonService.cancelWithAlert(
          lesson.id,
          reason,
        );

      setLessons((current) =>
        current.map((item) =>
          item.id === lesson.id
            ? mapServiceLesson(
                result.lesson,
              )
            : item,
        ),
      );

      window.alert(
        `تم إلغاء الحصة وإرسال التنبيه إلى ${result.notifiedCount} من أولياء الأمور.`,
      );
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "تعذر إلغاء الحصة.",
      );
    }
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
                الحصص
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              الحصص
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              إدارة جدول الحصص ومتابعة الحصص اليومية.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 active:scale-[0.98]"
          >
            <FiPlus size={17} />
            إضافة حصة
          </button>
        </div>

        {/* Stats */}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LessonStat
            label="حصص اليوم"
            value={todayCount}
            icon={<FiCalendar size={19} />}
          />

          <LessonStat
            label="الحصص القادمة"
            value={upcomingCount}
            icon={<FiClock size={19} />}
          />

          <LessonStat
            label="حصص جارية"
            value={ongoingCount}
            icon={<FiBookOpen size={19} />}
          />

          <LessonStat
            label="حصص مكتملة"
            value={completedCount}
            icon={<FiCheckCircle size={19} />}
          />
        </section>

        {/* Filters */}

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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
                placeholder="ابحث باسم المادة أو المدرس أو المجموعة..."
                aria-label="البحث في الحصص"
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pr-9 pl-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
              />
            </div>

            <LessonSelect
              value={selectedDate}
              onChange={setSelectedDate}
              options={[
                "اليوم",
                "غدًا",
                "أسبوع",
                "شهر",
                "كل الأيام",
              ]}
              ariaLabel="فلترة حسب التاريخ"
            />

            <LessonSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              ariaLabel="فلترة حسب الحالة"
            />

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("الكل");
                setSelectedDate("اليوم");
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
            >
              <FiFilter size={15} />
              إعادة ضبط
            </button>
          </div>
        </section>

        {/* Lessons */}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                جدول الحصص
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                عرض {filteredLessons.length} حصة
              </p>
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />

              <span className="text-xs text-slate-400">
                جارية
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-right">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    المادة
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    المدرس
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    المجموعة
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    الموعد
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    القاعة
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    الطلاب
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    الحالة
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    إجراءات
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredLessons.map((lesson) => (
                  <tr
                    key={lesson.id}
                    className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                          <FiBookOpen size={16} />
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {lesson.subject}
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            #{lesson.id}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className="text-xs font-medium text-slate-600">
                        {lesson.teacher}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        {lesson.group}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <FiClock
                            size={14}
                            className="text-slate-400"
                          />

                          {formatTime(lesson.time)}
                        </div>

                        <p className="mt-1 text-[10px] text-slate-400">
                          {formatDate(lesson.date)}{" "}
                          · {lesson.duration} دقيقة
                        </p>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className="text-xs font-medium text-slate-600">
                        {lesson.room}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <FiUsers
                          size={14}
                          className="text-slate-400"
                        />

                        <span className="text-sm font-semibold text-slate-700">
                          {lesson.students}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <LessonStatusBadge
                        status={lesson.status}
                      />
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        {(lesson.status ===
                          "قادمة" ||
                          lesson.status ===
                            "جارية") && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleCancelWithAlert(
                                lesson,
                              )
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-amber-50 hover:text-amber-600"
                            title="إلغاء وإرسال تنبيه واتساب"
                            aria-label={`إلغاء حصة ${lesson.subject} وإرسال تنبيه`}
                          >
                            <FiBellOff
                              size={15}
                            />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            openEditModal(lesson)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          title="تعديل"
                          aria-label={`تعديل حصة ${lesson.subject}`}
                        >
                          <FiEdit2 size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(lesson)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          title="حذف"
                          aria-label={`حذف حصة ${lesson.subject}`}
                        >
                          <FiTrash2 size={15} />
                        </button>

                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          title="المزيد"
                          aria-label={`المزيد من إجراءات حصة ${lesson.subject}`}
                        >
                          <FiMoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredLessons.length === 0 && (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <FiBookOpen size={20} />
                </div>

                <h3 className="mt-4 text-sm font-bold text-slate-800">
                  لا توجد حصص
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  جرّب تغيير البحث أو الفلاتر.
                </p>

                {(search ||
                  statusFilter !== "الكل" ||
                  selectedDate !== "اليوم") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("الكل");
                      setSelectedDate("اليوم");
                    }}
                    className="mt-4 text-xs font-semibold text-teal-600 transition hover:text-teal-700"
                  >
                    إعادة ضبط الفلاتر
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Modal */}

      <LessonModal
        key={`${modalOpen}-${editingLesson?.id ?? "new"}`}
        open={modalOpen}
        lesson={editingLesson}
        groups={groups}
        teachers={teachers}
        rooms={rooms}
        onRoomAdded={(nextRooms) =>
          setRooms(nextRooms)
        }
        onClose={closeModal}
        onSubmit={handleSaveLesson}
      />
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Stats                                                                      */
/* -------------------------------------------------------------------------- */

function LessonStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p className="mt-1 text-xl font-bold text-slate-900">
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
/* Select                                                                     */
/* -------------------------------------------------------------------------- */

function LessonSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  ariaLabel: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      aria-label={ariaLabel}
      className="h-10 min-w-32 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none transition hover:border-slate-300 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

/* -------------------------------------------------------------------------- */
/* Status Badge                                                               */
/* -------------------------------------------------------------------------- */

function LessonStatusBadge({
  status,
}: {
  status: LessonStatus;
}) {
  const styles: Record<LessonStatus, string> = {
    قادمة: "bg-blue-50 text-blue-700",
    جارية: "bg-emerald-50 text-emerald-700",
    مكتملة: "bg-slate-100 text-slate-600",
    ملغاة: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

const NEW_ROOM_VALUE = "__new__";
const NEW_SUBJECT_VALUE = "__new_subject__";

function LessonModal({
  open,
  lesson,
  groups,
  teachers,
  rooms,
  onRoomAdded,
  onClose,
  onSubmit,
}: {
  open: boolean;
  lesson: Lesson | null;
  groups: Group[];
  teachers: Teacher[];
  rooms: string[];
  onRoomAdded: (
    rooms: string[],
  ) => void;
  onClose: () => void;
  onSubmit: (
    data: LessonFormData & {
      groupId: string;
      endTime?: string;
    },
  ) => void | Promise<void>;
}) {
  const isEdit = Boolean(lesson);

  const [groupId, setGroupId] = useState(
    () => lesson?.groupId ?? "",
  );

  const [subject, setSubject] = useState(
    () => lesson?.subject ?? "",
  );

  const [teacherId, setTeacherId] =
    useState(
      () => lesson?.teacherId ?? "",
    );

  const [date, setDate] = useState(
    () => lesson?.date ?? getDateKey(new Date()),
  );

  const [time, setTime] = useState(
    () => lesson?.time ?? "16:00",
  );

  const [duration, setDuration] = useState(
    () => String(lesson?.duration ?? 90),
  );

  const [room, setRoom] = useState(
    () => lesson?.room ?? "",
  );

  const [newRoomName, setNewRoomName] =
    useState("");

  const [students, setStudents] = useState(
    () => String(lesson?.students ?? 25),
  );

  const [status, setStatus] =
    useState<LessonStatus>(
      () => lesson?.status ?? "قادمة",
    );

  const [notes, setNotes] = useState(
    () => lesson?.notes ?? "",
  );

  const [error, setError] = useState("");

  const [saving, setSaving] = useState(false);

  const [storedSubjects, setStoredSubjects] = useState<string[]>([]);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [savingSubject, setSavingSubject] = useState(false);

  useEffect(() => {
    let mounted = true;
    settingsService
      .getSubjects()
      .catch(() => [] as string[])
      .then((list) => {
        if (mounted && Array.isArray(list) && list.length > 0) {
          setStoredSubjects(list);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const subjectOptions = Array.from(
    new Set(
      [
        ...storedSubjects,
        ...groups.map(
          (group) => group.subject,
        ),
        ...teachers.map(
          (teacher) => teacher.subject,
        ),
        ...(lesson?.subject
          ? [lesson.subject]
          : []),
      ]
        .map((name) => (name ?? "").trim())
        .filter(Boolean),
    ),
  );

  const handleAddSubjectOption = async () => {
    const cleanName = newSubjectName.trim();
    if (cleanName.length < 2) {
      setError("اسم المادة الجديدة يجب أن يكون حرفين على الأقل.");
      return;
    }
    const exists = subjectOptions.some(
      (item) => item.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (exists) {
      setSubject(cleanName);
      setNewSubjectName("");
      setError("");
      return;
    }
    setSavingSubject(true);
    try {
      // حفظ فوري في قاعدة البيانات عبر الإعدادات ثم اختيارها
      const updated = await settingsService.addSubject(cleanName);
      setStoredSubjects(updated);
      setSubject(cleanName);
      setNewSubjectName("");
      setError("");
    } catch {
      // fallback محلي عند غياب الصلاحية حتى لا تنكسر الصفحة
      setStoredSubjects((current) =>
        current.some((item) => item.toLowerCase() === cleanName.toLowerCase())
          ? current
          : [...current, cleanName]
      );
      setSubject(cleanName);
      setNewSubjectName("");
      setError("");
    } finally {
      setSavingSubject(false);
    }
  };

  const teachersForSubject =
    teachers.filter(
      (teacher) =>
        !subject ||
        subject === NEW_SUBJECT_VALUE ||
        teacher.subject === subject,
    );

  const teacherOptions =
    teachersForSubject.length > 0
      ? teachersForSubject
      : teachers;

  const roomOptions = Array.from(
    new Set(
      [
        ...rooms,
        ...groups
          .map((group) => group.room ?? "")
          .filter(Boolean),
        ...(lesson?.room
          ? [lesson.room]
          : []),
      ]
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  );

  const selectedTeacher =
    teachers.find(
      (teacher) =>
        teacher.id === teacherId,
    ) ?? null;

  const applyGroupDefaults = (
    nextGroupId: string,
  ) => {
    const selected = groups.find(
      (group) => group.id === nextGroupId,
    );

    setGroupId(nextGroupId);

    if (selected) {
      if (selected.subject) {
        setSubject(selected.subject);
      }

      const matchedTeacherId =
        (selected.teacherId &&
        teachers.some(
          (teacher) =>
            teacher.id ===
            selected.teacherId,
        )
          ? selected.teacherId
          : teachers.find(
              (teacher) =>
                teacher.name ===
                selected.teacher,
            )?.id) ?? "";

      setTeacherId(matchedTeacherId);

      if (selected.room) {
        setRoom(selected.room);
      }
    }

    if (error) {
      setError("");
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Escape + Body Scroll                                                     */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleSubmit = async () => {
    if (
      !groupId ||
      !subject.trim() ||
      subject === NEW_SUBJECT_VALUE ||
      !date.trim() ||
      !time.trim() ||
      (room !== NEW_ROOM_VALUE &&
        !room.trim())
    ) {
      setError(
        subject === NEW_SUBJECT_VALUE
          ? "يرجى حفظ اسم المادة الجديدة أولاً ثم الحفظ."
          : "يرجى اختيار المجموعة والمادة والقاعة وإدخال التاريخ والوقت.",
      );
      return;
    }

    // تحقق مبكر أن المجموعة موجودة فعلاً لتفادي GROUP_NOT_FOUND
    if (!groups.some((group) => group.id === groupId)) {
      setError("المجموعة المحددة غير موجودة. حدّث الصفحة واختر مجموعة صالحة.");
      return;
    }

    const numericDuration = Number(duration);
    const numericStudents = Number(students);

    if (
      !Number.isFinite(numericDuration) ||
      numericDuration <= 0
    ) {
      setError("مدة الحصة غير صحيحة.");
      return;
    }

    if (
      !Number.isFinite(numericStudents) ||
      numericStudents < 0
    ) {
      setError("عدد الطلاب غير صحيح.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let finalRoom = room.trim();

      if (room === NEW_ROOM_VALUE) {
        const cleanName =
          newRoomName.trim();

        if (cleanName.length < 2) {
          setError(
            "اسم القاعة الجديدة يجب أن يكون حرفين على الأقل.",
          );
          setSaving(false);
          return;
        }

        const nextRooms =
          await settingsService.addRoom(
            cleanName,
          );

        onRoomAdded(nextRooms);
        finalRoom = cleanName;
      }

      const selectedGroup = groups.find(
        (group) => group.id === groupId,
      );

      await onSubmit({
        subject: subject.trim(),
        teacher:
          selectedTeacher?.name ??
          lesson?.teacher ??
          "",
        teacherId: teacherId || undefined,
        group:
          selectedGroup?.name ??
          lesson?.group ??
          "",
        groupId,
        date: date.trim(),
        time: time.trim(),
        endTime: addMinutesToTime(
          time.trim(),
          numericDuration,
        ),
        duration: numericDuration,
        room: finalRoom,
        students: numericStudents,
        status,
        notes: notes.trim(),
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "تعذر حفظ الحصة.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-modal-title"
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
            <h2
              id="lesson-modal-title"
              className="text-base font-bold text-slate-900"
            >
              {isEdit
                ? "تعديل الحصة"
                : "إضافة حصة جديدة"}
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              أدخل بيانات الحصة والموعد والمجموعة.
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
            <div
              className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <LessonField label="المجموعة">
              <select
                value={groupId}
                onChange={(event) => {
                  applyGroupDefaults(
                    event.target.value,
                  );
                }}
                className="field"
              >
                <option value="">
                  اختر المجموعة
                </option>

                {groups.map((group) => (
                  <option
                    key={group.id}
                    value={group.id}
                  >
                    {group.name}
                    {group.subject
                      ? ` — ${group.subject}`
                      : ""}
                  </option>
                ))}
              </select>
            </LessonField>

            <LessonField label="المادة">
              <select
                value={subject}
                onChange={(event) => {
                  const nextSubject =
                    event.target.value;

                  if (nextSubject === NEW_SUBJECT_VALUE) {
                    setSubject(NEW_SUBJECT_VALUE);
                    setNewSubjectName("");
                    setError("");
                    return;
                  }

                  setSubject(nextSubject);

                  const stillValid =
                    teachers.some(
                      (teacher) =>
                        teacher.id ===
                          teacherId &&
                        (!nextSubject ||
                          teacher.subject ===
                            nextSubject),
                    );

                  if (!stillValid) {
                    const firstMatch =
                      teachers.find(
                        (teacher) =>
                          !nextSubject ||
                          teacher.subject ===
                            nextSubject,
                      );

                    setTeacherId(
                      firstMatch?.id ?? "",
                    );
                  }

                  setError("");
                }}
                className="field"
              >
                <option value="">
                  اختر المادة
                </option>

                {subjectOptions.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  ),
                )}

                <option value={NEW_SUBJECT_VALUE}>
                  + إضافة مادة أخرى
                </option>
              </select>

              {subject === NEW_SUBJECT_VALUE && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={(event) => {
                      setNewSubjectName(event.target.value);
                      setError("");
                    }}
                    placeholder="اسم المادة الجديدة"
                    autoComplete="off"
                    className="field flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddSubjectOption()}
                    disabled={savingSubject}
                    className="h-10 shrink-0 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingSubject ? "جاري الحفظ..." : "حفظ"}
                  </button>
                </div>
              )}
            </LessonField>

            <LessonField label="المدرس">
              <select
                value={teacherId}
                onChange={(event) => {
                  setTeacherId(
                    event.target.value,
                  );
                  setError("");
                }}
                className="field"
              >
                <option value="">
                  اختر المدرس
                </option>

                {teacherOptions.map(
                  (teacher) => (
                    <option
                      key={teacher.id}
                      value={teacher.id}
                    >
                      {teacher.name}
                      {teacher.subject
                        ? ` — ${teacher.subject}`
                        : ""}
                    </option>
                  ),
                )}
              </select>
            </LessonField>

            <LessonField label="القاعة">
              <select
                value={room}
                onChange={(event) => {
                  setRoom(
                    event.target.value,
                  );
                  setError("");
                }}
                className="field"
              >
                <option value="">
                  اختر القاعة
                </option>

                {roomOptions.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}

                <option
                  value={NEW_ROOM_VALUE}
                >
                  + إضافة قاعة جديدة
                </option>
              </select>

              {room ===
                NEW_ROOM_VALUE && (
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(event) => {
                    setNewRoomName(
                      event.target.value,
                    );
                    setError("");
                  }}
                  placeholder="اسم القاعة الجديدة"
                  autoComplete="off"
                  className="field mt-2"
                />
              )}
            </LessonField>

            <LessonField label="التاريخ">
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setError("");
                }}
                className="field"
              />
            </LessonField>

            <LessonField label="وقت الحصة">
              <TimePicker
                value={time}
                onChange={(next) => {
                  setTime(next);
                  setError("");
                }}
              />
            </LessonField>

            <LessonField label="مدة الحصة بالدقائق">
              <input
                type="number"
                min="1"
                step="5"
                value={duration}
                onChange={(event) => {
                  setDuration(event.target.value);
                  setError("");
                }}
                className="field"
                inputMode="numeric"
              />
            </LessonField>

            <LessonField label="عدد الطلاب">
              <input
                type="number"
                min="0"
                step="1"
                value={students}
                onChange={(event) => {
                  setStudents(event.target.value);
                  setError("");
                }}
                className="field"
                inputMode="numeric"
              />
            </LessonField>

            <LessonField label="حالة الحصة">
              <select
                value={status}
                onChange={(event) => {
                  setStatus(
                    event.target
                      .value as LessonStatus,
                  );
                  setError("");
                }}
                className="field"
              >
                <option value="قادمة">
                  قادمة
                </option>

                <option value="جارية">
                  جارية
                </option>

                <option value="مكتملة">
                  مكتملة
                </option>

                <option value="ملغاة">
                  ملغاة
                </option>
              </select>
            </LessonField>

            <div className="sm:col-span-2">
              <LessonField label="ملاحظات">
                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                  placeholder="ملاحظات إضافية..."
                  className="field min-h-24 resize-y"
                />
              </LessonField>
            </div>
          </div>
        </div>

        {/* Footer */}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="h-10 rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white transition hover:bg-teal-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "جاري الحفظ..."
              : isEdit
                ? "حفظ التعديلات"
                : "إضافة الحصة"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Field                                                                      */
/* -------------------------------------------------------------------------- */

function LessonField({
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
