import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  afterEach(() => {
    cleanup();
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

  it("renders effective runtime, ota and ACL catalog values for admin review", () => {
    useReadinessHealthMock.mockReturnValue(okQuery({ status: "degraded", checks: { api: { status: "healthy" }, redis: { status: "degraded" } } }));
    useOtaReleaseMock.mockReturnValue(
      okQuery({
        configured: true,
        channel: "production",
        latestVersion: "2.4.0",
        minimumSupportedVersion: "2.3.0",
        notes: "Hotfix rollout",
      }),
    );
    useAccessFeaturesMock.mockReturnValue(
      okQuery(
        okPaginated([
          { id: "feature-1", code: "access_control", name: "Access control", createdAt: null, updatedAt: null, raw: {} },
          { id: "feature-2", code: "ble_device", name: "BLE Device", createdAt: null, updatedAt: null, raw: {} },
        ]),
      ),
    );
    useAccessActionsMock.mockReturnValue(
      okQuery(
        okPaginated([
          { id: "action-1", code: "read", name: "Read", description: "Leer", createdAt: null, updatedAt: null, raw: {} },
          { id: "action-2", code: "update", name: "Update", description: "Editar", createdAt: null, updatedAt: null, raw: {} },
        ]),
      ),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <SystemSettingsCenter />
      </QueryClientProvider>,
    );

    expect(screen.getByText("degraded")).toBeInTheDocument();
    expect(screen.getByText("sí")).toBeInTheDocument();
    expect(screen.getAllByText(/Canal production/i).length).toBeGreaterThan(0);
    expect(screen.getByText("2.4.0")).toBeInTheDocument();
    expect(screen.getByText("2.3.0")).toBeInTheDocument();
    expect(screen.getByText("Hotfix rollout")).toBeInTheDocument();
    expect(screen.getByText(/2 features y 2 acciones visibles/i)).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === "Features visibles: access_control, ble_device." )).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === "Actions visibles: read, update." )).toBeInTheDocument();
  });
});
