import { describe, expect, it } from "vitest";
import { buildPlayerOutcomeSeries, buildRoundOutcomeSeries } from "@/features/device-import/game-analytics";
import type { ImportedGame } from "@/features/device-import/types";

const game: ImportedGame = {
  summary: { gameId: 42, startedAt: "2026-09-10T12:00:00.000Z", durationSeconds: 60, totalPlayers: 2, deckName: "Demo" },
  players: [
    { position: 1, uid: "p1", colorCode: "AM", name: "Jugador 1" },
    { position: 2, uid: "p2", colorCode: "VE", name: "Jugador 2" },
  ],
  assignments: { p1: { kind: "manual", id: "p1", name: "Ana" } },
  turns: [
    { turnNumber: 1, playerUid: "p1", cardId: "a", correct: true, difficulty: "EASY", timestamp: 1, playTimeSeconds: 2 },
    { turnNumber: 1, playerUid: "p2", cardId: "b", correct: false, difficulty: "EASY", timestamp: 2, playTimeSeconds: 4 },
    { turnNumber: 2, playerUid: "p1", cardId: "c", correct: true, difficulty: "MEDIUM", timestamp: 3, playTimeSeconds: 3 },
  ],
};

describe("cable-import game analytics", () => {
  it("groups hits, errors and timing by round", () => {
    expect(buildRoundOutcomeSeries(game)).toEqual([
      { round: 1, label: "Ronda 1", hits: 1, misses: 1, total: 2, accuracy: 50, averageTimeSeconds: 3 },
      { round: 2, label: "Ronda 2", hits: 1, misses: 0, total: 1, accuracy: 100, averageTimeSeconds: 3 },
    ]);
  });

  it("summarizes outcomes using assigned player names", () => {
    expect(buildPlayerOutcomeSeries(game)).toEqual([
      { playerUid: "p1", label: "Ana", colorCode: "AM", hits: 2, misses: 0, total: 2, accuracy: 100 },
      { playerUid: "p2", label: "Jugador 2", colorCode: "VE", hits: 0, misses: 1, total: 1, accuracy: 0 },
    ]);
  });
});
