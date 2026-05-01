import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstitutionStudentProfilePage } from "@/features/institutions/institution-student-profile-page";

const routerPushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

const useAuthMock = vi.fn();
const useInstitutionsMock = vi.fn();
const useClassGroupsMock = vi.fn();
const useAllStudentsMock = vi.fn();
const useGamesMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/institutions/api", () => ({
  useInstitutions: (...args: unknown[]) => useInstitutionsMock(...args),
}));

vi.mock("@/features/class-groups/api", () => ({
  useClassGroups: (...args: unknown[]) => useClassGroupsMock(...args),
}));

vi.mock("@/features/students/api", () => ({
  useAllStudents: (...args: unknown[]) => useAllStudentsMock(...args),
  deleteStudent: vi.fn(),
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

function renderStudentProfilePage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <InstitutionStudentProfilePage institutionId="ec-1" groupId="group-1" studentId="student-1" />
    </QueryClientProvider>,
  );
}

describe("InstitutionStudentProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerPushMock.mockReset();

    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
    });

    useInstitutionsMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "ec-1",
            name: "Colegio Norte",
            email: "colegio@example.com",
            phoneNumber: "+598111111",
            url: "https://colegio.example.com",
            address: null,
            city: "Montevideo",
            country: "UY",
            contactName: null,
            contactEmail: null,
            code: null,
            status: null,
            imageUrl: null,
            createdAt: null,
            updatedAt: null,
            raw: {},
            operationalSummary: {
              userCount: 3,
              deviceCount: 2,
              classGroupCount: 1,
              studentCount: 20,
              needsReview: false,
            },
          },
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
          {
            id: "group-1",
            educationalCenterId: "ec-1",
            userId: null,
            name: "Quinto A",
            code: "quinto_a",
            updatedAt: null,
          },
        ],
        page: 1,
        limit: 1,
        total: 1,
        total_pages: 1,
      }),
    );

    useAllStudentsMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "student-1",
            classGroupId: "group-1",
            firstName: "Luna",
            lastName: "Pérez",
            fullName: "Luna Pérez",
            fileNumber: "luna_001",
            imageUrl: null,
            updatedAt: null,
          },
          {
            id: "student-2",
            classGroupId: "group-1",
            firstName: "Mateo",
            lastName: "Ruiz",
            fullName: "Mateo Ruiz",
            fileNumber: "mateo_002",
            imageUrl: null,
            updatedAt: null,
          },
          {
            id: "student-3",
            classGroupId: "group-1",
            firstName: "Camila",
            lastName: "Sosa",
            fullName: "Camila Sosa",
            fileNumber: "camila_003",
            imageUrl: null,
            updatedAt: null,
          },
          {
            id: "student-4",
            classGroupId: "group-1",
            firstName: "Tomás",
            lastName: "Benítez",
            fullName: "Tomás Benítez",
            fileNumber: "tomas_004",
            imageUrl: null,
            updatedAt: null,
          },
          {
            id: "student-5",
            classGroupId: "group-1",
            firstName: "Valentina",
            lastName: "López",
            fullName: "Valentina López",
            fileNumber: "valentina_005",
            imageUrl: null,
            updatedAt: null,
          },
          {
            id: "student-6",
            classGroupId: "group-1",
            firstName: "Nicolás",
            lastName: "Gómez",
            fullName: "Nicolás Gómez",
            fileNumber: "nicolas_006",
            imageUrl: null,
            updatedAt: null,
          },
          {
            id: "student-7",
            classGroupId: "group-1",
            firstName: "Martina",
            lastName: "Díaz",
            fullName: "Martina Díaz",
            fileNumber: "martina_007",
            imageUrl: null,
            updatedAt: null,
          },
          {
            id: "student-8",
            classGroupId: "group-1",
            firstName: "Joaquín",
            lastName: "Pereira",
            fullName: "Joaquín Pereira",
            fileNumber: "joaquin_008",
            imageUrl: null,
            updatedAt: null,
          },
          {
            id: "student-9",
            classGroupId: "group-1",
            firstName: "Agustina",
            lastName: "Méndez",
            fullName: "Agustina Méndez",
            fileNumber: "agustina_009",
            imageUrl: null,
            updatedAt: null,
          },
          {
            id: "student-10",
            classGroupId: "group-1",
            firstName: "Bruno",
            lastName: "Silva",
            fullName: "Bruno Silva",
            fileNumber: "bruno_010",
            imageUrl: null,
            updatedAt: null,
          },
        ],
        page: 1,
        limit: 10,
        total: 10,
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
            players: [
              { id: "player-1", gameDataId: "game-1", studentId: "student-1", playerName: "Luna Pérez", playerSource: "registered", position: 1, raw: {} },
            ],
            turns: [
              { id: "turn-1", gameDataId: "game-1", studentId: "student-1", turnNumber: 1, position: 1, success: true, playTimeSeconds: 12, raw: {} },
              { id: "turn-2", gameDataId: "game-1", studentId: "student-1", turnNumber: 2, position: 1, success: false, playTimeSeconds: 18, raw: {} },
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
  });

  afterEach(() => {
    cleanup();
  });

  it("muestra una pantalla dedicada con analítica y navegación de regreso", () => {
    renderStudentProfilePage();

    expect(screen.getByRole("heading", { name: "Luna Pérez", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText(/Documento \/ ID: luna_001/).length).toBeGreaterThan(0);
    expect(screen.getByText("Analítica temporal")).toBeInTheDocument();
    expect(screen.getByText("Contexto y navegación")).toBeInTheDocument();
    expect(screen.getByText("Con actividad")).toBeInTheDocument();
    expect(screen.getByText("Turnos por fecha")).toBeInTheDocument();
    expect(screen.getByText("Partidas en las que participó")).toBeInTheDocument();
    expect(screen.getByText(/Memoria #101/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Volver a Institutions/i })).toHaveAttribute(
      "href",
      "/institutions?institutionId=ec-1&groupId=group-1",
    );
    expect(screen.getByText(/Perfil abierto en esta pantalla/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Mateo Ruiz/i })).toHaveAttribute(
      "href",
      "/institutions/student?institutionId=ec-1&groupId=group-1&studentId=student-2",
    );
    expect(screen.getByRole("link", { name: /Bruno Silva/i })).toHaveAttribute(
      "href",
      "/institutions/student?institutionId=ec-1&groupId=group-1&studentId=student-10",
    );
    expect(screen.getByTestId("institution-student-navigation-list")).toHaveClass("max-h-[min(70vh,640px)]", "overflow-y-auto", "overscroll-contain");
    expect(screen.getByText(/Mostrando 1 partidas visibles para este estudiante./i)).toBeInTheDocument();
  });

  it("permite cambiar el alcance de la analítica", () => {
    renderStudentProfilePage();

    expect(screen.getByText(/Luna Pérez: La lectura temporal usa solo las partidas y turnos del estudiante activo./i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver grupo" }));

    expect(screen.getByText(/Quinto A: La lectura temporal consolida las partidas y turnos visibles de todo el grupo./i)).toBeInTheDocument();
  });
});
