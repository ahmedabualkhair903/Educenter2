
"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import Header from "./Header";
import Sidebar from "./Sidebar";

type DashboardShellProps = {
  children: React.ReactNode;
};

export default function DashboardShell({
  children,
}: DashboardShellProps) {
  const pathname = usePathname();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  /*
   * Authentication pages should not contain
   * the dashboard layout.
   */
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register";

  const isPublicPage = pathname === "/";

  /*
   * Parent Portal has its own mobile-first layout
   * and must never render the Admin navigation.
   */
  const isParentPortal =
    pathname.startsWith("/parent-portal/");

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const toggleSidebar = () => {
    setSidebarOpen((current) => !current);
  };

  if (isAuthPage || isParentPortal || isPublicPage) {
    return <>{children}</>;
  }

  return (
    <div
      className="educenter-shell min-h-screen bg-[#F5F7FC]"
      dir="rtl"
    >
      <div className="min-h-screen lg:flex">
        <Sidebar
          mobileOpen={sidebarOpen}
          onClose={closeSidebar}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header onMenuClick={toggleSidebar} />

          <main className="min-w-0 flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
