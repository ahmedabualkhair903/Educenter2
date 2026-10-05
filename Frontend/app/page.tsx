"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  FiActivity,
  FiArrowLeft,
  FiBookOpen,
  FiCalendar,
  FiCheck,
  FiChevronLeft,
  FiClock,
  FiMenu,
  FiSearch,
  FiUsers,
  FiX,
} from "react-icons/fi";
import styles from "./Homepage.module.css";

const stats = [
  { value: "+5,000", label: "طالب وطالبة" },
  { value: "+120", label: "مدرس ومعلم" },
  { value: "+50", label: "مركز تعليمي" },
];

const students = [
  { name: "أحمد محمد علي", detail: "الصف الثالث الثانوي", score: "96%", tone: "blue" },
  { name: "سارة محمود حسن", detail: "الصف الثاني الثانوي", score: "92%", tone: "purple" },
  { name: "عمر خالد إبراهيم", detail: "الصف الأول الثانوي", score: "88%", tone: "orange" },
];

const attendance = [
  ["ح", "ن", "ث", "ر", "خ", "ج", "س"],
  ["", "", "", "١", "٢", "٣", "٤"],
  ["٥", "٦", "٧", "٨", "٩", "١٠", "١١"],
  ["١٢", "١٣", "١٤", "١٥", "١٦", "١٧", "١٨"],
  ["١٩", "٢٠", "٢١", "٢٢", "٢٣", "٢٤", "٢٥"],
];

function Brand() {
  return (
    <Link href="/" className={styles.brand} aria-label="EduCenter - الرئيسية">
      <span className={styles.brandMark}>
        <FiBookOpen aria-hidden="true" />
      </span>
      <span className={styles.brandName}>
        EduCenter
        <small>منصتك التعليمية</small>
      </span>
    </Link>
  );
}

function DashboardPreview() {
  return (
    <div className={styles.dashboard} dir="rtl" aria-label="معاينة لوحة تحكم EduCenter">
      <aside className={styles.dashboardSidebar}>
        <Brand />
        <div className={styles.sidebarLinks}>
          <span className={styles.sidebarLinkActive}><FiActivity /> لوحة التحكم</span>
          <span className={styles.sidebarLink}><FiUsers /> الطلاب</span>
          <span className={styles.sidebarLink}><FiBookOpen /> المجموعات</span>
          <span className={styles.sidebarLink}><FiCalendar /> الحضور والغياب</span>
        </div>
        <span className={styles.sidebarFooter}>مساحتك التعليمية، في مكان واحد</span>
      </aside>

      <div className={styles.dashboardContent}>
        <div className={styles.dashboardTopbar}>
          <div>
            <p className={styles.dashboardEyebrow}>الأحد، ١٢ أكتوبر ٢٠٢٥</p>
            <h3>مرحباً بك في EduCenter</h3>
          </div>
          <div className={styles.searchBox}><FiSearch /> ابحث عن طالب أو مجموعة</div>
        </div>

        <div className={styles.metricGrid}>
          <article className={styles.metricCard}>
            <span className={styles.metricIcon}><FiUsers /></span>
            <span className={styles.metricLabel}>إجمالي الطلاب</span>
            <strong>1,248</strong>
            <small>طالب مسجل</small>
          </article>
          <article className={styles.metricCard}>
            <span className={`${styles.metricIcon} ${styles.metricPurple}`}><FiCalendar /></span>
            <span className={styles.metricLabel}>الحضور اليوم</span>
            <strong>92%</strong>
            <small>مقارنة بالأسبوع الماضي</small>
          </article>
          <article className={styles.metricCard}>
            <span className={`${styles.metricIcon} ${styles.metricOrange}`}><FiBookOpen /></span>
            <span className={styles.metricLabel}>الحصص النشطة</span>
            <strong>18</strong>
            <small>حصة هذا الأسبوع</small>
          </article>
        </div>

        <div className={styles.dashboardLower}>
          <article className={styles.panel}>
            <div className={styles.panelHeading}>
              <div><h4>نظرة على الأداء</h4><p>متابعة تقدم الطلاب خلال الشهر</p></div>
              <button type="button" className={styles.periodButton}>هذا الشهر <FiChevronLeft /></button>
            </div>
            <div className={styles.chartLegend}><span /> درجات الطلاب</div>
            <div className={styles.chart}>
              <div className={styles.chartGrid}>
                <span>١٠٠</span><span>٧٥</span><span>٥٠</span><span>٢٥</span>
              </div>
              <svg viewBox="0 0 520 130" role="img" aria-label="رسم بياني يوضح تحسن درجات الطلاب">
                <defs>
                  <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#3262f5" stopOpacity=".2" />
                    <stop offset="100%" stopColor="#3262f5" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 103 C35 98 43 85 76 89 S115 70 147 78 S191 64 223 68 S263 44 293 58 S336 51 365 45 S403 48 433 29 S482 39 520 13 L520 130 L0 130Z" fill="url(#chartFill)" />
                <path d="M0 103 C35 98 43 85 76 89 S115 70 147 78 S191 64 223 68 S263 44 293 58 S336 51 365 45 S403 48 433 29 S482 39 520 13" fill="none" stroke="#3262f5" strokeWidth="3" strokeLinecap="round" />
                <circle cx="433" cy="29" r="5" fill="#fff" stroke="#3262f5" strokeWidth="3" />
              </svg>
              <div className={styles.chartMonths}><span>الأسبوع الأول</span><span>الأسبوع الثاني</span><span>الأسبوع الثالث</span><span>الأسبوع الرابع</span></div>
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeading}>
              <div><h4>الطلاب المتفوقون</h4><p>أعلى النتائج هذا الشهر</p></div>
              <Link href="/students" className={styles.panelLink}>عرض الكل <FiChevronLeft /></Link>
            </div>
            <div className={styles.studentList}>
              {students.map((student, index) => (
                <div className={styles.studentRow} key={student.name}>
                  <span className={`${styles.avatar} ${styles[`avatar${index + 1}`]}`} aria-hidden="true">
                    {student.name.charAt(0)}
                  </span>
                  <span className={styles.studentInfo}><strong>{student.name}</strong><small>{student.detail}</small></span>
                  <span className={`${styles.studentScore} ${styles[student.tone]}`}>{student.score}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

function AttendancePreview() {
  return (
    <div className={styles.attendancePreview} dir="rtl" aria-label="معاينة سجل الحضور">
      <div className={styles.attendanceHeader}>
        <span className={styles.attendanceIcon}><FiCalendar /></span>
        <div><p>الحضور والغياب</p><small>متابعة يومية بكل سهولة</small></div>
        <span className={styles.attendanceDate}>أكتوبر ٢٠٢٥ <FiChevronLeft /></span>
      </div>
      <div className={styles.attendanceBody}>
        <div className={styles.calendar}>
          {attendance.flatMap((week, row) => week.map((day, column) => (
            <span
              className={[
                styles.calendarDay,
                row === 0 ? styles.calendarWeekday : "",
                (row === 2 && column === 3) || (row === 3 && column === 1) ? styles.calendarPresent : "",
                row === 3 && column === 4 ? styles.calendarSelected : "",
                row === 4 && column === 5 ? styles.calendarAbsent : "",
              ].filter(Boolean).join(" ")}
              key={`${row}-${column}`}
            >
              {day}
            </span>
          )))}
        </div>
        <div className={styles.attendanceSummary}>
          <div className={styles.progressRing}><span>٩٢٪</span></div>
          <strong>نسبة الحضور</strong>
          <span className={styles.attendanceTrend}><FiCheck /> أعلى من الشهر الماضي</span>
          <div className={styles.attendanceStats}><span>حاضر <b>١١٥</b></span><span>غائب <b>١٠</b></span></div>
        </div>
      </div>
      <div className={styles.attendanceFooter}><FiClock /> آخر تحديث اليوم، ٩:٤٥ صباحاً</div>
    </div>
  );
}

export default function HomePage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobileMenu = () => setMobileOpen(false);

  return (
    <main className={styles.home} dir="rtl">
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Brand />
          <nav className={styles.desktopNav} aria-label="التنقل الرئيسي">
            <a className={styles.activeNav} href="#home">الرئيسية</a>
            <a href="#platform">المنصة</a>
            <a href="#students">المميزات</a>
            <a href="#contact">تواصل معنا</a>
          </nav>
          <Link href="/login" className={styles.loginButton}>تسجيل الدخول <FiArrowLeft /></Link>
          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "إغلاق القائمة" : "فتح القائمة"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
        {mobileOpen && (
          <nav className={styles.mobileNav} aria-label="التنقل الرئيسي">
            <a href="#home" onClick={closeMobileMenu}>الرئيسية</a>
            <a href="#platform" onClick={closeMobileMenu}>المنصة</a>
            <a href="#students" onClick={closeMobileMenu}>المميزات</a>
            <a href="#contact" onClick={closeMobileMenu}>تواصل معنا</a>
            <Link href="/login" onClick={closeMobileMenu}>تسجيل الدخول</Link>
          </nav>
        )}
      </header>

      <section className={styles.hero} id="home">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}><span /> كل ما يحتاجه مركزك، في منصة واحدة</span>
            <h1>مستقبل تعليمي<br /><span>أكثر إشراقاً</span></h1>
            <p className={styles.heroDescription}>
              نظّم فصولك، وتابع طلابك، واصنع تجربة تعليمية أفضل — كل ذلك بسهولة، من مكان واحد.
            </p>
            <div className={styles.heroActions}>
              <Link href="/register" className={styles.primaryButton}>ابدأ الآن <FiArrowLeft /></Link>
              <a href="#platform" className={styles.secondaryButton}><FiBookOpen /> تعرّف على المنصة</a>
            </div>
            <div className={styles.stats} aria-label="إحصائيات المنصة">
              {stats.map((stat) => (
                <div className={styles.stat} key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.blueShape} />
            <div className={styles.imageFrame}>
              <Image
                src="/images/educenter-hero.png"
                alt="طلاب يتعلمون داخل فصل دراسي"
                fill
                priority
                sizes="(max-width: 700px) 100vw, 54vw"
                className={styles.heroImage}
              />
            </div>
            <div className={styles.heroNote}><span><FiCheck /></span><div><strong>تعلّم يصنع الفرق</strong><small>خطوة أقرب إلى النجاح</small></div></div>
            <div className={styles.heroLogoCard}><span><FiBookOpen /></span><div><strong>EduCenter</strong><small>منصة إدارة تعليمية متكاملة</small></div></div>
            <span className={styles.heroSpark} aria-hidden="true">✦</span>
          </div>
        </div>
      </section>

      <section className={styles.platformSection} id="platform">
        <div className={styles.sectionHeading}>
          <span className={styles.sectionKicker}>مساحة واحدة لكل تفاصيل مركزك</span>
          <h2>صورة أوضح. <span>قرارات أفضل.</span></h2>
          <p>من لوحة التحكم إلى سجل الحضور، كل ما تحتاجه لإدارة يومك التعليمي مرتب أمامك.</p>
        </div>
        <DashboardPreview />
      </section>

      <section className={styles.attendanceSection} id="students">
        <div className={styles.attendanceIntro}>
          <span className={styles.sectionKicker}>متابعة بلا تعقيد</span>
          <h2>كل تقدّم صغير<br /><span>يستحق أن يُلاحظ.</span></h2>
          <p>تابع حضور طلابك ونتائجهم في لمحة، وامنح كل طالب الاهتمام الذي يستحقه.</p>
          <Link href="/students" className={styles.textLink}>اكتشف أدوات متابعة الطلاب <FiArrowLeft /></Link>
        </div>
        <AttendancePreview />
      </section>

      <footer className={styles.footer} id="contact">
        <Brand />
        <p>تعليم أفضل، يبدأ بتنظيم أفضل.</p>
        <Link href="/register">ابدأ رحلتك التعليمية <FiArrowLeft /></Link>
      </footer>
    </main>
  );
}
