import { useQuery } from "@tanstack/react-query";
import { apiEndpoints } from "@/lib/api/endpoints";
import { apiRequest } from "@/lib/api/fetcher";
import type { JsonObject, PaginatedResponse } from "@/lib/api/types";
import type { DeviceRecord } from "@/features/devices/types";

function asRecord(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonObject;
  return {};
}

function normalizeDevice(input: unknown): DeviceRecord {
  const record = asRecord(input);
  return {
    id: String(record.id || ""),
    deviceId: String(record.device_id || record.deviceId || ""),
    name: String(record.name || "Sin nombre"),
    educationalCenterId: (record.educational_center_id as string | undefined) || null,
    educationalCenterName: (record.educational_center_name as string | undefined) || null,
    ownerUserId: (record.owner_user_id as string | undefined) || null,
    ownerUserName: (record.owner_user_name as string | undefined) || null,
    ownerUserEmail: (record.owner_user_email as string | undefined) || null,
    firmwareVersion: (record.firmware_version as string | undefined) || null,
    status: (record.status as string | undefined) || null,
    deviceMetadata: asRecord(record.device_metadata),
    createdAt: (record.created_at as string | undefined) || null,
    updatedAt: (record.updated_at as string | undefined) || null,
    deletedAt: (record.deleted_at as string | undefined) || null,
    raw: record,
  };
}

export async function listDevices(token: string) {
  const response = await apiRequest<PaginatedResponse<unknown>>(apiEndpoints.devices.list, {
    token,
    searchParams: { page: 1, limit: 50, sort_by: "updated_at", order: "desc" },
  });
  return {
    ...response,
    data: response.data.map(normalizeDevice),
  } as PaginatedResponse<DeviceRecord>;
}

export function useDevices(token?: string) {
  return useQuery({
    queryKey: ["devices", token],
    queryFn: () => listDevices(token as string),
    enabled: Boolean(token),
  });
}
