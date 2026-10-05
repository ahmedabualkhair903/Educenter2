
"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiDollarSign,
  FiFileText,
  FiGrid,
  FiLogOut,
  FiMessageCircle,
  FiPrinter,
  FiSettings,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { LuGraduationCap } from "react-icons/lu";

import { useAppSettings } from "@/components/providers";
import { logout } from "@/lib/auth";
import type { ModuleKey } from "@/types";

type SidebarProps = {
  mobileOpen: boolean;
  onClose: () => void;
};

type NavItem = {
  label: string;
  href?: string;
  icon: React.ReactNode;
  module?: ModuleKey;
  children?: NavItem[];
};

const mainItems: NavItem[] = [
  {
    label: "الرئيسية",
    href: "/dashboard",
    icon: <FiGrid size={18} />,
  },
];

const navigationItems: NavItem[] = [
  {
    label: "الطلاب",
    href: "/students",
    icon: <FiUsers size={18} />,
    module: "students",
  },
  {
    label: "الحضور",
    href: "/attendance",
    icon: <FiCheckCircle size={18} />,
    module: "attendance",
    children: [
      {
        label: "الحضور والغياب",
        href: "/attendance",
        icon: <FiCheckCircle size={16} />,
        module: "attendance",
      },
      {
        label: "الحضور والانصراف",
        href: "/check-out",
        icon: <FiClock size={16} />,
        module: "checkOut",
      },
      {
        label: "تسجيل الحضور",
        href: "/attendance-scanner",
        icon: <FiCheckCircle size={16} />,
        module: "attendance",
      },
    ],
  },
  {
    label: "المجموعات",
    href: "/groups",
    icon: <FiBookOpen size={18} />,
    module: "groups",
    children: [
      {
        label: "المجموعات",
        href: "/groups",
        icon: <FiBookOpen size={16} />,
        module: "groups",
      },
      {
        label: "الحصص",
        href: "/lessons",
        icon: <FiCalendar size={16} />,
        module: "lessons",
      },
    ],
  },
  {
    label: "المصروفات",
    href: "/payments",
    icon: <FiDollarSign size={18} />,
    module: "payments",
  },
  {
    label: "الامتحانات والدرجات",
    href: "/exams",
    icon: <FiFileText size={18} />,
    module: "exams",
    children: [
      {
        label: "الامتحانات",
        href: "/exams",
        icon: <FiFileText size={16} />,
        module: "exams",
      },
    ],
  },
  {
    label: "الكروت",
    href: "/students/bulk-card-printing",
    icon: <FiPrinter size={18} />,
    module: "students",
    children: [
      {
        label: "طباعة الكروت",
        href: "/students/bulk-card-printing",
        icon: <FiPrinter size={16} />,
        module: "students",
      },
    ],
  },
  {
    label: "التقارير",
    href: "/reports",
    icon: <FiFileText size={18} />,
    module: "reports",
  },
];

const secondaryItems: NavItem[] = [
  {
    label: "WhatsApp",
    href: "/messages",
    icon: <FiMessageCircle size={18} />,
    module: "whatsapp",
  },
  {
    label: "Excel",
    href: "/excel",
    icon: <FiFileText size={18} />,
    module: "excel",
  },
];

function isActivePath(
  pathname: string,
  href: string,
) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

function hasActiveChild(
  pathname: string,
  children: NavItem[] = [],
): boolean {
  return children.some((child) => {
    if (child.href && isActivePath(pathname, child.href)) {
      return true;
    }

    return hasActiveChild(pathname, child.children);
  });
}

function filterVisibleItems(
  items: NavItem[],
  isModuleEnabled: (
    module: ModuleKey,
  ) => boolean,
): NavItem[] {
  return items
    .filter(
      (item) =>
        !item.module ||
        isModuleEnabled(item.module),
    )
    .map((item) => ({
      ...item,
      children: item.children
        ? filterVisibleItems(
            item.children,
            isModuleEnabled,
          )
        : undefined,
    }))
    .filter(
      (item) =>
        Boolean(item.href) ||
        Boolean(item.children?.length),
    );
}

export default function Sidebar({
  mobileOpen,
  onClose,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isModuleEnabled } = useAppSettings();

  const visibleNavigationItems =
    filterVisibleItems(
      navigationItems,
      isModuleEnabled,
    );

  const visibleSecondaryItems =
    filterVisibleItems(
      secondaryItems,
      isModuleEnabled,
    );

  const handleLogout = () => {
    onClose();
    logout();
    router.replace("/login");
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={[
          "fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] transition-opacity lg:hidden",
          mobileOpen
            ? "visible opacity-100"
            : "invisible pointer-events-none opacity-0",
        ].join(" ")}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        id="dashboard-sidebar"
        aria-label="القائمة الرئيسية"
        className={[
          "educenter-sidebar flex w-[272px] shrink-0 flex-col border-l border-white/10 bg-[#0A1B49]",
          "fixed inset-y-0 right-0 z-50 transition-transform duration-300",
          "lg:static lg:z-auto lg:h-screen lg:translate-x-0",
          mobileOpen
            ? "translate-x-0"
            : "translate-x-full",
        ].join(" ")}
      >
        {/* Logo */}
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <Link
            href="/dashboard"
            onClick={onClose}
            aria-label="EduCenter - الرئيسية"
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#315FF1] text-white shadow-sm shadow-[#071538]/30">
              <LuGraduationCap
                size={22}
                strokeWidth={2}
                aria-hidden="true"
              />
            </div>

            <div>
              <p className="text-xl font-extrabold tracking-tight text-white">
                EduCenter
              </p>

              <p className="mt-0.5 text-[10px] font-medium text-white/45">
                منصة إدارة التعليم
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white/45 transition hover:bg-white/10 hover:text-white/90 focus:outline-none focus:ring-2 focus:ring-[#DCE5FF] lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <NavSection title="الرئيسية">
            {renderItems(
              mainItems,
              pathname,
              onClose,
              isModuleEnabled,
            )}
          </NavSection>

          <NavSection title="إدارة المركز">
            {renderItems(
              visibleNavigationItems,
              pathname,
              onClose,
              isModuleEnabled,
            )}
          </NavSection>

          {visibleSecondaryItems.length > 0 && (
            <NavSection title="أدوات إضافية">
              {renderItems(
                visibleSecondaryItems,
                pathname,
                onClose,
                isModuleEnabled,
              )}
            </NavSection>
          )}

          <NavSection title="الإعدادات">
            <SidebarLink
              item={{
                label: "الإعدادات",
                href: "/settings",
                icon: <FiSettings size={18} />,
              }}
              pathname={pathname}
              onClose={onClose}
              isActive={isActivePath(
                pathname,
                "/settings",
              )}
            />
          </NavSection>
        </nav>

        {/* User / Logout */}
        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-lg bg-white/5 p-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E6ECFF] text-sm font-bold text-[#1748EF]"
              aria-hidden="true"
            >
              م
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white/90">
                مدير المركز
              </p>

              <p className="mt-0.5 truncate text-[10px] text-white/45">
                مسؤول النظام
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/60 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-100"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl transition group-hover:bg-white/10">
              <FiLogOut size={17} />
            </span>

            تسجيل الخروج
          </button>
        </div>
      </aside>
    </>
  );
}

function renderItems(
  items: NavItem[],
  pathname: string,
  onClose: () => void,
  isModuleEnabled: (
    module: ModuleKey,
  ) => boolean,
) {
  return items.map((item) => {
    const active =
      Boolean(
        item.href &&
          isActivePath(pathname, item.href),
      ) ||
      hasActiveChild(
        pathname,
        item.children,
      );

    const hasChildren =
      Boolean(item.children?.length);

    if (!hasChildren) {
      return (
        <SidebarLink
          key={item.label}
          item={item}
          pathname={pathname}
          onClose={onClose}
          isActive={active}
        />
      );
    }

    return (
      <SidebarGroup
        key={item.label}
        item={item}
        pathname={pathname}
        onClose={onClose}
        isModuleEnabled={isModuleEnabled}
        active={active}
      />
    );
  });
}

function SidebarLink({
  item,
  pathname,
  onClose,
  isActive,
}: {
  item: NavItem;
  pathname: string;
  onClose: () => void;
  isActive?: boolean;
}) {
  if (!item.href) {
    return null;
  }

  const active =
    isActive ??
    isActivePath(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onClose}
      aria-current={
        active ? "page" : undefined
      }
      className={[
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
        active
          ? "bg-[#315FF1]/20 text-[#C1D1FF]"
          : "text-white/60 hover:bg-white/5 hover:text-white",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
          active
            ? "bg-[#1748EF] text-white shadow-sm shadow-[#071538]/30"
            : "bg-transparent text-white/45 group-hover:text-white/75",
        ].join(" ")}
      >
        {item.icon}
      </span>

      <span className="flex-1">
        {item.label}
      </span>

      {active && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-[#7EA2FF]"
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

function SidebarGroup({
  item,
  pathname,
  onClose,
  isModuleEnabled,
  active,
}: {
  item: NavItem;
  pathname: string;
  onClose: () => void;
  isModuleEnabled: (
    module: ModuleKey,
  ) => boolean;
  active: boolean;
}) {
  const [open, setOpen] =
    useState(active);

  const handleToggle = () => {
    setOpen((current) => !current);
  };

  const visibleChildren =
    filterVisibleItems(
      item.children ?? [],
      isModuleEnabled,
    );

  return (
    <div>
      <div
        className={[
          "flex items-center rounded-lg transition-all",
          active
            ? "bg-[#315FF1]/20"
            : "hover:bg-white/5",
        ].join(" ")}
      >
        {item.href ? (
          <Link
            href={item.href}
            onClick={onClose}
            aria-current={
              active &&
              isActivePath(
                pathname,
                item.href,
              )
                ? "page"
                : undefined
            }
            className={[
              "group flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              active
                ? "text-[#C1D1FF]"
                : "text-white/60 hover:text-white",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
                active
                  ? "bg-[#1748EF] text-white shadow-sm shadow-[#071538]/30"
                  : "bg-transparent text-white/45 group-hover:text-white/75",
              ].join(" ")}
            >
              {item.icon}
            </span>

            <span className="truncate">
              {item.label}
            </span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleToggle}
            className={[
              "group flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-right text-sm font-medium transition-all",
              active
                ? "text-[#C1D1FF]"
                : "text-white/60 hover:text-white",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
                active
                  ? "bg-[#1748EF] text-white shadow-sm shadow-[#071538]/30"
                  : "bg-transparent text-white/45 group-hover:text-white/75",
              ].join(" ")}
            >
              {item.icon}
            </span>

            <span className="truncate">
              {item.label}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={handleToggle}
          className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/10 hover:text-white/90"
          aria-label={
            open
              ? `إغلاق قائمة ${item.label}`
              : `فتح قائمة ${item.label}`
          }
          aria-expanded={open}
        >
          <FiChevronDown
            size={16}
            className={[
              "transition-transform duration-200",
              open
                ? "rotate-180"
                : "rotate-0",
            ].join(" ")}
          />
        </button>
      </div>

      {open &&
        visibleChildren.length > 0 && (
          <div className="mr-5 mt-1 space-y-1 border-r border-white/10 pr-3">
            {visibleChildren.map(
              (child) => (
                <SidebarSubItem
                  key={child.label}
                  item={child}
                  pathname={pathname}
                  onClose={onClose}
                />
              ),
            )}
          </div>
        )}
    </div>
  );
}

function SidebarSubItem({
  item,
  pathname,
  onClose,
}: {
  item: NavItem;
  pathname: string;
  onClose: () => void;
}) {
  if (!item.href) {
    return null;
  }

  const active =
    isActivePath(
      pathname,
      item.href,
    );

  return (
    <Link
      href={item.href}
      onClick={onClose}
      aria-current={
        active ? "page" : undefined
      }
      className={[
        "group flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all",
        active
          ? "bg-[#315FF1]/20 text-[#C1D1FF]"
          : "text-white/60 hover:bg-white/5 hover:text-white",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          active
            ? "bg-[#1748EF] text-white shadow-sm shadow-[#071538]/30"
            : "text-white/45 group-hover:text-white/75",
        ].join(" ")}
      >
        {item.icon}
      </span>

      <span className="flex-1">
        {item.label}
      </span>

      {active && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-[#7EA2FF]"
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

function NavSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <p className="mb-2 px-3 text-[10px] font-bold tracking-wide text-white/45">
        {title}
      </p>

      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}
