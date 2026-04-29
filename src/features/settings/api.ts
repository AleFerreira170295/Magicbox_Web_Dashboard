import { useQuery } from "@tanstack/react-query";
import { apiEndpoints } from "@/lib/api/endpoints";
import { ApiError, apiRequest } from "@/lib/api/fetcher";
import type { JsonObject } from "@/lib/api/types";
import type { CreateOtaReleasePayload, OtaReleaseListResponse, OtaReleaseRecord } from "@/features/settings/types";

function asRecord(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonObject;
  return {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : value == null ? null : String(value);
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : value == null ? null : Number(value);
}

function normalizeOtaRelease(input: unknown): OtaReleaseRecord {
  const record = asRecord(input);
  return {
    id: asString(record.id),
    channel: asString(record.channel),
    configured: Boolean(record.configured),
    currentVersion: asString(record.current_version),
    latestVersion: asString(record.latest_version),
    minimumSupportedVersion: asString(record.minimum_supported_version),
    updateAvailable: Boolean(record.update_available),
    mandatory: Boolean(record.mandatory),
    downloadUrl: asString(record.download_url),
    sha256: asString(record.sha256),
    sizeBytes: asNumber(record.size_bytes),
    minAppVersion: asString(record.min_app_version),
    notes: asString(record.notes),
    isActive: Boolean(record.is_active),
    publishedAt: asString(record.published_at),
    createdAt: asString(record.created_at),
    updatedAt: asString(record.updated_at),
    deletedAt: asString(record.deleted_at),
    storagePath: asString(record.storage_path),
    filename: asString(record.filename),
    originalFilename: asString(record.original_filename),
    fileContentType: asString(record.file_content_type),
    sourceType: asString(record.source_type),
    createdByUserId: asString(record.created_by_user_id),
    raw: record,
  };
}

function normalizeOtaReleaseList(input: unknown): OtaReleaseListResponse {
  const record = asRecord(input);
  const data = Array.isArray(record.data) ? record.data.map(normalizeOtaRelease) : [];
  return {
    data,
    total: typeof record.total === "number" ? record.total : data.length,
    page: typeof record.page === "number" ? record.page : 1,
    limit: typeof record.limit === "number" ? record.limit : data.length || 1,
    totalPages: typeof record.total_pages === "number" ? record.total_pages : 1,
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

export async function getOtaReleases(token: string) {
  const response = await apiRequest<unknown>(apiEndpoints.settings.otaReleases, { token });
  return normalizeOtaReleaseList(response);
}

export async function createOtaRelease(token: string, payload: CreateOtaReleasePayload) {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("version", payload.version);
  if (payload.channel) formData.append("channel", payload.channel);
  if (payload.minimumSupportedVersion) formData.append("minimum_supported_version", payload.minimumSupportedVersion);
  if (payload.minAppVersion) formData.append("min_app_version", payload.minAppVersion);
  if (payload.notes) formData.append("notes", payload.notes);
  formData.append("mandatory", payload.mandatory ? "true" : "false");
  formData.append("activate", payload.activate === false ? "false" : "true");

  const response = await apiRequest<unknown>(apiEndpoints.settings.otaReleases, {
    method: "POST",
    token,
    body: formData,
  });
  return normalizeOtaRelease(response);
}

export async function activateOtaRelease(token: string, releaseId: string) {
  const response = await apiRequest<unknown>(apiEndpoints.settings.otaReleaseActivate(releaseId), {
    method: "PATCH",
    token,
  });
  return normalizeOtaRelease(response);
}

export function useOtaRelease(token?: string) {
  return useQuery({
    queryKey: ["settings", "ota-release", token],
    queryFn: () => getOtaRelease(token as string),
    enabled: Boolean(token),
  });
}

export function useOtaReleases(token?: string) {
  return useQuery({
    queryKey: ["settings", "ota-releases", token],
    queryFn: () => getOtaReleases(token as string),
    enabled: Boolean(token),
  });
}
