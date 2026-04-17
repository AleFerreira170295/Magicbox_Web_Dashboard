import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UsersTable } from "@/features/users/users-table";

const useAuthMock = vi.fn();
const useUsersMock = vi.fn();
const useInstitutionsMock = vi.fn();
const usePermissionsMock = vi.fn();
const useAccessActionsMock = vi.fn();
const useAccessFeaturesMock = vi.fn();
const useAccessAuditEventsMock = vi.fn();
const createUserMock = vi.fn();
const updateUserMock = vi.fn();
const deleteUserMock = vi.fn();
const createPermissionMock = vi.fn();
const deletePermissionMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/users/api", () => ({
  useUsers: (...args: unknown[]) => useUsersMock(...args),
  createUser: (...args: unknown[]) => createUserMock(...args),
  updateUser: (...args: unknown[]) => updateUserMock(...args),
  deleteUser: (...args: unknown[]) => deleteUserMock(...args),
}));

vi.mock("@/features/institutions/api", () => ({
  useInstitutions: (...args: unknown[]) => useInstitutionsMock(...args),
}));

vi.mock("@/features/access-control/api", () => ({
  usePermissions: (...args: unknown[]) => usePermissionsMock(...args),
  useAccessActions: (...args: unknown[]) => useAccessActionsMock(...args),
  useAccessFeatures: (...args: unknown[]) => useAccessFeaturesMock(...args),
  useAccessAuditEvents: (...args: unknown[]) => useAccessAuditEventsMock(...args),
  createPermission: (...args: unknown[]) => createPermissionMock(...args),
  deletePermission: (...args: unknown[]) => deletePermissionMock(...args),
}));

const baseUser = {
  id: "user-1",
  identityId: null,
  email: "juan@example.com",
  fullName: "Juan Pérez",
  firstName: "Juan",
  lastName: "Pérez",
  roles: ["teacher"],
  permissions: [],
  userType: "web",
  educationalCenterId: "ec-1",
  status: "active",
  phoneNumber: "+598111111",
  address: {
    addressFirstLine: "Calle 1",
    addressSecondLine: null,
    countryCode: "UY",
    city: "Montevideo",
    state: null,
    postalCode: null,
  },
  imageUrl: null,
  createdAt: "2026-04-16T12:00:00Z",
  updatedAt: "2026-04-16T12:00:00Z",
  deletedAt: null,
  lastLoginAt: null,
  raw: {},
};

const basePermission = {
  id: "perm-1",
  userId: "user-1",
  featureId: "feature-user",
  actionId: "action-read",
  educationalCenterId: "ec-1",
  createdAt: "2026-04-16T12:00:00Z",
  updatedAt: "2026-04-16T12:00:00Z",
  deletedAt: null,
  raw: {},
};

function okQuery<T>(data: T) {
  return {
    data,
    isLoading: false,
    error: null,
  };
}

function renderUsersTable() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <UsersTable />
    </QueryClientProvider>,
  );
}

function setupBaseMocks() {
  useUsersMock.mockReturnValue(
    okQuery({
      data: [baseUser],
      page: 1,
      limit: 1,
      total: 1,
      total_pages: 1,
    }),
  );
  useInstitutionsMock.mockReturnValue(
    okQuery({
      data: [{ id: "ec-1", name: "Colegio Norte", code: null, status: null, city: null, country: null, contactName: null, contactEmail: null, createdAt: null, updatedAt: null, raw: {} }],
      page: 1,
      limit: 1,
      total: 1,
      total_pages: 1,
    }),
  );
  usePermissionsMock.mockReturnValue(okQuery({ data: [basePermission], page: 1, limit: 1, total: 1, total_pages: 1 }));
  useAccessActionsMock.mockReturnValue(
    okQuery({
      data: [
        { id: "action-read", code: "read", name: "Leer", raw: {} },
        { id: "action-update", code: "update", name: "Editar", raw: {} },
      ],
      page: 1,
      limit: 2,
      total: 2,
      total_pages: 1,
    }),
  );
  useAccessFeaturesMock.mockReturnValue(
    okQuery({
      data: [{ id: "feature-user", code: "user", name: "Usuarios", raw: {} }],
      page: 1,
      limit: 1,
      total: 1,
      total_pages: 1,
    }),
  );
  useAccessAuditEventsMock.mockReturnValue(okQuery([]));
}

describe("UsersTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBaseMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("adapts the ACL UI to a single institution scope", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "current-user",
        email: "director@example.com",
        firstName: "Ana",
        lastName: "Director",
        fullName: "Ana Director",
        educationalCenterId: "ec-1",
        roles: ["institution-admin"],
        permissions: ["user:read", "user:create", "user:update", "access_control:read", "access_control:update"],
        raw: {},
      },
    });

    renderUsersTable();

    expect(screen.getByText("institution-admin")).toBeInTheDocument();
    expect(screen.getByText(/Institución activa: Colegio Norte/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Alta no disponible" })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Juan Pérez")[0]);

    expect(screen.getByText("Scope bloqueado a institución")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Global" })).not.toBeInTheDocument();
  });

  it("shows read-only cues when the current user lacks management permissions", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "current-user",
        email: "viewer@example.com",
        firstName: "Luz",
        lastName: "Viewer",
        fullName: "Luz Viewer",
        educationalCenterId: "ec-1",
        roles: ["teacher"],
        permissions: ["user:read"],
        raw: {},
      },
    });

    renderUsersTable();

    expect(screen.getByText("Alta no disponible")).toBeDisabled();
    expect(screen.getByText("solo lectura")).toBeInTheDocument();
    expect(screen.getByText("ACL bloqueada")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Juan Pérez")[0]);

    expect(screen.getByText("Sin permiso para eliminar")).toBeInTheDocument();
    expect(screen.getByText(/no consultar ni editar ACL detallada/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edición bloqueada" })).toBeDisabled();
  });

  it("shows institution and explicit ACL details for the selected owner", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "current-user",
        email: "admin@example.com",
        firstName: "Iris",
        lastName: "Admin",
        fullName: "Iris Admin",
        educationalCenterId: "ec-1",
        roles: ["admin"],
        permissions: ["user:read", "user:update", "access_control:read", "access_control:update"],
        raw: {},
      },
    });

    renderUsersTable();

    fireEvent.click(screen.getAllByText("Juan Pérez")[0]);

    expect(screen.getByText(/Institución: Colegio Norte/i)).toBeInTheDocument();
    expect(screen.getByText(/Permisos ACL: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/user:read · Colegio Norte/i)).toBeInTheDocument();
    expect(screen.getByText(/Bundle target: Colegio Norte/i)).toBeInTheDocument();
    expect(screen.getByText(/Scope bloqueado a institución/i)).toBeInTheDocument();
  });

  it("creates a user with normalized payload and scoped institution", async () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "current-user",
        email: "director@example.com",
        firstName: "Ana",
        lastName: "Director",
        fullName: "Ana Director",
        educationalCenterId: "ec-1",
        roles: ["institution-admin"],
        permissions: ["user:read", "user:create", "user:update", "access_control:read", "access_control:update"],
        raw: {},
      },
    });

    createUserMock.mockResolvedValue({
      ...baseUser,
      id: "user-2",
      email: "maria@example.com",
      fullName: "Maria Gomez",
      firstName: "Maria",
      lastName: "Gomez",
      phoneNumber: "+598222222",
    });

    renderUsersTable();

    fireEvent.click(screen.getByRole("button", { name: "Nuevo usuario" }));

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Maria" } });
    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Gomez" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "MARIA@EXAMPLE.COM" } });
    fireEvent.change(screen.getByLabelText("Contraseña inicial"), { target: { value: "secreta123" } });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "+598222222" } });
    fireEvent.change(screen.getByLabelText("Calle"), { target: { value: "Av. Siempre Viva 123" } });
    fireEvent.change(screen.getByLabelText("Ciudad"), { target: { value: "Montevideo" } });
    fireEvent.change(screen.getByLabelText("País (código)"), { target: { value: "uy" } });

    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

    await waitFor(() => {
      expect(createUserMock).toHaveBeenCalledWith("token", {
        firstName: "Maria",
        lastName: "Gomez",
        email: "maria@example.com",
        password: "secreta123",
        phoneNumber: "+598222222",
        userType: "web",
        roles: [],
        educationalCenterId: "ec-1",
        imageUrl: null,
        address: {
          addressFirstLine: "Av. Siempre Viva 123",
          addressSecondLine: null,
          countryCode: "UY",
          city: "Montevideo",
          state: null,
          postalCode: null,
        },
      });
    });

    expect(await screen.findByText("Usuario creado correctamente.")).toBeInTheDocument();
  });

  it("updates the selected user with a normalized payload", async () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "current-user",
        email: "admin@example.com",
        firstName: "Iris",
        lastName: "Admin",
        fullName: "Iris Admin",
        educationalCenterId: null,
        roles: ["admin"],
        permissions: ["user:read", "user:update", "access_control:read", "access_control:update"],
        raw: {},
      },
    });

    updateUserMock.mockResolvedValue({
      ...baseUser,
      email: "nuevo@example.com",
      phoneNumber: "+598999999",
      address: {
        ...baseUser.address,
        countryCode: "UY",
        city: "Canelones",
      },
    });

    renderUsersTable();

    fireEvent.click(screen.getAllByText("Juan Pérez")[0]);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "NUEVO@EXAMPLE.COM" } });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "+598999999" } });
    fireEvent.change(screen.getByLabelText("Ciudad"), { target: { value: "Canelones" } });
    fireEvent.change(screen.getByLabelText("País (código)"), { target: { value: "uy" } });

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith("token", "user-1", {
        firstName: "Juan",
        lastName: "Pérez",
        email: "nuevo@example.com",
        phoneNumber: "+598999999",
        userType: "web",
        roles: ["teacher"],
        educationalCenterId: "ec-1",
        imageUrl: null,
        address: {
          addressFirstLine: "Calle 1",
          addressSecondLine: null,
          countryCode: "UY",
          city: "Canelones",
          state: null,
          postalCode: null,
        },
      });
    });

    expect(await screen.findByText("Usuario actualizado correctamente.")).toBeInTheDocument();
  });

  it("applies scoped bundles even when the same permission keys already exist globally", async () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "current-user",
        email: "admin@example.com",
        firstName: "Iris",
        lastName: "Admin",
        fullName: "Iris Admin",
        educationalCenterId: null,
        roles: ["admin"],
        permissions: ["user:read", "user:update", "access_control:read", "access_control:create", "access_control:update"],
        raw: {},
      },
    });

    useInstitutionsMock.mockReturnValue(
      okQuery({
        data: [
          { id: "ec-1", name: "Colegio Norte", code: null, status: null, city: null, country: null, contactName: null, contactEmail: null, createdAt: null, updatedAt: null, raw: {} },
          { id: "ec-2", name: "Colegio Sur", code: null, status: null, city: null, country: null, contactName: null, contactEmail: null, createdAt: null, updatedAt: null, raw: {} },
        ],
        page: 1,
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );
    usePermissionsMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "perm-device-global",
            userId: "user-1",
            featureId: "feature-device",
            actionId: "action-read",
            educationalCenterId: null,
            createdAt: "2026-04-16T12:00:00Z",
            updatedAt: "2026-04-16T12:00:00Z",
            deletedAt: null,
            raw: {},
          },
          {
            id: "perm-game-global",
            userId: "user-1",
            featureId: "feature-game",
            actionId: "action-read",
            educationalCenterId: null,
            createdAt: "2026-04-16T12:00:00Z",
            updatedAt: "2026-04-16T12:00:00Z",
            deletedAt: null,
            raw: {},
          },
        ],
        page: 1,
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );
    useAccessActionsMock.mockReturnValue(
      okQuery({
        data: [{ id: "action-read", code: "read", name: "Leer", raw: {} }],
        page: 1,
        limit: 1,
        total: 1,
        total_pages: 1,
      }),
    );
    useAccessFeaturesMock.mockReturnValue(
      okQuery({
        data: [
          { id: "feature-device", code: "ble_device", name: "Dispositivos", raw: {} },
          { id: "feature-game", code: "game_data", name: "Partidas", raw: {} },
        ],
        page: 1,
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );
    createPermissionMock.mockResolvedValue({});

    renderUsersTable();

    fireEvent.click(screen.getAllByText("Juan Pérez")[0]);

    const aclScopeField = screen.getByText("Scope ACL").parentElement?.querySelector("select");
    expect(aclScopeField).toBeTruthy();
    fireEvent.change(aclScopeField as HTMLSelectElement, { target: { value: "ec-1" } });

    const teacherBundleButtons = screen.getAllByRole("button", { name: "Teacher" });
    fireEvent.click(teacherBundleButtons[teacherBundleButtons.length - 1]);

    await waitFor(() => {
      expect(createPermissionMock).toHaveBeenCalledTimes(2);
    });

    expect(createPermissionMock).toHaveBeenNthCalledWith(1, "token", {
      userId: "user-1",
      featureId: "feature-game",
      actionId: "action-read",
      educationalCenterId: "ec-1",
    });
    expect(createPermissionMock).toHaveBeenNthCalledWith(2, "token", {
      userId: "user-1",
      featureId: "feature-device",
      actionId: "action-read",
      educationalCenterId: "ec-1",
    });
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/Bundle Teacher aplicado en Colegio Norte/i)).toBeInTheDocument();
  });

  it("adds a scoped ACL permission even when the same key already exists globally", async () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "current-user",
        email: "admin@example.com",
        firstName: "Iris",
        lastName: "Admin",
        fullName: "Iris Admin",
        educationalCenterId: null,
        roles: ["admin"],
        permissions: ["user:read", "user:update", "access_control:read", "access_control:create", "access_control:update"],
        raw: {},
      },
    });

    useInstitutionsMock.mockReturnValue(
      okQuery({
        data: [
          { id: "ec-1", name: "Colegio Norte", code: null, status: null, city: null, country: null, contactName: null, contactEmail: null, createdAt: null, updatedAt: null, raw: {} },
          { id: "ec-2", name: "Colegio Sur", code: null, status: null, city: null, country: null, contactName: null, contactEmail: null, createdAt: null, updatedAt: null, raw: {} },
        ],
        page: 1,
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );
    usePermissionsMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "perm-device-global",
            userId: "user-1",
            featureId: "feature-device",
            actionId: "action-read",
            educationalCenterId: null,
            createdAt: "2026-04-16T12:00:00Z",
            updatedAt: "2026-04-16T12:00:00Z",
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
    useAccessActionsMock.mockReturnValue(
      okQuery({
        data: [{ id: "action-read", code: "read", name: "Leer", raw: {} }],
        page: 1,
        limit: 1,
        total: 1,
        total_pages: 1,
      }),
    );
    useAccessFeaturesMock.mockReturnValue(
      okQuery({
        data: [{ id: "feature-device", code: "ble_device", name: "Dispositivos", raw: {} }],
        page: 1,
        limit: 1,
        total: 1,
        total_pages: 1,
      }),
    );
    createPermissionMock.mockResolvedValue({});

    renderUsersTable();

    fireEvent.click(screen.getAllByText("Juan Pérez")[0]);

    const aclScopeField = screen.getByText("Scope ACL").parentElement?.querySelector("select");
    expect(aclScopeField).toBeTruthy();
    fireEvent.change(aclScopeField as HTMLSelectElement, { target: { value: "ec-1" } });

    fireEvent.click(screen.getByRole("checkbox", { name: "read" }));

    await waitFor(() => {
      expect(createPermissionMock).toHaveBeenCalledWith("token", {
        userId: "user-1",
        featureId: "feature-device",
        actionId: "action-read",
        educationalCenterId: "ec-1",
      });
    });

    expect(await screen.findByText(/Permiso ble_device:read agregado en scope Colegio Norte/i)).toBeInTheDocument();
  });

  it("removes only the scoped ACL permission and keeps the global one untouched", async () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "current-user",
        email: "admin@example.com",
        firstName: "Iris",
        lastName: "Admin",
        fullName: "Iris Admin",
        educationalCenterId: null,
        roles: ["admin"],
        permissions: ["user:read", "user:update", "access_control:read", "access_control:create", "access_control:update", "access_control:delete"],
        raw: {},
      },
    });

    useInstitutionsMock.mockReturnValue(
      okQuery({
        data: [
          { id: "ec-1", name: "Colegio Norte", code: null, status: null, city: null, country: null, contactName: null, contactEmail: null, createdAt: null, updatedAt: null, raw: {} },
          { id: "ec-2", name: "Colegio Sur", code: null, status: null, city: null, country: null, contactName: null, contactEmail: null, createdAt: null, updatedAt: null, raw: {} },
        ],
        page: 1,
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );
    usePermissionsMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "perm-device-global",
            userId: "user-1",
            featureId: "feature-device",
            actionId: "action-read",
            educationalCenterId: null,
            createdAt: "2026-04-16T12:00:00Z",
            updatedAt: "2026-04-16T12:00:00Z",
            deletedAt: null,
            raw: {},
          },
          {
            id: "perm-device-ec-1",
            userId: "user-1",
            featureId: "feature-device",
            actionId: "action-read",
            educationalCenterId: "ec-1",
            createdAt: "2026-04-16T12:00:00Z",
            updatedAt: "2026-04-16T12:00:00Z",
            deletedAt: null,
            raw: {},
          },
        ],
        page: 1,
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );
    useAccessActionsMock.mockReturnValue(
      okQuery({
        data: [{ id: "action-read", code: "read", name: "Leer", raw: {} }],
        page: 1,
        limit: 1,
        total: 1,
        total_pages: 1,
      }),
    );
    useAccessFeaturesMock.mockReturnValue(
      okQuery({
        data: [{ id: "feature-device", code: "ble_device", name: "Dispositivos", raw: {} }],
        page: 1,
        limit: 1,
        total: 1,
        total_pages: 1,
      }),
    );
    deletePermissionMock.mockResolvedValue(undefined);

    renderUsersTable();

    fireEvent.click(screen.getAllByText("Juan Pérez")[0]);

    const aclScopeField = screen.getByText("Scope ACL").parentElement?.querySelector("select");
    expect(aclScopeField).toBeTruthy();
    fireEvent.change(aclScopeField as HTMLSelectElement, { target: { value: "ec-1" } });

    fireEvent.click(screen.getByRole("checkbox", { name: "read" }));

    await waitFor(() => {
      expect(deletePermissionMock).toHaveBeenCalledTimes(1);
    });

    expect(deletePermissionMock).toHaveBeenCalledWith("token", "perm-device-ec-1");
    expect(deletePermissionMock).not.toHaveBeenCalledWith("token", "perm-device-global");
    expect(await screen.findByText(/Permiso ble_device:read removido de scope Colegio Norte/i)).toBeInTheDocument();
  });

  it("deletes the selected user after confirmation", async () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "current-user",
        email: "admin@example.com",
        firstName: "Iris",
        lastName: "Admin",
        fullName: "Iris Admin",
        educationalCenterId: null,
        roles: ["admin"],
        permissions: ["user:read", "user:update", "user:delete", "access_control:read", "access_control:update"],
        raw: {},
      },
    });

    const confirmSpy = vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    deleteUserMock.mockResolvedValue(undefined);

    renderUsersTable();

    fireEvent.click(screen.getAllByText("Juan Pérez")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(deleteUserMock).toHaveBeenCalledWith("token", "user-1");
    });

    expect(await screen.findByText("Usuario eliminado correctamente.")).toBeInTheDocument();
    expect(confirmSpy).toHaveBeenCalledWith("¿Eliminar a Juan Pérez?");

    confirmSpy.mockRestore();
  });

  it("blocks create when the initial password is too short", async () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "current-user",
        email: "director@example.com",
        firstName: "Ana",
        lastName: "Director",
        fullName: "Ana Director",
        educationalCenterId: "ec-1",
        roles: ["institution-admin"],
        permissions: ["user:read", "user:create", "user:update", "access_control:read", "access_control:update"],
        raw: {},
      },
    });

    renderUsersTable();

    fireEvent.click(screen.getByRole("button", { name: "Nuevo usuario" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Lola" } });
    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Cruz" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "lola@example.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña inicial"), { target: { value: "corta" } });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "+598333333" } });

    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

    expect(await screen.findByText("La contraseña inicial debe tener al menos 8 caracteres.")).toBeInTheDocument();
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("blocks create when the address is incomplete", async () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "current-user",
        email: "director@example.com",
        firstName: "Ana",
        lastName: "Director",
        fullName: "Ana Director",
        educationalCenterId: "ec-1",
        roles: ["institution-admin"],
        permissions: ["user:read", "user:create", "user:update", "access_control:read", "access_control:update"],
        raw: {},
      },
    });

    renderUsersTable();

    fireEvent.click(screen.getByRole("button", { name: "Nuevo usuario" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Lola" } });
    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Cruz" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "lola@example.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña inicial"), { target: { value: "secreta123" } });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "+598333333" } });
    fireEvent.change(screen.getByLabelText("Calle"), { target: { value: "Calle falsa 123" } });

    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

    expect(await screen.findByText("Si cargás dirección, completá al menos calle, ciudad y país.")).toBeInTheDocument();
    expect(createUserMock).not.toHaveBeenCalled();
  });
});
