
"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import {
  FiBookOpen,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
} from "react-icons/fi";

import { login } from "@/lib/auth";

const getRedirectPath = (): string => {
  const params = new URLSearchParams(
    window.location.search,
  );

  const redirect =
    params.get("redirect") ??
    "/dashboard";

  if (
    !redirect.startsWith("/") ||
    redirect.startsWith("//") ||
    redirect.includes(":")
  ) {
    return "/dashboard";
  }

  return redirect;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    if (!email.trim()) {
      setError("من فضلك أدخل اسم المستخدم أو البريد الإلكتروني.");
      return;
    }

    if (!password.trim()) {
      setError("من فضلك أدخل كلمة المرور.");
      return;
    }

    setLoading(true);

    try {
      await login(email, password);
      router.replace(getRedirectPath());
    } catch (err: unknown) {
      setLoading(false);
      setError(
        err instanceof Error
          ? err.message
          : "بيانات تسجيل الدخول غير صحيحة. حاول مرة أخرى.",
      );
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-[#f5f7fc]">
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-5 p-3 sm:p-5 lg:grid-cols-[1fr_.86fr] lg:gap-7 lg:p-7">
        <section className="relative flex min-h-[260px] overflow-hidden rounded-[24px] bg-[#10275b] shadow-[0_22px_55px_rgba(14,36,87,.16)] sm:min-h-[330px] lg:min-h-[calc(100vh-56px)]">
          <Image
            src="/images/nB1w5is9AKQCaSU5X77jCYDld4ynjirQvsTeZX7v7EJn5Wd8fQ-sc3rlNcrP95coYUyeJf8tKDkwXmDBIqIeFg1PxU9n3FL5fopLHdriIaJFkDv3J4KMCYEkqFD8oC0T7cIJ-a-rWDuX1Fn5wRaTNqlK0n7vBVBlDPkAu-5rlpeScv.jfif"
            alt="طلاب يتعلمون في EduCenter"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 56vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071538]/95 via-[#10275b]/48 to-[#10275b]/5" />
          <div className="absolute inset-0 bg-gradient-to-l from-[#10275b]/55 via-transparent to-transparent" />
          <div className="relative z-10 flex w-full flex-col justify-between p-6 sm:p-9 lg:p-12 xl:p-16">
            <Link href="/" className="flex w-fit items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white shadow-lg backdrop-blur-md">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#1748ef]"><FiBookOpen size={20} /></span>
              <span><strong className="block text-base">EduCenter</strong><small className="text-[10px] text-white/75">منصة تعليمية متكاملة</small></span>
            </Link>
            <div className="max-w-lg pb-1">
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur">مساحتك التعليمية، في مكان واحد</span>
              <h1 className="mt-4 text-3xl font-black leading-[1.25] text-white sm:text-4xl xl:text-5xl">بداية جديدة<br /><span className="text-[#9eb9ff]">لرحلة تعليمية ناجحة</span></h1>
              <p className="mt-4 max-w-md text-xs leading-7 text-white/80 sm:text-sm">مع EduCenter كل شيء أبسط، من متابعة الطلاب إلى تنظيم الحضور والنتائج والتواصل.</p>
            </div>
            <p className="hidden text-[10px] text-white/60 sm:block">© 2026 EduCenter. جميع الحقوق محفوظة.</p>
          </div>
          <div className="absolute bottom-6 left-6 hidden rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white shadow-lg backdrop-blur-md sm:block lg:bottom-10 lg:left-10">
            <span className="block text-[10px] text-white/65">خطوة أقرب إلى النجاح</span>
            <strong className="mt-1 block text-sm">تعلّم يصنع الفرق</strong>
          </div>
        </section>

        <section className="flex min-h-[560px] items-center justify-center rounded-[24px] border border-[#e8edf7] bg-white px-5 py-10 shadow-[0_14px_42px_rgba(14,36,87,.06)] sm:px-9 lg:min-h-[calc(100vh-56px)] lg:px-10 xl:px-14">
          <div className="w-full max-w-[430px]">
            <Link href="/" className="mb-7 flex items-center gap-3 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#1748ef] text-white"><FiBookOpen size={19}/></span><strong className="text-lg text-[#10275b]">EduCenter</strong></Link>
            <div className="mb-8">
              <p className="mb-2 text-sm font-bold text-[#1748ef]">مرحبًا بك مجددًا</p>
              <h2 className="text-3xl font-black tracking-tight text-[#10275b]">تسجيل الدخول</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">سجّل الدخول للوصول إلى لوحة التحكم الخاصة بك.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div><label htmlFor="email" className="mb-2 block text-sm font-bold text-slate-700">اسم المستخدم أو البريد</label><div className="relative"><FiMail size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/><input id="email" type="text" value={email} onChange={(e)=>{setEmail(e.target.value);if(error)setError("")}} placeholder="admin" autoComplete="username" className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-10 pl-4 text-sm outline-none transition focus:border-[#1748EF] focus:ring-4 focus:ring-[#1748EF]/10" /></div></div>
              <div><div className="mb-2 flex items-center justify-between"><label htmlFor="password" className="text-sm font-bold text-slate-700">كلمة المرور</label><button type="button" className="text-[11px] font-bold text-[#1748EF]">نسيت كلمة المرور؟</button></div><div className="relative"><FiLock size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/><input id="password" type={showPassword?"text":"password"} value={password} onChange={(e)=>{setPassword(e.target.value);if(error)setError("")}} placeholder="أدخل كلمة المرور" autoComplete="current-password" className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-10 pl-11 text-sm outline-none transition focus:border-[#1748EF] focus:ring-4 focus:ring-[#1748EF]/10"/><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-50">{showPassword?<FiEyeOff size={16}/>:<FiEye size={16}/>}</button></div></div>
              {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-600">{error}</div>}
              <button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-[#1748EF] text-sm font-bold text-white shadow-[0_10px_24px_rgba(23,72,239,.2)] transition hover:bg-[#123BD0] disabled:opacity-60">{loading?"جاري تسجيل الدخول...":"تسجيل الدخول"}</button>
              <div className="flex items-center gap-3"><div className="h-px flex-1 bg-slate-200"/><span className="text-[10px] text-slate-400">أو سجل الدخول باستخدام</span><div className="h-px flex-1 bg-slate-200"/></div>
              <div className="grid grid-cols-2 gap-3"><button type="button" className="h-11 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600">Google</button><button type="button" className="h-11 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600">Microsoft</button></div>
              <p className="pt-2 text-center text-xs text-slate-400">ليس لديك حساب؟ <Link href="/register" className="font-bold text-[#1748EF]">إنشاء حساب جديد</Link></p>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
