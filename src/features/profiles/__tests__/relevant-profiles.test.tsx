import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RelevantProfiles } from "@/features/profiles/relevant-profiles";

const useAuthMock = vi.fn();
const useProfilesOverviewMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/profiles/api", () => ({
  useProfilesOverview: (...args: unknown[]) => useProfilesOverviewMock(...args),
}));

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
        permissions: ["user:read"],
        raw: {},
      },
    });

    useProfilesOverviewMock.mockReturnValue({
      data: [
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
      ],
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("anchors profiles to the visible institution when the view is institution-scoped", () => {
    renderProfiles();

    expect(screen.getAllByText("Institution admin")[0]).toBeInTheDocument();
    expect(screen.getByText(/Institución activa: Colegio Norte/)).toBeInTheDocument();
    expect(screen.getAllByText(/La tabla queda anclada a la institución visible por ACL/i)[0]).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")[0]).toBeDisabled();
  });

  it("keeps the institution-scoped explanation even when no institution-linked profiles are returned", () => {
    useProfilesOverviewMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderProfiles();

    expect(screen.getAllByText("Institution admin")[0]).toBeInTheDocument();
    expect(screen.getAllByText(/La tabla queda anclada a la institución visible por ACL/i)[0]).toBeInTheDocument();
    expect(
      screen.getByText(/No hay perfiles Home ligados a la institución visible/i),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")[0]).toBeDisabled();
  });

  it("filters profiles through the operational focus segments", () => {
    useProfilesOverviewMock.mockReturnValue({
      data: [
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
        {
          id: "profile-2",
          displayName: "Luna",
          avatarUrl: null,
          age: 6,
          ageCategory: "6-8",
          isActive: true,
          userId: null,
          userName: null,
          userEmail: null,
          educationalCenterId: "ec-1",
          educationalCenterName: "Colegio Norte",
          bindingCount: 0,
          activeBindingCount: 0,
          cardUids: [],
          boundDevices: [],
          sessionCount: 0,
          lastSessionAt: null,
          createdAt: null,
          updatedAt: null,
          deletedAt: null,
          raw: {},
        },
      ],
      isLoading: false,
      error: null,
    });

    renderProfiles();

    fireEvent.click(screen.getByRole("button", { name: /Sin tarjeta/i }));

    expect(screen.queryAllByText("Luna").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Tomi")).toHaveLength(0);
  });
});
