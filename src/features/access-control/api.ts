import { useQuery } from "@tanstack/react-query";
import { apiEndpoints } from "@/lib/api/endpoints";
import { apiRequest } from "@/lib/api/fetcher";
import type { JsonObject, PaginatedResponse } from "@/lib/api/types";
import type {
  AccessActionRecord,
  AccessFeatureRecord,
  AccessAuditEventRecord,
  CreatePermissionPayload,
  PermissionRecord,
} from "@/features/access-control/types";

function asRecord(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonObject;
  return {};
}

function readString(record: JsonObject, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return "";
}

function normalizePaginatedResponse<T>(
  response: unknown,
  normalizeItem: (value: unknown) => T,
): PaginatedResponse<T> {
  if (Array.isArray(response)) {
    return {
      data: response.map(normalizeItem),
      page: 1,
      limit: response.length,
      total: response.length,
      total_pages: 1,
    };
  }

  const record = asRecord(response);
  const rawData = Array.isArray(record.data) ? record.data : [];
  return {
    data: rawData.map(normalizeItem),
    page: Number(record.page || 1),
    limit: Number(record.limit || rawData.length || 0),
    total: Number(record.total || rawData.length || 0),
    total_pages: Number(record.total_pages || 1),
  };
}

function normalizeAction(input: unknown): AccessActionRecord {
  const record = asRecord(input);
  return {
    id: readString(record, "id"),
    name: readString(record, "name") || "Sin nombre",
    code: readString(record, "code") || "sin-code",
    description: readString(record, "description") || null,
    createdAt: readString(record, "created_at", "createdAt") || null,
    updatedAt: readString(record, "updated_at", "updatedAt") || null,
    raw: record,
  };
}

function normalizeFeature(input: unknown): AccessFeatureRecord {
  const record = asRecord(input);
  return {
    id: readString(record, "id"),
    name: readString(record, "name") || "Sin nombre",
    code: readString(record, "code") || "sin-code",
    createdAt: readString(record, "created_at", "createdAt") || null,
    updatedAt: readString(record, "updated_at", "updatedAt") || null,
    raw: record,
  };
}

function normalizePermission(input: unknown): PermissionRecord {
  const record = asRecord(input);
  return {
    id: readString(record, "id"),
    userId: readString(record, "user_id", "userId"),
    featureId: readString(record, "feature_id", "featureId"),
    actionId: readString(record, "action_id", "actionId"),
    educationalCenterId: readString(record, "educational_center_id", "educationalCenterId") || null,
    createdAt: readString(record, "created_at", "createdAt") || null,
    updatedAt: readString(record, "updated_at", "updatedAt") || null,
    deletedAt: readString(record, "deleted_at", "deletedAt") || null,
    raw: record,
  };
}

function normalizeAuditEvent(input: unknown): AccessAuditEventRecord {
  const record = asRecord(input);
  return {
    id: readString(record, "id"),
    targetUserId: readString(record, "target_user_id", "targetUserId"),
    actorUserId: readString(record, "actor_user_id", "actorUserId") || null,
    entityType: readString(record, "entity_type", "entityType") || "unknown",
    entityId: readString(record, "entity_id", "entityId") || null,
    eventType: readString(record, "event_type", "eventType") || "unknown",
    educationalCenterId: readString(record, "educational_center_id", "educationalCenterId") || null,
    payload: (record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
      ? (record.payload as Record<string, unknown>)
      : record.payload_json && typeof record.payload_json === "object" && !Array.isArray(record.payload_json)
        ? (record.payload_json as Record<string, unknown>)
        : {}),
    createdAt: readString(record, "created_at", "createdAt") || null,
    raw: record,
  };
}

export async function listAccessActions(token: string) {
  const response = await apiRequest<unknown>(apiEndpoints.accessControl.actions, {
    token,
    searchParams: { page: 1, limit: 100, sort_by: "code", order: "asc" },
  });

  return normalizePaginatedResponse(response, normalizeAction);
}

export async function listAccessFeatures(token: string) {
  const response = await apiRequest<unknown>(apiEndpoints.features.list, {
    token,
    searchParams: { page: 1, limit: 100, sort_by: "code", order: "asc" },
  });

  return normalizePaginatedResponse(response, normalizeFeature);
}

export async function listPermissions(token: string) {
  const response = await apiRequest<unknown>(apiEndpoints.accessControl.permissions, {
    token,
    searchParams: { page: 1, limit: 1000, sort_by: "created_at", order: "desc" },
  });

  return normalizePaginatedResponse(response, normalizePermission);
}

export async function createPermission(token: string, payload: CreatePermissionPayload) {
  const response = await apiRequest<unknown>(apiEndpoints.accessControl.permissions, {
    method: "POST",
    token,
    body: {
      user_id: payload.userId,
      feature_id: payload.featureId,
      action_id: payload.actionId,
      educational_center_id: payload.educationalCenterId || null,
    },
  });

  return normalizePermission(response);
}

export async function deletePermission(token: string, permissionId: string) {
  return apiRequest(apiEndpoints.accessControl.permissionById(permissionId), {
    method: "DELETE",
    token,
  });
}

export async function listAccessAuditEvents(token: string, userId: string, limit = 25) {
  const response = await apiRequest<unknown>(apiEndpoints.accessControl.auditEvents, {
    token,
    searchParams: { user_id: userId, limit },
  });

  return Array.isArray(response) ? response.map(normalizeAuditEvent) : [];
}

export function useAccessActions(token?: string) {
  return useQuery({
    queryKey: ["access-actions", token],
    queryFn: () => listAccessActions(token as string),
    enabled: Boolean(token),
  });
}

export function useAccessFeatures(token?: string) {
  return useQuery({
    queryKey: ["access-features", token],
    queryFn: () => listAccessFeatures(token as string),
    enabled: Boolean(token),
  });
}

export function usePermissions(token?: string) {
  return useQuery({
    queryKey: ["access-permissions", token],
    queryFn: () => listPermissions(token as string),
    enabled: Boolean(token),
  });
}

export function useAccessAuditEvents(token?: string, userId?: string, limit = 25) {
  return useQuery({
    queryKey: ["access-audit-events", token, userId, limit],
    queryFn: () => listAccessAuditEvents(token as string, userId as string, limit),
    enabled: Boolean(token && userId),
  });
}
