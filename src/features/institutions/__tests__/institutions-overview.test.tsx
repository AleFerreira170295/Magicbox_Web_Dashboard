import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstitutionsOverview } from "@/features/institutions/institutions-overview";

const useAuthMock = vi.fn();
const useInstitutionsMock = vi.fn();
const useInstitutionByIdMock = vi.fn();
const useUsersMock = vi.fn();
const useDevicesMock = vi.fn();
const useClassGroupsMock = vi.fn();
const useAllStudentsMock = vi.fn();
const useGamesMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/institutions/api", () => ({
  useInstitutions: (...args: unknown[]) => useInstitutionsMock(...args),
  useInstitutionById: (...args: unknown[]) => useInstitutionByIdMock(...args),
  createInstitution: vi.fn(),
  updateInstitution: vi.fn(),
  deleteInstitution: vi.fn(),
}));

vi.mock("@/features/users/api", () => ({
  useUsers: (...args: unknown[]) => useUsersMock(...args),
}));

vi.mock("@/features/devices/api", () => ({
  useDevices: (...args: unknown[]) => useDevicesMock(...args),
}));

vi.mock("@/features/class-groups/api", () => ({
  useClassGroups: (...args: unknown[]) => useClassGroupsMock(...args),
}));

vi.mock("@/features/students/api", () => ({
  useAllStudents: (...args: unknown[]) => useAllStudentsMock(...args),
}));

vi.mock("@/features/games/api", () => ({
  useGames: (...args: unknown[]) => useGamesMock(...args),
}));

vi.mock("@/features/class-groups/student-import-panel", () => ({
  StudentImportPanel: () => <div data-testid="student-import-panel" />,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

function okQuery<T>(data: T) {
  return {
    data,
    isLoading: false,
    error: null,
  };
}

function renderInstitutionsOverview() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <InstitutionsOverview />
    </QueryClientProvider>,
  );
}

describe("InstitutionsOverview", () => {
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
        permissions: ["educational_center:read"],
        raw: {},
      },
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
            address: {
              addressFirstLine: "Calle 123",
              addressSecondLine: null,
              countryCode: "UY",
              city: "Montevideo",
              state: "Montevideo",
              postalCode: "11000",
            },
            city: "Montevideo",
            country: "UY",
            contactName: null,
            contactEmail: null,
            code: null,
            status: null,
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

    useInstitutionByIdMock.mockReturnValue(
      okQuery({
        id: "ec-1",
        operationalPreview: {
          users: [],
          devices: [],
          classGroups: [],
        },
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

    useDevicesMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "device-1",
            deviceId: "mb-1",
            name: "MagicBox Aula 1",
            educationalCenterId: "ec-1",
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

  it("shows institution-admin scoped read-only mode for institutions without forcing active selections", () => {
    renderInstitutionsOverview();

    expect(screen.getAllByText("Instituciones").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Colegio Norte/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Alta no disponible" })[0]).toBeDisabled();
    expect(screen.getByTestId("student-import-panel")).toBeInTheDocument();
    expect(screen.getByText("Grupos y perfiles de jugadores")).toBeInTheDocument();
    expect(screen.getByText(/Seleccioná una institución para ver sus grupos/i)).toBeInTheDocument();
    expect(screen.queryByText("Luna Pérez")).not.toBeInTheDocument();
    expect(screen.queryByText("Analítica temporal")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Colegio Norte")[0]);

    expect(screen.getByRole("button", { name: "Edición bloqueada" })).toBeDisabled();
    expect(screen.getByText("Sin permiso para eliminar")).toBeInTheDocument();
    expect(screen.getAllByText("Quinto A").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText("Quinto A")[0]);

    expect(screen.getAllByText("Luna Pérez").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Luna Pérez/i })).toHaveAttribute(
      "href",
      "/institutions/student?institutionId=ec-1&groupId=group-1&studentId=student-1",
    );
    expect(screen.getByRole("button", { name: "Deseleccionar institución" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Deseleccionar grupo" })).toBeEnabled();
  });

  it("adapts institutions copy to a director-oriented follow-up view", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-director",
        email: "director@example.com",
        firstName: "Dora",
        lastName: "Director",
        fullName: "Dora Director",
        educationalCenterId: "ec-1",
        roles: ["director"],
        permissions: ["educational_center:read"],
        raw: {},
      },
    });

    renderInstitutionsOverview();

    expect(screen.getByText("Director")).toBeInTheDocument();
    expect(screen.getByText(/Institución activa: Colegio Norte/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Colegio Norte")[0]);

    expect(screen.getByText(/Instituciones para seguimiento/i)).toBeInTheDocument();
    expect(screen.getByText(/Detalle de seguimiento/i)).toBeInTheDocument();
  });

  it("filters institutions with operational focus segments", () => {
    useInstitutionsMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "ec-1",
            name: "Colegio Norte",
            email: "colegio@example.com",
            phoneNumber: "+598111111",
            url: "https://colegio.example.com",
            address: {
              addressFirstLine: "Calle 123",
              addressSecondLine: null,
              countryCode: "UY",
              city: "Montevideo",
              state: "Montevideo",
              postalCode: "11000",
            },
            city: "Montevideo",
            country: "UY",
            contactName: null,
            contactEmail: null,
            code: null,
            status: null,
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
          {
            id: "ec-2",
            name: "Colegio Sur",
            email: "sur@example.com",
            phoneNumber: "+598222222",
            url: "https://sur.example.com",
            address: {
              addressFirstLine: "Calle 999",
              addressSecondLine: null,
              countryCode: "UY",
              city: "Canelones",
              state: "Canelones",
              postalCode: "90000",
            },
            city: "Canelones",
            country: "UY",
            contactName: null,
            contactEmail: null,
            code: null,
            status: null,
            createdAt: null,
            updatedAt: null,
            raw: {},
            operationalSummary: {
              userCount: 0,
              deviceCount: 0,
              classGroupCount: 0,
              studentCount: 0,
              needsReview: false,
            },
          },
        ],
        page: 1,
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );
    useUsersMock.mockReturnValue(okQuery({ data: [], page: 1, limit: 1, total: 0, total_pages: 1 }));
    useDevicesMock.mockReturnValue(okQuery({ data: [], page: 1, limit: 1, total: 0, total_pages: 1 }));

    renderInstitutionsOverview();

    fireEvent.click(screen.getByRole("button", { name: /Sin dispositivos/i }));

    expect(screen.queryAllByText("Colegio Sur").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Colegio Norte")).toHaveLength(0);
  });

  it("permite buscar y filtrar estudiantes dentro del grupo seleccionado", () => {
    renderInstitutionsOverview();

    fireEvent.click(screen.getAllByText("Colegio Norte")[0]);
    fireEvent.click(screen.getAllByText("Quinto A")[0]);

    expect(screen.getAllByText("Luna Pérez").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mateo Ruiz").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText("Buscar estudiante por nombre o documento / ID"), {
      target: { value: "mateo" },
    });

    expect(screen.getAllByText("Mateo Ruiz").length).toBeGreaterThan(0);
    expect(screen.queryByText("Luna Pérez")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Buscar estudiante por nombre o documento / ID"), {
      target: { value: "" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Sin partidas" }));

    expect(screen.getAllByText("Mateo Ruiz").length).toBeGreaterThan(0);
    expect(screen.queryByText("Luna Pérez")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sin partidas" }));
    expect(screen.getAllByText("Luna Pérez").length).toBeGreaterThan(0);
  });

  it("abre una navegación profunda al detalle del estudiante", () => {
    renderInstitutionsOverview();

    fireEvent.click(screen.getAllByText("Colegio Norte")[0]);
    fireEvent.click(screen.getAllByText("Quinto A")[0]);

    expect(screen.getAllByText(/Abrir página interna del estudiante/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Luna Pérez/i })).toHaveAttribute(
      "href",
      "/institutions/student?institutionId=ec-1&groupId=group-1&studentId=student-1",
    );
  });
});
