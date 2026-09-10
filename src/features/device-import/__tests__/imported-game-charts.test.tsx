import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ImportedGameCharts } from "@/features/device-import/imported-game-charts";
import type { ImportedGame } from "@/features/device-import/types";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Bar: () => null,
}));

const game: ImportedGame = {
  summary: { gameId: 7, startedAt: "2026-09-10T12:00:00.000Z", durationSeconds: 40, totalPlayers: 1, deckName: "Demo" },
  players: [{ position: 1, uid: "p1", colorCode: "AM", name: "Jugador 1" }],
  assignments: { p1: { kind: "manual", id: "p1", name: "Ana" } },
  turns: [
    { turnNumber: 1, playerUid: "p1", cardId: "a", correct: true, difficulty: "EASY", timestamp: 1, playTimeSeconds: 2 },
    { turnNumber: 2, playerUid: "p1", cardId: "b", correct: false, difficulty: "EASY", timestamp: 2, playTimeSeconds: 3 },
  ],
};

describe("ImportedGameCharts", () => {
  it("shows round and player outcome summaries", () => {
    render(<ImportedGameCharts game={game} />);

    expect(screen.getByText("Rondas y aciertos")).toBeInTheDocument();
    expect(screen.getByText("Resultados por ronda")).toBeInTheDocument();
    expect(screen.getByText("Rendimiento por jugador")).toBeInTheDocument();
    expect(screen.getByText(/Ana · Amarillo: 50%/)).toBeInTheDocument();
    expect(screen.getByTestId("import-round-chart")).toBeInTheDocument();
    expect(screen.getByTestId("import-player-chart")).toBeInTheDocument();
  });
});
