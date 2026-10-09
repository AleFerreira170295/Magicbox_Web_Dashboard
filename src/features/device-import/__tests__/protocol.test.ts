import { describe, expect, it } from "vitest";
import { buildDownloadedGame, encodeProtocolCommand, normalizeDeviceInfo, parseProtocolLine, turnDateFromGameStart } from "@/features/device-import/protocol";

describe("MagicBox cable protocol", () => {
  it("normalizes the MagicBox identity response", () => {
    expect(normalizeDeviceInfo({
      type: "deviceInfo",
      deviceId: "aa:bb:cc:dd:ee:ff",
      firmwareVersion: "V2.3.22",
      hardware: "V3",
    })).toEqual({ deviceId: "AABBCCDDEEFF", firmwareVersion: "V2.3.22", hardware: "V3" });
    expect(normalizeDeviceInfo({ type: "deviceInfo", deviceId: "invalid" })).toBeNull();
  });

  it("ignores firmware logs and parses JSON frames", () => {
    expect(parseProtocolLine("[battery] ready")).toBeNull();
    expect(parseProtocolLine('{"type":"savedGamesList","isLastChunk":true}')).toMatchObject({ type: "savedGamesList", isLastChunk: true });
  });

  it("encodes one newline-delimited JSON command", () => {
    expect(encodeProtocolCommand({ type: "savedGamesListRequest" })).toBe('{"type":"savedGamesListRequest"}\n');
  });

  it("assembles a complete downloaded game", () => {
    const game = buildDownloadedGame([
      { type: "savedGameTransferStart", gameId: "42" },
      { type: "savedGameMeta", gameId: "42", startedAt: "2026-09-10T12:00:00Z", deckName: "Mazo", duration: 30 },
      { type: "savedGamePlayer", player: { position: 1, uid: "P1", colorCode: "AM", name: "Jugador" } },
      { type: "savedGameTurnsChunk", turns: [{ turnNumber: 1, playerUid: "P1", cardId: "C1", correct: 1, difficulty: "4", timestamp: 2, playTimeSeconds: 1.5 }] },
      { type: "savedGameTransferComplete", gameId: "42", status: "ok" },
    ]);
    expect(game.summary.gameId).toBe(42);
    expect(game.players).toHaveLength(1);
    expect(game.turns[0]).toMatchObject({ playerUid: "P1", correct: true });
    expect(turnDateFromGameStart(game.summary.startedAt, 2000)).toBe("2026-09-10T12:00:02.000Z");
  });

  it("replaces the firmware placeholder date with the recent game time", () => {
    const receivedAt = Date.parse("2026-09-11T12:53:00Z");
    const game = buildDownloadedGame([
      { type: "savedGameTransferStart", gameId: "2356" },
      { type: "savedGameMeta", gameId: "2356", startedAt: "2024-01-01 00:00:00", deckName: "3.1", duration: 87 },
      { type: "savedGamePlayer", player: { position: 1, uid: "P1", colorCode: "AM", name: "Jugador" } },
      { type: "savedGameTurnsChunk", turns: [{ turnNumber: 1, playerUid: "P1", cardId: "C1", correct: 1, difficulty: "3102", timestamp: 3870, playTimeSeconds: 0 }] },
      { type: "savedGameTransferComplete", gameId: "2356", status: "ok" },
    ], receivedAt);

    expect(game.summary.sourceStartedAt).toBe("2024-01-01 00:00:00");
    expect(game.summary.startedAt).toBe("2026-09-11T12:51:33.000Z");
    expect(turnDateFromGameStart(game.summary.startedAt, game.turns[0].timestamp)).toBe("2026-09-11T12:51:36.870Z");
  });

  it("preserves valid saved games that ended before recording turns", () => {
    const game = buildDownloadedGame([
      { type: "savedGameTransferStart", gameId: "43" },
      { type: "savedGameMeta", gameId: "43", startedAt: "2026-09-10T12:00:00Z", deckName: "Mazo", duration: 0 },
      { type: "savedGamePlayer", player: { position: 1, uid: "P1", colorCode: "AM", name: "Jugador" } },
      { type: "savedGameTransferComplete", status: "ok" },
    ]);
    expect(game.summary.gameId).toBe(43);
    expect(game.players).toHaveLength(1);
    expect(game.turns).toEqual([]);
  });
  it("normalizes nested and legacy firmware aliases without losing players or turns", () => {
    const game = buildDownloadedGame([
      { type: "savedGameTransferStart", transfer_id: "tx-9", gid: 9, playersCount: 1, turnsCount: 1 },
      { payload: { type: "savedGameMeta", transferId: "tx-9", gameInfo: { id: 9, startDate: "2026-09-10T12:00:00Z", durationMs: 2500, deck: "3.1" } } },
      { type: "savedGamePlayer", transferId: "tx-9", gameId: 9, index: 1, id: "P1", color: "ve", playerName: "Ana" },
      { type: "savedGameTurnsChunk", transferId: "tx-9", gameId: 9, chunk: [{ turn_number: 1, playerId: "P1", card_id: "C1", success: 1, timestamp: 1500 }] },
      { type: "savedGameTransferComplete", transferId: "tx-9", gameId: 9, status: "ok" },
    ], Date.parse("2026-09-10T12:00:05Z"));

    expect(game.summary).toMatchObject({ gameId: 9, deckName: "3.1", durationSeconds: 2.5, timestampQuality: "exact" });
    expect(game.players).toEqual([{ position: 1, uid: "P1", colorCode: "VE", name: "Ana" }]);
    expect(game.turns).toEqual([{ turnNumber: 1, playerUid: "P1", cardId: "C1", correct: true, difficulty: "UNKNOWN", timestamp: 1500, playTimeSeconds: 1.5 }]);
  });

  it("rejects a transfer whose declared player or turn counts are incomplete", () => {
    expect(() => buildDownloadedGame([
      { type: "savedGameTransferStart", transferId: "tx-incomplete", gameId: 10, playersCount: 1, turnsCount: 2 },
      { type: "savedGameMeta", transferId: "tx-incomplete", gameId: 10, startedAt: "2026-09-10T12:00:00Z" },
      { type: "savedGamePlayer", transferId: "tx-incomplete", gameId: 10, player: { position: 1, uid: "P1", colorCode: "AM", name: "Ana" } },
      { type: "savedGameTurnsChunk", transferId: "tx-incomplete", gameId: 10, turns: [{ turnNumber: 1, playerUid: "P1", cardId: "C1", correct: true }] },
      { type: "savedGameTransferComplete", transferId: "tx-incomplete", gameId: 10, status: "ok" },
    ])).toThrow("1/2 turnos");
  });

});
