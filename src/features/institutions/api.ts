import { useQuery } from "@tanstack/react-query";
import { apiEndpoints } from "@/lib/api/endpoints";
import { apiRequest } from "@/lib/api/fetcher";
import type { JsonObject, PaginatedResponse } from "@/lib/api/types";
import type {
  CreateInstitutionPayload,
  InstitutionAddress,
  InstitutionRecord,
  UpdateInstitutionPayload,
} from "@/features/institutions/types";

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

function normalizeAddress(value: unknown): InstitutionAddress | null {
  const record = asRecord(value);
  const addressFirstLine = readString(record, "address_first_line", "addressFirstLine");
  const city = readString(record, "city");
  const countryCode = readString(record, "country_code", "countryCode");

  if (!addressFirstLine || !city || !countryCode) return null;

  return {
    addressFirstLine,
    addressSecondLine: readString(record, "address_second_line", "addressSecondLine") || null,
    countryCode,
    city,
    state: readString(record, "state") || null,
    postalCode: readString(record, "postal_code", "postalCode") || null,
  };
}

function serializeAddress(address: InstitutionAddress) {
  return {
    address_first_line: address.addressFirstLine,
    address_second_line: address.addressSecondLine || null,
    country_code: address.countryCode,
    city: address.city,
    state: address.state || null,
    postal_code: address.postalCode || null,
  };
}

function normalizeInstitution(input: unknown): InstitutionRecord {
  const record = asRecord(input);
  const name =
    readString(record, "name", "institution_name", "educational_center_name", "display_name") ||
    "Sin nombre";
  const address = normalizeAddress(record.address);
  const deletedAt = readString(record, "deleted_at", "deletedAt") || null;
  const email = readString(record, "email", "contact_email", "contactEmail") || "sin-email";

  return {
    id: readString(record, "id", "institution_id", "educational_center_id") || name,
    name,
    email,
    phoneNumber: readString(record, "phone_number", "phoneNumber", "phone") || "",
    address,
    url: readString(record, "url", "website") || null,
    code: readString(record, "code", "slug") || null,
    status: deletedAt ? "deleted" : readString(record, "status") || "active",
    city: address?.city || null,
    country: address?.countryCode || null,
    contactName: null,
    contactEmail: email,
    createdAt: readString(record, "created_at", "createdAt") || null,
    updatedAt: readString(record, "updated_at", "updatedAt") || null,
    deletedAt,
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
  const nested = asRecord(record.data);
  const rawData = Array.isArray(nested.data)
    ? nested.data
    : Array.isArray(record.data)
      ? (record.data as unknown[])
      : [];
  const pageSource = Array.isArray(nested.data) ? nested : record;

  return {
    data: rawData.map(normalizeInstitution),
    page: Number(pageSource.page || 1),
    limit: Number(pageSource.limit || rawData.length || 0),
    total: Number(pageSource.total || rawData.length || 0),
    total_pages: Number(pageSource.total_pages || 1),
  };
}

export async function listInstitutions(token: string) {
  const response = await apiRequest<unknown>(apiEndpoints.institutions.list, {
    token,
    searchParams: { page: 1, limit: 100, sort_by: "created_at", order: "desc" },
  });

  return normalizeResponse(response);
}

export async function createInstitution(token: string, payload: CreateInstitutionPayload) {
  const response = await apiRequest<unknown>(apiEndpoints.institutions.list, {
    method: "POST",
    token,
    body: {
      name: payload.name,
      email: payload.email,
      phone_number: payload.phoneNumber,
      address: serializeAddress(payload.address),
      url: payload.url || null,
    },
  });

  return normalizeInstitution(response);
}

export async function updateInstitution(token: string, institutionId: string, payload: UpdateInstitutionPayload) {
  const response = await apiRequest<unknown>(apiEndpoints.institutions.byId(institutionId), {
    method: "PATCH",
    token,
    body: {
      name: payload.name,
      email: payload.email,
      phone_number: payload.phoneNumber,
      address: serializeAddress(payload.address),
      url: payload.url || null,
    },
  });

  return normalizeInstitution(response);
}

export async function deleteInstitution(token: string, institutionId: string) {
  return apiRequest(apiEndpoints.institutions.byId(institutionId), {
    method: "DELETE",
    token,
  });
}

export function useInstitutions(token?: string) {
  return useQuery({
    queryKey: ["institutions", token],
    queryFn: () => listInstitutions(token as string),
    enabled: Boolean(token),
  });
}
