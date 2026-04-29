import { useQuery } from "@tanstack/react-query";
import { apiEndpoints } from "@/lib/api/endpoints";
import { apiRequest } from "@/lib/api/fetcher";
import type { JsonObject, PaginatedResponse } from "@/lib/api/types";
import type { GamePlayerRecord, GameRecord, GameTurnRecord } from "@/features/games/types";

export interface ListGamesParams {
  institutionId?: string | null;
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: "asc" | "desc";
}

function asRecord(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonObject;
  return {};
}

function normalizePlayer(input: unknown): GamePlayerRecord {
  const record = asRecord(input);
  return {
    id: String(record.id || ""),
    gameDataId: String(record.game_data_id || ""),
    studentId: (record.student_id as string | undefined) || null,
    externalPlayerUid: (record.external_player_uid as string | undefined) || null,
    playerName: (record.player_name as string | undefined) || null,
    playerSource: (record.player_source as string | undefined) || null,
    position: Number(record.position || 0),
    cardColor: (record.card_color as string | undefined) || null,
    createdAt: (record.created_at as string | undefined) || null,
    updatedAt: (record.updated_at as string | undefined) || null,
    raw: record,
  };
}

function normalizeTurn(input: unknown): GameTurnRecord {
  const record = asRecord(input);
  return {
    id: String(record.id || ""),
    gameDataId: String(record.game_data_id || ""),
    studentId: (record.student_id as string | undefined) || null,
    gamePlayerId: (record.game_player_id as string | undefined) || null,
    externalPlayerUid: (record.external_player_uid as string | undefined) || null,
    turnNumber: Number(record.turn_number || 0),
    position: Number(record.position || 0),
    cardId: (record.card_id as string | undefined) || null,
    success: Boolean(record.success),
    difficulty: (record.difficulty as string | undefined) || null,
    turnStartDate: (record.turn_start_date as string | undefined) || null,
    playTimeSeconds: typeof record.play_time_seconds === "number" ? record.play_time_seconds : Number(record.play_time_seconds || 0),
    createdAt: (record.created_at as string | undefined) || null,
    updatedAt: (record.updated_at as string | undefined) || null,
    raw: record,
  };
}

function normalizeGame(input: unknown): GameRecord {
  const record = asRecord(input);
  const players = Array.isArray(record.players) ? record.players.map(normalizePlayer) : [];
  const turns = Array.isArray(record.turns) ? record.turns.map(normalizeTurn) : [];
  return {
    id: String(record.id || ""),
    educationalCenterId: (record.educational_center_id as string | undefined) || null,
    bleDeviceId: (record.ble_device_id as string | undefined) || null,
    gameId: typeof record.game_id === "number" ? record.game_id : Number(record.game_id || 0),
    deckName: (record.deck_name as string | undefined) || null,
    totalPlayers: typeof record.total_players === "number" ? record.total_players : Number(record.total_players || players.length),
    startDate: (record.start_date as string | undefined) || null,
    createdAt: (record.created_at as string | undefined) || null,
    updatedAt: (record.updated_at as string | undefined) || null,
    players,
    turns,
    raw: record,
  };
}

export async function listGames(token: string, params: ListGamesParams = {}) {
  const safeLimit = Math.min(Math.max(params.limit ?? 50, 1), 100);

  const response = await apiRequest<PaginatedResponse<unknown>>(apiEndpoints.games.list, {
    token,
    searchParams: {
      institution_id: params.institutionId || undefined,
      page: params.page ?? 1,
      limit: safeLimit,
      sort_by: params.sortBy ?? "created_at",
      order: params.order ?? "desc",
    },
  });

  return {
    ...response,
    data: response.data.map(normalizeGame),
  } as PaginatedResponse<GameRecord>;
}

export function useGames(token?: string, params?: ListGamesParams) {
  const safeLimit = Math.min(Math.max(params?.limit ?? 50, 1), 100);

  return useQuery({
    queryKey: ["games", token, params?.institutionId ?? null, params?.page ?? 1, safeLimit, params?.sortBy ?? "created_at", params?.order ?? "desc"],
    queryFn: () => listGames(token as string, params),
    enabled: Boolean(token),
  });
}
