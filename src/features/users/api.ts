import { useQuery } from "@tanstack/react-query";
import { apiEndpoints } from "@/lib/api/endpoints";
import { apiRequest } from "@/lib/api/fetcher";
import type { JsonObject, PaginatedResponse } from "@/lib/api/types";
import { resolvePermissions, resolveRoles } from "@/features/auth/role-resolver";
import type {
  CreateUserPayload,
  UpdateUserPayload,
  UserAddress,
  UserRecord,
} from "@/features/users/types";

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

function normalizeAddress(value: unknown): UserAddress | null {
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

function normalizeUser(input: unknown): UserRecord {
  const record = asRecord(input);
  const firstName = readString(record, "first_name", "firstName");
  const lastName = readString(record, "last_name", "lastName");
  const fullName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    readString(record, "full_name", "fullName", "name", "display_name") ||
    "Sin nombre";
  const email = readString(record, "email") || "sin-email";
  const deletedAt = readString(record, "deleted_at", "deletedAt") || null;

  return {
    id: readString(record, "id", "user_id") || `${email}:${fullName}`,
    identityId: readString(record, "identity_id", "identityId") || null,
    email,
    fullName,
    firstName: firstName || null,
    lastName: lastName || null,
    roles: resolveRoles(record),
    permissions: resolvePermissions(record),
    userType: readString(record, "user_type", "userType") || null,
    educationalCenterId: readString(record, "educational_center_id", "educationalCenterId") || null,
    status: deletedAt ? "deleted" : "active",
    phoneNumber: readString(record, "phone_number", "phoneNumber") || null,
    address: normalizeAddress(record.address),
    imageUrl: readString(record, "image_url", "imageUrl") || null,
    createdAt: readString(record, "created_at", "createdAt") || null,
    updatedAt: readString(record, "updated_at", "updatedAt") || null,
    deletedAt,
    lastLoginAt: readString(record, "last_login_at", "lastLoginAt") || null,
    raw: record,
  };
}

function normalizeResponse(response: unknown): PaginatedResponse<UserRecord> {
  if (Array.isArray(response)) {
    return {
      data: response.map(normalizeUser),
      page: 1,
      limit: response.length,
      total: response.length,
      total_pages: 1,
    };
  }

  const record = asRecord(response);
  const rawData = Array.isArray(record.data) ? record.data : [];
  return {
    data: rawData.map(normalizeUser),
    page: Number(record.page || 1),
    limit: Number(record.limit || rawData.length || 0),
    total: Number(record.total || rawData.length || 0),
    total_pages: Number(record.total_pages || 1),
  };
}

function serializeAddress(address?: UserAddress | null) {
  if (!address) return null;
  return {
    address_first_line: address.addressFirstLine,
    address_second_line: address.addressSecondLine || null,
    country_code: address.countryCode,
    city: address.city,
    state: address.state || null,
    postal_code: address.postalCode || null,
  };
}

export async function listUsers(token: string) {
  const response = await apiRequest<unknown>(apiEndpoints.users.list, {
    token,
    searchParams: { page: 1, limit: 100, sort_by: "created_at", order: "desc" },
  });

  return normalizeResponse(response);
}

export async function createUser(token: string, payload: CreateUserPayload) {
  const response = await apiRequest<unknown>(apiEndpoints.users.list, {
    method: "POST",
    token,
    body: {
      first_name: payload.firstName,
      last_name: payload.lastName,
      email: payload.email,
      password: payload.password,
      phone_number: payload.phoneNumber,
      user_type: payload.userType,
      educational_center_id: payload.educationalCenterId || null,
      image_url: payload.imageUrl || null,
      address: serializeAddress(payload.address),
    },
  });

  return normalizeUser(response);
}

export async function updateUser(token: string, userId: string, payload: UpdateUserPayload) {
  const response = await apiRequest<unknown>(apiEndpoints.users.byId(userId), {
    method: "PATCH",
    token,
    body: {
      first_name: payload.firstName,
      last_name: payload.lastName,
      email: payload.email,
      phone_number: payload.phoneNumber,
      user_type: payload.userType,
      educational_center_id: payload.educationalCenterId || null,
      image_url: payload.imageUrl || null,
      address: serializeAddress(payload.address),
    },
  });

  return normalizeUser(response);
}

export async function deleteUser(token: string, userId: string) {
  return apiRequest(apiEndpoints.users.byId(userId), {
    method: "DELETE",
    token,
  });
}

export function useUsers(token?: string) {
  return useQuery({
    queryKey: ["users", token],
    queryFn: () => listUsers(token as string),
    enabled: Boolean(token),
  });
}
