import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearcherDashboard } from "@/features/dashboard/researcher-dashboard";

const useAuthMock = vi.fn();
const useGamesMock = vi.fn();
const useSyncSessionsMock = vi.fn();
const useUsersMock = vi.fn();
const useProfilesOverviewMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
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

vi.mock("@/features/profiles/api", () => ({
  useProfilesOverview: (...args: unknown[]) => useProfilesOverviewMock(...args),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Bar: () => null,
  Line: () => null,
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
    useUsersMock.mockReturnValue(okQuery(okPaginated([
      { id: "user-1", fullName: "Rita Researcher", userType: "web", roles: ["researcher"] },
      { id: "user-2", fullName: "Tom Teacher", userType: "mobile", roles: ["teacher"] },
    ])));
    useProfilesOverviewMock.mockReturnValue(okQuery([
      { id: "profile-1", activeBindingCount: 1, isActive: true, sessionCount: 2 },
      { id: "profile-2", activeBindingCount: 0, isActive: false, sessionCount: 0 },
    ]));
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a research-oriented dashboard focused on evidence quality", () => {
    renderDashboard();

    expect(screen.getByText("Dashboard de evidencia y trazabilidad")).toBeInTheDocument();
    expect(screen.getByText(/Alertas de calidad de evidencia/i)).toBeInTheDocument();
    expect(screen.getByText(/Tipos de usuario en la muestra/i)).toBeInTheDocument();
    expect(screen.getByText(/Cobertura de perfiles/i)).toBeInTheDocument();
    expect(screen.getByText(/Altas y logins/i)).toBeInTheDocument();
    expect(screen.getByText(/Cohortes de profundidad/i)).toBeInTheDocument();
    expect(screen.getByText(/Syncs sin raw/i)).toBeInTheDocument();
    expect(screen.getByText(/Mazos en la muestra/i)).toBeInTheDocument();
  });

  it("opens researcher detail filters from metrics, charts and evidence alerts", () => {
    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: /Ver detalle Mazos activos/i }));
    expect(screen.getByRole("heading", { name: /Mazos activos/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Filtrar Fuentes de sync por tablet/i }));
    expect(screen.getByText(/Fuentes de sync · tablet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ver detalle de Syncs sin raw/i }));
    expect(screen.getByText(/Focos de trazabilidad incompleta dentro de la muestra/i)).toBeInTheDocument();
  });
});
