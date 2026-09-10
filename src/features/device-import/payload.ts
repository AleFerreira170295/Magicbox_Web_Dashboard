import { turnDateFromGameStart } from "@/features/device-import/protocol";
import type { ImportedGame } from "@/features/device-import/types";

const COLOR_NAMES: Record<string, string> = {
  AM: "yellow", NA: "orange", VE: "green", VI: "violet", CI: "blue", MA: "red",
};

function normalizeDeviceId(deviceId: string) {
  const normalizedDeviceId = deviceId.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (normalizedDeviceId.length !== 12) throw new Error("El identificador de la MagicBox debe tener 12 caracteres hexadecimales.");
  return normalizedDeviceId;
}

export function buildGamesBatchPayload(deviceId: string, games: ImportedGame[], educationalCenterId?: string | null) {
  const normalizedDeviceId = normalizeDeviceId(deviceId);

  return {
    ...(educationalCenterId ? { educational_center_id: educationalCenterId } : {}),
    games: games.map((game) => {
      const players = game.players.map((player) => {
        const target = game.assignments[player.uid] ?? { kind: "manual" as const, id: player.uid, name: player.name || `Jugador ${player.position}` };
        return {
          ...(target.kind === "student" ? { student_id: target.id } : {
            external_player_uid: target.kind === "profile" ? `profile:${target.id}` : target.id,
            player_name: target.name,
            player_source: "manual",
          }),
          position: player.position,
          card_color: COLOR_NAMES[player.colorCode] ?? player.colorCode,
        };
      });
      const playerByUid = new Map(game.players.map((player) => [player.uid, player]));
      const turns = game.turns.map((turn) => {
        const player = playerByUid.get(turn.playerUid);
        const target = game.assignments[turn.playerUid] ?? { kind: "manual" as const, id: turn.playerUid, name: player?.name || "Jugador" };
        return {
          ...(target.kind === "student" ? { student_id: target.id } : {
            external_player_uid: target.kind === "profile" ? `profile:${target.id}` : target.id,
          }),
          turn_number: turn.turnNumber,
          position: player?.position ?? 1,
          card_id: turn.cardId,
          success: turn.correct,
          difficulty: turn.difficulty,
          turn_start_date: turnDateFromGameStart(game.summary.startedAt, turn.timestamp),
          play_time_seconds: turn.playTimeSeconds,
        };
      });
      return {
        ...(educationalCenterId ? { educational_center_id: educationalCenterId } : {}),
        device_id: normalizedDeviceId,
        game_id: game.summary.gameId,
        deck_name: game.summary.deckName || "UNKNOWN",
        total_players: players.length,
        start_date: game.summary.startedAt || new Date().toISOString(),
        players,
        turns,
      };
    }),
  };
}

export function buildRawSyncEnvelopes(deviceId: string, games: ImportedGame[], educationalCenterId?: string | null) {
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  const batch = buildGamesBatchPayload(normalizedDeviceId, games, educationalCenterId);

  return batch.games.map((gamePayload, index) => {
    const importedGame = games[index];
    const startedAtMs = Date.parse(gamePayload.start_date);
    const stableStartedAt = Number.isFinite(startedAtMs) ? startedAtMs : 0;
    const syncSessionId = `cable:${normalizedDeviceId}:${gamePayload.game_id}:${stableStartedAt}`;

    return {
      ingestion_key: `device-cable-import:${syncSessionId}`,
      source_type: "device_memory_relay",
      source_channel: "web_dashboard",
      sync_session_id: syncSessionId,
      device_id: normalizedDeviceId,
      payload_schema_version: "magicbox.device_cable_import.v1",
      captured_at: gamePayload.start_date,
      received_at: new Date().toISOString(),
      session_type: "device_memory_relay",
      deck_name: gamePayload.deck_name,
      total_cards: gamePayload.turns.length,
      total_players: gamePayload.total_players,
      started_at: gamePayload.start_date,
      session_metadata: {
        ...(educationalCenterId ? { educational_center_id: educationalCenterId } : {}),
        relay_origin: "web_serial",
        source_game_id: gamePayload.game_id,
      },
      payload: {
        game_data_payload: gamePayload,
        download_response: importedGame,
      },
      transport_metadata: {
        origin: "web_dashboard",
        flow: "device_cable_import",
        transport: "web_serial",
      },
    };
  });
}
