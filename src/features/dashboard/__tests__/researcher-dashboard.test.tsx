import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearcherDashboard } from "@/features/dashboard/researcher-dashboard";

const useAuthMock = vi.fn();
const useGamesMock = vi.fn();
const useSyncSessionsMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/games/api", () => ({
  useGames: (...args: unknown[]) => useGamesMock(...args),
}));

vi.mock("@/features/syncs/api", () => ({
  useSyncSessions: (...args: unknown[]) => useSyncSessionsMock(...args),
}));

function okPaginated(data: unknown[]) {
  return { data, total: data.length, page: 1, limit: data.length || 1, total_pages: 1 };
}

function okQuery<T>(data: T) {
  return { data, isLoading: false, error: null };
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ResearcherDashboard />
    </QueryClientProvider>,
  );
}

describe("ResearcherDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        fullName: "Rita Researcher",
        roles: ["researcher"],
        permissions: ["game_data:read", "ble_device:read"],
      },
    });

    useGamesMock.mockReturnValue(okQuery(okPaginated([
      { id: "game-1", deckName: "Lectura", turns: [], players: [] },
      { id: "game-2", deckName: "Memoria", turns: [{ id: "turn-1", success: true }], players: [{ id: "player-1", playerSource: "manual" }, { id: "player-2", playerSource: "registered" }] },
    ])));
    useSyncSessionsMock.mockReturnValue(okQuery(okPaginated([
      { id: "sync-1", source: "tablet", rawRecordCount: 0, rawRecordIds: [] },
      { id: "sync-2", source: "tablet", rawRecordCount: 2, rawRecordIds: [] },
    ])));
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a research-oriented home with direct links to games and syncs", () => {
    renderDashboard();

    expect(screen.getByText("Home operativa para lectura de evidencia")).toBeInTheDocument();
    expect(screen.getByText(/Syncs sin raw/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Ver partidas|Partidas/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Ver syncs|Sincronizaciones/i }).length).toBeGreaterThan(0);
  });
});
