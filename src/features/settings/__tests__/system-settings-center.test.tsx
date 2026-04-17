import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SystemSettingsCenter } from "@/features/settings/system-settings-center";

const useAuthMock = vi.fn();
const useBasicHealthMock = vi.fn();
const useReadinessHealthMock = vi.fn();
const useOtaReleaseMock = vi.fn();
const useAccessFeaturesMock = vi.fn();
const useAccessActionsMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({ useAuth: () => useAuthMock() }));
vi.mock("@/features/health/api", () => ({
  useBasicHealth: (...args: unknown[]) => useBasicHealthMock(...args),
  useReadinessHealth: (...args: unknown[]) => useReadinessHealthMock(...args),
}));
vi.mock("@/features/settings/api", () => ({ useOtaRelease: (...args: unknown[]) => useOtaReleaseMock(...args) }));
vi.mock("@/features/access-control/api", () => ({
  useAccessFeatures: (...args: unknown[]) => useAccessFeaturesMock(...args),
  useAccessActions: (...args: unknown[]) => useAccessActionsMock(...args),
}));

function okQuery<T>(data: T) {
  return { data, isLoading: false, error: null };
}

function okPaginated(data: unknown[]) {
  return { data, total: data.length, page: 1, limit: data.length || 1, total_pages: 1 };
}

describe("SystemSettingsCenter", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthMock.mockReturnValue({ tokens: { accessToken: "token" }, user: { email: "admin@example.com", roles: ["admin"], permissions: [] } });
    useBasicHealthMock.mockReturnValue(okQuery({ environment: "local", version: "1.0.0" }));
    useReadinessHealthMock.mockReturnValue(okQuery({ status: "healthy", checks: {} }));
    useOtaReleaseMock.mockReturnValue(okQuery({ configured: false, channel: null }));
    useAccessFeaturesMock.mockReturnValue(okQuery(okPaginated([])));
    useAccessActionsMock.mockReturnValue(okQuery(okPaginated([])));
  });

  it("makes the global runtime scope explicit", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <SystemSettingsCenter />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Configuración global")).toBeInTheDocument();
    expect(screen.getByText("admin global")).toBeInTheDocument();
    expect(screen.getByText(/No funciona como una vista institucional scopeada/i)).toBeInTheDocument();
  });
});
