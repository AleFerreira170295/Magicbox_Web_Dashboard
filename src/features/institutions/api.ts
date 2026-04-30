import { useQuery } from "@tanstack/react-query";
import { apiEndpoints } from "@/lib/api/endpoints";
import { apiRequest, normalizeImageUrl } from "@/lib/api/fetcher";
import type { JsonObject, PaginatedResponse } from "@/lib/api/types";
import type {
  CreateInstitutionPayload,
  InstitutionAddress,
  InstitutionOperationalPreview,
  InstitutionOperationalSummary,
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

function normalizeOperationalPreview(value: unknown): InstitutionOperationalPreview | null {
  const record = asRecord(value);
  const users = Array.isArray(record.users)
    ? record.users.map((entry) => {
        const user = asRecord(entry);
        return {
          id: readString(user, "id") || "sin-id",
          fullName: readString(user, "full_name", "fullName") || "Sin nombre",
          email: readString(user, "email") || "sin-email",
          userType: readString(user, "user_type", "userType") || "-",
          roleCodes: Array.isArray(user.role_codes)
            ? user.role_codes.filter((value): value is string => typeof value === "string")
            : Array.isArray(user.roleCodes)
              ? user.roleCodes.filter((value): value is string => typeof value === "string")
              : [],
          imageUrl: normalizeImageUrl(readString(user, "image_url", "imageUrl")),
          updatedAt: readString(user, "updated_at", "updatedAt") || null,
        };
      })
    : [];
  const devices = Array.isArray(record.devices)
    ? record.devices.map((entry) => {
        const device = asRecord(entry);
        return {
          id: readString(device, "id") || "sin-id",
          deviceId: readString(device, "device_id", "deviceId") || "sin-device-id",
          name: readString(device, "name") || "Sin nombre",
          updatedAt: readString(device, "updated_at", "updatedAt") || null,
        };
      })
    : [];
  const rawClassGroups = Array.isArray(record.class_groups)
    ? record.class_groups
    : Array.isArray(record.classGroups)
      ? record.classGroups
      : [];
  const classGroups = rawClassGroups.map((entry) => {
    const classGroup = asRecord(entry);
    return {
      id: readString(classGroup, "id") || "sin-id",
      name: readString(classGroup, "name") || "Sin nombre",
      code: readString(classGroup, "code") || "sin-codigo",
      studentCount: Number(classGroup.student_count ?? classGroup.studentCount ?? 0),
      updatedAt: readString(classGroup, "updated_at", "updatedAt") || null,
    };
  });

  if (users.length === 0 && devices.length === 0 && classGroups.length === 0) return null;

  return { users, devices, classGroups };
}

function normalizeOperationalSummary(value: unknown): InstitutionOperationalSummary | null {
  const record = asRecord(value);
  const entries = Object.keys(record);
  if (entries.length === 0) return null;

  return {
    userCount: Number(record.user_count ?? record.userCount ?? 0),
    deviceCount: Number(record.device_count ?? record.deviceCount ?? 0),
    classGroupCount: Number(record.class_group_count ?? record.classGroupCount ?? 0),
    studentCount: Number(record.student_count ?? record.studentCount ?? 0),
    needsReview: Boolean(record.needs_review ?? record.needsReview ?? false),
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
  const operationalSummary =
    normalizeOperationalSummary(record.operational_summary) ||
    normalizeOperationalSummary(record.operationalSummary) ||
    normalizeOperationalSummary(record.summary) ||
    normalizeOperationalSummary(record.stats);
  const operationalPreview =
    normalizeOperationalPreview(record.operational_preview) ||
    normalizeOperationalPreview(record.operationalPreview);

  return {
    id: readString(record, "id", "institution_id", "educational_center_id") || name,
    name,
    email,
    phoneNumber: readString(record, "phone_number", "phoneNumber", "phone") || "",
    imageUrl: normalizeImageUrl(readString(record, "image_url", "imageUrl")),
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
    operationalSummary,
    operationalPreview,
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
      image_url: payload.imageUrl || null,
      url: payload.url || null,
    },
  });

  return normalizeInstitution(response);
}

export async function getInstitutionById(token: string, institutionId: string) {
  const response = await apiRequest<unknown>(apiEndpoints.institutions.byId(institutionId), {
    token,
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
      image_url: payload.imageUrl || null,
      url: payload.url || null,
    },
  });

  return normalizeInstitution(response);
}

export type UploadInstitutionImageResponse = {
  educationalCenterId: string;
  imageUrl: string;
  imagePath: string;
  filename: string;
  folder: string;
};

export async function uploadInstitutionImage(token: string, institutionId: string, file: File, filename?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (filename) formData.append("filename", filename);

  const response = await apiRequest<unknown>(apiEndpoints.institutions.imageById(institutionId), {
    method: "POST",
    token,
    body: formData,
  });

  const record = asRecord(response);

  return {
    educationalCenterId: readString(record, "educational_center_id", "educationalCenterId") || institutionId,
    imageUrl: readString(record, "image_url", "imageUrl"),
    imagePath: readString(record, "image_path", "imagePath"),
    filename: readString(record, "filename"),
    folder: readString(record, "folder"),
  } satisfies UploadInstitutionImageResponse;
}

export async function deleteInstitution(token: string, institutionId: string) {
  return apiRequest(apiEndpoints.institutions.byId(institutionId), {
    method: "DELETE",
    token,
  });
}

export function useInstitutionById(token?: string, institutionId?: string | null) {
  return useQuery({
    queryKey: ["institutions", "detail", token, institutionId],
    queryFn: () => getInstitutionById(token as string, institutionId as string),
    enabled: Boolean(token && institutionId),
  });
}

export function useInstitutions(token?: string) {
  return useQuery({
    queryKey: ["institutions", token],
    queryFn: () => listInstitutions(token as string),
    enabled: Boolean(token),
  });
}
