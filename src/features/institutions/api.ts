import { useQuery } from "@tanstack/react-query";
import { apiEndpoints } from "@/lib/api/endpoints";
import { apiRequest } from "@/lib/api/fetcher";
import type { JsonObject, PaginatedResponse } from "@/lib/api/types";
import type { InstitutionRecord } from "@/features/institutions/types";

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

function normalizeInstitution(input: unknown): InstitutionRecord {
  const record = asRecord(input);
  const name =
    readString(record, "name", "institution_name", "educational_center_name", "display_name") ||
    "Sin nombre";

  return {
    id: readString(record, "id", "institution_id", "educational_center_id") || name,
    name,
    code: readString(record, "code", "slug") || null,
    status: readString(record, "status") || null,
    city: readString(record, "city") || null,
    country: readString(record, "country") || null,
    contactName: readString(record, "contact_name", "contactName") || null,
    contactEmail: readString(record, "contact_email", "contactEmail", "email") || null,
    createdAt: readString(record, "created_at", "createdAt") || null,
    updatedAt: readString(record, "updated_at", "updatedAt") || null,
    raw: record,
  };
}

function normalizeResponse(response: unknown): PaginatedResponse<InstitutionRecord> {
  if (Array.isArray(response)) {
    return {
      data: response.map(normalizeInstitution),
      page: 1,
      limit: response.length,
      total: response.length,
      total_pages: 1,
    };
  }

  const record = asRecord(response);
  const rawData = Array.isArray(record.data) ? record.data : [];
  return {
    data: rawData.map(normalizeInstitution),
    page: Number(record.page || 1),
    limit: Number(record.limit || rawData.length || 0),
    total: Number(record.total || rawData.length || 0),
    total_pages: Number(record.total_pages || 1),
  };
}

export async function listInstitutions(token: string) {
  const response = await apiRequest<unknown>(apiEndpoints.institutions.list, {
    token,
    searchParams: { page: 1, limit: 100, sort_by: "created_at", order: "desc" },
  });

  return normalizeResponse(response);
}

export function useInstitutions(token?: string) {
  return useQuery({
    queryKey: ["institutions", token],
    queryFn: () => listInstitutions(token as string),
    enabled: Boolean(token),
  });
}
