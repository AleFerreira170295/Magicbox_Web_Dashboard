import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/users/api", () => ({
  useUsers: (...args: unknown[]) => useUsersMock(...args),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("@/features/institutions/api", () => ({
  useInstitutions: (...args: unknown[]) => useInstitutionsMock(...args),
}));

vi.mock("@/features/access-control/api", () => ({
  usePermissions: (...args: unknown[]) => usePermissionsMock(...args),
  useAccessActions: (...args: unknown[]) => useAccessActionsMock(...args),
  useAccessFeatures: (...args: unknown[]) => useAccessFeaturesMock(...args),
  useAccessAuditEvents: (...args: unknown[]) => useAccessAuditEventsMock(...args),
  createPermission: vi.fn(),
  deletePermission: vi.fn(),
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

const userWithoutAcl = {
  ...baseUser,
  id: "user-2",
  email: "lucia@example.com",
  fullName: "Lucía Gómez",
  firstName: "Lucía",
  lastName: "Gómez",
  permissions: [],
  phoneNumber: null,
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

  it("filters the roster with quick operational focus segments", () => {
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

    useUsersMock.mockReturnValue(
      okQuery({
        data: [baseUser, userWithoutAcl],
        page: 1,
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );
    usePermissionsMock.mockReturnValue(okQuery({ data: [basePermission], page: 1, limit: 1, total: 1, total_pages: 1 }));

    renderUsersTable();

    fireEvent.click(screen.getAllByRole("button", { name: /Sin ACL explícita/i }).at(-1)!);

    expect(screen.queryAllByText("Lucía Gómez").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Juan Pérez")).toHaveLength(0);
  });
});
