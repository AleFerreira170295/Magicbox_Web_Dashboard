import type { JsonObject } from "@/lib/api/types";

export interface InstitutionAddress {
  addressFirstLine: string;
  addressSecondLine?: string | null;
  countryCode: string;
  city: string;
  state?: string | null;
  postalCode?: string | null;
}

export interface InstitutionRecord {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
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
  raw: JsonObject;
}

export interface InstitutionMutationPayload {
  name: string;
  email: string;
  phoneNumber: string;
  address: InstitutionAddress;
  url?: string | null;
}

export type CreateInstitutionPayload = InstitutionMutationPayload;
export type UpdateInstitutionPayload = InstitutionMutationPayload;
