import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncsTable } from "@/features/syncs/syncs-table";

const useAuthMock = vi.fn();
const useSyncSessionsMock = vi.fn();
const useDevicesMock = vi.fn();
const useUsersMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/syncs/api", () => ({
  useSyncSessions: (...args: unknown[]) => useSyncSessionsMock(...args),
}));

vi.mock("@/features/devices/api", () => ({
  useDevices: (...args: unknown[]) => useDevicesMock(...args),
}));

vi.mock("@/features/users/api", () => ({
  useUsers: (...args: unknown[]) => useUsersMock(...args),
}));

function okQuery<T>(data: T) {
  return {
    data,
    isLoading: false,
    error: null,
  };
}

function renderSyncsTable() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SyncsTable />
    </QueryClientProvider>,
  );
}

describe("SyncsTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useSyncSessionsMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "sync-1",
            userId: "user-1",
            syncId: "mb-sync-1",
            source: "magicbox",
            sourceType: "device",
            sessionType: null,
            status: "done",
            bleDeviceId: "device-1",
            deviceId: "mb-1",
            firmwareVersion: "v2.2",
            appVersion: "1.0.0",
            payloadSchemaVersion: "1",
            gameId: null,
            deckName: "Animales",
            totalCards: 10,
            totalPlayers: 2,
            durationSeconds: 60,
            score: 100,
            finalResult: null,
            gameEndReason: null,
            startedAt: null,
            endedAt: null,
            syncedAt: null,
            capturedAt: null,
            participants: [],
            rawRecordIds: [],
            rawRecordCount: 0,
            lastRawRecordId: null,
            rawPayload: {},
            fragmentCount: 0,
            rawFragmentCount: 0,
            additionalFields: {},
            receivedAt: null,
            createdAt: null,
            updatedAt: null,
            raw: {},
          },
        ],
        page: 1,
        limit: 1,
        total: 1,
        total_pages: 1,
      }),
    );

    useDevicesMock.mockReturnValue(okQuery({ data: [], page: 1, limit: 0, total: 0, total_pages: 0 }));
    useUsersMock.mockReturnValue(okQuery({ data: [], page: 1, limit: 0, total: 0, total_pages: 0 }));
  });

  it("shows personal-history copy when the session lacks BLE operational read", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-1",
        email: "teacher@example.com",
        firstName: "Teo",
        lastName: "Teacher",
        fullName: "Teo Teacher",
        educationalCenterId: "ec-1",
        roles: ["teacher"],
        permissions: ["game_data:read"],
        raw: {},
      },
    });

    renderSyncsTable();

    expect(screen.getByText("Mi actividad")).toBeInTheDocument();
    expect(screen.getByText("historial personal")).toBeInTheDocument();
    expect(screen.getByText(/la tabla queda limitada a tus propias sincronizaciones/i)).toBeInTheDocument();
  });
});
