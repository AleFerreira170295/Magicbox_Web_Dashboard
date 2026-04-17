import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstitutionsOverview } from "@/features/institutions/institutions-overview";

const useAuthMock = vi.fn();
const useInstitutionsMock = vi.fn();
const useInstitutionByIdMock = vi.fn();
const useUsersMock = vi.fn();
const useDevicesMock = vi.fn();
const createInstitutionMock = vi.fn();
const updateInstitutionMock = vi.fn();
const deleteInstitutionMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/institutions/api", () => ({
  useInstitutions: (...args: unknown[]) => useInstitutionsMock(...args),
  useInstitutionById: (...args: unknown[]) => useInstitutionByIdMock(...args),
  createInstitution: (...args: unknown[]) => createInstitutionMock(...args),
  updateInstitution: (...args: unknown[]) => updateInstitutionMock(...args),
  deleteInstitution: (...args: unknown[]) => deleteInstitutionMock(...args),
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

    createInstitutionMock.mockResolvedValue({
      id: "ec-2",
      name: "Colegio Sur",
      email: "nuevo@example.com",
      phoneNumber: "+598222222",
      url: "https://sur.example.com",
      address: {
        addressFirstLine: "Nueva 456",
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
    });
    updateInstitutionMock.mockResolvedValue({ id: "ec-1", name: "Colegio Norte" });
    deleteInstitutionMock.mockResolvedValue(undefined);

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

  afterEach(() => {
    cleanup();
  });

  it("shows institution-admin scoped read-only mode for institutions", () => {
    renderInstitutionsOverview();

    expect(screen.getByText("Institution admin")).toBeInTheDocument();
    expect(screen.getByText(/Institución activa: Colegio Norte/)).toBeInTheDocument();
    expect(screen.getByText("Con usuarios")).toBeInTheDocument();
    expect(screen.getByText("Con dispositivos")).toBeInTheDocument();
    expect(screen.getByText("Alta no disponible")).toBeDisabled();
    expect(screen.getByText("solo lectura")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Colegio Norte")[0]);

    expect(screen.getByRole("button", { name: "Edición bloqueada" })).toBeDisabled();
    expect(screen.getByText("Sin permiso para eliminar")).toBeInTheDocument();
  });

  it("labels the scoped institutions view as director when the current role is director", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-current",
        email: "director@example.com",
        firstName: "Marta",
        lastName: "Director",
        fullName: "Marta Director",
        educationalCenterId: "ec-1",
        roles: ["director"],
        permissions: ["educational_center:read"],
        raw: {},
      },
    });

    renderInstitutionsOverview();

    expect(screen.getByText("Director")).toBeInTheDocument();
    expect(screen.getByText(/Institución activa: Colegio Norte/)).toBeInTheDocument();
    expect(screen.getAllByText("director")[0]).toBeInTheDocument();
    expect(screen.queryByText("institution-admin")).not.toBeInTheDocument();
  });

  it("shows device linkage in metrics, table and operational impact", () => {
    useInstitutionByIdMock.mockReturnValue(
      okQuery({
        id: "ec-1",
        operationalPreview: {
          users: [],
          devices: [
            {
              id: "device-1",
              deviceId: "mb-1",
              name: "MagicBox Aula 1",
              updatedAt: "2026-04-16T18:00:00.000Z",
            },
          ],
          classGroups: [],
        },
      }),
    );

    renderInstitutionsOverview();

    expect(screen.getAllByText("Con dispositivos").length).toBeGreaterThan(0);

    const institutionRow = screen.getAllByText("Colegio Norte")[0].closest("tr");
    expect(institutionRow).not.toBeNull();
    expect(within(institutionRow as HTMLTableRowElement).getByText("2")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Colegio Norte")[0]);

    expect(screen.getByText(/Dispositivos vinculados: 2/i)).toBeInTheDocument();
    expect(screen.getByText("MagicBox Aula 1")).toBeInTheDocument();
    expect(screen.getByText("mb-1")).toBeInTheDocument();
  });

  it("filters institutions by linked device and linked user context", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-current",
        email: "admin@example.com",
        firstName: "Iris",
        lastName: "Admin",
        fullName: "Iris Admin",
        educationalCenterId: null,
        roles: ["admin"],
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
            operationalSummary: { userCount: 1, deviceCount: 1, classGroupCount: 1, studentCount: 20, needsReview: false },
          },
          {
            id: "ec-2",
            name: "Colegio Sur",
            email: "sur@example.com",
            phoneNumber: "+598222222",
            url: "https://sur.example.com",
            address: {
              addressFirstLine: "Avenida 456",
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
            operationalSummary: { userCount: 1, deviceCount: 1, classGroupCount: 0, studentCount: 12, needsReview: false },
          },
        ],
        page: 1,
        limit: 2,
        total: 2,
        total_pages: 1,
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
          {
            id: "user-2",
            identityId: null,
            email: "bruno@example.com",
            fullName: "Bruno Sur",
            firstName: "Bruno",
            lastName: "Sur",
            roles: ["teacher"],
            permissions: [],
            userType: "web",
            educationalCenterId: "ec-2",
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
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );

    useDevicesMock.mockReturnValue(
      okQuery({
        data: [
          { id: "device-1", deviceId: "mb-1", name: "MagicBox Aula 1", educationalCenterId: "ec-1", assignmentScope: "institution", raw: {} },
          { id: "device-2", deviceId: "mb-2", name: "MagicBox Sur", educationalCenterId: "ec-2", assignmentScope: "institution", raw: {} },
        ],
        page: 1,
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );

    renderInstitutionsOverview();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por institución, email, usuario o dispositivo/i), { target: { value: "MagicBox Sur" } });
    expect(screen.getByText("Colegio Sur")).toBeInTheDocument();
    expect(screen.queryByText("Colegio Norte")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por institución, email, usuario o dispositivo/i), { target: { value: "Ana Admin" } });
    expect(screen.getByText("Colegio Norte")).toBeInTheDocument();
    expect(screen.queryByText("Colegio Sur")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por institución, email, usuario o dispositivo/i), { target: { value: "ana@example.com" } });
    expect(screen.getByText("Colegio Norte")).toBeInTheDocument();
    expect(screen.queryByText("Colegio Sur")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por institución, email, usuario o dispositivo/i), { target: { value: "mb-2" } });
    expect(screen.getByText("Colegio Sur")).toBeInTheDocument();
    expect(screen.queryByText("Colegio Norte")).not.toBeInTheDocument();
  });

  it("creates institutions with normalized backend payload", async () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-current",
        email: "admin@example.com",
        firstName: "Iris",
        lastName: "Admin",
        fullName: "Iris Admin",
        educationalCenterId: null,
        roles: ["admin"],
        permissions: ["educational_center:create"],
        raw: {},
      },
    });

    renderInstitutionsOverview();

    fireEvent.click(screen.getByRole("button", { name: "Nueva institución" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Colegio Sur" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "NUEVO@Example.com" } });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "+598222222" } });
    fireEvent.change(screen.getByLabelText("URL"), { target: { value: "https://sur.example.com" } });
    fireEvent.change(screen.getByLabelText("Calle"), { target: { value: "Nueva 456" } });
    fireEvent.change(screen.getByLabelText("Ciudad"), { target: { value: "Canelones" } });
    fireEvent.change(screen.getByLabelText("País (código)"), { target: { value: "uy" } });
    fireEvent.change(screen.getByLabelText("Departamento / estado"), { target: { value: "Canelones" } });
    fireEvent.change(screen.getByLabelText("Código postal"), { target: { value: "90000" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear institución" }));

    await waitFor(() => {
      expect(createInstitutionMock).toHaveBeenCalledWith("token", {
        name: "Colegio Sur",
        email: "nuevo@example.com",
        phoneNumber: "+598222222",
        url: "https://sur.example.com",
        address: {
          addressFirstLine: "Nueva 456",
          addressSecondLine: null,
          countryCode: "UY",
          city: "Canelones",
          state: "Canelones",
          postalCode: "90000",
        },
      });
    });
  });

  it("blocks create when required institution fields are missing", async () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-current",
        email: "admin@example.com",
        firstName: "Iris",
        lastName: "Admin",
        fullName: "Iris Admin",
        educationalCenterId: null,
        roles: ["admin"],
        permissions: ["educational_center:create"],
        raw: {},
      },
    });

    renderInstitutionsOverview();

    fireEvent.click(screen.getByRole("button", { name: "Nueva institución" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Colegio Sur" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear institución" }));

    expect(await screen.findByText("Completá nombre, email y teléfono.")).toBeInTheDocument();
    expect(createInstitutionMock).not.toHaveBeenCalled();
  });

  it("blocks create when the institution address is incomplete", async () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-current",
        email: "admin@example.com",
        firstName: "Iris",
        lastName: "Admin",
        fullName: "Iris Admin",
        educationalCenterId: null,
        roles: ["admin"],
        permissions: ["educational_center:create"],
        raw: {},
      },
    });

    renderInstitutionsOverview();

    fireEvent.click(screen.getByRole("button", { name: "Nueva institución" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Colegio Sur" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nuevo@example.com" } });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "+598222222" } });
    fireEvent.change(screen.getByLabelText("Calle"), { target: { value: "Nueva 456" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear institución" }));

    expect(await screen.findByText("Completá al menos calle, ciudad y país.")).toBeInTheDocument();
    expect(createInstitutionMock).not.toHaveBeenCalled();
  });
});
