import type { JsonObject } from "@/lib/api/types";

export interface AccessActionRecord {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  raw: JsonObject;
}

export interface AccessFeatureRecord {
  id: string;
  name: string;
  code: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  raw: JsonObject;
}

export interface PermissionRecord {
  id: string;
  userId: string;
  featureId: string;
  actionId: string;
  educationalCenterId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
  raw: JsonObject;
}

export interface CreatePermissionPayload {
  userId: string;
  featureId: string;
  actionId: string;
  educationalCenterId?: string | null;
}
