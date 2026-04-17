import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

function errorQuery(message: string) {
  return {
    data: undefined,
    isLoading: false,
    error: new Error(message),
  };
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

  it("shows bound devices in metrics and profile detail", () => {
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
          bindingCount: 2,
          activeBindingCount: 2,
          cardUids: ["card-1", "card-2"],
          boundDevices: [
            { id: "device-1", deviceId: "mb-1", name: "MagicBox Aula 1" },
            { id: "device-2", deviceId: "mb-2", name: "MagicBox Aula 2" },
          ],
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

    renderProfiles();

    expect(screen.getAllByText("Con tarjeta").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText("Tomi")[0]);

    expect(screen.getByText("Dispositivos vinculados")).toBeInTheDocument();
    expect(screen.getByText("MagicBox Aula 1")).toBeInTheDocument();
    expect(screen.getByText("MagicBox Aula 2")).toBeInTheDocument();
    expect(screen.getByText(/Owner Ana Owner/i)).toBeInTheDocument();
  });

  it("shows the backend error when profiles cannot be loaded", () => {
    useProfilesOverviewMock.mockReturnValue(errorQuery("Profiles caídos"));

    renderProfiles();

    expect(screen.getByText("Profiles caídos")).toBeInTheDocument();
  });
});
