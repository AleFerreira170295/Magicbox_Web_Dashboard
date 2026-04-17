import { useQuery } from "@tanstack/react-query";
import { apiEndpoints } from "@/lib/api/endpoints";
import { ApiError, apiRequest } from "@/lib/api/fetcher";
import type { JsonObject } from "@/lib/api/types";
import type { OtaReleaseRecord } from "@/features/settings/types";

function asRecord(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonObject;
  return {};
}

function normalizeOtaRelease(input: unknown): OtaReleaseRecord {
  const record = asRecord(input);
  return {
    channel: (record.channel as string | undefined) || null,
    configured: Boolean(record.configured),
    currentVersion: (record.current_version as string | undefined) || null,
    latestVersion: (record.latest_version as string | undefined) || null,
    minimumSupportedVersion: (record.minimum_supported_version as string | undefined) || null,
    updateAvailable: Boolean(record.update_available),
    mandatory: Boolean(record.mandatory),
    downloadUrl: (record.download_url as string | undefined) || null,
    sha256: (record.sha256 as string | undefined) || null,
    sizeBytes: typeof record.size_bytes === "number" ? record.size_bytes : record.size_bytes == null ? null : Number(record.size_bytes),
    minAppVersion: (record.min_app_version as string | undefined) || null,
    notes: (record.notes as string | undefined) || null,
    raw: record,
  };
}

export async function getOtaRelease(token: string) {
  try {
    const response = await apiRequest<unknown>(apiEndpoints.settings.otaRelease, { token });
    return normalizeOtaRelease(response);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      const legacyResponse = await apiRequest<unknown>(apiEndpoints.settings.otaReleaseLegacy, { token });
      return normalizeOtaRelease(legacyResponse);
    }
    throw error;
  }
}

export function useOtaRelease(token?: string) {
  return useQuery({
    queryKey: ["settings", "ota-release", token],
    queryFn: () => getOtaRelease(token as string),
    enabled: Boolean(token),
  });
}
