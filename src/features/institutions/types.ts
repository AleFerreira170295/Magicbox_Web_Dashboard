import type { JsonObject } from "@/lib/api/types";

export interface InstitutionRecord {
  id: string;
  name: string;
  code?: string | null;
  status?: string | null;
  city?: string | null;
  country?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  raw: JsonObject;
}
