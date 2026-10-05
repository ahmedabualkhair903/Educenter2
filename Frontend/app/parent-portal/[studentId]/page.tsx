import Link from "next/link";
import { notFound } from "next/navigation";
import { FiArrowRight, FiClock, FiUser } from "react-icons/fi";

type ParentPortalPageProps = {
  params: Promise<{
    studentId: string;
  }>;
};

/*
 * Public parent portal (no dashboard shell — see DashboardShell).
 * The backend parent-portal endpoint is a stub, so this renders
 * a graceful placeholder instead of breaking the build or
 * showing a blank page from printed QR codes.
 */
export default async function ParentPortalPage({
  params,
}: ParentPortalPageProps) {
  const { studentId } = await params;

  if (!studentId || !studentId.trim()) {
    notFound();
  }

  return (
    <main
      dir="rtl"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F3F6FC] px-4 py-10 sm:px-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-[-8rem] h-80 w-80 rounded-full bg-[#1748EF]/[0.07] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 left-[-7rem] h-96 w-96 rounded-full bg-[#10275B]/[0.06] blur-3xl"
      />

      <section className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[#DCE5F2] bg-white shadow-[0_24px_70px_rgba(16,39,91,0.10)]">
        <div className="h-1.5 bg-gradient-to-l from-[#10275B] via-[#1748EF] to-[#4D74FF]" />

        <div className="px-6 py-9 text-center sm:px-10 sm:py-11">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#1748EF] ring-8 ring-[#F7F8FF]">
            <FiUser size={26} />
          </div>

          <p className="mt-6 text-xs font-bold tracking-wide text-[#1748EF]">
            بوابة EduCenter
          </p>
          <h1 className="mt-2 text-2xl font-black text-[#10275B] sm:text-3xl">
            بوابة ولي الأمر
          </h1>

          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-600 sm:text-base">
            ملف الطالب ({studentId}) سيكون متاحاً هنا قريباً.
            لمتابعة الحضور والدرجات والمدفوعات، تواصل مع إدارة
            المركز.
          </p>

          <div className="mt-7 flex items-center justify-center gap-2 rounded-xl border border-[#DCE5F2] bg-[#F5F7FC] px-4 py-3.5 text-sm font-semibold text-[#10275B]">
            <FiClock size={17} className="shrink-0 text-[#1748EF]" />
            هذه الصفحة قيد التجهيز
          </div>

          <Link
            href="/login"
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1748EF] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#10275B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1748EF]/20 sm:w-auto sm:min-w-52"
          >
            <FiArrowRight size={16} className="rotate-180" />
            تسجيل الدخول
          </Link>
        </div>
      </section>
    </main>
  );
}
