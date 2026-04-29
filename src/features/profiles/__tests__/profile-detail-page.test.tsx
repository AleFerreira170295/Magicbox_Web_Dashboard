import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileDetailPage } from "@/features/profiles/profile-detail-page";

const useAuthMock = vi.fn();
const useProfilesOverviewMock = vi.fn();
const useInstitutionsMock = vi.fn();
const useClassGroupsMock = vi.fn();
const useStudentsMock = vi.fn();
const useGamesMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/profiles/api", () => ({
  useProfilesOverview: (...args: unknown[]) => useProfilesOverviewMock(...args),
}));

vi.mock("@/features/institutions/api", () => ({
  useInstitutions: (...args: unknown[]) => useInstitutionsMock(...args),
}));

vi.mock("@/features/class-groups/api", () => ({
  useClassGroups: (...args: unknown[]) => useClassGroupsMock(...args),
}));

vi.mock("@/features/students/api", () => ({
  useStudents: (...args: unknown[]) => useStudentsMock(...args),
}));

vi.mock("@/features/games/api", () => ({
  useGames: (...args: unknown[]) => useGamesMock(...args),
}));

function okQuery<T>(data: T) {
  return {
    data,
    isLoading: false,
    error: null,
  };
}

function renderProfileDetailPage(props: { kind: string; entityId: string; institutionId?: string | null; classGroupId?: string | null }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileDetailPage {...props} />
    </QueryClientProvider>,
  );
}

describe("ProfileDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
    });

    useProfilesOverviewMock.mockReturnValue(
      okQuery([
        {
          id: "profile-1",
          displayName: "Tomi",
          avatarUrl: null,
          age: 7,
          ageCategory: "6-8",
          isActive: true,
          userId: "user-1",
          userName: "Ana Owner",
          userEmail: "ana@example.com",
          educationalCenterId: "ec-1",
          educationalCenterName: "Colegio Norte",
          bindingCount: 1,
          activeBindingCount: 1,
          cardUids: ["card-1"],
          boundDevices: [{ id: "device-bind-1", name: "MB-01", deviceId: "mb-01" }],
          sessionCount: 3,
          lastSessionAt: "2026-04-29T12:00:00Z",
          createdAt: null,
          updatedAt: "2026-04-29T13:00:00Z",
          deletedAt: null,
          raw: {},
        },
        {
          id: "profile-2",
          displayName: "Mora",
          avatarUrl: null,
          age: 8,
          ageCategory: "6-8",
          isActive: true,
          userId: "user-2",
          userName: "Bruno Owner",
          userEmail: "bruno@example.com",
          educationalCenterId: "ec-1",
          educationalCenterName: "Colegio Norte",
          bindingCount: 1,
          activeBindingCount: 1,
          cardUids: ["card-2"],
          boundDevices: [],
          sessionCount: 1,
          lastSessionAt: "2026-04-28T09:00:00Z",
          createdAt: null,
          updatedAt: "2026-04-28T09:30:00Z",
          deletedAt: null,
          raw: {},
        },
      ]),
    );

    useInstitutionsMock.mockReturnValue(
      okQuery({
        data: [
          { id: "ec-1", name: "Colegio Norte", email: "colegio@example.com", phoneNumber: "+598111111", imageUrl: null, url: null, address: null, createdAt: null, updatedAt: null, raw: {} },
        ],
        page: 1,
        limit: 1,
        total: 1,
        total_pages: 1,
      }),
    );

    useClassGroupsMock.mockReturnValue(
      okQuery({
        data: [
          { id: "group-1", educationalCenterId: "ec-1", userId: null, name: "Quinto A", code: "quinto_a", createdAt: null, updatedAt: null, deletedAt: null },
          { id: "group-2", educationalCenterId: "ec-1", userId: null, name: "Sexto B", code: "sexto_b", createdAt: null, updatedAt: null, deletedAt: null },
        ],
        page: 1,
        limit: 1,
        total: 1,
        total_pages: 1,
      }),
    );

    useStudentsMock.mockReturnValue(
      okQuery({
        data: [
          { id: "student-1", classGroupId: "group-1", firstName: "Luna", lastName: "Pérez", fullName: "Luna Pérez", fileNumber: "luna_001", imageUrl: null, createdAt: null, updatedAt: null, deletedAt: null },
          { id: "student-2", classGroupId: "group-1", firstName: "Mateo", lastName: "Ruiz", fullName: "Mateo Ruiz", fileNumber: "mateo_002", imageUrl: null, createdAt: null, updatedAt: null, deletedAt: null },
          { id: "student-3", classGroupId: "group-1", firstName: "Julia", lastName: "Sosa", fullName: "Julia Sosa", fileNumber: "julia_003", imageUrl: null, createdAt: null, updatedAt: null, deletedAt: null },
          { id: "student-4", classGroupId: "group-2", firstName: "Pedro", lastName: "López", fullName: "Pedro López", fileNumber: "pedro_004", imageUrl: null, createdAt: null, updatedAt: null, deletedAt: null },
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
            gameId: 101,
            deckName: "Memoria",
            startDate: "2026-04-29T12:00:00Z",
            updatedAt: "2026-04-29T12:10:00Z",
            createdAt: "2026-04-29T12:00:00Z",
            players: [{ id: "player-1", gameDataId: "game-1", studentId: "student-1", playerName: "Luna Pérez", playerSource: "registered", position: 1, raw: {} }],
            turns: [{ id: "turn-1", gameDataId: "game-1", studentId: "student-1", turnNumber: 1, position: 1, success: true, playTimeSeconds: 12, raw: {} }],
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

  it("muestra una vista dedicada para perfiles Home", () => {
    renderProfileDetailPage({ kind: "home-profile", entityId: "profile-1", institutionId: "ec-1" });

    expect(screen.getByRole("heading", { name: "Tomi", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Vista dedicada del perfil Home/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Owner: Ana Owner/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Tarjetas vinculadas/i)).toBeInTheDocument();
    expect(screen.getByText("card-1")).toBeInTheDocument();
    expect(screen.getByTestId("profile-detail-navigation-list")).toHaveClass("max-h-[420px]", "overflow-y-auto");
    expect(screen.getByRole("link", { name: /Volver a Profiles/i })).toHaveAttribute("href", "/profiles?institutionId=ec-1");
  });

  it("muestra una vista dedicada para estudiantes", () => {
    renderProfileDetailPage({ kind: "student", entityId: "student-1", institutionId: "ec-1", classGroupId: "group-1" });

    expect(screen.getByRole("heading", { name: "Luna Pérez", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText(/Documento \/ ID: luna_001/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Estudiante institucional/i)).toBeInTheDocument();
    expect(screen.getByText(/Grupo: Quinto A/i)).toBeInTheDocument();
    expect(screen.getByText(/Los estudiantes no exponen cards propias en este registro/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Mismo grupo/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Misma institución/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Mateo Ruiz/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Julia Sosa/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pedro López/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tomi/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Mora/i })).toBeInTheDocument();
  });
});
