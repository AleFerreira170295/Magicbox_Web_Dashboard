import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncsTable } from "@/features/syncs/syncs-table";

const useAuthMock = vi.fn();
const useSyncSessionsMock = vi.fn();
const useDevicesMock = vi.fn();
const useUsersMock = vi.fn();
const useGamesMock = vi.fn();
const routerPushMock = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
  usePathname: () => "/syncs",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/syncs/api", () => ({
  useSyncSessions: (...args: unknown[]) => useSyncSessionsMock(...args),
}));

vi.mock("@/features/devices/api", () => ({
  useDevices: (...args: unknown[]) => useDevicesMock(...args),
}));

vi.mock("@/features/games/api", () => ({
  useGames: (...args: unknown[]) => useGamesMock(...args),
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
    currentSearch = "";

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

    useDevicesMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "device-1",
            deviceId: "mb-1",
            name: "MagicBox Aula 1",
            educationalCenterId: "ec-1",
            educationalCenterName: "Colegio Norte",
            assignmentScope: "institution",
            ownerUserId: "user-1",
            ownerUserName: "Teo Teacher",
            ownerUserEmail: "teacher@example.com",
            firmwareVersion: "v2.2",
            status: "online",
            deviceMetadata: {},
            createdAt: null,
            updatedAt: null,
            deletedAt: null,
            raw: {},
          },
        ],
        page: 1,
        limit: 1,
        total: 1,
        total_pages: 1,
      }),
    );
    useUsersMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "user-1",
            identityId: null,
            email: "teacher@example.com",
            fullName: "Teo Teacher",
            firstName: "Teo",
            lastName: "Teacher",
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
        ],
        page: 1,
        limit: 1,
        total: 1,
        total_pages: 1,
      }),
    );
    useGamesMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "game-1",
            educationalCenterId: "ec-1",
            bleDeviceId: "device-1",
            gameId: 201,
            deckName: "Animales",
            totalPlayers: 2,
            startDate: null,
            createdAt: null,
            updatedAt: null,
            players: [],
            turns: [],
            raw: {},
          },
        ],
        page: 1,
        limit: 1,
        total: 1,
        total_pages: 1,
      }),
    );
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

    expect(screen.getByText("Teacher")).toBeInTheDocument();
    expect(screen.queryAllByText("historial personal").length).toBeGreaterThan(0);
    expect(screen.getByText(/la tabla queda limitada a tus propias sincronizaciones/i)).toBeInTheDocument();
  });

  it("adapts operational sync reading to a teacher-oriented framing", () => {
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
        permissions: ["ble_device:read"],
        raw: {},
      },
    });

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
            gameId: 201,
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
            participants: [{ id: "participant-1", profileId: "profile-1", profileName: "Luna", playerName: "Luna", cardUid: "card-1", position: 1, studentId: "student-1", externalPlayerUid: null, raw: {} }],
            rawRecordIds: ["raw-1"],
            rawRecordCount: 1,
            lastRawRecordId: null,
            rawPayload: { hello: "world" },
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

    renderSyncsTable();

    expect(screen.getByText("Teacher")).toBeInTheDocument();
    expect(screen.getByText(/pensada para conectar captura, participantes y dispositivo/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText("mb-sync-1"));

    expect(screen.getByText(/Detalle para aula/i)).toBeInTheDocument();
    expect(screen.getByText(/Participantes y contexto de aula/i)).toBeInTheDocument();
    expect(screen.getByText(/Señales útiles para aula/i)).toBeInTheDocument();
  });

  it("shows access association and readable sync detail when BLE read is available", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-1",
        email: "teacher@example.com",
        firstName: "Ines",
        lastName: "Admin",
        fullName: "Ines Admin",
        educationalCenterId: "ec-1",
        roles: ["institution-admin"],
        permissions: ["ble_device:read"],
        raw: {},
      },
    });

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
            gameId: 201,
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
            participants: [{ id: "participant-1", profileId: "profile-1", profileName: "Luna", playerName: "Luna", cardUid: "card-1", position: 1, studentId: "student-1", externalPlayerUid: null, raw: {} }],
            rawRecordIds: ["raw-1"],
            rawRecordCount: 1,
            lastRawRecordId: null,
            rawPayload: { hello: "world" },
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

    renderSyncsTable();

    fireEvent.click(screen.getByText("mb-sync-1"));

    expect(screen.queryAllByText(/mis dispositivos/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Partida correlacionada: Animales/i)).toBeInTheDocument();
    expect(screen.getByText("Participantes y asociaciones")).toBeInTheDocument();
    expect(screen.getByText("Cruces rápidos")).toBeInTheDocument();
    expect(screen.queryAllByText("Luna").length).toBeGreaterThan(0);
    expect(screen.getByText(/match con partida:/i)).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Abrir partida correlacionada/i })).toHaveAttribute(
      "href",
      "/games/detail?gameRecordId=game-1&ownerUserId=user-1&ownerUserName=Teo+Teacher&bleDeviceId=device-1&deviceId=mb-1&deviceName=MagicBox+Aula+1",
    );
    expect(screen.getByRole("link", { name: /Ver partidas del dispositivo/i })).toHaveAttribute(
      "href",
      "/games?ownerUserId=user-1&ownerUserName=Teo+Teacher&bleDeviceId=device-1&deviceId=mb-1&deviceName=MagicBox+Aula+1",
    );

    fireEvent.click(screen.getByRole("button", { name: /Quitar selección/i }));

    expect(screen.getByText(/Elegí una sincronización para revisar su detalle./i)).toBeInTheDocument();
  });

  it("adapts copy for researcher sessions while preserving evidence detail", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-1",
        email: "teacher@example.com",
        firstName: "Rita",
        lastName: "Researcher",
        fullName: "Rita Researcher",
        educationalCenterId: "ec-1",
        roles: ["researcher"],
        permissions: ["ble_device:read"],
        raw: {},
      },
    });

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
            gameId: 201,
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
            participants: [{ id: "participant-1", profileId: "profile-1", profileName: "Luna", playerName: "Luna", cardUid: "card-1", position: 1, studentId: "student-1", externalPlayerUid: null, raw: {} }],
            rawRecordIds: ["raw-1"],
            rawRecordCount: 1,
            lastRawRecordId: null,
            rawPayload: { hello: "world" },
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

    renderSyncsTable();

    expect(screen.getByText("Researcher")).toBeInTheDocument();
    expect(screen.getByText(/pensada para leer cobertura de captura/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText("mb-sync-1"));

    expect(screen.getByText("Detalle de evidencia")).toBeInTheDocument();
    expect(screen.getByText("Participantes y asociaciones clave")).toBeInTheDocument();
    expect(screen.getByText("Señales de evidencia")).toBeInTheDocument();
  });

  it("adapts the syncs view to a simplified family reading", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-1",
        email: "family@example.com",
        firstName: "Fiona",
        lastName: "Family",
        fullName: "Fiona Family",
        educationalCenterId: "ec-1",
        roles: ["family"],
        permissions: ["ble_device:read"],
        raw: {},
      },
    });

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
            gameId: 201,
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
            participants: [{ id: "participant-1", profileId: "profile-1", profileName: "Luna", playerName: "Luna", cardUid: "card-1", position: 1, studentId: "student-1", externalPlayerUid: null, raw: {} }],
            rawRecordIds: ["raw-1"],
            rawRecordCount: 1,
            lastRawRecordId: null,
            rawPayload: { hello: "world" },
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

    renderSyncsTable();

    expect(screen.getByText("Family")).toBeInTheDocument();
    expect(screen.getByText(/seguir la actividad de sincronización reciente/i)).toBeInTheDocument();
    expect(screen.queryByText("Todos los accesos")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("mb-sync-1"));

    expect(screen.getByText("Resumen de sincronización")).toBeInTheDocument();
    expect(screen.getAllByText("Participantes").length).toBeGreaterThan(0);
    expect(screen.getByText("Señales de sincronización")).toBeInTheDocument();
  });

  it("can open the syncs view already filtered by device from devices", () => {
    currentSearch = "bleDeviceId=device-1&deviceId=mb-1&deviceName=MagicBox%20Aula%201";

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
            userId: "user-1",
            syncId: "mb-sync-2",
            source: "magicbox",
            sourceType: "device",
            sessionType: null,
            status: "done",
            bleDeviceId: "device-2",
            deviceId: "mb-2",
            firmwareVersion: "v2.2",
            appVersion: "1.0.0",
            payloadSchemaVersion: "1",
            gameId: null,
            deckName: "Colores",
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
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );

    renderSyncsTable();

    expect(screen.getByText(/Dispositivo filtrado: MagicBox Aula 1/i)).toBeInTheDocument();
    expect(screen.queryAllByText("mb-sync-1").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("mb-sync-2")).toHaveLength(0);
  });
});
