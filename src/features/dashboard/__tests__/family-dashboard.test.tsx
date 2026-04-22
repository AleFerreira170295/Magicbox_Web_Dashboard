import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FamilyDashboard } from "@/features/dashboard/family-dashboard";

const useAuthMock = vi.fn();
const useDevicesMock = vi.fn();
const useGamesMock = vi.fn();
const useSyncSessionsMock = vi.fn();
const useUsersMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/devices/api", () => ({
  useDevices: (...args: unknown[]) => useDevicesMock(...args),
}));

vi.mock("@/features/games/api", () => ({
  useGames: (...args: unknown[]) => useGamesMock(...args),
}));

vi.mock("@/features/syncs/api", () => ({
  useSyncSessions: (...args: unknown[]) => useSyncSessionsMock(...args),
}));

vi.mock("@/features/users/api", () => ({
  useUsers: (...args: unknown[]) => useUsersMock(...args),
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
      <FamilyDashboard />
    </QueryClientProvider>,
  );
}

describe("FamilyDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        fullName: "Familia Demo",
        roles: ["family"],
        permissions: ["game_data:read"],
      },
    });

    useDevicesMock.mockReturnValue(okQuery(okPaginated([
      { id: "device-1", name: "Tablet familiar", assignmentScope: "home" },
      { id: "device-2", name: "Tablet secundaria", assignmentScope: "home" },
    ])));
    useGamesMock.mockReturnValue(okQuery(okPaginated([
      { id: "game-1", deckName: "Lectura", turns: [{ id: "turn-1", playTimeSeconds: 90 }] },
      { id: "game-2", deckName: "Memoria", turns: [] },
    ])));
    useSyncSessionsMock.mockReturnValue(okQuery(okPaginated([
      { id: "sync-1", rawRecordCount: 0, rawRecordIds: [] },
      { id: "sync-2", rawRecordCount: 2, rawRecordIds: [] },
    ])));
    useUsersMock.mockReturnValue(okQuery(okPaginated([
      { id: "user-1", fullName: "Niña Demo", email: "nina@example.com" },
      { id: "user-2", fullName: "Niño Demo", email: "nino@example.com" },
    ])));
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a simplified family dashboard focused on visible activity", () => {
    renderDashboard();

    expect(screen.getByText("Home simple para seguir lo visible")).toBeInTheDocument();
    expect(screen.getAllByText(/tus dispositivos, partidas y usuarios visibles/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Dispositivos visibles/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Usuarios visibles/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Partidas visibles/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Syncs visibles/i).length).toBeGreaterThan(0);
  });
});
