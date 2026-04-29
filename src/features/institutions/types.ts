import type { JsonObject } from "@/lib/api/types";

export interface InstitutionAddress {
  addressFirstLine: string;
  addressSecondLine?: string | null;
  countryCode: string;
  city: string;
  state?: string | null;
  postalCode?: string | null;
}

export interface InstitutionOperationalSummary {
  userCount: number;
  deviceCount: number;
  classGroupCount: number;
  studentCount: number;
  needsReview: boolean;
}

export interface InstitutionUserPreview {
  id: string;
  fullName: string;
  email: string;
  userType: string;
  roleCodes: string[];
  imageUrl?: string | null;
  updatedAt?: string | null;
}

export interface InstitutionDevicePreview {
  id: string;
  deviceId: string;
  name: string;
  updatedAt?: string | null;
}

export interface InstitutionClassGroupPreview {
  id: string;
  name: string;
  code: string;
  studentCount: number;
  updatedAt?: string | null;
}

export interface InstitutionOperationalPreview {
  users: InstitutionUserPreview[];
  devices: InstitutionDevicePreview[];
  classGroups: InstitutionClassGroupPreview[];
}

export interface InstitutionRecord {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  imageUrl?: string | null;
  address?: InstitutionAddress | null;
  url?: string | null;
  code?: string | null;
  status?: string | null;
  city?: string | null;
  country?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
  operationalSummary?: InstitutionOperationalSummary | null;
  operationalPreview?: InstitutionOperationalPreview | null;
  raw: JsonObject;
}

export interface InstitutionMutationPayload {
  name: string;
  email: string;
  phoneNumber: string;
  address: InstitutionAddress;
  imageUrl?: string | null;
  url?: string | null;
}

export type CreateInstitutionPayload = InstitutionMutationPayload;
export type UpdateInstitutionPayload = InstitutionMutationPayload;
