import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GamesTable } from "@/features/games/games-table";

const useAuthMock = vi.fn();
const useGamesMock = vi.fn();
const useDevicesMock = vi.fn();
const useInstitutionsMock = vi.fn();
const routerPushMock = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
  usePathname: () => "/games",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/games/api", () => ({
  useGames: (...args: unknown[]) => useGamesMock(...args),
}));

vi.mock("@/features/devices/api", () => ({
  useDevices: (...args: unknown[]) => useDevicesMock(...args),
}));

vi.mock("@/features/institutions/api", () => ({
  useInstitutions: (...args: unknown[]) => useInstitutionsMock(...args),
}));

function okQuery<T>(data: T) {
  return {
    data,
    isLoading: false,
    error: null,
  };
}

function renderGamesTable() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <GamesTable />
    </QueryClientProvider>,
  );
}

describe("GamesTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearch = "";

    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-1",
        email: "admin@example.com",
        firstName: "Ines",
        lastName: "Admin",
        fullName: "Ines Admin",
        educationalCenterId: "ec-1",
        roles: ["institution-admin"],
        permissions: ["game_data:read"],
        raw: {},
      },
    });

    useGamesMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "game-1",
            educationalCenterId: "ec-1",
            bleDeviceId: "device-1",
            gameId: 101,
            deckName: "Animales",
            totalPlayers: 2,
            startDate: null,
            createdAt: null,
            updatedAt: null,
            players: [
              {
                id: "player-1",
                gameDataId: "game-1",
                studentId: "student-1",
                externalPlayerUid: null,
                playerName: "Luna",
                playerSource: "registered",
                position: 1,
                cardColor: "blue",
                createdAt: null,
                updatedAt: null,
                raw: {},
              },
            ],
            turns: [
              {
                id: "turn-1",
                gameDataId: "game-1",
                studentId: "student-1",
                gamePlayerId: "player-1",
                externalPlayerUid: null,
                turnNumber: 3,
                position: 1,
                cardId: "card-1",
                success: true,
                difficulty: "medium",
                turnStartDate: null,
                playTimeSeconds: 45,
                createdAt: null,
                updatedAt: null,
                raw: {},
              },
            ],
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
            ownerUserName: "Ines Admin",
            ownerUserEmail: "admin@example.com",
            firmwareVersion: null,
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
    useInstitutionsMock.mockReturnValue(
      okQuery({
        data: [{ id: "ec-1", name: "Colegio Norte", raw: {} }],
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

  it("anchors the games view to a single institution when the session is institution-scoped", () => {
    renderGamesTable();

    expect(screen.getByRole("heading", { name: "Partidas" })).toBeInTheDocument();
    expect(screen.getByText(/Institución activa: Colegio Norte/)).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")[0]).toBeDisabled();
  });

  it("shows access association context and expanded game detail", () => {
    renderGamesTable();

    fireEvent.click(screen.getByText("101"));

    expect(screen.queryAllByText(/mis dispositivos/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Owner del dispositivo: Ines Admin/i)).toBeInTheDocument();
    expect(screen.getByText("Jugadores y asociaciones")).toBeInTheDocument();
    expect(screen.queryAllByText("Luna").length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/medium/i).length).toBeGreaterThan(0);
  });

  it("can open the games view already filtered by user from the roster link", () => {
    currentSearch = "ownerUserId=user-1&ownerUserName=Ines%20Admin";

    useGamesMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "game-1",
            educationalCenterId: "ec-1",
            bleDeviceId: "device-1",
            gameId: 101,
            deckName: "Animales",
            totalPlayers: 2,
            startDate: null,
            createdAt: null,
            updatedAt: null,
            players: [],
            turns: [],
            raw: {},
          },
          {
            id: "game-2",
            educationalCenterId: "ec-1",
            bleDeviceId: "device-2",
            gameId: 202,
            deckName: "Frutas",
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
        limit: 2,
        total: 2,
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
            ownerUserName: "Ines Admin",
            ownerUserEmail: "admin@example.com",
            firmwareVersion: null,
            status: "online",
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
            firmwareVersion: null,
            status: "online",
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

    renderGamesTable();

    expect(screen.getByText(/Usuario filtrado: Ines Admin/i)).toBeInTheDocument();
    expect(screen.queryAllByText("101").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("202")).toHaveLength(0);
  });

  it("adapts copy for researcher sessions without changing the evidence detail", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-9",
        email: "research@example.com",
        firstName: "Rita",
        lastName: "Researcher",
        fullName: "Rita Researcher",
        educationalCenterId: "ec-1",
        roles: ["researcher"],
        permissions: ["game_data:read"],
        raw: {},
      },
    });

    renderGamesTable();

    expect(screen.getByText("Researcher")).toBeInTheDocument();
    expect(screen.getByText(/pensada para leer composición de muestra/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText("101"));

    expect(screen.getByText("Detalle de evidencia")).toBeInTheDocument();
    expect(screen.getByText("Participantes y asociaciones visibles")).toBeInTheDocument();
    expect(screen.queryAllByText("Turnos observables").length).toBeGreaterThan(0);
  });

  it("adapts the games view to a teacher-oriented classroom reading", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-teacher",
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

    renderGamesTable();

    expect(screen.getByText("Teacher")).toBeInTheDocument();
    expect(screen.getByText(/priorizando qué se jugó, con quién y desde qué dispositivo/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText("101"));

    expect(screen.getByText(/Detalle para aula/i)).toBeInTheDocument();
    expect(screen.getByText(/Participantes y contexto de aula/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Ritmo visible/i).length).toBeGreaterThan(0);
  });

  it("adapts the games view to a simplified family reading", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-family",
        email: "family@example.com",
        firstName: "Fiona",
        lastName: "Family",
        fullName: "Fiona Family",
        educationalCenterId: "ec-1",
        roles: ["family"],
        permissions: ["game_data:read"],
        raw: {},
      },
    });

    renderGamesTable();

    expect(screen.getByText("Family")).toBeInTheDocument();
    expect(screen.getByText(/pensada para entender sesiones, participantes y ritmo general/i)).toBeInTheDocument();
    expect(screen.queryByText("Todos los accesos")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("101"));

    expect(screen.getByText("Resumen de partida")).toBeInTheDocument();
    expect(screen.getByText("Participantes visibles")).toBeInTheDocument();
    expect(screen.getByText("Momentos recientes")).toBeInTheDocument();
  });
});
