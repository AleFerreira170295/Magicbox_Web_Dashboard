import type { JsonObject } from "@/lib/api/types";

export interface UserAddress {
  addressFirstLine: string;
  addressSecondLine?: string | null;
  countryCode: string;
  city: string;
  state?: string | null;
  postalCode?: string | null;
}

export interface UserRecord {
  id: string;
  identityId?: string | null;
  email: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  roles: string[];
  permissions: string[];
  userType?: string | null;
  educationalCenterId?: string | null;
  status?: string | null;
  phoneNumber?: string | null;
  address?: UserAddress | null;
  imageUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
  lastLoginAt?: string | null;
  raw: JsonObject;
}

export interface UserMutationPayload {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  userType: "web" | "mobile" | "web|mobile";
  educationalCenterId?: string | null;
  imageUrl?: string | null;
  address?: UserAddress | null;
}

export interface CreateUserPayload extends UserMutationPayload {
  password: string;
}

export type UpdateUserPayload = UserMutationPayload;
