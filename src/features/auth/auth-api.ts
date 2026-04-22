import { apiEndpoints } from "@/lib/api/endpoints";
import { apiRequest, ApiError } from "@/lib/api/fetcher";
import type { JsonObject } from "@/lib/api/types";
import { resolvePermissions, resolveRoles } from "@/features/auth/role-resolver";
import type { AuthTokens, AuthUser, LoginPayload } from "@/features/auth/types";

function asRecord(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
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

export function normalizeAuthUser(input: unknown): AuthUser {
  const record = asRecord(input);
  const firstName = readString(record, "first_name", "firstName");
  const lastName = readString(record, "last_name", "lastName");
  const fullName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    readString(record, "name", "display_name");

  return {
    id: readString(record, "user_id", "id"),
    identityId: readString(record, "identity_id") || null,
    email: readString(record, "email"),
    firstName,
    lastName,
    fullName,
    imageUrl: readString(record, "image_url", "imageUrl") || null,
    userType: readString(record, "user_type", "userType") || null,
    educationalCenterId:
      readString(record, "educational_center_id", "educationalCenterId") || null,
    roles: resolveRoles(record),
    permissions: resolvePermissions(record),
    raw: record,
  };
}

async function fetchMe(accessToken: string) {
  const payload = await apiRequest<{ identity?: unknown; user?: unknown }>(
    apiEndpoints.identity.me,
    { token: accessToken },
  );
  return payload?.user ? normalizeAuthUser(payload.user) : null;
}

export async function login(payload: LoginPayload) {
  const response = await apiRequest<{
    access_token: string;
    refresh_token: string;
    user?: unknown;
  }>(apiEndpoints.identity.login, {
    method: "POST",
    body: payload,
  });

  const tokens: AuthTokens = {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
  };

  let user = response.user ? normalizeAuthUser(response.user) : null;
  try {
    const profile = await fetchMe(tokens.accessToken);
    if (profile) user = profile;
  } catch {
    // noop, dejamos el payload del login si /identity/me falla.
  }

  if (!user) {
    throw new ApiError("No se pudo resolver el perfil autenticado", 500);
  }

  return { tokens, user };
}

export async function register(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phoneNumber: string;
}) {
  await apiRequest(apiEndpoints.identity.register, {
    method: "POST",
    body: {
      first_name: payload.firstName,
      last_name: payload.lastName,
      email: payload.email,
      password: payload.password,
      confirm_password: payload.confirmPassword,
      phone_number: payload.phoneNumber,
    },
  });
}

export async function forgotPassword(email: string) {
  await apiRequest(apiEndpoints.identity.forgotPassword, {
    method: "POST",
    body: { email },
  });
}

export async function verifyOtpCode(email: string, otpCode: string) {
  await apiRequest(apiEndpoints.identity.verifyOtp, {
    method: "POST",
    body: { email, otp_code: otpCode },
  });
}

export async function resetPassword(payload: {
  email: string;
  newPassword: string;
  confirmPassword: string;
}) {
  await apiRequest(apiEndpoints.identity.resetPassword, {
    method: "POST",
    body: {
      email: payload.email,
      new_password: payload.newPassword,
      confirm_password: payload.confirmPassword,
    },
  });
}

export async function refreshAuthTokens(refreshToken: string) {
  const raw = await apiRequest<Record<string, unknown>>(apiEndpoints.identity.refresh, {
    method: "POST",
    body: { refresh_token: refreshToken },
  });

  const data = (raw?.data && typeof raw.data === "object") ? (raw.data as Record<string, unknown>) : raw;
  return {
    accessToken: String(data.access_token || data.accessToken || ""),
    refreshToken: String(data.refresh_token || data.refreshToken || ""),
  } as AuthTokens;
}

export async function logout(refreshToken: string) {
  await apiRequest(apiEndpoints.identity.logout, {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
}

export async function getMe(accessToken: string) {
  return fetchMe(accessToken);
}
