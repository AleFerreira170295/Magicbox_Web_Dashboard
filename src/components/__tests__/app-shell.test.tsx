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

function expectVisibleLabels(labels: string[]) {
  labels.forEach((label) => {
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });
}

function expectHiddenLabels(labels: string[]) {
  labels.forEach((label) => {
    expect(screen.queryByText(label)).not.toBeInTheDocument();
  });
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

  it("shows institution-admin navigation aligned with the enabled modules and strong permissions contract", () => {
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
    expect(screen.getAllByText("Permisos").length).toBeGreaterThan(0);

    expect(screen.queryByText("Configuración")).not.toBeInTheDocument();
    expect(screen.queryByText("Salud")).not.toBeInTheDocument();
  });

  it("shows teacher-specific shell copy and friendly role labels", () => {
    useAuthMock.mockReturnValue({
      user: {
        fullName: "Teo Teacher",
        email: "teacher@example.com",
        roles: ["teacher"],
        permissions: ["game_data:read"],
      },
      logout: vi.fn(),
    });

    renderShell();

    expect(screen.getByText("Vista docente")).toBeInTheDocument();
    expect(screen.getByText(/operar el aula con rapidez/i)).toBeInTheDocument();
    expect(screen.getAllByText("docente").length).toBeGreaterThan(0);
  });

  it("keeps permissions navigation visible for institution-admin sessions with ACL read access", () => {
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
    expect(screen.getByText(/seguimiento territorial, alertas ejecutivas y lectura agregada/i)).toBeInTheDocument();

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
    expect(screen.getByText(/evidencia capturada, consistencia entre sync y partida/i)).toBeInTheDocument();

    expect(screen.queryByText("Dispositivos")).not.toBeInTheDocument();
    expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();
    expect(screen.queryByText("Permisos")).not.toBeInTheDocument();
    expect(screen.queryByText("Instituciones")).not.toBeInTheDocument();
  });

  it("keeps family focused on dashboard and simplified activity views", () => {
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
    expect(screen.getAllByText("Partidas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sincronizaciones").length).toBeGreaterThan(0);
    expect(screen.getByText("Vista familia")).toBeInTheDocument();
    expect(screen.getByText(/seguimiento simple y claro de la actividad/i)).toBeInTheDocument();

    expect(screen.getAllByText("Dispositivos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Usuarios").length).toBeGreaterThan(0);
  });

  it("keeps the navigation matrix aligned across the supported profiles", () => {
    const cases = [
      {
        name: "admin",
        user: {
          fullName: "Ada Admin",
          email: "admin@example.com",
          roles: ["admin"],
          permissions: ["feature:read"],
        },
        visible: ["Dashboard", "Sincronizaciones", "Partidas", "Usuarios", "Permisos", "Instituciones", "Salud", "Perfiles", "Configuración", "Dispositivos"],
        hidden: ["Alertas territoriales", "Territorios e instituciones"],
      },
      {
        name: "director",
        user: {
          fullName: "Diana Director",
          email: "director@example.com",
          roles: ["director"],
          permissions: ["game_data:read"],
        },
        visible: ["Dashboard", "Sincronizaciones", "Partidas", "Instituciones", "Perfiles", "Dispositivos"],
        hidden: ["Usuarios", "Permisos", "Salud", "Configuración", "Alertas territoriales", "Territorios e instituciones"],
      },
      {
        name: "institution-admin with acl read",
        user: {
          fullName: "Irene Institution",
          email: "ia@example.com",
          roles: ["institution-admin"],
          permissions: ["access_control:read", "feature:read"],
        },
        visible: ["Dashboard", "Sincronizaciones", "Partidas", "Usuarios", "Permisos", "Instituciones", "Perfiles", "Dispositivos"],
        hidden: ["Salud", "Configuración", "Alertas territoriales", "Territorios e instituciones"],
      },
      {
        name: "institution-admin without acl read still sees permissions",
        user: {
          fullName: "Irene Institution",
          email: "ia@example.com",
          roles: ["institution-admin"],
          permissions: [],
        },
        visible: ["Dashboard", "Sincronizaciones", "Partidas", "Usuarios", "Permisos", "Instituciones", "Perfiles", "Dispositivos"],
        hidden: ["Salud", "Configuración", "Alertas territoriales", "Territorios e instituciones"],
      },
      {
        name: "teacher",
        user: {
          fullName: "Teo Teacher",
          email: "teacher@example.com",
          roles: ["teacher"],
          permissions: ["game_data:read"],
        },
        visible: ["Dashboard", "Sincronizaciones", "Partidas", "Dispositivos"],
        hidden: ["Usuarios", "Permisos", "Instituciones", "Salud", "Perfiles", "Configuración", "Alertas territoriales", "Territorios e instituciones"],
      },
      {
        name: "researcher",
        user: {
          fullName: "Rita Researcher",
          email: "research@example.com",
          roles: ["researcher"],
          permissions: ["game_data:read", "ble_device:read"],
        },
        visible: ["Dashboard", "Sincronizaciones", "Partidas"],
        hidden: ["Dispositivos", "Usuarios", "Permisos", "Instituciones", "Salud", "Perfiles", "Configuración", "Alertas territoriales", "Territorios e instituciones"],
      },
      {
        name: "family",
        user: {
          fullName: "Familia Demo",
          email: "family@example.com",
          roles: ["family"],
          permissions: ["game_data:read"],
        },
        visible: ["Dashboard", "Sincronizaciones", "Partidas", "Dispositivos", "Usuarios"],
        hidden: ["Permisos", "Instituciones", "Salud", "Perfiles", "Configuración", "Alertas territoriales", "Territorios e instituciones"],
      },
      {
        name: "government-viewer",
        user: {
          fullName: "Gobierno Territorial",
          email: "gov@example.com",
          roles: ["government-viewer"],
          permissions: ["feature:read"],
        },
        visible: ["Dashboard", "Alertas territoriales", "Territorios e instituciones"],
        hidden: ["Sincronizaciones", "Partidas", "Dispositivos", "Usuarios", "Permisos", "Instituciones", "Salud", "Perfiles", "Configuración"],
      },
    ];

    cases.forEach(({ user, visible, hidden }) => {
      cleanup();
      useAuthMock.mockReturnValue({ user, logout: vi.fn() });
      renderShell();
      expectVisibleLabels(visible);
      expectHiddenLabels(hidden);
    });
  });
});
