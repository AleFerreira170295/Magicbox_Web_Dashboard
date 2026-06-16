import { apiEndpoints } from "@/lib/api/endpoints";
import { apiRequest, normalizeImageUrl } from "@/lib/api/fetcher";
import type { JsonObject } from "@/lib/api/types";
import type { AuthUser } from "@/features/auth/types";
import type { UserAddress } from "@/features/users/types";

export type AccountProfile = {
  id: string;
  identityId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  imageUrl: string | null;
  userType: string | null;
  educationalCenterId: string | null;
  roles: string[];
  address: UserAddress | null;
  raw: JsonObject;
};

export type UpdateAccountProfilePayload = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  imageUrl?: string | null;
  address?: UserAddress | null;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

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

export function normalizeAccountProfile(input: unknown): AccountProfile {
  const record = asRecord(input);
  return {
    id: readString(record, "id", "user_id"),
    identityId: readString(record, "identity_id", "identityId") || null,
    firstName: readString(record, "first_name", "firstName"),
    lastName: readString(record, "last_name", "lastName"),
    email: readString(record, "email"),
    phoneNumber: readString(record, "phone_number", "phoneNumber"),
    imageUrl: normalizeImageUrl(readString(record, "image_url", "imageUrl")),
    userType: readString(record, "user_type", "userType") || null,
    educationalCenterId: readString(record, "educational_center_id", "educationalCenterId") || null,
    roles: Array.isArray(record.roles) ? record.roles.filter((item): item is string => typeof item === "string") : [],
    address: normalizeAddress(record.address),
    raw: record,
  };
}

export function accountProfileFromAuthUser(user: AuthUser): AccountProfile {
  return {
    id: user.id,
    identityId: user.identityId || null,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: user.email || "",
    phoneNumber: readString(user.raw, "phone_number", "phoneNumber"),
    imageUrl: normalizeImageUrl(user.imageUrl || readString(user.raw, "image_url", "imageUrl")),
    userType: user.userType || null,
    educationalCenterId: user.educationalCenterId || null,
    roles: user.roles,
    address: normalizeAddress(user.raw.address),
    raw: user.raw,
  };
}

export async function getAccountProfile(token: string) {
  const response = await apiRequest<unknown>(apiEndpoints.users.me, { token });
  return normalizeAccountProfile(response);
}

export async function updateAccountProfile(token: string, payload: UpdateAccountProfilePayload) {
  const response = await apiRequest<unknown>(apiEndpoints.users.me, {
    method: "PATCH",
    token,
    body: {
      first_name: payload.firstName,
      last_name: payload.lastName,
      email: payload.email,
      phone_number: payload.phoneNumber,
      image_url: payload.imageUrl || null,
      address: serializeAddress(payload.address),
    },
  });
  return normalizeAccountProfile(response);
}

export async function uploadAccountAvatar(token: string, file: File, filename?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (filename?.trim()) formData.append("filename", filename.trim());

  const response = await apiRequest<{ image_url: string }>(apiEndpoints.users.meAvatar, {
    method: "POST",
    token,
    body: formData,
  });

  return normalizeImageUrl(response.image_url);
}

export async function changeAccountPassword(token: string, payload: ChangePasswordPayload) {
  return apiRequest(apiEndpoints.identity.changeMyPassword, {
    method: "PATCH",
    token,
    body: {
      current_password: payload.currentPassword,
      new_password: payload.newPassword,
      confirm_password: payload.confirmPassword,
    },
  });
}
