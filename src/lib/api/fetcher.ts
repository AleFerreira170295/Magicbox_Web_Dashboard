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

function resolveApiBaseUrl() {
  const configuredBase = appConfig.apiBaseUrl.trim();

  if (/^https?:\/\//i.test(configuredBase)) {
    return configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`;
  }

  const relativeBase = configuredBase.startsWith("/") ? configuredBase : `/${configuredBase}`;
  const origin = typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:3000";

  return `${origin}${relativeBase.endsWith("/") ? relativeBase : `${relativeBase}/`}`;
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
