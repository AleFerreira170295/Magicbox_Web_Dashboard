import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
});
