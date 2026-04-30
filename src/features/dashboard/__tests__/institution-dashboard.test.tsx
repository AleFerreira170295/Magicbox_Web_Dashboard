import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstitutionDashboard } from "@/features/dashboard/institution-dashboard";

const useAuthMock = vi.fn();
const useUsersMock = vi.fn();
const useInstitutionsMock = vi.fn();
const useDevicesMock = vi.fn();
const useGamesMock = vi.fn();
const useProfilesOverviewMock = vi.fn();
const useSyncSessionsMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/users/api", () => ({
  useUsers: (...args: unknown[]) => useUsersMock(...args),
}));

vi.mock("@/features/institutions/api", () => ({
  useInstitutions: (...args: unknown[]) => useInstitutionsMock(...args),
}));

vi.mock("@/features/devices/api", () => ({
  useDevices: (...args: unknown[]) => useDevicesMock(...args),
}));

vi.mock("@/features/games/api", () => ({
  useGames: (...args: unknown[]) => useGamesMock(...args),
}));

vi.mock("@/features/profiles/api", () => ({
  useProfilesOverview: (...args: unknown[]) => useProfilesOverviewMock(...args),
}));

vi.mock("@/features/syncs/api", () => ({
  useSyncSessions: (...args: unknown[]) => useSyncSessionsMock(...args),
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
      <InstitutionDashboard />
    </QueryClientProvider>,
  );
}

describe("InstitutionDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useUsersMock.mockReturnValue(okQuery(okPaginated([{ id: "user-1", roles: ["institution-admin"] }, { id: "user-2", roles: ["teacher"] }])));
    useInstitutionsMock.mockReturnValue(okQuery(okPaginated([{ id: "ec-1", name: "Colegio Norte" }])));
    useDevicesMock.mockReturnValue(okQuery(okPaginated([{ id: "device-1", status: null }, { id: "device-2", status: "active", ownerUserEmail: "owner@example.com" }])));
    useGamesMock.mockReturnValue(okQuery(okPaginated([{ id: "game-1", turns: [] }, { id: "game-2", turns: [{ id: "turn-1" }] }])));
    useProfilesOverviewMock.mockReturnValue(okQuery([
      { id: "profile-1", activeBindingCount: 0, isActive: true, sessionCount: 0, createdAt: "2026-04-20T10:00:00Z" },
      { id: "profile-2", activeBindingCount: 1, isActive: true, sessionCount: 1, lastSessionAt: "2026-04-21T10:00:00Z", createdAt: "2026-04-19T10:00:00Z" },
    ]));
    useSyncSessionsMock.mockReturnValue(okQuery(okPaginated([{ id: "sync-1", rawRecordCount: 0, rawRecordIds: [] }, { id: "sync-2", rawRecordCount: 1, rawRecordIds: [] }])));
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the scoped institutional dashboard for institution-admin", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        fullName: "Paula Control",
        roles: ["institution-admin"],
        permissions: ["access_control:read", "feature:read"],
      },
    });

    renderDashboard();

    expect(screen.getAllByText("Colegio Norte").length).toBeGreaterThan(0);
    expect(screen.getByText(/Vista analítica de Colegio Norte/i)).toBeInTheDocument();
    expect(screen.getByText(/Usuarios y permisos/i)).toBeInTheDocument();
    expect(screen.getByText(/Balance de recursos/i)).toBeInTheDocument();
    expect(screen.getByText(/Usuarios por rol/i)).toBeInTheDocument();
    expect(screen.getByText(/Actividad reciente de perfiles/i)).toBeInTheDocument();
    expect(screen.getByText(/Altas y reingresos/i)).toBeInTheDocument();
    expect(screen.getByText(/Cohortes por sesiones/i)).toBeInTheDocument();
    expect(screen.getByText(/Dispositivos sin status/i)).toBeInTheDocument();
  });

  it("keeps permissions visible for institution-admin even when the session arrives without ACL read", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        fullName: "Paula Control",
        roles: ["institution-admin"],
        permissions: [],
      },
    });

    renderDashboard();

    expect(screen.getByText(/Usuarios y permisos/i)).toBeInTheDocument();
    expect(screen.getByText(/Prioridades operativas/i)).toBeInTheDocument();
  });

  it("keeps director on the institutional modules without admin-only actions", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        fullName: "Dora Directora",
        roles: ["director"],
        permissions: ["game_data:read"],
      },
    });

    renderDashboard();

    expect(screen.getByText("Dirección")).toBeInTheDocument();
    expect(screen.queryByText(/Usuarios y permisos/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Usuarios/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Vínculos de perfiles/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Partidas/i).length).toBeGreaterThan(0);
  });

  it("opens detail filters from institutional cards and charts", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        fullName: "Paula Control",
        roles: ["institution-admin"],
        permissions: ["access_control:read", "feature:read"],
      },
    });

    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: /Ver detalle Usuarios/i }));
    expect(screen.getByText(/Detalle de usuarios/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Filtrar Estado de hardware por Sin status/i }));
    expect(screen.getByText(/Hardware · Sin status/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ver detalle de Dispositivos sin status/i }));
    expect(screen.getByText(/Equipos que necesitan chequeo técnico o actualización de estado/i)).toBeInTheDocument();
  });
});
