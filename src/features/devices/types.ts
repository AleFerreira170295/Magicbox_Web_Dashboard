import type { JsonObject } from "@/lib/api/types";

export interface DeviceRecord {
  id: string;
  deviceId: string;
  name: string;
  educationalCenterId?: string | null;
  ownerUserId?: string | null;
  firmwareVersion?: string | null;
  status?: string | null;
  deviceMetadata: JsonObject;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
  raw: JsonObject;
}
