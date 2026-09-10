import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameDetailPage } from "@/features/games/game-detail-page";

const routerPushMock = vi.fn();
const assignGamePlayerStudentMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Bar: () => <div />,
}));

const useAuthMock = vi.fn();
const useGameMock = vi.fn();
const useGamesMock = vi.fn();
const useDevicesMock = vi.fn();
const useInstitutionsMock = vi.fn();
const useAllStudentsMock = vi.fn();
const assignGamePlayerStudentMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/games/api", () => ({
  useGame: (...args: unknown[]) => useGameMock(...args),
  useGames: (...args: unknown[]) => useGamesMock(...args),
  deleteGame: vi.fn(),
  assignGamePlayerStudent: (...args: unknown[]) => assignGamePlayerStudentMock(...args),
}));

vi.mock("@/features/devices/api", () => ({
  useDevices: (...args: unknown[]) => useDevicesMock(...args),
}));

vi.mock("@/features/institutions/api", () => ({
  useInstitutions: (...args: unknown[]) => useInstitutionsMock(...args),
}));

vi.mock("@/features/students/api", () => ({
  useAllStudents: (...args: unknown[]) => useAllStudentsMock(...args),
}));

function okQuery<T>(data: T) {
  return {
    data,
    isLoading: false,
    error: null,
  };
}

function renderGameDetailPage(initialGameRecordId = "game-1") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const renderTree = (gameRecordId: string) => (
    <QueryClientProvider client={queryClient}>
      <GameDetailPage
        key={gameRecordId}
        gameRecordId={gameRecordId}
        overviewState={{
          q: "animal",
          access: "shared",
          page: 2,
          pageSize: 20,
          ownerUserId: "user-1",
          ownerUserName: "Ines Admin",
        }}
      />
    </QueryClientProvider>
  );
  const renderResult = render(renderTree(initialGameRecordId));

  return {
    ...renderResult,
    rerenderGameDetailPage: (gameRecordId: string) => renderResult.rerender(renderTree(gameRecordId)),
  };
}

describe("GameDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerPushMock.mockReset();
    assignGamePlayerStudentMock.mockReset();
    assignGamePlayerStudentMock.mockResolvedValue({});

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
              {
                id: "player-2",
                gameDataId: "game-1",
                studentId: null,
                externalPlayerUid: "guest-2",
                playerName: "Mateo",
                playerSource: "manual",
                position: 2,
                cardColor: "red",
                createdAt: null,
                updatedAt: null,
                raw: {},
              },
            ],
            turns: Array.from({ length: 11 }, (_, index) => ({
              id: `turn-${index + 1}`,
              gameDataId: "game-1",
              studentId: index % 2 === 0 ? "student-1" : null,
              gamePlayerId: index % 2 === 0 ? "player-1" : "player-2",
              externalPlayerUid: index % 2 === 0 ? null : "guest-2",
              turnNumber: index + 1,
              position: index % 2 === 0 ? 1 : 2,
              cardId: `card-${index + 1}`,
              success: index % 2 === 0,
              difficulty: "medium",
              turnStartDate: null,
              playTimeSeconds: 20 + index,
              createdAt: null,
              updatedAt: null,
              raw: {},
            })),
            raw: {},
          },
          {
            id: "game-2",
            educationalCenterId: "ec-1",
            bleDeviceId: "device-1",
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
          {
            id: "game-3",
            educationalCenterId: "ec-1",
            bleDeviceId: "device-2",
            gameId: 303,
            deckName: "Colores",
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
        limit: 20,
        total: 3,
        total_pages: 1,
      }),
    );
    useGameMock.mockImplementation((_token: string, gameRecordId: string) => {
      const gamesQuery = useGamesMock();
      return okQuery(gamesQuery.data.data.find((game: { id: string }) => game.id === gameRecordId));
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
            ownerUserName: "Ines Admin",
            ownerUserEmail: "admin@example.com",
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
        limit: 20,
        total: 2,
        total_pages: 1,
      }),
    );

    useInstitutionsMock.mockReturnValue(
      okQuery({
        data: [{ id: "ec-1", name: "Colegio Norte", raw: {} }],
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      }),
    );
    useAllStudentsMock.mockReturnValue(okQuery({ data: [], page: 1, limit: 100, total: 0, total_pages: 1 }));
    assignGamePlayerStudentMock.mockResolvedValue({ id: "player-2", studentId: "student-2" });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the dedicated detail page with contextual navigation and chart", () => {
    renderGameDetailPage();

    expect(screen.getAllByRole("heading", { name: /Animales/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Volver a Games/i })).toHaveAttribute(
      "href",
      "/games?q=animal&access=shared&ownerUserId=user-1&ownerUserName=Ines+Admin&page=2&pageSize=20",
    );
    expect(screen.getByText("Aciertos y errores por turno")).toBeInTheDocument();
    expect(screen.getAllByText("Luna").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mateo").length).toBeGreaterThan(0);
    expect(screen.getByText(/6 turnos registrados/i)).toBeInTheDocument();
    expect(screen.getByText(/5 turnos registrados/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver partidas del dispositivo/i })).toHaveAttribute(
      "href",
      "/games?ownerUserId=user-1&ownerUserName=Ines+Admin&bleDeviceId=device-1&deviceId=mb-1&deviceName=MagicBox+Aula+1",
    );
    expect(screen.getByRole("link", { name: /Ver syncs del dispositivo/i })).toHaveAttribute(
      "href",
      "/syncs?bleDeviceId=device-1&deviceId=mb-1&deviceName=MagicBox+Aula+1",
    );
    expect(screen.getByRole("link", { name: /Frutas/i })).toHaveAttribute(
      "href",
      "/games/detail?gameRecordId=game-2&q=animal&access=shared&ownerUserId=user-1&ownerUserName=Ines+Admin&page=2&pageSize=20",
    );
  });

  it("allows an authorized user to assign a student after import", async () => {
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
        permissions: ["game_data:read", "game_data:update"],
        raw: {},
      },
    });
    renderGameDetailPage();

    fireEvent.change(screen.getByRole("combobox", { name: /Asignar alumno a Mateo/i }), {
      target: { value: "student-2" },
    });

    await waitFor(() => {
      expect(assignGamePlayerStudentMock).toHaveBeenCalledWith("token", "game-1", "player-2", "student-2");
    });
  });

  it("paginates the turn list inside the detail page", () => {
    renderGameDetailPage();

    expect(screen.getAllByText(/Mostrando 1-10 de 11/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Siguiente" }).at(-1)!);
    expect(screen.getByText(/Turno 11/i)).toBeInTheDocument();
  });

  it("associates a manual participant with an institution student", async () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-1",
        educationalCenterId: "ec-1",
        roles: ["teacher"],
        permissions: ["game_data:read", "game_data:update", "student:read"],
        raw: {},
      },
    });
    useAllStudentsMock.mockReturnValue(okQuery({
      data: [
        { id: "student-1", fullName: "Luna Pérez", fileNumber: "s_1" },
        { id: "student-2", fullName: "Mateo Silva", fileNumber: "s_2" },
      ],
      page: 1,
      limit: 100,
      total: 2,
      total_pages: 1,
    }));
    renderGameDetailPage();

    fireEvent.change(screen.getByRole("combobox", { name: "Estudiante para participante 2" }), {
      target: { value: "student-2" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Asociar" })[1]);

    await waitFor(() => {
      expect(assignGamePlayerStudentMock).toHaveBeenCalledWith("token", "game-1", "player-2", "student-2");
    });
  });

  it("loads new detail data when the selected game record id changes", () => {
    const { rerenderGameDetailPage } = renderGameDetailPage();

    expect(useGameMock).toHaveBeenCalledWith("token", "game-1");
    expect(screen.getAllByRole("heading", { name: /Animales/i }).length).toBeGreaterThan(0);

    rerenderGameDetailPage("game-2");

    expect(useGameMock).toHaveBeenLastCalledWith("token", "game-2");
    expect(screen.getAllByRole("heading", { name: /Frutas/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/6 turnos registrados/i)).not.toBeInTheDocument();
  });
});
