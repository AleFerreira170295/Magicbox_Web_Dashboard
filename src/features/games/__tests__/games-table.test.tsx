import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("anchors the games view to a single institution when the session is institution-scoped", () => {
    renderGamesTable();

    expect(screen.getByText("Institution admin")).toBeInTheDocument();
    expect(screen.getByText(/Institución activa: Colegio Norte/)).toBeInTheDocument();
    expect(screen.getByText(/La tabla queda anclada a la institución visible por ACL/i)).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")[0]).toBeDisabled();
  });
});
