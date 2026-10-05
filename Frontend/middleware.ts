import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "manara-auth";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/parent-portal",
  "/images/educenter-hero.png",
  "/images/nB1w5is9AKQCaSU5X77jCYDld4ynjirQvsTeZX7v7EJn5Wd8fQ-sc3rlNcrP95coYUyeJf8tKDkwXmDBIqIeFg1PxU9n3FL5fopLHdriIaJFkDv3J4KMCYEkqFD8oC0T7cIJ-a-rWDuX1Fn5wRaTNqlK0n7vBVBlDPkAu-5rlpeScv.jfif",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPath = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (isPublicPath) {
    return NextResponse.next();
  }

  const isAuthenticated =
    request.cookies.get(AUTH_COOKIE)?.value === "true";

  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);

    loginUrl.searchParams.set("redirect", pathname);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};