import { appConfig } from "@/lib/api/config";
import type { ApiErrorPayload, QueryParams } from "@/lib/api/types";

type ApiEnvelope<T> = {
  status?: string;
  code?: number;
  data?: T;
  timestamp?: string;
};

export class ApiError extends Error {
  status: number;
  payload?: ApiErrorPayload;

  constructor(message: string, status: number, payload?: ApiErrorPayload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  token?: string;
  body?: unknown;
  headers?: HeadersInit;
  searchParams?: QueryParams;
  signal?: AbortSignal;
}

export const AUTH_SESSION_EXPIRED_EVENT = "magicbox:auth-session-expired";

const PLACEHOLDER_IMAGE_HOSTS = new Set(["magicbox.academy", "www.magicbox.academy"]);
const PLACEHOLDER_IMAGE_PATHS = new Set(["/default-avatar.png", "/default-student.png"]);

function isPrivateOrLocalHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();

  if (
    normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "0.0.0.0"
    || normalized === "::1"
  ) {
    return true;
  }

  const ipv4Match = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return false;

  const [first, second] = ipv4Match.slice(1).map(Number);

  if (first === 10) return true;
  if (first === 127) return true;
  if (first === 192 && second === 168) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;

  return false;
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

export function normalizeImageUrl(value?: string | null) {
  if (!value || value.trim().length === 0) return null;

  try {
    const url = new URL(value);
    if (PLACEHOLDER_IMAGE_HOSTS.has(url.hostname.toLowerCase()) && PLACEHOLDER_IMAGE_PATHS.has(url.pathname.toLowerCase())) {
      return null;
    }
  } catch {
    return value;
  }

  return value;
}

export function resolveApiBaseUrl(configuredBaseInput = appConfig.apiBaseUrl, browserOrigin = typeof window !== "undefined" ? window.location.origin : null) {
  const configuredBase = configuredBaseInput.trim();

  if (/^https?:\/\//i.test(configuredBase)) {
    const configuredUrl = new URL(ensureTrailingSlash(configuredBase));

    if (browserOrigin) {
      const currentUrl = new URL(browserOrigin);
      const shouldPreferCurrentOrigin = currentUrl.origin !== configuredUrl.origin
        && isPrivateOrLocalHostname(configuredUrl.hostname)
        && !isPrivateOrLocalHostname(currentUrl.hostname);

      if (shouldPreferCurrentOrigin) {
        return `${currentUrl.origin}${ensureTrailingSlash(configuredUrl.pathname.startsWith("/") ? configuredUrl.pathname : `/${configuredUrl.pathname}`)}`;
      }
    }

    return configuredUrl.toString();
  }

  const relativeBase = configuredBase.startsWith("/") ? configuredBase : `/${configuredBase}`;
  const origin = browserOrigin || "http://localhost:3000";

  return `${origin}${ensureTrailingSlash(relativeBase)}`;
}

function buildUrl(path: string, searchParams?: QueryParams) {
  const url = new URL(path.replace(/^\//, ""), resolveApiBaseUrl());

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value == null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
}

function notifyExpiredSession(status: number) {
  if (typeof window === "undefined") return;
  if (status !== 401) return;

  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  const response = await fetch(buildUrl(path, options.searchParams), {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(!isFormData && options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    body: isFormData ? (options.body as FormData) : options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? ((await response.json()) as ApiErrorPayload) : undefined;

  if (!response.ok) {
    notifyExpiredSession(response.status);
    const message = payload?.error?.message || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!isJson) {
    return undefined as T;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    "status" in payload
  ) {
    return (payload as ApiEnvelope<T>).data as T;
  }

  return payload as T;
}
