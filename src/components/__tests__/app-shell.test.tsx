import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";

const useAuthMock = vi.fn();
const usePathnameMock = vi.fn();
const useRouterMock = vi.fn();

vi.mock("@/components/auth-guard", () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => useRouterMock(),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

function renderShell() {
  return render(
    <AppShell>
      <div>contenido</div>
    </AppShell>,
  );
}

describe("AppShell navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue("/dashboard");
    useRouterMock.mockReturnValue({ replace: vi.fn() });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows institution-admin navigation aligned with the enabled modules", () => {
    useAuthMock.mockReturnValue({
      user: {
        fullName: "Ana Admin",
        email: "ana@example.com",
        roles: ["institution-admin"],
        permissions: [],
      },
      logout: vi.fn(),
    });

    renderShell();

    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Usuarios").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Instituciones").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Perfiles").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dispositivos").length).toBeGreaterThan(0);

    expect(screen.queryByText("Permisos")).not.toBeInTheDocument();
    expect(screen.queryByText("Configuración")).not.toBeInTheDocument();
    expect(screen.queryByText("Salud")).not.toBeInTheDocument();
  });

  it("shows permissions navigation for institution-admin sessions with ACL read access", () => {
    useAuthMock.mockReturnValue({
      user: {
        fullName: "Ana Admin",
        email: "ana@example.com",
        roles: ["institution-admin"],
        permissions: ["access_control:read", "feature:read"],
      },
      logout: vi.fn(),
    });

    renderShell();

    expect(screen.getAllByText("Permisos").length).toBeGreaterThan(0);
  });

  it("shows the full command navigation for admin sessions", () => {
    useAuthMock.mockReturnValue({
      user: {
        fullName: "Iris Admin",
        email: "iris@example.com",
        roles: ["admin"],
        permissions: ["access_control:read", "feature:read"],
      },
      logout: vi.fn(),
    });

    renderShell();

    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Usuarios").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Permisos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Instituciones").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Salud").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Perfiles").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Configuración").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dispositivos").length).toBeGreaterThan(0);
  });

  it("keeps teacher navigation limited to classroom-facing modules", () => {
    useAuthMock.mockReturnValue({
      user: {
        fullName: "Teo Teacher",
        email: "teo@example.com",
        roles: ["teacher"],
        permissions: [],
      },
      logout: vi.fn(),
    });

    renderShell();

    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sincronizaciones").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Partidas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dispositivos").length).toBeGreaterThan(0);

    expect(screen.queryAllByText("Usuarios")).toHaveLength(0);
    expect(screen.queryAllByText("Permisos")).toHaveLength(0);
    expect(screen.queryAllByText("Instituciones")).toHaveLength(0);
    expect(screen.queryAllByText("Salud")).toHaveLength(0);
    expect(screen.queryAllByText("Perfiles")).toHaveLength(0);
    expect(screen.queryAllByText("Configuración")).toHaveLength(0);
  });

  it("logs out and returns to login", async () => {
    const logoutMock = vi.fn().mockResolvedValue(undefined);
    const replaceMock = vi.fn();

    useRouterMock.mockReturnValue({ replace: replaceMock });
    useAuthMock.mockReturnValue({
      user: {
        fullName: "Iris Admin",
        email: "iris@example.com",
        roles: ["admin"],
        permissions: [],
      },
      logout: logoutMock,
    });

    renderShell();

    fireEvent.click(screen.getAllByRole("button", { name: "Salir" })[0]);

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalled();
      expect(replaceMock).toHaveBeenCalledWith("/login");
    });
  });
});
