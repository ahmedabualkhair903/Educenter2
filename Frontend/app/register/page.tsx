
"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FiArrowLeft,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiPhone,
  FiUser,
} from "react-icons/fi";
import { LuGraduationCap } from "react-icons/lu";

import { api } from "@/lib/api";
import { login } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const clearError = () => {
    if (error) {
      setError("");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    if (!name.trim()) {
      setError("من فضلك أدخل الاسم بالكامل.");
      return;
    }

    if (!email.trim()) {
      setError("من فضلك أدخل البريد الإلكتروني.");
      return;
    }

    if (!phone.trim()) {
      setError("من فضلك أدخل رقم الهاتف.");
      return;
    }

    if (!password.trim()) {
      setError("من فضلك أدخل كلمة المرور.");
      return;
    }

    if (password.length < 6) {
      setError("يجب أن تتكون كلمة المرور من 6 أحرف أو أرقام على الأقل.");
      return;
    }

    if (!confirmPassword.trim()) {
      setError("من فضلك أكد كلمة المرور.");
      return;
    }

    if (password !== confirmPassword) {
      setError("كلمة المرور وتأكيد كلمة المرور غير متطابقين.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/register", {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password: password.trim(),
      });

      await login(email.trim(), password.trim());
      router.replace("/dashboard");
    } catch (err: unknown) {
      setLoading(false);
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء إنشاء الحساب. حاول مرة أخرى.",
      );
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-[#f5f7fc]">
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-5 p-3 sm:p-5 lg:grid-cols-[.9fr_1.1fr] lg:gap-7 lg:p-7">
        <section className="relative flex min-h-[230px] overflow-hidden rounded-[24px] bg-[#10275b] shadow-[0_22px_55px_rgba(14,36,87,.16)] sm:min-h-[285px] lg:min-h-[calc(100vh-56px)]">
          <Image
            src="/images/nB1w5is9AKQCaSU5X77jCYDld4ynjirQvsTeZX7v7EJn5Wd8fQ-sc3rlNcrP95coYUyeJf8tKDkwXmDBIqIeFg1PxU9n3FL5fopLHdriIaJFkDv3J4KMCYEkqFD8oC0T7cIJ-a-rWDuX1Fn5wRaTNqlK0n7vBVBlDPkAu-5rlpeScv.jfif"
            alt="طلاب يتعلمون ويستعدون لمستقبلهم"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 48vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071538]/95 via-[#10275b]/42 to-[#10275b]/5" />
          <div className="relative z-10 flex w-full flex-col justify-between p-6 sm:p-9 lg:p-12 xl:p-14">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="flex w-fit items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white shadow-lg backdrop-blur-md">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#1748ef]">
                  <LuGraduationCap size={22} strokeWidth={2} aria-hidden="true" />
                </span>
                <span>
                  <strong className="block text-base">EduCenter</strong>
                  <small className="text-[10px] text-white/75">نظام إدارة المركز التعليمي</small>
                </span>
              </Link>
              <span className="hidden rounded-full border border-white/20 bg-white/10 px-3 py-2 text-[10px] font-semibold text-white backdrop-blur sm:block">
                ابدأ الآن بسهولة
              </span>
            </div>

            <div className="max-w-lg pb-1">
              <p className="mb-3 text-xs font-bold text-[#b7caff] sm:text-sm">
                كل تفاصيل مركزك، بخطوة واحدة
              </p>
              <h1 className="text-3xl font-black leading-[1.25] tracking-tight text-white xl:text-5xl">
                أنشئ حسابك،<br />
                <span className="text-[#9eb9ff]">وابنِ تجربة تعليمية أفضل.</span>
              </h1>
              <p className="mt-4 max-w-md text-xs leading-7 text-white/80 sm:text-sm">
                مساحة واحدة لإدارة الطلاب والمجموعات والحصص والحضور، كي تمنح وقتك لما يصنع فرقًا حقيقيًا.
              </p>
              <div className="mt-5 hidden flex-wrap gap-2 sm:flex">
                {["الطلاب", "المجموعات", "الحضور", "النتائج"].map((feature) => (
                  <span key={feature} className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white backdrop-blur">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
            <p className="hidden text-[10px] text-white/60 sm:block">
              © 2026 EduCenter. جميع الحقوق محفوظة.
            </p>
          </div>
          <div className="absolute bottom-8 left-8 hidden rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white shadow-lg backdrop-blur-md xl:block">
            <span className="block text-[10px] text-white/65">خطوة أقرب إلى النجاح</span>
            <strong className="mt-1 block text-sm">مستقبل تعليمي أكثر إشراقًا</strong>
          </div>
        </section>

        <section className="flex min-h-[640px] items-center justify-center rounded-[24px] border border-[#e8edf7] bg-white px-5 py-10 shadow-[0_14px_42px_rgba(14,36,87,.06)] sm:px-8 lg:min-h-[calc(100vh-56px)] lg:px-10 xl:px-14">
          <div className="w-full max-w-md">
            {/* Mobile Brand */}
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1748EF] text-white shadow-sm">
                <LuGraduationCap
                  size={23}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </div>

              <div>
                <p className="text-lg font-bold text-slate-900">
                  EduCenter
                </p>

                <p className="text-xs text-slate-400">
                  نظام إدارة المركز التعليمي
                </p>
              </div>
            </div>

            {/* Heading */}
            <div className="mb-7">
              <p className="mb-2 text-sm font-medium text-[#1748EF]">
                حساب جديد
              </p>

              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                إنشاء حساب
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                أدخل بياناتك لإنشاء حساب جديد في EduCenter.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  الاسم بالكامل
                </label>

                <div className="relative">
                  <FiUser
                    size={18}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      clearError();
                    }}
                    placeholder="أدخل الاسم بالكامل"
                    autoComplete="name"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-10 pl-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#1748EF] focus:ring-4 focus:ring-[#1748EF]/10"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  البريد الإلكتروني
                </label>

                <div className="relative">
                  <FiMail
                    size={18}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      clearError();
                    }}
                    placeholder="admin@example.com"
                    autoComplete="email"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-10 pl-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#1748EF] focus:ring-4 focus:ring-[#1748EF]/10"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  رقم الهاتف
                </label>

                <div className="relative">
                  <FiPhone
                    size={18}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      clearError();
                    }}
                    placeholder="01xxxxxxxxx"
                    autoComplete="tel"
                    dir="ltr"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-10 pl-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#1748EF] focus:ring-4 focus:ring-[#1748EF]/10"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  كلمة المرور
                </label>

                <div className="relative">
                  <FiLock
                    size={18}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      clearError();
                    }}
                    placeholder="أدخل كلمة المرور"
                    autoComplete="new-password"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-10 pl-11 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#1748EF] focus:ring-4 focus:ring-[#1748EF]/10"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                    aria-label={
                      showPassword
                        ? "إخفاء كلمة المرور"
                        : "إظهار كلمة المرور"
                    }
                    className="absolute left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <FiEyeOff size={17} />
                    ) : (
                      <FiEye size={17} />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  تأكيد كلمة المرور
                </label>

                <div className="relative">
                  <FiLock
                    size={18}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="confirmPassword"
                    type={
                      showConfirmPassword ? "text" : "password"
                    }
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      clearError();
                    }}
                    placeholder="أعد إدخال كلمة المرور"
                    autoComplete="new-password"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-10 pl-11 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#1748EF] focus:ring-4 focus:ring-[#1748EF]/10"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(
                        (current) => !current
                      )
                    }
                    aria-label={
                      showConfirmPassword
                        ? "إخفاء تأكيد كلمة المرور"
                        : "إظهار تأكيد كلمة المرور"
                    }
                    className="absolute left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                  >
                    {showConfirmPassword ? (
                      <FiEyeOff size={17} />
                    ) : (
                      <FiEye size={17} />
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-600"
                >
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="group mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1748EF] text-sm font-semibold text-white shadow-[0_8px_18px_rgba(23,72,239,.18)] transition hover:bg-[#123BD0] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    جاري إنشاء الحساب...
                  </>
                ) : (
                  <>
                    إنشاء الحساب

                    <FiArrowLeft
                      size={17}
                      className="transition-transform group-hover:-translate-x-1"
                    />
                  </>
                )}
              </button>
            </form>

            {/* Login Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-slate-500">
                لديك حساب بالفعل؟{" "}
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="font-semibold text-[#1748EF] transition hover:text-[#123BD0]"
                >
                  تسجيل الدخول
                </button>
              </p>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5 text-center">
              <p className="text-xs leading-5 text-slate-400">
                الحساب الافتراضي: <strong>admin</strong> / <strong>admin123</strong>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
