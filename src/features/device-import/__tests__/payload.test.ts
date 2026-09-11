import { describe, expect, it } from "vitest";
import { buildGamesBatchPayload, buildRawSyncEnvelopes } from "@/features/device-import/payload";

describe("device import payload", () => {
  it("maps colors to students and preserves manual identities", () => {
    const payload = buildGamesBatchPayload("AA:BB:CC:DD:EE:FF", [{
      summary: { gameId: 7, startedAt: "2026-09-10T12:00:00Z", durationSeconds: 10, totalPlayers: 2, deckName: "Mazo" },
      players: [
        { position: 1, uid: "P1", colorCode: "AM", name: "Uno" },
        { position: 2, uid: "P2", colorCode: "VE", name: "Dos" },
      ],
      turns: [
        { turnNumber: 1, playerUid: "P1", cardId: "C1", correct: true, difficulty: "4", timestamp: 0, playTimeSeconds: 1 },
        { turnNumber: 2, playerUid: "P2", cardId: "C2", correct: false, difficulty: "3", timestamp: 2, playTimeSeconds: 2 },
      ],
      assignments: { P1: { kind: "student", id: "student-1", name: "Ana" } },
    }], "center-1");

    expect(payload.games[0].device_id).toBe("AABBCCDDEEFF");
    expect(payload.games[0].players[0]).toMatchObject({ student_id: "student-1", card_color: "yellow" });
    expect(payload.games[0].players[1]).toMatchObject({ external_player_uid: "P2", player_name: "Dos", card_color: "green" });
  });

  it("builds a stable lossless envelope for safe retries", () => {
    const games = [{
      summary: { gameId: 7, startedAt: "2026-09-10T12:00:00Z", durationSeconds: 10, totalPlayers: 1, deckName: "Mazo" },
      players: [{ position: 1, uid: "P1", colorCode: "AM", name: "Uno" }],
      turns: [{ turnNumber: 1, playerUid: "P1", cardId: "C1", correct: true, difficulty: "4", timestamp: 0, playTimeSeconds: 1 }],
      assignments: {},
    }];

    const first = buildRawSyncEnvelopes("AABBCCDDEEFF", games, "center-1")[0];
    const second = buildRawSyncEnvelopes("AABBCCDDEEFF", games, "center-1")[0];

    expect(first.ingestion_key).toBe(second.ingestion_key);
    expect(first).toEqual(second);
    expect(first).not.toHaveProperty("received_at");
    expect(first.ingestion_key).toContain(String(Date.parse("2026-09-10T12:00:00Z")));
    expect(first).toMatchObject({
      source_channel: "web_dashboard",
      payload_schema_version: "magicbox.device_cable_import.v1",
      payload: { game_data_payload: { game_id: 7 } },
    });
  });

  it("keeps the legacy source date in the idempotency key while uploading the corrected date", () => {
    const game = {
      summary: {
        gameId: 2356,
        startedAt: "2026-09-11T12:51:33.000Z",
        sourceStartedAt: "2024-01-01 00:00:00",
        durationSeconds: 87,
        totalPlayers: 1,
        deckName: "3.1 Geometría | Fácil",
      },
      players: [{ position: 1, uid: "P1", colorCode: "AM", name: "Uno" }],
      turns: [{ turnNumber: 1, playerUid: "P1", cardId: "C1", correct: true, difficulty: "3102", timestamp: 3870, playTimeSeconds: 0 }],
      assignments: {},
    };

    const envelope = buildRawSyncEnvelopes("CC88311D16F0", [game])[0];

    expect(envelope.ingestion_key).toBe("device-cable-import:cable:CC88311D16F0:2356:1704078000000");
    expect(envelope.started_at).toBe("2026-09-11T12:51:33.000Z");
    expect(envelope.payload.game_data_payload.turns[0].turn_start_date).toBe("2026-09-11T12:51:36.870Z");
  });

});
