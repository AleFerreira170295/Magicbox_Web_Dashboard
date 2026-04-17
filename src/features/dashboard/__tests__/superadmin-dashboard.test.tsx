import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SuperadminDashboard } from "@/features/dashboard/superadmin-dashboard";

const useAuthMock = vi.fn();
const useUsersMock = vi.fn();
const useInstitutionsMock = vi.fn();
const useDevicesMock = vi.fn();
const useSyncSessionsMock = vi.fn();
const useGamesMock = vi.fn();
const useProfilesOverviewMock = vi.fn();
const useBasicHealthMock = vi.fn();
const useReadinessHealthMock = vi.fn();

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

vi.mock("@/features/syncs/api", () => ({
  useSyncSessions: (...args: unknown[]) => useSyncSessionsMock(...args),
}));

vi.mock("@/features/games/api", () => ({
  useGames: (...args: unknown[]) => useGamesMock(...args),
}));

vi.mock("@/features/profiles/api", () => ({
  useProfilesOverview: (...args: unknown[]) => useProfilesOverviewMock(...args),
}));

vi.mock("@/features/health/api", () => ({
  useBasicHealth: (...args: unknown[]) => useBasicHealthMock(...args),
  useReadinessHealth: (...args: unknown[]) => useReadinessHealthMock(...args),
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
      <SuperadminDashboard />
    </QueryClientProvider>,
  );
}

describe("SuperadminDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useUsersMock.mockReturnValue(okQuery(okPaginated([])));
    useInstitutionsMock.mockReturnValue(okQuery(okPaginated([{ id: "ec-1", name: "Colegio Norte", operationalSummary: { needsReview: false } }])));
    useDevicesMock.mockReturnValue(okQuery(okPaginated([{ id: "device-1", status: "active" }])));
    useSyncSessionsMock.mockReturnValue(okQuery(okPaginated([{ id: "sync-1", rawRecordCount: 1, rawRecordIds: [] }])));
    useGamesMock.mockReturnValue(okQuery(okPaginated([{ id: "game-1" }])));
    useProfilesOverviewMock.mockReturnValue(okQuery([{ id: "profile-1", activeBindingCount: 1 }]));
    useBasicHealthMock.mockReturnValue({ data: null, isLoading: false, error: null });
    useReadinessHealthMock.mockReturnValue({ data: null, isLoading: false, error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("gives institution-admin a scoped command center without health/settings, but with permissions when enabled", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        fullName: "Paula Control",
        roles: ["institution-admin"],
        permissions: ["feature:read", "ble_device:read"],
      },
    });

    renderDashboard();

    expect(screen.getByRole("link", { name: /Usuarios/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Permisos/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dispositivos/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Profiles/i })).toBeInTheDocument();
    expect(screen.queryByText("Health")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    expect(useBasicHealthMock).toHaveBeenCalledWith({ enabled: false });
    expect(useReadinessHealthMock).toHaveBeenCalledWith({ enabled: false });
  });

  it("hides the permissions module for institution-admin when ACL access is missing", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        fullName: "Paula Limited",
        roles: ["institution-admin"],
        permissions: ["ble_device:read"],
      },
    });

    renderDashboard();

    expect(screen.getByRole("link", { name: /Usuarios/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Permisos/i })).not.toBeInTheDocument();
  });

  it("keeps director dashboard cards aligned with navigation visibility", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        fullName: "Dora Directora",
        roles: ["director"],
        permissions: ["ble_device:read", "game_data:read"],
      },
    });

    renderDashboard();

    expect(screen.getByText("Dirección")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Usuarios/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Permisos/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Instituciones/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dispositivos/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Profiles/i })).toBeInTheDocument();
    expect(screen.queryByText("Health")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  it("surfaces device totals and missing status in the executive home", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        fullName: "Ada Admin",
        roles: ["admin"],
        permissions: ["ble_device:read", "game_data:read"],
      },
    });

    useDevicesMock.mockReturnValue(
      okQuery(
        okPaginated([
          { id: "device-1", status: null },
          { id: "device-2", status: "online" },
        ]),
      ),
    );
    useBasicHealthMock.mockReturnValue(okQuery({ environment: "local", version: "1.2.3" }));
    useReadinessHealthMock.mockReturnValue(okQuery({ status: "healthy", checks: {} }));

    renderDashboard();

    expect(screen.getByText(/0 usuarios, 1 instituciones y 2 dispositivos visibles/i)).toBeInTheDocument();
    expect(screen.getByText(/1 dispositivos visibles siguen sin `status` explícito/i)).toBeInTheDocument();
    expect(screen.getByText("Devices")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Usuarios/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Permisos/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dispositivos/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Health/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Settings/i })).toBeInTheDocument();
  });
});
