import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstitutionsOverview } from "@/features/institutions/institutions-overview";

const useAuthMock = vi.fn();
const useInstitutionsMock = vi.fn();
const useInstitutionByIdMock = vi.fn();
const useUsersMock = vi.fn();
const useDevicesMock = vi.fn();

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
  });

  it("shows institution-admin scoped read-only mode for institutions", () => {
    renderInstitutionsOverview();

    expect(screen.getByText("Institution admin")).toBeInTheDocument();
    expect(screen.getByText(/Institución activa: Colegio Norte/)).toBeInTheDocument();
    expect(screen.getByText("Alta no disponible")).toBeDisabled();
    expect(screen.getByText("solo lectura")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Colegio Norte")[0]);

    expect(screen.getByRole("button", { name: "Edición bloqueada" })).toBeDisabled();
    expect(screen.getByText("Sin permiso para eliminar")).toBeInTheDocument();
  });
});
