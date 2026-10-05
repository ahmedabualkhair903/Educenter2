/**
 * Central API client — connects the Next.js frontend to the Express/SQLite backend.
 * All requests go through this file so token management is in one place.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

const TOKEN_KEY = "manara-token";
const REFRESH_KEY = "manara-refresh";

// ─── Token helpers ────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, refreshToken?: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ─── Standard API response shape ─────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ApiError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 500, code = "UNKNOWN_ERROR") {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  isFormData?: boolean;
};

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const { method = "GET", body, params, isFormData = false } = options;

  // Build URL with query params
  let url = `${BASE_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  // Build headers
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!isFormData) headers["Content-Type"] = "application/json";

  const response = await fetch(url, {
    method,
    headers,
    body: isFormData
      ? (body as FormData)
      : body != null
        ? JSON.stringify(body)
        : undefined,
  });

  let json: ApiResponse<T>;
  try {
    json = await response.json();
  } catch {
    throw new ApiError(
      `الخادم لا يستجيب — تأكد من تشغيل الـ Backend على ${BASE_URL}`,
      response.status,
      "NETWORK_ERROR",
    );
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      if (!window.location.pathname.startsWith("/login")) {
        clearTokens();
        window.location.assign(
          new URL("/login", window.location.origin).toString(),
        );
      }
    }

    const errorObj =
      typeof json === "object" && json !== null && "error" in json
        ? (json as { error?: { message?: string; code?: string } }).error
        : undefined;
    const msg =
      errorObj?.message ||
      (json as { message?: string })?.message ||
      "حدث خطأ غير متوقع";
    const code =
      errorObj?.code ||
      (json as { code?: string })?.code ||
      "SERVER_ERROR";
    throw new ApiError(msg, response.status, code);
  }

  return json;
}

// ─── Convenience methods ──────────────────────────────────────────────────────

export const api = {
  get: <T>(
    path: string,
    params?: RequestOptions["params"],
  ) => apiRequest<T>(path, { method: "GET", params }),

  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: "POST", body }),

  put: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: "PUT", body }),

  patch: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: "PATCH", body }),

  delete: <T>(path: string) =>
    apiRequest<T>(path, { method: "DELETE" }),

  upload: <T>(path: string, formData: FormData) =>
    apiRequest<T>(path, {
      method: "POST",
      body: formData,
      isFormData: true,
    }),
};
