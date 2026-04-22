import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/(app)/dashboard/page";
import DevicesPage from "@/app/(app)/devices/page";
import GamesPage from "@/app/(app)/games/page";
import HealthPage from "@/app/(app)/health/page";
import InstitutionsPage from "@/app/(app)/institutions/page";
import PermissionsPage from "@/app/(app)/permissions/page";
import ProfilesPage from "@/app/(app)/profiles/page";
import SettingsPage from "@/app/(app)/settings/page";
import SyncsPage from "@/app/(app)/syncs/page";
import TerritorialAlertsPage from "@/app/(app)/territorial-alerts/page";
import TerritorialOverviewPage from "@/app/(app)/territorial-overview/page";
import UsersPage from "@/app/(app)/users/page";

const useAuthMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/dashboard/dashboard-home", () => ({
  DashboardHome: () => <div>dashboard-home</div>,
}));

vi.mock("@/features/devices/devices-table", () => ({
  DevicesTable: () => <div>devices-table</div>,
}));

vi.mock("@/features/games/games-table", () => ({
  GamesTable: () => <div>games-table</div>,
}));

vi.mock("@/features/health/system-health-dashboard", () => ({
  SystemHealthDashboard: () => <div>system-health-dashboard</div>,
}));

vi.mock("@/features/institutions/institutions-overview", () => ({
  InstitutionsOverview: () => <div>institutions-overview</div>,
}));

vi.mock("@/features/permissions/permissions-center", () => ({
  PermissionsCenter: () => <div>permissions-center</div>,
}));

vi.mock("@/features/profiles/relevant-profiles", () => ({
  RelevantProfiles: () => <div>relevant-profiles</div>,
}));

vi.mock("@/features/settings/system-settings-center", () => ({
  SystemSettingsCenter: () => <div>system-settings-center</div>,
}));

vi.mock("@/features/syncs/syncs-table", () => ({
  SyncsTable: () => <div>syncs-table</div>,
}));

vi.mock("@/features/dashboard/territorial-alerts-center", () => ({
  TerritorialAlertsCenter: () => <div>territorial-alerts-center</div>,
}));

vi.mock("@/features/dashboard/territorial-overview-center", () => ({
  TerritorialOverviewCenter: () => <div>territorial-overview-center</div>,
}));

vi.mock("@/features/users/users-table", () => ({
  UsersTable: () => <div>users-table</div>,
}));

const allModules = [
  "dashboard-home",
  "devices-table",
  "games-table",
  "system-health-dashboard",
  "institutions-overview",
  "permissions-center",
  "relevant-profiles",
  "system-settings-center",
  "syncs-table",
  "territorial-alerts-center",
  "territorial-overview-center",
  "users-table",
] as const;

function renderProtectedPages() {
  return render(
    <>
      <DashboardPage />
      <DevicesPage />
      <GamesPage />
      <HealthPage />
      <InstitutionsPage />
      <PermissionsPage />
      <ProfilesPage />
      <SettingsPage />
      <SyncsPage />
      <TerritorialAlertsPage />
      <TerritorialOverviewPage />
      <UsersPage />
    </>,
  );
}

describe("operational route guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it.each([
    {
      role: "guest",
      visible: [],
    },
    {
      role: "admin",
      visible: [
        "dashboard-home",
        "devices-table",
        "games-table",
        "system-health-dashboard",
        "institutions-overview",
        "permissions-center",
        "relevant-profiles",
        "system-settings-center",
        "syncs-table",
        "users-table",
      ],
    },
    {
      role: "institution-admin",
      visible: [
        "dashboard-home",
        "devices-table",
        "games-table",
        "institutions-overview",
        "permissions-center",
        "relevant-profiles",
        "syncs-table",
        "users-table",
      ],
    },
    {
      role: "director",
      visible: [
        "dashboard-home",
        "devices-table",
        "games-table",
        "institutions-overview",
        "relevant-profiles",
        "syncs-table",
      ],
    },
    {
      role: "teacher",
      visible: ["dashboard-home", "devices-table", "games-table", "syncs-table"],
    },
    {
      role: "researcher",
      visible: ["dashboard-home", "games-table", "syncs-table"],
    },
    {
      role: "family",
      visible: ["dashboard-home", "games-table", "syncs-table"],
    },
    {
      role: "government-viewer",
      visible: ["dashboard-home", "territorial-alerts-center", "territorial-overview-center"],
    },
  ])("applies the full screen contract for %s", ({ role, visible }) => {
    useAuthMock.mockReturnValue({
      user: { roles: [role], permissions: [] },
    });

    renderProtectedPages();

    visible.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    allModules
      .filter((label) => !visible.includes(label))
      .forEach((label) => {
        expect(screen.queryByText(label)).not.toBeInTheDocument();
      });

    expect(screen.getAllByText("Acceso restringido")).toHaveLength(allModules.length - visible.length);
  });
});
