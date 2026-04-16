import type { JsonObject } from "@/lib/api/types";

export interface UserRecord {
  id: string;
  email: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  roles: string[];
  permissions: string[];
  userType?: string | null;
  educationalCenterId?: string | null;
  status?: string | null;
  createdAt?: string | null;
  lastLoginAt?: string | null;
  raw: JsonObject;
}
