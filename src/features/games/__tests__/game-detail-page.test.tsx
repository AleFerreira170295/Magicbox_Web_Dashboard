import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameDetailPage } from "@/features/games/game-detail-page";

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

function renderGameDetailPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <GameDetailPage
        gameRecordId="game-1"
        overviewState={{
          q: "animal",
          access: "shared",
          page: 2,
          pageSize: 20,
          ownerUserId: "user-1",
          ownerUserName: "Ines Admin",
        }}
      />
    </QueryClientProvider>,
  );
}

describe("GameDetailPage", () => {
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
            turns: Array.from({ length: 11 }, (_, index) => ({
              id: `turn-${index + 1}`,
              gameDataId: "game-1",
              studentId: "student-1",
              gamePlayerId: "player-1",
              externalPlayerUid: null,
              turnNumber: index + 1,
              position: 1,
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
    expect(screen.getByRole("link", { name: /Ver syncs del dispositivo/i })).toHaveAttribute(
      "href",
      "/syncs?bleDeviceId=device-1&deviceId=mb-1&deviceName=MagicBox+Aula+1",
    );
    expect(screen.getByRole("link", { name: /Frutas/i })).toHaveAttribute(
      "href",
      "/games/detail?gameRecordId=game-2&q=animal&access=shared&ownerUserId=user-1&ownerUserName=Ines+Admin&page=2&pageSize=20",
    );
  });

  it("paginates the turn list inside the detail page", () => {
    renderGameDetailPage();

    expect(screen.getAllByText(/Mostrando 1-10 de 11/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Siguiente" }).at(-1)!);
    expect(screen.getByText(/Turno 11/i)).toBeInTheDocument();
  });
});
