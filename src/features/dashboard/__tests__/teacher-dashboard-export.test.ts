import { describe, expect, it } from "vitest";
import { buildTeacherDashboardExportData } from "@/features/dashboard/teacher-dashboard-export";

describe("buildTeacherDashboardExportData", () => {
  it("builds detailed match exports without player-identifying fields", () => {
    const result = buildTeacherDashboardExportData([
      {
        id: "game-1",
        deckName: "Animales",
        startDate: "2026-04-17T10:00:00.000Z",
        createdAt: "2026-04-17T10:00:00.000Z",
        updatedAt: "2026-04-17T10:05:00.000Z",
        players: [
          {
            id: "player-1",
            gameDataId: "game-1",
            playerName: "Ana",
            studentId: "student-1",
            position: 1,
            raw: {},
          },
        ],
        turns: [
          {
            id: "turn-1",
            gameDataId: "game-1",
            turnNumber: 1,
            position: 1,
            gamePlayerId: "player-1",
            studentId: "student-1",
            success: true,
            difficulty: "media",
            cardId: "card-1",
            playTimeSeconds: 12,
            turnStartDate: "2026-04-17T10:00:10.000Z",
            createdAt: "2026-04-17T10:00:22.000Z",
            updatedAt: "2026-04-17T10:00:22.000Z",
            raw: {},
          },
        ],
        raw: {},
      },
    ]);

    expect(result.matches).toEqual([
      {
        matchId: "game-1",
        deckName: "Animales",
        startedAt: "2026-04-17T10:00:00.000Z",
        totalTurns: 1,
        successfulTurns: 1,
        successRate: 100,
        avgTurnTimeSeconds: 12,
      },
    ]);

    expect(result.turns).toEqual([
      {
        matchId: "game-1",
        deckName: "Animales",
        turnNumber: 1,
        success: "yes",
        playTimeSeconds: 12,
        difficulty: "media",
        cardId: "card-1",
        turnStartedAt: "2026-04-17T10:00:10.000Z",
        recordedAt: "2026-04-17T10:00:22.000Z",
      },
    ]);

    expect(JSON.stringify(result)).not.toContain("Ana");
    expect(JSON.stringify(result)).not.toContain("student-1");
    expect(JSON.stringify(result)).not.toContain("player-1");
  });
});
