import { cleanup, render, screen } from "@testing-library/react";
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

  it("keeps government-viewer focused on the executive dashboard only", () => {
    useAuthMock.mockReturnValue({
      user: {
        fullName: "Gobierno Territorial",
        email: "gobierno@example.com",
        roles: ["government-viewer"],
        permissions: ["feature:read"],
      },
      logout: vi.fn(),
    });

    renderShell();

    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Alertas territoriales").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Territorios e instituciones").length).toBeGreaterThan(0);
    expect(screen.getByText("Vista gobierno")).toBeInTheDocument();
    expect(screen.getByText(/lectura territorial, alertas ejecutivas y seguimiento agregado/i)).toBeInTheDocument();

    expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();
    expect(screen.queryByText("Permisos")).not.toBeInTheDocument();
    expect(screen.queryByText("Instituciones")).not.toBeInTheDocument();
    expect(screen.queryByText("Dispositivos")).not.toBeInTheDocument();
    expect(screen.queryByText("Configuración")).not.toBeInTheDocument();
  });

  it("keeps researcher focused on dashboard, games and syncs", () => {
    useAuthMock.mockReturnValue({
      user: {
        fullName: "Rita Researcher",
        email: "research@example.com",
        roles: ["researcher"],
        permissions: ["game_data:read", "ble_device:read"],
      },
      logout: vi.fn(),
    });

    renderShell();

    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Partidas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sincronizaciones").length).toBeGreaterThan(0);
    expect(screen.getByText("Vista investigación")).toBeInTheDocument();
    expect(screen.getByText(/evidencia visible, consistencia entre sync y partida/i)).toBeInTheDocument();

    expect(screen.queryByText("Dispositivos")).not.toBeInTheDocument();
    expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();
    expect(screen.queryByText("Permisos")).not.toBeInTheDocument();
    expect(screen.queryByText("Instituciones")).not.toBeInTheDocument();
  });

  it("keeps family focused on dashboard only", () => {
    useAuthMock.mockReturnValue({
      user: {
        fullName: "Familia Demo",
        email: "family@example.com",
        roles: ["family"],
        permissions: ["game_data:read"],
      },
      logout: vi.fn(),
    });

    renderShell();

    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getByText("Vista familia")).toBeInTheDocument();
    expect(screen.getByText(/lectura simple y cuidada de actividad visible/i)).toBeInTheDocument();

    expect(screen.queryByText("Partidas")).not.toBeInTheDocument();
    expect(screen.queryByText("Sincronizaciones")).not.toBeInTheDocument();
    expect(screen.queryByText("Dispositivos")).not.toBeInTheDocument();
    expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();
  });
});
