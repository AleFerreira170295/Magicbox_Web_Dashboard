import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
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
const useSystemDashboardSummaryMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/features/dashboard/api", () => ({
  useSystemDashboardSummary: (...args: unknown[]) => useSystemDashboardSummaryMock(...args),
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

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  XAxis: () => null,
  Tooltip: () => null,
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
    useSystemDashboardSummaryMock.mockReturnValue({ data: null, isLoading: false, error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("hides health and settings modules for institution-admin and disables health queries", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        fullName: "Paula Control",
        roles: ["institution-admin"],
        permissions: ["feature:read", "ble_device:read"],
      },
    });

    renderDashboard();

    expect(screen.queryByText("Health")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Profiles/i })).toBeInTheDocument();
    expect(useBasicHealthMock).toHaveBeenCalledWith({ enabled: false });
    expect(useReadinessHealthMock).toHaveBeenCalledWith({ enabled: false });
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
    expect(screen.getByRole("link", { name: /Instituciones/i })).toBeInTheDocument();
    expect(screen.queryByText("Health")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  it("uses the aggregated admin summary endpoint and renders filter controls", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        fullName: "Ada Admin",
        roles: ["admin"],
        permissions: ["feature:read", "ble_device:read"],
      },
    });
    useSystemDashboardSummaryMock.mockReturnValue(
      okQuery({
        filters: {
          selected_range: "30d",
          selected_institution_id: null,
          selected_country_code: null,
          selected_state: null,
          selected_city: null,
          selected_user_type: null,
          selected_role_code: null,
          range_options: [{ value: "30d", label: "30 días" }],
          institutions: [{ id: "ec-1", name: "Colegio Norte" }],
          countries: ["CL"],
          states: ["Metropolitana"],
          cities: ["Santiago"],
          user_types: ["teacher"],
          role_codes: ["admin"],
          window_start: null,
          trend_range: "30d",
        },
        totals: {
          users: 25,
          institutions: 1,
          devices: 5,
          syncs: 2,
          games: 8,
          profiles: 4,
          turns: 14,
        },
        stats: {
          institutions_needing_review: 0,
          devices_without_status: 1,
          devices_with_owner: 5,
          devices_with_firmware: 3,
          home_devices: 1,
          institution_devices: 4,
          syncs_with_raw: 2,
          total_players: 16,
          successful_turns: 10,
          games_with_turns: 5,
          active_profiles: 4,
          profiles_with_bindings: 3,
          profiles_with_sessions: 2,
        },
        trends: [
          { date: "2026-04-20", syncs: 1, games: 2, turns: 3, successful_turns: 2, success_rate: 66.7 },
        ],
        comparisons: {
          window_label: "30d",
          current_start: "2026-03-20T00:00:00Z",
          current_end: "2026-04-20T00:00:00Z",
          previous_start: "2026-02-18T00:00:00Z",
          previous_end: "2026-03-20T00:00:00Z",
          metrics: [{ key: "syncs", label: "Syncs", current: 2, previous: 1, delta_percent: 100 }],
        },
        alerts: [{ severity: "success", title: "Sin alertas críticas", message: "Todo estable" }],
        segments: {
          role_mix: [{ key: "admin", count: 1 }],
          user_type_mix: [{ key: "web", count: 1 }],
          top_institutions: [{ id: "ec-1", name: "Colegio Norte", users: 10, games: 8, turns: 14, state: "Metropolitana", city: "Santiago" }],
          top_territories: [{ key: "Metropolitana / Santiago", institutions: 1, users: 10, games: 8, turns: 14 }],
          territorial_hierarchy: [{ key: "CL", institutions: 1, users: 10, games: 8, turns: 14, states: [{ key: "Metropolitana", institutions: 1, users: 10, games: 8, turns: 14, cities: [{ key: "Santiago", institutions: 1, users: 10, games: 8, turns: 14 }] }] }],
          territory_alerts: [],
          territory_scores: [{ label: "Metropolitana / Santiago", score: 85, status: "success", users: 10, games: 8, turns: 14, reasons: ["Actividad registrada en el período"] }],
        },
      }),
    );

    renderDashboard();

    expect(screen.getByText("Ventana temporal")).toBeInTheDocument();
    expect(screen.getByText("Institución")).toBeInTheDocument();
    expect(screen.getByText("País")).toBeInTheDocument();
    expect(screen.getByText("Tipo de usuario")).toBeInTheDocument();
    expect(screen.getByText("Mini tendencias")).toBeInTheDocument();
    expect(screen.getByText("Comparativa entre períodos")).toBeInTheDocument();
    expect(screen.getByText("Semáforos operativos")).toBeInTheDocument();
    expect(useSystemDashboardSummaryMock).toHaveBeenCalledWith(
      "token",
      {
        range: "30d",
        institutionId: null,
        countryCode: null,
        state: null,
        city: null,
        userType: null,
        roleCode: null,
      },
      true,
    );
  });

  it("renders the territorial government view from the summary endpoint without technical modules", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        fullName: "Gobierno Territorial",
        roles: ["government-viewer"],
        permissions: ["feature:read"],
      },
    });
    useSystemDashboardSummaryMock.mockReturnValue(
      okQuery({
        filters: {
          selected_range: "30d",
          selected_institution_id: null,
          selected_country_code: "UY",
          selected_state: "Montevideo",
          selected_city: null,
          selected_user_type: null,
          selected_role_code: null,
          range_options: [{ value: "30d", label: "30 días" }],
          institutions: [{ id: "ec-1", name: "Colegio Norte" }],
          countries: ["UY"],
          states: ["Montevideo"],
          cities: ["Montevideo"],
          user_types: ["web"],
          role_codes: ["teacher"],
          window_start: null,
          trend_range: "30d",
        },
        totals: {
          users: 10,
          institutions: 1,
          devices: 2,
          syncs: 3,
          games: 4,
          profiles: 5,
          turns: 6,
        },
        stats: {
          institutions_needing_review: 0,
          devices_without_status: 0,
          devices_with_owner: 2,
          devices_with_firmware: 2,
          home_devices: 0,
          institution_devices: 2,
          syncs_with_raw: 3,
          total_players: 8,
          successful_turns: 5,
          games_with_turns: 4,
          active_profiles: 4,
          profiles_with_bindings: 3,
          profiles_with_sessions: 2,
        },
        trends: [{ date: "2026-04-20", syncs: 1, games: 1, turns: 2, successful_turns: 2, success_rate: 100 }],
        comparisons: {
          window_label: "30d",
          current_start: "2026-03-20T00:00:00Z",
          current_end: "2026-04-20T00:00:00Z",
          previous_start: "2026-02-18T00:00:00Z",
          previous_end: "2026-03-20T00:00:00Z",
          metrics: [{ key: "turns", label: "Turnos", current: 6, previous: 4, delta_percent: 50 }],
        },
        alerts: [{ severity: "warning", title: "Caída de actividad en turnos", message: "Atención" }],
        segments: {
          role_mix: [{ key: "teacher", count: 8 }],
          user_type_mix: [{ key: "web", count: 6 }],
          top_institutions: [{ id: "ec-1", name: "Colegio Norte", users: 10, games: 4, turns: 6, state: "Montevideo", city: "Montevideo" }],
          top_territories: [{ key: "Montevideo / Montevideo", institutions: 1, users: 10, games: 4, turns: 6 }],
          territorial_hierarchy: [{ key: "UY", institutions: 1, users: 10, games: 4, turns: 6, states: [{ key: "Montevideo", institutions: 1, users: 10, games: 4, turns: 6, cities: [{ key: "Montevideo", institutions: 1, users: 10, games: 4, turns: 6 }] }] }],
          territory_alerts: [{ severity: "warning", scope: "city", label: "UY / Montevideo / Montevideo", message: "Foco local" }],
          territory_scores: [{ label: "Montevideo / Montevideo", score: 62, status: "secondary", users: 10, games: 4, turns: 6, reasons: ["Actividad registrada en el período"] }],
        },
      }),
    );

    renderDashboard();

    expect(screen.getByText("Gobierno")).toBeInTheDocument();
    expect(screen.getByText("Mini tendencias")).toBeInTheDocument();
    expect(screen.getByText("Comparativa entre períodos")).toBeInTheDocument();
    expect(screen.getByText("Semáforos operativos")).toBeInTheDocument();
    expect(screen.getByText("Drilldown territorial")).toBeInTheDocument();
    expect(screen.getByText("Alertas por territorio")).toBeInTheDocument();
    expect(screen.getByText("Índice territorial compuesto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exportar CSV ejecutivo/i })).toBeInTheDocument();
    expect(screen.getByText("Territorios con mayor actividad")).toBeInTheDocument();
    expect(screen.getByText("Instituciones destacadas en el territorio")).toBeInTheDocument();
    expect(screen.queryByText("Health")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    expect(useSystemDashboardSummaryMock).toHaveBeenCalledWith(
      "token",
      {
        range: "30d",
        institutionId: null,
        countryCode: null,
        state: null,
        city: null,
        userType: null,
        roleCode: null,
      },
      true,
    );
  });
});
