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
      className="flex min-h-screen items-center justify-center bg-slate-50 p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
          <FiUser size={22} />
        </div>

        <h1 className="mt-4 text-lg font-bold text-slate-900">
          بوابة ولي الأمر
        </h1>

        <p className="mt-2 text-xs leading-6 text-slate-500">
          ملف الطالب ({studentId}) سيكون متاحاً هنا قريباً.
          لمتابعة الحضور والدرجات والمدفوعات، تواصل مع إدارة
          المركز.
        </p>

        <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-700">
          <FiClock size={15} />
          هذه الصفحة قيد التجهيز
        </div>

        <Link
          href="/login"
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white transition hover:bg-teal-700"
        >
          <FiArrowRight size={15} className="rotate-180" />
          تسجيل الدخول
        </Link>
      </div>
    </main>
  );
}
