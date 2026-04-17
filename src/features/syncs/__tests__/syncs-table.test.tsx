import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

function errorQuery(message: string) {
  return {
    data: undefined,
    isLoading: false,
    error: new Error(message),
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

  afterEach(() => {
    cleanup();
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

  it("resolves the device name from the devices feed in both table and detail", () => {
    useDevicesMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "device-1",
            deviceId: "mb-1",
            name: "MagicBox Renombrada",
            assignmentScope: "institution",
            raw: {},
          },
        ],
        page: 1,
        limit: 1,
        total: 1,
        total_pages: 1,
      }),
    );

    renderSyncsTable();

    expect(screen.getAllByText("MagicBox Renombrada").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("MagicBox Renombrada"));

    expect(screen.getByText(/Dispositivo: MagicBox Renombrada/i)).toBeInTheDocument();
  });

  it("filters syncs by raw availability", () => {
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
            rawRecordIds: ["raw-1"],
            rawRecordCount: 1,
            lastRawRecordId: "raw-1",
            rawPayload: { fragment: true },
            fragmentCount: 0,
            rawFragmentCount: 0,
            additionalFields: {},
            receivedAt: null,
            createdAt: null,
            updatedAt: null,
            raw: {},
          },
          {
            id: "sync-2",
            userId: "user-2",
            syncId: "mb-sync-2",
            source: "magicbox",
            sourceType: "device",
            sessionType: null,
            status: "done",
            bleDeviceId: "device-2",
            deviceId: "mb-2",
            firmwareVersion: null,
            appVersion: "1.0.0",
            payloadSchemaVersion: "1",
            gameId: null,
            deckName: "Números",
            totalCards: 8,
            totalPlayers: 1,
            durationSeconds: 40,
            score: 80,
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
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );

    renderSyncsTable();

    fireEvent.change(screen.getByDisplayValue("Todas"), { target: { value: "with-raw" } });
    expect(screen.getByText("mb-sync-1")).toBeInTheDocument();
    expect(screen.queryByText("mb-sync-2")).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("Solo con raw"), { target: { value: "without-raw" } });
    expect(screen.getByText("mb-sync-2")).toBeInTheDocument();
    expect(screen.queryByText("mb-sync-1")).not.toBeInTheDocument();
  });

  it("filters syncs by linked user and linked device names", () => {
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
          {
            id: "sync-2",
            userId: "user-2",
            syncId: "mb-sync-2",
            source: "magicbox",
            sourceType: "device",
            sessionType: null,
            status: "done",
            bleDeviceId: "device-2",
            deviceId: "mb-2",
            firmwareVersion: "v2.3",
            appVersion: "1.1.0",
            payloadSchemaVersion: "1",
            gameId: null,
            deckName: "Números",
            totalCards: 8,
            totalPlayers: 1,
            durationSeconds: 40,
            score: 80,
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
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );

    useDevicesMock.mockReturnValue(
      okQuery({
        data: [
          { id: "device-1", deviceId: "mb-1", name: "MagicBox Norte", assignmentScope: "institution", raw: {} },
          { id: "device-2", deviceId: "mb-2", name: "MagicBox Sur", assignmentScope: "institution", raw: {} },
        ],
        page: 1,
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );

    useUsersMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "user-1",
            identityId: null,
            email: "ana@example.com",
            fullName: "Ana Norte",
            firstName: "Ana",
            lastName: "Norte",
            roles: ["teacher"],
            permissions: [],
            userType: "web",
            educationalCenterId: "ec-1",
            status: "active",
            phoneNumber: null,
            address: null,
            imageUrl: null,
            createdAt: null,
            updatedAt: null,
            deletedAt: null,
            lastLoginAt: null,
            raw: {},
          },
          {
            id: "user-2",
            identityId: null,
            email: "bruno@example.com",
            fullName: "Bruno Sur",
            firstName: "Bruno",
            lastName: "Sur",
            roles: ["teacher"],
            permissions: [],
            userType: "web",
            educationalCenterId: "ec-2",
            status: "active",
            phoneNumber: null,
            address: null,
            imageUrl: null,
            createdAt: null,
            updatedAt: null,
            deletedAt: null,
            lastLoginAt: null,
            raw: {},
          },
        ],
        page: 1,
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );

    renderSyncsTable();

    fireEvent.change(screen.getByPlaceholderText(/Filtrar por syncId, origen, mazo, dispositivo o usuario/i), { target: { value: "Bruno Sur" } });
    expect(screen.getByText("mb-sync-2")).toBeInTheDocument();
    expect(screen.queryByText("mb-sync-1")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Filtrar por syncId, origen, mazo, dispositivo o usuario/i), { target: { value: "MagicBox Norte" } });
    expect(screen.getByText("mb-sync-1")).toBeInTheDocument();
    expect(screen.queryByText("mb-sync-2")).not.toBeInTheDocument();
  });

  it("shows an empty-state message when no syncs are visible", () => {
    useSyncSessionsMock.mockReturnValue(
      okQuery({
        data: [],
        page: 1,
        limit: 0,
        total: 0,
        total_pages: 0,
      }),
    );

    renderSyncsTable();

    expect(screen.getByText("No hay sincronizaciones para mostrar.")).toBeInTheDocument();
    expect(screen.getByText("Elegí una sincronización para revisar su detalle.")).toBeInTheDocument();
  });

  it("shows the backend error when sync sessions cannot be loaded", () => {
    useSyncSessionsMock.mockReturnValue(errorQuery("Syncs caídas"));

    renderSyncsTable();

    expect(screen.getByText("Syncs caídas")).toBeInTheDocument();
  });
});
