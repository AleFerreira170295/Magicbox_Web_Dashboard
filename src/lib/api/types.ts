export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonObject
  | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export type QueryParamsValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryParamsValue>;

export interface ApiErrorPayload {
  status?: string;
  http_status?: number;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  [key: string]: unknown;
}
