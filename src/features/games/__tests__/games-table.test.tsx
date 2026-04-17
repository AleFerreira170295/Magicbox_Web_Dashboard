import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GamesTable } from "@/features/games/games-table";

const useAuthMock = vi.fn();
const useGamesMock = vi.fn();
const useDevicesMock = vi.fn();
const useInstitutionsMock = vi.fn();

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

function errorQuery(message: string) {
  return {
    data: undefined,
    isLoading: false,
    error: new Error(message),
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

    useDevicesMock.mockReturnValue(okQuery({ data: [], page: 1, limit: 0, total: 0, total_pages: 0 }));
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

    expect(screen.getByText("Institution admin")).toBeInTheDocument();
    expect(screen.getByText(/Institución activa: Colegio Norte/)).toBeInTheDocument();
    expect(screen.getByText(/La tabla queda anclada a la institución visible por ACL/i)).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")[0]).toBeDisabled();
  });

  it("resolves the device name from the devices feed in both table and detail", () => {
    useDevicesMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "device-1",
            deviceId: "mb-1",
            name: "MagicBox Aula Renombrada",
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

    renderGamesTable();

    expect(screen.getAllByText("MagicBox Aula Renombrada").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("MagicBox Aula Renombrada"));

    expect(screen.getByText(/Dispositivo: MagicBox Aula Renombrada/i)).toBeInTheDocument();
  });

  it("shows the full turn timeline with hits and errors in the detail panel", () => {
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
              { id: "p1", playerName: "Ana", playerSource: "registered" },
              { id: "p2", playerName: "Beto", playerSource: "manual" },
            ],
            turns: Array.from({ length: 8 }, (_, index) => ({
              id: `turn-${index + 1}`,
              gameDataId: "game-1",
              turnNumber: index + 1,
              position: index + 1,
              success: index % 3 !== 0,
              playTimeSeconds: index + 2,
              difficulty: index % 2 === 0 ? "easy" : "hard",
              cardId: `card-${index + 1}`,
              externalPlayerUid: index % 2 === 0 ? "Ana" : "Beto",
              raw: {},
            })),
            raw: {},
          },
        ],
        page: 1,
        limit: 1,
        total: 1,
        total_pages: 1,
      }),
    );

    renderGamesTable();

    fireEvent.click(screen.getByText("101"));

    expect(screen.getByText("Historial completo de jugadas")).toBeInTheDocument();
    expect(screen.getByText("Aciertos 5")).toBeInTheDocument();
    expect(screen.getByText("Errores 3")).toBeInTheDocument();
    expect(screen.getByText("Turno 1")).toBeInTheDocument();
    expect(screen.getByText("Turno 8")).toBeInTheDocument();
    expect(screen.getByText(/Carta: card-8/i)).toBeInTheDocument();
    expect(screen.getAllByText(/error/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/acierto/i).length).toBeGreaterThan(0);
  });

  it("filters games by player mode", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-1",
        email: "admin@example.com",
        firstName: "Ines",
        lastName: "Admin",
        fullName: "Ines Admin",
        educationalCenterId: null,
        roles: ["admin"],
        permissions: ["game_data:read"],
        raw: {},
      },
    });

    useInstitutionsMock.mockReturnValue(
      okQuery({
        data: [
          { id: "ec-1", name: "Colegio Norte", raw: {} },
          { id: "ec-2", name: "Colegio Sur", raw: {} },
        ],
        page: 1,
        limit: 2,
        total: 2,
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
            gameId: 101,
            deckName: "Animales",
            totalPlayers: 2,
            startDate: null,
            createdAt: null,
            updatedAt: null,
            players: [
              { id: "p1", playerName: "Ana", playerSource: "registered" },
              { id: "p2", playerName: "Beto", playerSource: "registered" },
            ],
            turns: [],
            raw: {},
          },
          {
            id: "game-2",
            educationalCenterId: "ec-2",
            bleDeviceId: "device-2",
            gameId: 202,
            deckName: "Números",
            totalPlayers: 2,
            startDate: null,
            createdAt: null,
            updatedAt: null,
            players: [
              { id: "p3", playerName: "Cami", playerSource: "manual" },
              { id: "p4", playerName: "Dani", playerSource: "manual" },
            ],
            turns: [],
            raw: {},
          },
          {
            id: "game-3",
            educationalCenterId: "ec-2",
            bleDeviceId: "device-2",
            gameId: 303,
            deckName: "Colores",
            totalPlayers: 2,
            startDate: null,
            createdAt: null,
            updatedAt: null,
            players: [
              { id: "p5", playerName: "Eva", playerSource: "manual" },
              { id: "p6", playerName: "Fede", playerSource: "registered" },
            ],
            turns: [],
            raw: {},
          },
        ],
        page: 1,
        limit: 3,
        total: 3,
        total_pages: 1,
      }),
    );

    renderGamesTable();

    fireEvent.change(screen.getByDisplayValue("Todos los modos"), { target: { value: "mixed" } });
    expect(screen.getByText("303")).toBeInTheDocument();
    expect(screen.queryByText("101")).not.toBeInTheDocument();
    expect(screen.queryByText("202")).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("Mixtos"), { target: { value: "manual" } });
    expect(screen.getByText("202")).toBeInTheDocument();
    expect(screen.queryByText("101")).not.toBeInTheDocument();
    expect(screen.queryByText("303")).not.toBeInTheDocument();
  });

  it("filters games by linked player and device names", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-1",
        email: "admin@example.com",
        firstName: "Ines",
        lastName: "Admin",
        fullName: "Ines Admin",
        educationalCenterId: null,
        roles: ["admin"],
        permissions: ["game_data:read"],
        raw: {},
      },
    });

    useInstitutionsMock.mockReturnValue(
      okQuery({
        data: [
          { id: "ec-1", name: "Colegio Norte", raw: {} },
          { id: "ec-2", name: "Colegio Sur", raw: {} },
        ],
        page: 1,
        limit: 2,
        total: 2,
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
            gameId: 101,
            deckName: "Animales",
            totalPlayers: 1,
            startDate: null,
            createdAt: null,
            updatedAt: null,
            players: [{ id: "p1", playerName: "Ana Norte", playerSource: "registered" }],
            turns: [],
            raw: {},
          },
          {
            id: "game-2",
            educationalCenterId: "ec-2",
            bleDeviceId: "device-2",
            gameId: 202,
            deckName: "Números",
            totalPlayers: 1,
            startDate: null,
            createdAt: null,
            updatedAt: null,
            players: [{ id: "p2", playerName: "Bruno Sur", playerSource: "manual" }],
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
          { id: "device-1", deviceId: "mb-1", name: "MagicBox Norte", assignmentScope: "institution", raw: {} },
          { id: "device-2", deviceId: "mb-2", name: "MagicBox Sur", assignmentScope: "institution", raw: {} },
        ],
        page: 1,
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );

    renderGamesTable();

    fireEvent.change(screen.getByPlaceholderText(/Filtrar por mazo, gameId, institución, dispositivo o jugador/i), { target: { value: "Bruno Sur" } });
    expect(screen.getByText("202")).toBeInTheDocument();
    expect(screen.queryByText("101")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Filtrar por mazo, gameId, institución, dispositivo o jugador/i), { target: { value: "MagicBox Norte" } });
    expect(screen.getByText("101")).toBeInTheDocument();
    expect(screen.queryByText("202")).not.toBeInTheDocument();
  });

  it("shows an empty-state message when no games are visible", () => {
    useGamesMock.mockReturnValue(
      okQuery({
        data: [],
        page: 1,
        limit: 0,
        total: 0,
        total_pages: 0,
      }),
    );

    renderGamesTable();

    expect(screen.getByText("No hay partidas para mostrar.")).toBeInTheDocument();
    expect(screen.getByText("Elegí una partida para revisar su detalle operativo.")).toBeInTheDocument();
  });

  it("shows the backend error when games cannot be loaded", () => {
    useGamesMock.mockReturnValue(errorQuery("Games caídas"));

    renderGamesTable();

    expect(screen.getByText("Games caídas")).toBeInTheDocument();
  });
});
