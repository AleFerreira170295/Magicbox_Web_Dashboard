import { describe, expect, it } from "vitest";
import { buildDownloadedGame, encodeProtocolCommand, parseProtocolLine, turnDateFromGameStart } from "@/features/device-import/protocol";

describe("MagicBox cable protocol", () => {
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
    expect(turnDateFromGameStart(game.summary.startedAt, 2)).toBe("2026-09-10T12:00:02.000Z");
  });
});
