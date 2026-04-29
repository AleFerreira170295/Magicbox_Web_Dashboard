import type { JsonObject } from "@/lib/api/types";

export interface OtaReleaseRecord {
  id?: string | null;
  channel?: string | null;
  configured: boolean;
  currentVersion?: string | null;
  latestVersion?: string | null;
  minimumSupportedVersion?: string | null;
  updateAvailable: boolean;
  mandatory: boolean;
  downloadUrl?: string | null;
  sha256?: string | null;
  sizeBytes?: number | null;
  minAppVersion?: string | null;
  notes?: string | null;
  isActive?: boolean;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
  storagePath?: string | null;
  filename?: string | null;
  originalFilename?: string | null;
  fileContentType?: string | null;
  sourceType?: string | null;
  createdByUserId?: string | null;
  raw: JsonObject;
}

export interface OtaReleaseListResponse {
  data: OtaReleaseRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateOtaReleasePayload {
  file: File;
  version: string;
  channel?: string;
  minimumSupportedVersion?: string;
  minAppVersion?: string;
  notes?: string;
  mandatory?: boolean;
  activate?: boolean;
}
