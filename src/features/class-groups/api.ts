import { useQuery } from "@tanstack/react-query";
import { apiEndpoints } from "@/lib/api/endpoints";
import { apiRequest } from "@/lib/api/fetcher";
import type { JsonObject, PaginatedResponse } from "@/lib/api/types";
import type { ClassGroupRecord, ClassGroupStudentImportResult, CreateClassGroupPayload } from "@/features/class-groups/types";

function asRecord(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonObject;
  return {};
}

function readString(record: JsonObject, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return "";
}

function normalizeClassGroup(input: unknown): ClassGroupRecord {
  const record = asRecord(input);
  return {
    id: readString(record, "id") || "sin-id",
    educationalCenterId: readString(record, "educational_center_id", "educationalCenterId"),
    userId: readString(record, "user_id", "userId") || null,
    name: readString(record, "name") || "Sin nombre",
    code: readString(record, "code") || "sin-codigo",
    createdAt: readString(record, "created_at", "createdAt") || null,
    updatedAt: readString(record, "updated_at", "updatedAt") || null,
    deletedAt: readString(record, "deleted_at", "deletedAt") || null,
  };
}

function normalizeListResponse(response: unknown): PaginatedResponse<ClassGroupRecord> {
  if (Array.isArray(response)) {
    return {
      data: response.map(normalizeClassGroup),
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
    data: rawData.map(normalizeClassGroup),
    page: Number(pageSource.page || 1),
    limit: Number(pageSource.limit || rawData.length || 0),
    total: Number(pageSource.total || rawData.length || 0),
    total_pages: Number(pageSource.total_pages || 1),
  };
}

function normalizeImportResponse(response: unknown): ClassGroupStudentImportResult {
  const record = asRecord(response);
  const issues = Array.isArray(record.issues)
    ? record.issues.map((entry) => {
        const item = asRecord(entry);
        return {
          rowNumber: Number(item.row_number ?? item.rowNumber ?? 0),
          firstName: readString(item, "first_name", "firstName") || null,
          lastName: readString(item, "last_name", "lastName") || null,
          fileNumber: readString(item, "file_number", "fileNumber") || null,
          message: readString(item, "message") || "Fila inválida",
        };
      })
    : [];

  return {
    classGroupId: readString(record, "class_group_id", "classGroupId"),
    educationalCenterId: readString(record, "educational_center_id", "educationalCenterId"),
    groupName: readString(record, "group_name", "groupName") || "Grupo",
    totalRows: Number(record.total_rows ?? record.totalRows ?? 0),
    processedRows: Number(record.processed_rows ?? record.processedRows ?? 0),
    createdCount: Number(record.created_count ?? record.createdCount ?? 0),
    updatedCount: Number(record.updated_count ?? record.updatedCount ?? 0),
    skippedCount: Number(record.skipped_count ?? record.skippedCount ?? 0),
    errorCount: Number(record.error_count ?? record.errorCount ?? 0),
    issues,
  };
}

export async function listClassGroups(token: string, institutionId?: string | null) {
  const response = await apiRequest<unknown>(apiEndpoints.classGroups.list, {
    token,
    searchParams: {
      institution_id: institutionId || undefined,
      all: true,
      sort_by: "name",
      order: "asc",
    },
  });

  return normalizeListResponse(response);
}

export async function createClassGroup(token: string, payload: CreateClassGroupPayload) {
  const response = await apiRequest<unknown>(apiEndpoints.classGroups.list, {
    method: "POST",
    token,
    body: {
      educational_center_id: payload.educationalCenterId,
      user_id: payload.userId || null,
      name: payload.name,
      code: payload.code,
    },
  });

  return normalizeClassGroup(response);
}

export async function importClassGroupStudents(token: string, classGroupId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiRequest<unknown>(apiEndpoints.classGroups.importStudents(classGroupId), {
    method: "POST",
    token,
    body: formData,
  });

  return normalizeImportResponse(response);
}

export async function deleteClassGroup(token: string, classGroupId: string) {
  await apiRequest<void>(apiEndpoints.classGroups.byId(classGroupId), {
    method: "DELETE",
    token,
  });
}

export function useClassGroups(token?: string, institutionId?: string | null) {
  return useQuery({
    queryKey: ["class-groups", token, institutionId ?? null],
    queryFn: () => listClassGroups(token as string, institutionId ?? null),
    enabled: Boolean(token),
  });
}
