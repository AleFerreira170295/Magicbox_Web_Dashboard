import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TerritorialAlertsCenter } from "@/features/dashboard/territorial-alerts-center";

const useAuthMock = vi.fn();
const useSystemDashboardSummaryMock = vi.fn();
const replaceMock = vi.fn();
const pushMock = vi.fn();
let searchParamsMock = new URLSearchParams("range=30d&focus=critical");

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  usePathname: () => "/territorial-alerts",
  useSearchParams: () => searchParamsMock,
}));

vi.mock("@/features/dashboard/api", () => ({
  useSystemDashboardSummary: (...args: unknown[]) => useSystemDashboardSummaryMock(...args),
}));

function okQuery<T>(data: T) {
  return { data, isLoading: false, error: null };
}

function renderCenter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TerritorialAlertsCenter />
    </QueryClientProvider>,
  );
}

describe("TerritorialAlertsCenter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsMock = new URLSearchParams("range=30d&focus=critical");

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
          selected_country_code: null,
          selected_state: null,
          selected_city: null,
          selected_user_type: null,
          selected_role_code: null,
          range_options: [{ value: "30d", label: "30 días" }],
          institutions: [],
          countries: ["UY"],
          states: ["Montevideo"],
          cities: ["Montevideo"],
          user_types: [],
          role_codes: [],
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
        trends: [],
        comparisons: {
          window_label: "30d",
          current_start: "2026-03-20T00:00:00Z",
          current_end: "2026-04-20T00:00:00Z",
          previous_start: "2026-02-18T00:00:00Z",
          previous_end: "2026-03-20T00:00:00Z",
          metrics: [],
        },
        alerts: [],
        segments: {
          role_mix: [],
          user_type_mix: [],
          top_institutions: [],
          top_territories: [],
          territorial_hierarchy: [],
          territory_alerts: [{ severity: "warning", scope: "city", label: "UY / Montevideo / Centro", message: "Foco territorial inmediato" }],
          territory_scores: [
            { label: "UY / Montevideo / Centro", score: 48, status: "warning", users: 12, games: 4, turns: 1, reasons: ["Baja actividad", "Score crítico"] },
            { label: "UY / Canelones / Pando", score: 57, status: "secondary", users: 10, games: 3, turns: 0, reasons: ["Sin turnos"] },
          ],
        },
      }),
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("renders prioritized territories and dashboard jump links", () => {
    renderCenter();

    expect(screen.getByText("Alertas territoriales")).toBeInTheDocument();
    expect(screen.getByText("Focos priorizados")).toBeInTheDocument();
    expect(screen.getAllByText("UY / Montevideo / Centro").length).toBeGreaterThan(0);
    expect(screen.getByText("Foco territorial inmediato")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Abrir en dashboard/i }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Ir al dashboard ejecutivo/i }));

    expect(pushMock).toHaveBeenCalledWith("/dashboard?range=30d&smart_preset=critical");
  });
});
