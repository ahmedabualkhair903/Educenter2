import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";

import "./globals.css";

import DashboardShell from "@/components/layout/DashboardShell";
import { AppSettingsProvider } from "@/components/providers";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-ibm-plex-arabic",
  subsets: ["arabic"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "EduCenter | منصة التعليم",
    template: "%s | EduCenter",
  },
  description: "منصة تعليمية وإدارة متكاملة للطلاب والمراكز التعليمية",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={ibmPlexSansArabic.variable}
      suppressHydrationWarning
    >
      <body
        className="min-h-screen antialiased"
        suppressHydrationWarning
      >
        <AppSettingsProvider>
          <DashboardShell>{children}</DashboardShell>
        </AppSettingsProvider>
      </body>
    </html>
  );
}