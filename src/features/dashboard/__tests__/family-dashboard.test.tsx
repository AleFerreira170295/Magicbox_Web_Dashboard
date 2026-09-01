import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FamilyDashboard } from "@/features/dashboard/family-dashboard";

const useAuthMock = vi.fn();
const useDevicesMock = vi.fn();
const useGamesMock = vi.fn();
const useSyncSessionsMock = vi.fn();
const useUsersMock = vi.fn();
const useProfilesOverviewMock = vi.fn();

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
    useProfilesOverviewMock.mockReturnValue(okQuery([
      { id: "profile-1", activeBindingCount: 1, isActive: true, sessionCount: 1 },
      { id: "profile-2", activeBindingCount: 0, isActive: true, sessionCount: 0 },
    ]));
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a simplified family dashboard focused on recent activity", () => {
    renderDashboard();

    expect(screen.getByText(/Seguimiento de Familia Demo/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Partidas/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sincronizaciones/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Actividad reciente/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Mazos usados/i)).toBeInTheDocument();
    expect(screen.getByText(/Syncs con evidencia/i)).toBeInTheDocument();
    expect(screen.queryByText(/Usuarios por rol/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dispositivos/i)).not.toBeInTheDocument();
  });

  it("opens family detail filters from cards and summary blocks", () => {
    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: /Ver detalle Partidas/i }));
    expect(screen.getByText(/Detalle de partidas/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ver detalle de Syncs con evidencia/i }));
    expect(screen.getByText(/Detalle de sincronizaciones/i)).toBeInTheDocument();
  });
});
