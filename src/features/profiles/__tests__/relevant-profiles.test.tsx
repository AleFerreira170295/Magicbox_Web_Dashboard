import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RelevantProfiles } from "@/features/profiles/relevant-profiles";

const useAuthMock = vi.fn();
const useProfilesOverviewMock = vi.fn();
const useInstitutionsMock = vi.fn();
const useClassGroupsMock = vi.fn();
const useStudentsMock = vi.fn();
const useGamesMock = vi.fn();
const pushMock = vi.fn();

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

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: pushMock }),
}));

function okQuery<T>(data: T) {
  return {
    data,
    isLoading: false,
    error: null,
  };
}

function renderProfiles() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RelevantProfiles />
    </QueryClientProvider>,
  );
}

describe("RelevantProfiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushMock.mockReset();

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
        permissions: ["user:read", "student:read", "class_group:read"],
        raw: {},
      },
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
          boundDevices: [],
          sessionCount: 3,
          lastSessionAt: null,
          createdAt: null,
          updatedAt: null,
          deletedAt: null,
          raw: {},
        },
      ]),
    );

    useInstitutionsMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "ec-1",
            name: "Colegio Norte",
            email: "colegio@example.com",
            phoneNumber: "+598111111",
            imageUrl: null,
            url: null,
            address: null,
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

    useClassGroupsMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "group-1",
            educationalCenterId: "ec-1",
            userId: null,
            name: "Quinto A",
            code: "quinto_a",
            createdAt: null,
            updatedAt: null,
            deletedAt: null,
          },
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
          {
            id: "student-1",
            classGroupId: "group-1",
            firstName: "Luna",
            lastName: "Pérez",
            fullName: "Luna Pérez",
            fileNumber: "luna_001",
            imageUrl: null,
            createdAt: null,
            updatedAt: null,
            deletedAt: null,
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

  it("anchors profiles and students to the visible institution when the view is institution-scoped", () => {
    renderProfiles();

    expect(screen.getAllByText("Institution admin")[0]).toBeInTheDocument();
    expect(screen.getByText(/Institución activa: Colegio Norte/)).toBeInTheDocument();
    expect(screen.getByText(/ahora suma estudiantes además de perfiles Home/i)).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")[0]).toBeDisabled();
    expect(screen.getByRole("link", { name: "Luna Pérez" })).toHaveAttribute(
      "href",
      "/profiles/detail?kind=student&entityId=student-1&institutionId=ec-1&classGroupId=group-1",
    );
    expect(screen.getByText("Estudiantes")).toBeInTheDocument();
    expect(screen.getAllByText(/Click en la fila o en el nombre para abrir el detalle/i).length).toBeGreaterThan(0);
  });

  it("adapts profiles copy to a director-oriented institutional reading", () => {
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
        permissions: ["profile:read", "student:read", "class_group:read"],
        raw: {},
      },
    });

    renderProfiles();

    expect(screen.getByText("Director")).toBeInTheDocument();
    expect(screen.getByText(/mezclando perfiles Home y estudiantes visibles/i)).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Luna Pérez" })).toHaveAttribute(
      "href",
      "/profiles/detail?kind=student&entityId=student-1&institutionId=ec-1&classGroupId=group-1",
    );
    expect(screen.getByText(/Detalle visible en página dedicada/i)).toBeInTheDocument();
  });

  it("keeps the institution-scoped explanation even when no profiles or students are returned", () => {
    useProfilesOverviewMock.mockReturnValue(okQuery([]));
    useStudentsMock.mockReturnValue(
      okQuery({
        data: [],
        page: 1,
        limit: 0,
        total: 0,
        total_pages: 1,
      }),
    );

    renderProfiles();

    expect(screen.getAllByText("Institution admin")[0]).toBeInTheDocument();
    expect(screen.getByText(/ahora suma estudiantes además de perfiles Home/i)).toBeInTheDocument();
    expect(screen.getByText(/No hay perfiles ni estudiantes visibles dentro de la institución actual/i)).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")[0]).toBeDisabled();
  });

  it("navigates to the detail page when the row is clicked", () => {
    renderProfiles();

    fireEvent.click(screen.getByText("Luna Pérez").closest("tr") as HTMLElement);

    expect(pushMock).toHaveBeenCalledWith(
      "/profiles/detail?kind=student&entityId=student-1&institutionId=ec-1&classGroupId=group-1",
    );
  });

  it("filters the unified list through the operational focus segments", () => {
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
          boundDevices: [],
          sessionCount: 3,
          lastSessionAt: "2026-04-28T10:00:00Z",
          createdAt: null,
          updatedAt: null,
          deletedAt: null,
          raw: {},
        },
      ]),
    );

    useStudentsMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "student-2",
            classGroupId: "group-1",
            firstName: "Luna",
            lastName: "Pérez",
            fullName: "Luna Pérez",
            fileNumber: "luna_001",
            imageUrl: null,
            createdAt: null,
            updatedAt: null,
            deletedAt: null,
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
        data: [],
        page: 1,
        limit: 0,
        total: 0,
        total_pages: 1,
      }),
    );

    renderProfiles();

    fireEvent.click(screen.getByRole("button", { name: /Sin sesiones/i }));

    expect(screen.queryAllByText("Luna Pérez").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Tomi" })).not.toBeInTheDocument();
  });
});
