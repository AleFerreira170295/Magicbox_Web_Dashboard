import type { JsonObject } from "@/lib/api/types";

export interface OtaReleaseRecord {
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
  raw: JsonObject;
}
