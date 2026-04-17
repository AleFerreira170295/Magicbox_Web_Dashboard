import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionsCenter } from "@/features/permissions/permissions-center";

const useAuthMock = vi.fn();
const useAccessActionsMock = vi.fn();
const useAccessFeaturesMock = vi.fn();
const usePermissionsMock = vi.fn();
const useUsersMock = vi.fn();
const useInstitutionsMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/access-control/api", () => ({
  useAccessActions: (...args: unknown[]) => useAccessActionsMock(...args),
  useAccessFeatures: (...args: unknown[]) => useAccessFeaturesMock(...args),
  usePermissions: (...args: unknown[]) => usePermissionsMock(...args),
}));

vi.mock("@/features/users/api", () => ({
  useUsers: (...args: unknown[]) => useUsersMock(...args),
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

function renderPermissionsCenter() {
  return render(<PermissionsCenter />);
}

describe("PermissionsCenter", () => {
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
        permissions: ["access_control:read", "feature:read", "user:read", "educational_center:read"],
        raw: {},
      },
    });

    useAccessActionsMock.mockReturnValue(
      okQuery({
        data: [
          { id: "action-read", code: "read", name: "Read", description: "Leer", createdAt: null, updatedAt: null, raw: {} },
          { id: "action-update", code: "update", name: "Update", description: "Editar", createdAt: null, updatedAt: null, raw: {} },
        ],
        page: 1,
        limit: 2,
        total: 2,
        total_pages: 1,
      }),
    );
    useAccessFeaturesMock.mockReturnValue(
      okQuery({
        data: [
          { id: "feature-access", code: "access_control", name: "Access control", createdAt: null, updatedAt: null, raw: {} },
          { id: "feature-user", code: "user", name: "Users", createdAt: null, updatedAt: null, raw: {} },
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
            id: "perm-1",
            userId: "user-1",
            featureId: "feature-access",
            actionId: "action-read",
            educationalCenterId: "ec-1",
            createdAt: null,
            updatedAt: null,
            deletedAt: null,
            raw: {},
          },
          {
            id: "perm-2",
            userId: "user-2",
            featureId: "feature-user",
            actionId: "action-update",
            educationalCenterId: null,
            createdAt: null,
            updatedAt: null,
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
            roles: ["institution-admin"],
            permissions: ["access_control:read"],
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
            fullName: "Bruno Campo",
            firstName: "Bruno",
            lastName: "Campo",
            roles: [],
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
        ],
        page: 1,
        limit: 2,
        total: 2,
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
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the scoped institution-admin mode when ACL reads are available", () => {
    renderPermissionsCenter();

    expect(screen.getByText("Institution admin")).toBeInTheDocument();
    expect(screen.getByText("lectura institucional")).toBeInTheDocument();
    expect(screen.getByText("ACL legible")).toBeInTheDocument();
    expect(screen.getByText("features legibles")).toBeInTheDocument();
  });

  it("renders operational ACL filters for institution-admin review", () => {
    renderPermissionsCenter();

    const scopeSelect = screen.getByLabelText("Scope") as HTMLSelectElement;
    fireEvent.change(scopeSelect, { target: { value: "global" } });

    expect(scopeSelect.value).toBe("global");
    expect(screen.getByLabelText("Buscar")).toBeInTheDocument();
    expect(screen.getByLabelText("Feature")).toBeInTheDocument();
    expect(screen.getByLabelText("Action")).toBeInTheDocument();
    expect(screen.getByLabelText("Señal")).toBeInTheDocument();
  });

  it("filters scoped overrides and review profiles by institution", () => {
    renderPermissionsCenter();

    const scopeSelect = screen.getByLabelText("Scope") as HTMLSelectElement;
    fireEvent.change(scopeSelect, { target: { value: "ec-1" } });

    const tables = screen.getAllByRole("table");
    const overridesTable = tables[1];
    const reviewTable = tables[2];

    expect(scopeSelect.value).toBe("ec-1");
    expect(within(overridesTable).getByText("Ana Admin")).toBeInTheDocument();
    expect(within(overridesTable).getByText("access_control")).toBeInTheDocument();
    expect(within(overridesTable).getByText("Colegio Norte")).toBeInTheDocument();
    expect(within(overridesTable).queryByText("Bruno Campo")).not.toBeInTheDocument();
    expect(within(overridesTable).queryByText("Global")).not.toBeInTheDocument();
    expect(within(reviewTable).getByText("Ana Admin")).toBeInTheDocument();
    expect(within(reviewTable).getByText("override explícito")).toBeInTheDocument();
    expect(within(reviewTable).queryByText("Bruno Campo")).not.toBeInTheDocument();
  });

  it("filters the review queue by signal and free-text search", () => {
    renderPermissionsCenter();

    fireEvent.change(screen.getByLabelText("Señal"), { target: { value: "sin rol" } });
    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "Bruno" } });

    const tables = screen.getAllByRole("table");
    const reviewTable = tables[2];

    expect(within(reviewTable).getByText("Bruno Campo")).toBeInTheDocument();
    expect(within(reviewTable).getAllByText("sin rol").length).toBeGreaterThan(0);
    expect(within(reviewTable).queryByText("Ana Admin")).not.toBeInTheDocument();
  });

  it("surfaces incomplete ACL references in metrics and override rows", () => {
    usePermissionsMock.mockReturnValue(
      okQuery({
        data: [
          {
            id: "perm-broken",
            userId: "missing-user",
            featureId: "missing-feature",
            actionId: "missing-action",
            educationalCenterId: null,
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

    renderPermissionsCenter();

    const brokenRefsCard = screen.getByText("Referencias rotas").closest("div");
    expect(screen.getByText("Referencias rotas")).toBeInTheDocument();
    expect(brokenRefsCard).not.toBeNull();
    expect(within(brokenRefsCard as HTMLElement).getByText("1")).toBeInTheDocument();

    const tables = screen.getAllByRole("table");
    const overridesTable = tables[1];

    expect(within(overridesTable).getByText("Usuario no resuelto")).toBeInTheDocument();
    expect(within(overridesTable).getByText("missing-feature")).toBeInTheDocument();
    expect(within(overridesTable).getByText("missing-action")).toBeInTheDocument();
    expect(within(overridesTable).getByText("referencia incompleta")).toBeInTheDocument();
    expect(within(overridesTable).getByText("Global")).toBeInTheDocument();
  });

  it("keeps the module visible but blocks ACL governance when read permissions are missing", () => {
    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        id: "user-current",
        email: "maite@example.com",
        firstName: "Maite",
        lastName: "Viewer",
        fullName: "Maite Viewer",
        educationalCenterId: "ec-1",
        roles: ["institution-admin"],
        permissions: ["user:read"],
        raw: {},
      },
    });

    renderPermissionsCenter();

    expect(screen.getByText("ACL bloqueada")).toBeInTheDocument();
    expect(screen.getByText("features bloqueadas")).toBeInTheDocument();
    expect(screen.getByText(/Lectura ACL no disponible para esta sesión/i)).toBeInTheDocument();
    expect(screen.getByText(/solo se activa cuando el backend expone esos permisos/i)).toBeInTheDocument();
    expect(useAccessActionsMock).toHaveBeenCalledWith(undefined);
    expect(useAccessFeaturesMock).toHaveBeenCalledWith(undefined);
    expect(usePermissionsMock).toHaveBeenCalledWith(undefined);
  });
});
