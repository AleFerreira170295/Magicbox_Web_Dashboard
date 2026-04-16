import { useQuery } from "@tanstack/react-query";
import { apiEndpoints } from "@/lib/api/endpoints";
import { apiRequest } from "@/lib/api/fetcher";
import type { JsonObject } from "@/lib/api/types";
import type { ProfileOverviewRecord } from "@/features/profiles/types";

function asRecord(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonObject;
  return {};
}

function normalizeProfile(input: unknown): ProfileOverviewRecord {
  const record = asRecord(input);
  const boundDevices = Array.isArray(record.bound_devices)
    ? record.bound_devices.map((device) => {
        const deviceRecord = asRecord(device);
        return {
          id: String(deviceRecord.id || ""),
          deviceId: (deviceRecord.device_id as string | undefined) || null,
          name: (deviceRecord.name as string | undefined) || null,
        };
      })
    : [];

  return {
    id: String(record.id || ""),
    displayName: String(record.display_name || ""),
    avatarUrl: (record.avatar_url as string | undefined) || null,
    age: typeof record.age === "number" ? record.age : record.age == null ? null : Number(record.age),
    ageCategory: (record.age_category as string | undefined) || null,
    isActive: Boolean(record.is_active),
    userId: String(record.user_id || ""),
    userName: (record.user_name as string | undefined) || null,
    userEmail: (record.user_email as string | undefined) || null,
    educationalCenterId: (record.educational_center_id as string | undefined) || null,
    educationalCenterName: (record.educational_center_name as string | undefined) || null,
    bindingCount: typeof record.binding_count === "number" ? record.binding_count : Number(record.binding_count || 0),
    activeBindingCount: typeof record.active_binding_count === "number" ? record.active_binding_count : Number(record.active_binding_count || 0),
    cardUids: Array.isArray(record.card_uids) ? record.card_uids.map(String) : [],
    boundDevices,
    sessionCount: typeof record.session_count === "number" ? record.session_count : Number(record.session_count || 0),
    lastSessionAt: (record.last_session_at as string | undefined) || null,
    createdAt: (record.created_at as string | undefined) || null,
    updatedAt: (record.updated_at as string | undefined) || null,
    deletedAt: (record.deleted_at as string | undefined) || null,
    raw: record,
  };
}

export async function listProfilesOverview(token: string) {
  const response = await apiRequest<unknown[]>(apiEndpoints.profiles.overview, { token });
  return response.map(normalizeProfile);
}

export function useProfilesOverview(token?: string) {
  return useQuery({
    queryKey: ["profiles-overview", token],
    queryFn: () => listProfilesOverview(token as string),
    enabled: Boolean(token),
  });
}
