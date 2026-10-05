import { LuGraduationCap } from "react-icons/lu";

export default function Loading() {
  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#F5F7FC] px-6"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1748EF] text-white shadow-lg shadow-[#1748EF]/20">
          <LuGraduationCap size={28} aria-hidden="true" />
        </div>

        <div
          role="status"
          aria-live="polite"
          className="text-sm font-medium text-slate-500"
        >
          جاري تحميل الصفحة...
        </div>
      </div>
    </main>
  );
}