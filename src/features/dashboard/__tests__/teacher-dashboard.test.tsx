import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeacherDashboard } from "@/features/dashboard/teacher-dashboard";

const useAuthMock = vi.fn();
const useGamesMock = vi.fn();
const useDevicesMock = vi.fn();
const useSyncSessionsMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/games/api", () => ({
  useGames: (...args: unknown[]) => useGamesMock(...args),
}));

vi.mock("@/features/devices/api", () => ({
  useDevices: (...args: unknown[]) => useDevicesMock(...args),
}));

vi.mock("@/features/syncs/api", () => ({
  useSyncSessions: (...args: unknown[]) => useSyncSessionsMock(...args),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Bar: () => null,
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
      <TeacherDashboard />
    </QueryClientProvider>,
  );
}

describe("TeacherDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        fullName: "Luz Docente",
        roles: ["teacher"],
        permissions: ["game_data:read"],
      },
    });

    useGamesMock.mockReturnValue(okQuery(okPaginated([
      { id: "game-1", deckName: "Lectura", turns: [] },
      { id: "game-2", deckName: "Lectura", turns: [{ id: "turn-1", playTimeSeconds: 120 }] },
    ])));
    useDevicesMock.mockReturnValue(okQuery(okPaginated([
      { id: "device-1", status: null },
      { id: "device-2", status: "online" },
    ])));
    useSyncSessionsMock.mockReturnValue(okQuery(okPaginated([
      { id: "sync-1", source: "tablet", rawRecordCount: 0, rawRecordIds: [] },
      { id: "sync-2", source: "tablet", rawRecordCount: 3, rawRecordIds: [] },
    ])));
  });

  afterEach(() => {
    cleanup();
  });

  it("renders an operational teacher home with quick module access", () => {
    renderDashboard();

    expect(screen.getByText("Home operativa para acompañar el aula")).toBeInTheDocument();
    expect(screen.getByText(/Partidas sin turnos: 1/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Partidas/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Dispositivos/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Sincronizaciones/i }).length).toBeGreaterThan(0);
  });
});
