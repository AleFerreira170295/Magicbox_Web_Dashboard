import { useQuery } from "@tanstack/react-query";
import { apiEndpoints } from "@/lib/api/endpoints";
import { ApiError, apiRequest } from "@/lib/api/fetcher";
import type { JsonObject, PaginatedResponse } from "@/lib/api/types";
import type { SyncParticipant, SyncSessionRecord } from "@/features/syncs/types";

function asRecord(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonObject;
  return {};
}

function normalizeParticipant(input: unknown): SyncParticipant {
  const record = asRecord(input);
  return {
    id: (record.id as string | undefined) || null,
    profileId: (record.profile_id as string | undefined) || null,
    profileName: (record.profile_name as string | undefined) || null,
    playerName: (record.player_name as string | undefined) || null,
    cardUid: (record.card_uid as string | undefined) || null,
    position: typeof record.position === "number" ? record.position : Number(record.position || 0),
    studentId: (record.student_id as string | undefined) || null,
    externalPlayerUid: (record.external_player_uid as string | undefined) || null,
    raw: record,
  };
}

function normalizeLegacySession(input: unknown): SyncSessionRecord {
  const record = asRecord(input);
  return {
    id: String(record.id || ""),
    syncId: (record.sync_id as string | undefined) || null,
    source: (record.source as string | undefined) || null,
    sourceType: ((record.source_type || record.source) as string | undefined) || null,
    sessionType: (record.session_type as string | undefined) || null,
    status: (record.sync_status as string | undefined) || null,
    bleDeviceId: (record.ble_device_id as string | undefined) || null,
    deviceId: (record.device_id as string | undefined) || null,
    gameId: (record.game_id as string | number | undefined) || null,
    deckName: (record.deck_name as string | undefined) || null,
    totalCards: typeof record.total_cards === "number" ? record.total_cards : Number(record.total_cards || 0),
    totalPlayers: typeof record.total_players === "number" ? record.total_players : Number(record.total_players || 0),
    durationSeconds: typeof record.duration_seconds === "number" ? record.duration_seconds : Number(record.duration_seconds || 0),
    score: typeof record.score === "number" ? record.score : Number(record.score || 0),
    finalResult: (record.final_result as string | undefined) || null,
    gameEndReason: (record.game_end_reason as string | undefined) || null,
    startedAt: (record.started_at as string | undefined) || null,
    endedAt: (record.ended_at as string | undefined) || null,
    syncedAt: (record.synced_at as string | undefined) || null,
    capturedAt: (record.captured_at as string | undefined) || null,
    participants: Array.isArray(record.participants) ? record.participants.map(normalizeParticipant) : [],
    rawRecordIds: Array.isArray(record.raw_record_ids) ? record.raw_record_ids.map(String) : [],
    rawPayload: asRecord(record.raw_payload),
    fragmentCount: typeof record.fragment_count === "number" ? record.fragment_count : Number(record.fragment_count || 0),
    additionalFields: asRecord(record.session_metadata),
    raw: record,
  };
}

export async function listSyncSessions(token: string) {
  try {
    const response = await apiRequest<PaginatedResponse<unknown>>(apiEndpoints.syncs.list, {
      token,
      searchParams: { page: 1, limit: 50 },
    });
    return {
      ...response,
      data: response.data.map(normalizeLegacySession),
    } as PaginatedResponse<SyncSessionRecord>;
  } catch (error) {
    if (error instanceof ApiError && error.status !== 404) {
      throw error;
    }
    const legacyResponse = await apiRequest<PaginatedResponse<unknown>>(apiEndpoints.syncs.legacyList, {
      token,
      searchParams: { page: 1, limit: 50 },
    });
    return {
      ...legacyResponse,
      data: legacyResponse.data.map(normalizeLegacySession),
    } as PaginatedResponse<SyncSessionRecord>;
  }
}

export function useSyncSessions(token?: string) {
  return useQuery({
    queryKey: ["sync-sessions", token],
    queryFn: () => listSyncSessions(token as string),
    enabled: Boolean(token),
  });
}
