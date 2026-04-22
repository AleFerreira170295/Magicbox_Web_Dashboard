import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

    useUsersMock.mockReturnValue(okQuery(okPaginated([{ id: "user-1" }, { id: "user-2" }])));
    useInstitutionsMock.mockReturnValue(okQuery(okPaginated([{ id: "ec-1", name: "Colegio Norte" }])));
    useDevicesMock.mockReturnValue(okQuery(okPaginated([{ id: "device-1", status: null }, { id: "device-2", status: "active", ownerUserEmail: "owner@example.com" }])));
    useGamesMock.mockReturnValue(okQuery(okPaginated([{ id: "game-1", turns: [] }, { id: "game-2", turns: [{ id: "turn-1" }] }])));
    useProfilesOverviewMock.mockReturnValue(okQuery([{ id: "profile-1", activeBindingCount: 0 }, { id: "profile-2", activeBindingCount: 1 }]));
    useSyncSessionsMock.mockReturnValue(okQuery(okPaginated([{ id: "sync-1", rawRecordCount: 0, rawRecordIds: [] }, { id: "sync-2", rawRecordCount: 1, rawRecordIds: [] }])));
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the scoped institutional home for institution-admin", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        fullName: "Paula Control",
        roles: ["institution-admin"],
        permissions: ["access_control:read", "feature:read"],
      },
    });

    renderDashboard();

    expect(screen.getByText("Colegio Norte")).toBeInTheDocument();
    expect(screen.getByText(/Home operativo de Colegio Norte/i)).toBeInTheDocument();
    expect(screen.getAllByText("Usuarios").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Permisos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dispositivos").length).toBeGreaterThan(0);
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

    expect(screen.getAllByText("Permisos").length).toBeGreaterThan(0);
    expect(screen.getByText(/señal temprana si la sesión llega incompleta/i)).toBeInTheDocument();
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
    expect(screen.queryByText("Permisos")).not.toBeInTheDocument();
    expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();
    expect(screen.getAllByText("Instituciones").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Partidas").length).toBeGreaterThan(0);
  });
});
