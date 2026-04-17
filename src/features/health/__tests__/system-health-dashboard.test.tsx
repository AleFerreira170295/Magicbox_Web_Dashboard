import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SystemHealthDashboard } from "@/features/health/system-health-dashboard";

const useAuthMock = vi.fn();
const useBasicHealthMock = vi.fn();
const useReadinessHealthMock = vi.fn();
const useLivenessHealthMock = vi.fn();
const useDevicesMock = vi.fn();
const useSyncSessionsMock = vi.fn();
const useGamesMock = vi.fn();
const useProfilesOverviewMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({ useAuth: () => useAuthMock() }));
vi.mock("@/features/health/api", () => ({
  useBasicHealth: (...args: unknown[]) => useBasicHealthMock(...args),
  useReadinessHealth: (...args: unknown[]) => useReadinessHealthMock(...args),
  useLivenessHealth: (...args: unknown[]) => useLivenessHealthMock(...args),
}));
vi.mock("@/features/devices/api", () => ({ useDevices: (...args: unknown[]) => useDevicesMock(...args) }));
vi.mock("@/features/syncs/api", () => ({ useSyncSessions: (...args: unknown[]) => useSyncSessionsMock(...args) }));
vi.mock("@/features/games/api", () => ({ useGames: (...args: unknown[]) => useGamesMock(...args) }));
vi.mock("@/features/profiles/api", () => ({ useProfilesOverview: (...args: unknown[]) => useProfilesOverviewMock(...args) }));

function okQuery<T>(data: T) {
  return { data, isLoading: false, error: null };
}

function okPaginated(data: unknown[]) {
  return { data, total: data.length, page: 1, limit: data.length || 1, total_pages: 1 };
}

describe("SystemHealthDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthMock.mockReturnValue({ tokens: { accessToken: "token" }, user: { email: "admin@example.com", roles: ["admin"] } });
    useBasicHealthMock.mockReturnValue(okQuery({ status: "healthy", timestamp: null }));
    useReadinessHealthMock.mockReturnValue(okQuery({ status: "healthy", checks: {} }));
    useLivenessHealthMock.mockReturnValue(okQuery({ uptime: "1h" }));
    useDevicesMock.mockReturnValue(okQuery(okPaginated([])));
    useSyncSessionsMock.mockReturnValue(okQuery(okPaginated([])));
    useGamesMock.mockReturnValue(okQuery(okPaginated([])));
    useProfilesOverviewMock.mockReturnValue(okQuery([]));
  });

  it("makes the global-only admin scope explicit", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <SystemHealthDashboard />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Salud global")).toBeInTheDocument();
    expect(screen.getByText("admin global")).toBeInTheDocument();
    expect(screen.getByText(/No representa una vista scopeada por institución/i)).toBeInTheDocument();
  });
});
