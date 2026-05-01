import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DevicesTable } from "@/features/devices/devices-table";

const useAuthMock = vi.fn();
const useDevicesMock = vi.fn();
const useInstitutionsMock = vi.fn();
const useUsersMock = vi.fn();
const useGamesMock = vi.fn();
const useSyncSessionsMock = vi.fn();
const routerPushMock = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
  usePathname: () => "/devices",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/devices/api", () => ({
  useDevices: (...args: unknown[]) => useDevicesMock(...args),
  updateDevice: vi.fn(),
  deleteDevice: vi.fn(),
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

function renderDevicesTable() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DevicesTable />
    </QueryClientProvider>,
  );
}

describe("DevicesTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearch = "";

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

    useGamesMock.mockReturnValue(okQuery({ data: [], page: 1, limit: 0, total: 0, total_pages: 0 }));
    useSyncSessionsMock.mockReturnValue(okQuery({ data: [], page: 1, limit: 0, total: 0, total_pages: 0 }));
  });

  afterEach(() => {
    cleanup();
  });

  it("opens the dedicated device detail page preserving the overview context", () => {
    renderDevicesTable();

    expect(screen.getByRole("heading", { name: "Dispositivos" })).toBeInTheDocument();
    expect(screen.getByText(/Institución activa: Colegio Norte/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("MagicBox Aula 1"));

    expect(routerPushMock).toHaveBeenCalledWith("/devices/detail?deviceRecordId=device-1&institutionId=ec-1");
    expect(screen.getByText(/Detalle dedicado del dispositivo/i)).toBeInTheDocument();
  });

  it("filters devices through the operational focus segments", () => {
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
            status: "online",
            deviceMetadata: { serial: "SN-1" },
            createdAt: null,
            updatedAt: null,
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
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );

    renderDevicesTable();

    fireEvent.click(screen.getByRole("button", { name: /Sin responsable/i }));

    expect(screen.queryAllByText("MagicBox Aula 2").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("MagicBox Aula 1")).toHaveLength(0);
  });

  it("activates focus from summary cards and shows the active result chip", () => {
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
            status: "online",
            deviceMetadata: { serial: "SN-1" },
            createdAt: null,
            updatedAt: null,
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
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );

    renderDevicesTable();

    fireEvent.click(screen.getByRole("button", { name: /Ver foco Con responsable/i }));

    expect(screen.getByText(/Enfoque · Con responsable/i)).toBeInTheDocument();
    expect(screen.getByText(/1 de 2 dispositivos con el recorte actual/i)).toBeInTheDocument();
    expect(screen.queryAllByText("MagicBox Aula 1").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("MagicBox Aula 2")).toHaveLength(0);
  });

  it("can open the devices view already filtered by user from the roster link", () => {
    currentSearch = "ownerUserId=user-1&ownerUserName=Ana%20Admin";

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
            deviceMetadata: {},
            createdAt: null,
            updatedAt: null,
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
            ownerUserId: "user-2",
            ownerUserName: "Otro Owner",
            ownerUserEmail: "otro@example.com",
            firmwareVersion: "v2.2",
            status: "active",
            deviceMetadata: {},
            createdAt: null,
            updatedAt: null,
            deletedAt: null,
            raw: {},
          },
        ],
        page: 1,
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );

    renderDevicesTable();

    expect(screen.getByText(/Usuario filtrado: Ana Admin/i)).toBeInTheDocument();
    expect(screen.queryAllByText("MagicBox Aula 1").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("MagicBox Aula 2")).toHaveLength(0);
  });

  it("preserves linked owner filters when opening the dedicated device detail", () => {
    currentSearch = "ownerUserId=user-1&ownerUserName=Ana%20Admin";

    renderDevicesTable();

    fireEvent.click(screen.getByText("MagicBox Aula 1"));

    expect(routerPushMock).toHaveBeenCalledWith(
      "/devices/detail?deviceRecordId=device-1&institutionId=ec-1&ownerUserId=user-1&ownerUserName=Ana+Admin",
    );
  });

  it("clarifies teacher access and visible activity per device", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-1",
        email: "ana@example.com",
        firstName: "Ana",
        lastName: "Teacher",
        fullName: "Ana Teacher",
        educationalCenterId: "ec-1",
        roles: ["teacher"],
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
            ownerUserName: "Ana Teacher",
            ownerUserEmail: "ana@example.com",
            firmwareVersion: "v2.2",
            status: "online",
            deviceMetadata: { serial: "SN-1" },
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

    renderDevicesTable();

    expect(screen.getByText("Teacher")).toBeInTheDocument();
    expect(screen.queryAllByText(/mis dispositivos/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Con actividad/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText("MagicBox Aula 1"));

    expect(routerPushMock).toHaveBeenCalledWith("/devices/detail?deviceRecordId=device-1&institutionId=ec-1");
  });

  it("frames director device review as institutional coordination", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "director-1",
        email: "director@example.com",
        firstName: "Dora",
        lastName: "Director",
        fullName: "Dora Director",
        educationalCenterId: "ec-1",
        roles: ["director"],
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
            ownerUserId: null,
            ownerUserName: null,
            ownerUserEmail: null,
            firmwareVersion: "v2.2",
            status: null,
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

    renderDevicesTable();

    expect(screen.getByText("Director")).toBeInTheDocument();
    expect(screen.getAllByText(/Sin responsable/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Conviene revisar/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("MagicBox Aula 1"));

    expect(routerPushMock).toHaveBeenCalledWith("/devices/detail?deviceRecordId=device-1&institutionId=ec-1");
  });
});
