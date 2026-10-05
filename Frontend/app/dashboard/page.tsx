"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import {
  FiArrowDown,
  FiArrowUp,
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiMessageCircle,
  FiRefreshCw,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";

import {
  attendanceService,
  examService,
  lessonService,
  messageService,
  paymentService,
  studentService,
} from "@/services";

type Stat = {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ size?: number | string }>;
  trend?: "up" | "down";
};

type ClassItem = {
  id: string;
  subject: string;
  group: string;
  time: string;
  status: "جارية" | "قادمة";
};

type WeekDayAttendance = {
  day: string;
  present: number;
  absent: number;
  hasData: boolean;
};

const stats: Stat[] = [
  {
    title: "إجمالي الطلاب",
    value: "1,248",
    description: "+8.2% هذا الشهر",
    icon: FiUsers,
    trend: "up",
  },
  {
    title: "الحضور اليوم",
    value: "1,086",
    description: "87% من إجمالي الطلاب",
    icon: FiCheckCircle,
    trend: "up",
  },
  {
    title: "الغياب اليوم",
    value: "162",
    description: "13% من إجمالي الطلاب",
    icon: FiClock,
    trend: "down",
  },
  {
    title: "حصص اليوم",
    value: "24",
    description: "6 حصص جارية الآن",
    icon: FiBookOpen,
  },
  {
    title: "المحصل اليوم",
    value: "18,450 ج.م",
    description: "+12.5% مقارنة بالأمس",
    icon: FiDollarSign,
    trend: "up",
  },
  {
    title: "إجمالي الديون",
    value: "42,800 ج.م",
    description: "38 طالبًا لديهم مستحقات",
    icon: FiTrendingUp,
  },
  {
    title: "الامتحانات القادمة",
    value: "7",
    description: "خلال هذا الأسبوع",
    icon: FiCalendar,
  },
  {
    title: "رسائل WhatsApp",
    value: "326",
    description: "تم إرسالها هذا الشهر",
    icon: FiMessageCircle,
  },
];

const quickActions = [
  {
    label: "إضافة طالب",
    description: "تسجيل طالب جديد",
    icon: FiUsers,
    href: "/students",
  },
  {
    label: "تسجيل حضور",
    description: "تسجيل حضور الطلاب",
    icon: FiCheckCircle,
    href: "/attendance",
  },
  {
    label: "تسجيل دفعة",
    description: "إضافة دفعة مالية",
    icon: FiDollarSign,
    href: "/payments",
  },
  {
    label: "إرسال رسالة",
    description: "التواصل مع أولياء الأمور",
    icon: FiMessageCircle,
    href: "/messages",
  },
];

const formatMoney = (amount: number): string =>
  `${amount.toLocaleString("en-US")} ج.م`;

const formatTodayLabel = (date: Date): string =>
  new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

const weekdayArabic = (date: Date): string =>
  [
    "الأحد",
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
  ][date.getDay()];

const formatTime = (time: string): string => {
  const [hoursRaw, minutesRaw] = time
    .split(":")
    .map(Number);

  const hours = hoursRaw ?? 0;
  const minutes = minutesRaw ?? 0;
  const suffix = hours >= 12 ? "م" : "ص";
  const display =
    hours % 12 === 0 ? 12 : hours % 12;

  return `${display
    .toString()
    .padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")} ${suffix}`;
};

const isMarked = (
  status: string,
): boolean =>
  status === "present" ||
  status === "late" ||
  status === "absent";

export default function DashboardPage() {
  const [studentsCount, setStudentsCount] = useState(0);
  const [todayPresent, setTodayPresent] = useState(0);
  const [todayAbsent, setTodayAbsent] = useState(0);
  const [collectedToday, setCollectedToday] = useState(0);
  const [examsCount, setExamsCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [todayLessonCount, setTodayLessonCount] = useState(0);
  const [classItems, setClassItems] = useState<ClassItem[]>([]);
  const [weekAttendance, setWeekAttendance] = useState<WeekDayAttendance[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  /*
   * Evaluated during render (same pattern as lessons/attendance pages):
   * always reflects the current day on refresh without SSR staleness
   * from module-scope evaluation.
   */
  const todayKey = new Date().toISOString().slice(0, 10);
  const [todayLabel, setTodayLabel] = useState(() =>
    formatTodayLabel(new Date()),
  );

  useEffect(() => {
    let mounted = true;

    const loadStats = async () => {
      try {
        const [
          students,
          attendance,
          payments,
          exams,
          messages,
          lessons,
        ] = await Promise.all([
          studentService.list(),
          attendanceService.list(),
          paymentService.list(),
          examService.list(),
          messageService.list(),
          lessonService.list(),
        ]);

        if (!mounted) {
          return;
        }

        const todayRecords = attendance
          .filter((record) => {
            const recordDay =
              record.checkedInAt?.slice(0, 10) ??
              record.checkedOutAt?.slice(0, 10) ??
              todayKey;

            return recordDay === todayKey;
          })
          .map((record) => record.status);

        setStudentsCount(students.length);

        setTodayPresent(
          todayRecords.filter(
            (status) =>
              status === "present" ||
              status === "late",
          ).length,
        );

        setTodayAbsent(
          todayRecords.filter(
            (status) => status === "absent",
          ).length,
        );

        const paymentRecords = payments.filter(
          (payment) =>
            (
              payment.paymentDate ??
              payment.paidAt ??
              ""
            ).slice(0, 10) === todayKey,
        );

        setCollectedToday(
          paymentRecords.reduce(
            (total, payment) =>
              total + payment.amount,
            0,
          ),
        );

        setExamsCount(exams.length);

        setMessagesCount(messages.length);

        const upcomingLessons = lessons
          .filter(
            (lesson) =>
              lesson.date > todayKey &&
              lesson.status !== "cancelled",
          )
          .sort(
            (first, second) =>
              first.date.localeCompare(second.date) ||
              first.time.localeCompare(second.time),
          );

        const todayLessons = lessons
          .filter(
            (lesson) =>
              lesson.date === todayKey &&
              lesson.status !== "cancelled",
          )
          .sort((first, second) =>
            first.time.localeCompare(second.time),
          );

        setTodayLessonCount(todayLessons.length);

        const shownLessons =
          todayLessons.length > 0
            ? todayLessons
            : upcomingLessons.slice(0, 4);

        setClassItems(
          shownLessons.map((lesson) => ({
            id: lesson.id,
            subject: lesson.subject,
            group: lesson.group,
            time: formatTime(lesson.time),
            status:
              lesson.status === "ongoing"
                ? "جارية"
                : "قادمة",
          })),
        );

        const weekDays: WeekDayAttendance[] = [];

        for (
          let offset = 6;
          offset >= 0;
          offset -= 1
        ) {
          const date = new Date();
          date.setDate(date.getDate() - offset);
          const dayKey = date
            .toISOString()
            .slice(0, 10);

          const marked = attendance.filter(
            (record) => {
              const recordDay =
                record.checkedInAt?.slice(0, 10) ??
                record.checkedOutAt?.slice(0, 10) ??
                todayKey;

              return (
                recordDay === dayKey &&
                isMarked(record.status)
              );
            },
          );

          const presentCount = marked.filter(
            (record) =>
              record.status === "present" ||
              record.status === "late",
          ).length;

          const absentCount = marked.filter(
            (record) =>
              record.status === "absent",
          ).length;

          const present =
            marked.length === 0
              ? 0
              : Math.round(
                  (presentCount /
                    marked.length) *
                    100,
                );

          weekDays.push({
            day: weekdayArabic(date),
            present,
            absent:
              marked.length === 0
                ? 0
                : Math.round(
                    (absentCount /
                      marked.length) *
                      100,
                  ),
            hasData: marked.length > 0,
          });
        }

        setWeekAttendance(weekDays);
      } catch {
        // Keep the zeros; the fixed layout still renders.
      }
    };

    void loadStats();

    return () => {
      mounted = false;
    };
  }, [reloadKey, todayKey]);

  const handleRefreshToday = () => {
    setTodayLabel(formatTodayLabel(new Date()));
    setReloadKey((current) => current + 1);
  };

  return (
    <main className="educenter-dashboard min-h-screen bg-[#F5F7FC]">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        {/* Page Header */}

        <section className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-bold text-[#1748EF]">
              {todayLabel || "اليوم"}
            </p>

            <h1 className="text-2xl font-extrabold tracking-tight text-[#10275B] sm:text-3xl">
              لوحة التحكم
            </h1>

            <p className="mt-1.5 text-sm text-slate-500">
              نظرة عامة على أداء المركز وحالة العمل اليوم.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshToday}
              aria-label="تحديث بيانات اليوم"
              className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <FiRefreshCw size={15} />
              تحديث
            </button>
          </div>
        </section>

        {/* Statistics */}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            const liveValue =
              stat.title === "إجمالي الطلاب"
                ? studentsCount.toLocaleString("en-US")
                : stat.title === "الحضور اليوم"
                  ? todayPresent.toLocaleString("en-US")
                  : stat.title === "الغياب اليوم"
                    ? todayAbsent.toLocaleString("en-US")
                    : stat.title === "حصص اليوم"
                      ? todayLessonCount.toLocaleString("en-US")
                      : stat.title === "المحصل اليوم"
                        ? formatMoney(collectedToday)
                        : stat.title ===
                            "الامتحانات القادمة"
                          ? examsCount.toLocaleString("en-US")
                          : stat.title ===
                              "رسائل WhatsApp"
                            ? messagesCount.toLocaleString(
                                "en-US",
                              )
                            : stat.value;

            return (
              <div
                key={stat.title}
                className="group rounded-2xl border border-[#E7ECF5] bg-white p-5 shadow-[0_5px_20px_rgba(15,35,75,.035)] transition duration-200 hover:-translate-y-0.5 hover:border-[#CFD9F1] hover:shadow-[0_12px_28px_rgba(15,35,75,.08)]"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EDF2FF] text-[#1748EF] transition group-hover:bg-[#E1E9FF]">
                    <Icon size={19} />
                  </div>

                  {stat.trend && (
                    <span
                      className={[
                        "flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold",
                        stat.trend === "up"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-amber-50 text-amber-600",
                      ].join(" ")}
                    >
                      {stat.trend === "up" ? (
                        <FiArrowUp size={11} />
                      ) : (
                        <FiArrowDown size={11} />
                      )}

                      {stat.trend === "up"
                        ? "تحسن"
                        : "متابعة"}
                    </span>
                  )}
                </div>

                <p className="text-xs font-medium text-slate-500">
                  {stat.title}
                </p>

                <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  {liveValue}
                </p>

                <p className="mt-2 text-[10px] font-medium text-slate-400">
                  {stat.description}
                </p>
              </div>
            );
          })}
        </section>

        {/* Main Dashboard Grid */}

        <section className="mt-6 grid gap-6 xl:grid-cols-3">
          {/* Attendance Chart */}

          <div className="rounded-2xl border border-[#E7ECF5] bg-white p-5 shadow-[0_5px_20px_rgba(15,35,75,.035)] xl:col-span-2 sm:p-6">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  الحضور والغياب
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  نسبة الحضور والغياب خلال آخر 7 أيام
                </p>
              </div>
            </div>

            <div className="mb-5 flex items-center gap-5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#1748EF]" />
                <span className="text-[10px] font-medium text-slate-500">
                  حضور
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                <span className="text-[10px] font-medium text-slate-500">
                  غياب
                </span>
              </div>
            </div>

            <div className="relative h-64">
              <div className="absolute inset-0 flex flex-col justify-between">
                {[100, 75, 50, 25, 0].map((value) => (
                  <div
                    key={value}
                    className="flex items-center gap-3"
                  >
                    <span className="w-7 text-[9px] text-slate-400">
                      {value}%
                    </span>

                    <div className="h-px flex-1 bg-slate-100" />
                  </div>
                ))}
              </div>

              <div className="absolute inset-x-10 bottom-0 top-0 flex items-end justify-between gap-2">
                {weekAttendance.map((item) => (
                  <div
                    key={item.day}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                  >
                    <div
                      className="flex h-[calc(100%-24px)] w-full max-w-10 flex-col justify-end overflow-hidden rounded-t-lg bg-slate-50"
                      title={
                        item.hasData
                          ? `حضور ${item.present}%، غياب ${item.absent}%`
                          : "لا توجد سجلات"
                      }
                    >
                      {item.hasData && (
                        <>
                          <div
                            className="w-full bg-[#F3A9B2] transition-all duration-500"
                            style={{ height: `${item.absent}%` }}
                          />
                          <div
                            className="w-full bg-[#315FF1] transition-all duration-500"
                            style={{ height: `${item.present}%` }}
                          />
                        </>
                      )}
                    </div>

                    <span className="text-[9px] font-medium text-slate-400">
                      {item.day}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Today's Classes */}

          <div className="rounded-2xl border border-[#E7ECF5] bg-white p-5 shadow-[0_5px_20px_rgba(15,35,75,.035)] sm:p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  حصص اليوم
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  جدول الحصص القادمة
                </p>
              </div>

              <span className="rounded-full bg-[#EDF2FF] px-2 py-1 text-[10px] font-semibold text-[#1748EF]">
                {todayLessonCount > 0
                  ? `${todayLessonCount.toLocaleString(
                      "en-US",
                    )} حصة`
                  : classItems.length > 0
                    ? `${classItems.length.toLocaleString(
                        "en-US",
                      )} حصة قادمة`
                    : "لا توجد حصص"}
              </span>
            </div>

            {classItems.length === 0 ? (
              <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center">
                <FiCalendar size={20} className="text-slate-400" />

                <p className="mt-3 text-xs font-bold text-slate-600">
                  لا توجد حصص مسجلة لليوم
                </p>

                <p className="mt-1 text-[10px] leading-5 text-slate-400">
                  أضف حصصًا من صفحة جدول الحصص وسيتم
                  عرضها هنا تلقائيًا.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {classItems.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-[#DCE5FF] hover:bg-[#EDF2FF]/40"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition group-hover:bg-[#E2E9FF] group-hover:text-[#1748EF]">
                      <FiBookOpen size={16} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-800">
                        {item.subject}
                      </p>

                      <p className="mt-0.5 truncate text-[10px] text-slate-400">
                        {item.group}
                      </p>
                    </div>

                    <div className="shrink-0 text-left">
                      <p className="text-[10px] font-semibold text-slate-600">
                        {item.time}
                      </p>

                      <span
                        className={[
                          "mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[8px] font-semibold",
                          item.status === "جارية"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-100 text-slate-400",
                        ].join(" ")}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Link
              href="/lessons"
              className="mt-4 flex w-full items-center justify-center rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-[#CCD8FF] hover:bg-[#EDF2FF] hover:text-[#1748EF]"
            >
              عرض جدول الحصص
            </Link>
          </div>
        </section>

        {/* Quick Actions */}

        <section className="mt-6 rounded-2xl border border-[#E7ECF5] bg-white p-5 shadow-[0_5px_20px_rgba(15,35,75,.035)] sm:p-6">
          <div className="mb-5">
            <h2 className="text-sm font-bold text-slate-900">
              إجراءات سريعة
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              الوصول السريع إلى العمليات الأكثر استخدامًا
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-right transition duration-200 hover:-translate-y-0.5 hover:border-[#CCD8FF] hover:bg-[#EDF2FF]/50 hover:shadow-sm"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition group-hover:bg-[#E2E9FF] group-hover:text-[#1748EF]">
                    <Icon size={17} />
                  </span>

                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-700">
                      {action.label}
                    </span>

                    <span className="mt-1 block truncate text-[10px] text-slate-400">
                      {action.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}