import type { JsonObject } from "@/lib/api/types";

export type AppRole = "teacher" | "director" | "family" | "researcher" | "admin" | "institution-admin" | "government-viewer";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  identityId?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  imageUrl?: string | null;
  userType?: string | null;
  educationalCenterId?: string | null;
  roles: AppRole[];
  permissions: string[];
  raw: JsonObject;
}

export interface LoginPayload {
  email: string;
  password: string;
}
