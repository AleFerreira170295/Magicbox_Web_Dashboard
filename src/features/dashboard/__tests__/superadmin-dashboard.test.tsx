import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
});
