import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeacherDashboard } from "@/features/dashboard/teacher-dashboard";

const useAuthMock = vi.fn();
const useGamesMock = vi.fn();
const useDevicesMock = vi.fn();
const useSyncSessionsMock = vi.fn();
const useUsersMock = vi.fn();
const useProfilesOverviewMock = vi.fn();

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

vi.mock("@/features/users/api", () => ({
  useUsers: (...args: unknown[]) => useUsersMock(...args),
}));

vi.mock("@/features/profiles/api", () => ({
  useProfilesOverview: (...args: unknown[]) => useProfilesOverviewMock(...args),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
    useUsersMock.mockReturnValue(okQuery(okPaginated([
      { id: "user-1", fullName: "Luz Docente", roles: ["teacher"] },
      { id: "user-2", fullName: "Paula Control", roles: ["institution-admin"] },
    ])));
    useProfilesOverviewMock.mockReturnValue(okQuery([
      { id: "profile-1", activeBindingCount: 1, isActive: true, sessionCount: 2 },
      { id: "profile-2", activeBindingCount: 0, isActive: true, sessionCount: 0 },
    ]));
  });

  afterEach(() => {
    cleanup();
  });

  it("renders an analytical teacher dashboard focused on activity and alerts", () => {
    renderDashboard();

    expect(screen.getByText("Dashboard analítico del aula")).toBeInTheDocument();
    expect(screen.getByText(/Turnos jugados/i)).toBeInTheDocument();
    expect(screen.getByText(/Mazos más usados/i)).toBeInTheDocument();
    expect(screen.getByText(/Usuarios por rol/i)).toBeInTheDocument();
    expect(screen.getByText(/Cobertura de perfiles/i)).toBeInTheDocument();
    expect(screen.getByText(/Recencia del padrón/i)).toBeInTheDocument();
    expect(screen.getByText(/Perfiles por categoría/i)).toBeInTheDocument();
    expect(screen.getByText(/Partidas sin turnos/i)).toBeInTheDocument();
    expect(screen.getByText(/Dispositivos sin status/i)).toBeInTheDocument();
  });

  it("opens detail filters from summary cards and alert blocks", () => {
    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: /Ver detalle Turnos jugados/i }));

    expect(screen.getByText(/Detalle de turnos jugados/i)).toBeInTheDocument();
    expect(screen.getByText(/1 turnos/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ver detalle de Dispositivos sin status/i }));

    expect(screen.getByText(/Equipos que necesitan chequeo técnico o actualización de estado/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Sin status/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Limpiar filtro Dispositivos sin status/i }));
    expect(screen.queryByText(/Detalle de turnos jugados/i)).not.toBeInTheDocument();
  });
});
