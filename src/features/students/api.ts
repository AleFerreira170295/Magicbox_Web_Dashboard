import { useQuery } from "@tanstack/react-query";
import { apiEndpoints } from "@/lib/api/endpoints";
import { apiRequest, normalizeImageUrl } from "@/lib/api/fetcher";
import type { JsonObject, PaginatedResponse } from "@/lib/api/types";
import type { ListStudentsParams, StudentRecord } from "@/features/students/types";

function asRecord(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonObject;
  return {};
}

function readString(record: JsonObject, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return "";
}

function normalizeStudent(input: unknown): StudentRecord {
  const record = asRecord(input);
  const firstName = readString(record, "first_name", "firstName") || "Sin nombre";
  const lastName = readString(record, "last_name", "lastName") || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || "Sin nombre";

  return {
    id: readString(record, "id") || "sin-id",
    classGroupId: readString(record, "class_group_id", "classGroupId"),
    firstName,
    lastName,
    fullName,
    fileNumber: readString(record, "file_number", "fileNumber") || "sin-legajo",
    imageUrl: normalizeImageUrl(readString(record, "image_url", "imageUrl")),
    createdAt: readString(record, "created_at", "createdAt") || null,
    updatedAt: readString(record, "updated_at", "updatedAt") || null,
    deletedAt: readString(record, "deleted_at", "deletedAt") || null,
  };
}

function normalizeResponse(response: unknown): PaginatedResponse<StudentRecord> {
  if (Array.isArray(response)) {
    return {
      data: response.map(normalizeStudent),
      page: 1,
      limit: response.length,
      total: response.length,
      total_pages: 1,
    };
  }

  const record = asRecord(response);
  const nested = asRecord(record.data);
  const rawData = Array.isArray(nested.data)
    ? nested.data
    : Array.isArray(record.data)
      ? (record.data as unknown[])
      : [];
  const pageSource = Array.isArray(nested.data) ? nested : record;

  return {
    data: rawData.map(normalizeStudent),
    page: Number(pageSource.page || 1),
    limit: Number(pageSource.limit || rawData.length || 0),
    total: Number(pageSource.total || rawData.length || 0),
    total_pages: Number(pageSource.total_pages || 1),
  };
}

export async function listStudents(token: string, params: ListStudentsParams = {}) {
  const safeLimit = Math.min(Math.max(params.limit ?? 100, 1), 100);

  const response = await apiRequest<unknown>(apiEndpoints.students.list, {
    token,
    searchParams: {
      institution_id: params.institutionId || undefined,
      class_group_id: params.classGroupId || undefined,
      page: params.page ?? 1,
      limit: safeLimit,
      sort_by: params.sortBy ?? "updated_at",
      order: params.order ?? "desc",
    },
  });

  return normalizeResponse(response);
}

export async function listAllStudents(token: string, params: Omit<ListStudentsParams, "page" | "limit"> = {}) {
  const limit = 100;
  const firstPage = await listStudents(token, { ...params, page: 1, limit });

  if ((firstPage.total_pages || 1) <= 1) {
    return firstPage;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, (firstPage.total_pages || 1) - 1) }, (_, index) =>
      listStudents(token, { ...params, page: index + 2, limit }),
    ),
  );

  const data = [firstPage, ...remainingPages].flatMap((page) => page.data);

  return {
    data,
    page: 1,
    limit,
    total: firstPage.total || data.length,
    total_pages: firstPage.total_pages || 1,
  };
}

export async function deleteStudent(token: string, studentId: string) {
  await apiRequest<void>(apiEndpoints.students.byId(studentId), {
    method: "DELETE",
    token,
  });
}

export function useStudents(token?: string, params?: ListStudentsParams) {
  const safeLimit = Math.min(Math.max(params?.limit ?? 100, 1), 100);

  return useQuery({
    queryKey: ["students", token, params?.institutionId ?? null, params?.classGroupId ?? null, params?.page ?? 1, safeLimit, params?.sortBy ?? "updated_at", params?.order ?? "desc"],
    queryFn: () => listStudents(token as string, params ?? {}),
    enabled: Boolean(token),
  });
}

export function useAllStudents(token?: string, params?: Omit<ListStudentsParams, "page" | "limit">) {
  return useQuery({
    queryKey: ["students", "all", token, params?.institutionId ?? null, params?.classGroupId ?? null, params?.sortBy ?? "updated_at", params?.order ?? "desc"],
    queryFn: () => listAllStudents(token as string, params ?? {}),
    enabled: Boolean(token),
  });
}
