import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DevicesTable } from "@/features/devices/devices-table";

const useAuthMock = vi.fn();
const useDevicesMock = vi.fn();
const useInstitutionsMock = vi.fn();
const useUsersMock = vi.fn();
const updateDeviceMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/devices/api", () => ({
  useDevices: (...args: unknown[]) => useDevicesMock(...args),
  updateDevice: (...args: unknown[]) => updateDeviceMock(...args),
}));

vi.mock("@/features/institutions/api", () => ({
  useInstitutions: (...args: unknown[]) => useInstitutionsMock(...args),
}));

vi.mock("@/features/users/api", () => ({
  useUsers: (...args: unknown[]) => useUsersMock(...args),
}));

function okQuery<T>(data: T) {
  return {
    data,
    isLoading: false,
    error: null,
  };
}

function renderDevicesTable() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DevicesTable />
    </QueryClientProvider>,
  );
}

describe("DevicesTable", () => {
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
        permissions: ["ble_device:read"],
        raw: {},
      },
    });

    updateDeviceMock.mockResolvedValue({ id: "device-1" });

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
            ownerUserName: "Ana Admin",
            ownerUserEmail: "ana@example.com",
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
        limit: 1,
        total: 1,
        total_pages: 1,
      }),
    );

    useInstitutionsMock.mockReturnValue(
      okQuery({
        data: [{ id: "ec-1", name: "Colegio Norte", raw: {} }],
        page: 1,
        limit: 1,
        total: 1,
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

  it("shows institution-admin read-only mode when update permission is missing", () => {
    renderDevicesTable();

    expect(screen.getByText("institution-admin")).toBeInTheDocument();
    expect(screen.getByText(/Institución activa: Colegio Norte/)).toBeInTheDocument();
    expect(screen.getByText("solo lectura")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("MagicBox Aula 1")[0]);

    expect(screen.getByRole("button", { name: "Edición bloqueada" })).toBeDisabled();
    expect(screen.getByText(/La sesión actual puede revisar el parque visible por ACL/i)).toBeInTheDocument();
  });

  it("persists a move from institution to home when device updates are allowed", async () => {
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
        permissions: ["ble_device:update"],
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

    renderDevicesTable();

    fireEvent.click(screen.getAllByText("MagicBox Aula 1")[0]);
    fireEvent.change(screen.getAllByRole("combobox")[2], { target: { value: "home" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(updateDeviceMock).toHaveBeenCalledWith("token", "device-1", {
        name: "MagicBox Aula 1",
        educationalCenterId: null,
        ownerUserId: "user-1",
        firmwareVersion: "v2.2",
        status: "active",
      });
    });
  });

  it("filters available owners to the selected institution plus global owners", () => {
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
        permissions: ["ble_device:update"],
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
            fullName: "Bruno Global",
            firstName: "Bruno",
            lastName: "Global",
            roles: ["teacher"],
            permissions: [],
            userType: "web",
            educationalCenterId: null,
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
            id: "user-3",
            identityId: null,
            email: "carla@example.com",
            fullName: "Carla Sur",
            firstName: "Carla",
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
        limit: 3,
        total: 3,
        total_pages: 1,
      }),
    );

    renderDevicesTable();

    fireEvent.click(screen.getAllByText("MagicBox Aula 1")[0]);
    fireEvent.change(screen.getAllByRole("combobox")[3], { target: { value: "ec-2" } });

    expect(screen.getByRole("option", { name: /Bruno Global · bruno@example.com/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Carla Sur · carla@example.com/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Ana Admin · ana@example.com/i })).not.toBeInTheDocument();
  });

  it("blocks saving when the device name is empty", async () => {
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
        permissions: ["ble_device:update"],
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

    renderDevicesTable();

    fireEvent.click(screen.getAllByText("MagicBox Aula 1")[0]);
    fireEvent.change(screen.getByDisplayValue("MagicBox Aula 1"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("El nombre es obligatorio.")).toBeInTheDocument();
    expect(updateDeviceMock).not.toHaveBeenCalled();
  });

  it("blocks saving an institution-scoped device without institution", async () => {
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
        permissions: ["ble_device:update"],
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

    renderDevicesTable();

    fireEvent.click(screen.getAllByText("MagicBox Aula 1")[0]);
    fireEvent.change(screen.getAllByRole("combobox")[3], { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Elegí una institución para el dispositivo.")).toBeInTheDocument();
    expect(updateDeviceMock).not.toHaveBeenCalled();
  });
});
