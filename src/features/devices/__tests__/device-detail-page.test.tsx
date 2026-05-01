import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceDetailPage } from "@/features/devices/device-detail-page";

const useAuthMock = vi.fn();
const useDevicesMock = vi.fn();
const useInstitutionsMock = vi.fn();
const useUsersMock = vi.fn();
const useGamesMock = vi.fn();
const useSyncSessionsMock = vi.fn();
const routerPushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/devices/api", () => ({
  useDevices: (...args: unknown[]) => useDevicesMock(...args),
  deleteDevice: vi.fn(),
  updateDevice: vi.fn(),
}));

vi.mock("@/features/institutions/api", () => ({
  useInstitutions: (...args: unknown[]) => useInstitutionsMock(...args),
}));

vi.mock("@/features/games/api", () => ({
  useGames: (...args: unknown[]) => useGamesMock(...args),
}));

vi.mock("@/features/syncs/api", () => ({
  useSyncSessions: (...args: unknown[]) => useSyncSessionsMock(...args),
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

function renderDeviceDetailPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DeviceDetailPage
        deviceRecordId="device-1"
        overviewState={{
          q: "magicbox",
          institutionId: "ec-1",
          scope: "institution",
          access: "all",
          focus: "with_activity",
          ownerUserId: "user-1",
          ownerUserName: "Ana Admin",
          page: 2,
          pageSize: 20,
        }}
      />
    </QueryClientProvider>,
  );
}

describe("DeviceDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-current",
        email: "diego@example.com",
        firstName: "Diego",
        lastName: "Pereyra",
        fullName: "Diego Pereyra",
        educationalCenterId: "ec-1",
        roles: ["institution-admin"],
        permissions: ["ble_device:read"],
        raw: {},
      },
    });

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
            ownerUserName: "Ana Admin",
            ownerUserEmail: "ana@example.com",
            firmwareVersion: "v2.2",
            status: "active",
            deviceMetadata: { serial: "SN-1" },
            createdAt: null,
            updatedAt: "2026-05-01T12:00:00.000Z",
            deletedAt: null,
            raw: {},
          },
          {
            id: "device-2",
            deviceId: "mb-2",
            name: "MagicBox Aula 2",
            educationalCenterId: "ec-1",
            educationalCenterName: "Colegio Norte",
            assignmentScope: "institution",
            ownerUserId: "user-1",
            ownerUserName: "Ana Admin",
            ownerUserEmail: "ana@example.com",
            firmwareVersion: "v2.1",
            status: "online",
            deviceMetadata: { serial: "SN-2" },
            createdAt: null,
            updatedAt: null,
            deletedAt: null,
            raw: {},
          },
          {
            id: "device-3",
            deviceId: "mb-home-1",
            name: "MagicBox Casa",
            educationalCenterId: null,
            educationalCenterName: null,
            assignmentScope: "home",
            ownerUserId: null,
            ownerUserName: null,
            ownerUserEmail: null,
            firmwareVersion: null,
            status: null,
            deviceMetadata: {},
            createdAt: null,
            updatedAt: null,
            deletedAt: null,
            raw: {},
          },
        ],
        page: 1,
        limit: 3,
        total: 3,
        total_pages: 1,
      }),
    );

    useInstitutionsMock.mockReturnValue(
      okQuery({
        data: [{ id: "ec-1", name: "Colegio Norte", raw: {} }],
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
            email: "ana@example.com",
            fullName: "Ana Admin",
            firstName: "Ana",
            lastName: "Admin",
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
            gameId: 301,
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
            gameId: 301,
            deckName: "Animales",
            totalCards: 10,
            totalPlayers: 2,
            durationSeconds: 60,
            score: 100,
            finalResult: null,
            gameEndReason: null,
            startedAt: null,
            endedAt: null,
            syncedAt: "2026-04-22T03:00:00.000Z",
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
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a dedicated detail screen with preserved contextual links", () => {
    renderDeviceDetailPage();

    expect(screen.getAllByRole("heading", { name: "MagicBox Aula 1" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Volver a dispositivos/i })).toHaveAttribute(
      "href",
      "/devices?q=magicbox&institutionId=ec-1&scope=institution&focus=with_activity&ownerUserId=user-1&ownerUserName=Ana+Admin&page=2&pageSize=20",
    );

    expect(screen.getByRole("link", { name: /Ver partidas del dispositivo/i })).toHaveAttribute(
      "href",
      "/games?bleDeviceId=device-1&deviceId=mb-1&deviceName=MagicBox+Aula+1",
    );
    expect(screen.getByRole("link", { name: /Ver syncs del dispositivo/i })).toHaveAttribute(
      "href",
      "/syncs?bleDeviceId=device-1&deviceId=mb-1&deviceName=MagicBox+Aula+1",
    );
    expect(screen.getAllByText("MagicBox Aula 2")[0]?.closest("a")).toHaveAttribute(
      "href",
      "/devices/detail?deviceRecordId=device-2&q=magicbox&institutionId=ec-1&scope=institution&focus=with_activity&ownerUserId=user-1&ownerUserName=Ana+Admin&page=2&pageSize=20",
    );
  });

  it("keeps the editor in read-only mode when update permission is missing", () => {
    renderDeviceDetailPage();

    expect(screen.getByRole("heading", { name: /Detalle y edición/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edición bloqueada/i })).toBeDisabled();
    expect(screen.getByText(/Cruces rápidos/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Dispositivos relacionados/i })).toBeInTheDocument();
  });
});
