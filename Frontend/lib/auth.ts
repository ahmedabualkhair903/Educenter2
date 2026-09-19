"use client";

import { api, clearTokens, setToken } from "./api";

const AUTH_COOKIE = "manara-auth";
const AUTH_STORAGE_KEY = "manara-user";

export type AuthUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: "admin" | "secretary" | "teacher" | "employee" | "owner";
};

// ─── Cookie helpers ───────────────────────────────────────────────────────────

function setAuthCookie() {
  document.cookie = `${AUTH_COOKIE}=true; path=/; max-age=${
    60 * 60 * 24 * 7
  }; SameSite=Lax`;
}

function clearAuthCookie() {
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

// ─── Auth API calls ───────────────────────────────────────────────────────────

export async function login(
  username: string,
  password: string,
): Promise<AuthUser> {
  if (!username.trim() || !password.trim()) {
    throw new Error("بيانات تسجيل الدخول غير صحيحة.");
  }

  const res = await api.post<{ token: string; refreshToken: string; user: AuthUser }>(
    "/auth/login",
    { username: username.trim(), password: password.trim() },
  );

  const { token, refreshToken, user } = res.data;

  setToken(token, refreshToken);
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  setAuthCookie();

  return user;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } catch {
    // Always clear local state even if server call fails
  } finally {
    clearTokens();
    localStorage.removeItem(AUTH_STORAGE_KEY);
    clearAuthCookie();
  }
}

export function getCurrentUser(): AuthUser | null {
  try {
    if (typeof window === "undefined") return null;
    const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedUser) return null;
    return JSON.parse(storedUser) as AuthUser;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some((cookie) => cookie.startsWith(`${AUTH_COOKIE}=true`));
}

export async function refreshCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await api.get<AuthUser>("/auth/me");
    const user = res.data;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return user;
  } catch {
    return null;
  }
}