import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/(app)/dashboard/page";
import DevicesPage from "@/app/(app)/devices/page";
import GamesPage from "@/app/(app)/games/page";
import SyncsPage from "@/app/(app)/syncs/page";
import TerritorialAlertsPage from "@/app/(app)/territorial-alerts/page";
import TerritorialOverviewPage from "@/app/(app)/territorial-overview/page";

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

vi.mock("@/features/syncs/syncs-table", () => ({
  SyncsTable: () => <div>syncs-table</div>,
}));

vi.mock("@/features/dashboard/territorial-alerts-center", () => ({
  TerritorialAlertsCenter: () => <div>territorial-alerts-center</div>,
}));

vi.mock("@/features/dashboard/territorial-overview-center", () => ({
  TerritorialOverviewCenter: () => <div>territorial-overview-center</div>,
}));

describe("operational route guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("blocks direct access for roles outside the allowed navigation contract", () => {
    useAuthMock.mockReturnValue({
      user: { roles: ["family"], permissions: [] },
    });

    render(
      <>
        <DashboardPage />
        <DevicesPage />
        <GamesPage />
        <SyncsPage />
        <TerritorialAlertsPage />
        <TerritorialOverviewPage />
      </>,
    );

    expect(screen.queryByText("dashboard-home")).not.toBeInTheDocument();
    expect(screen.queryByText("devices-table")).not.toBeInTheDocument();
    expect(screen.queryByText("games-table")).not.toBeInTheDocument();
    expect(screen.queryByText("syncs-table")).not.toBeInTheDocument();
    expect(screen.queryByText("territorial-alerts-center")).not.toBeInTheDocument();
    expect(screen.queryByText("territorial-overview-center")).not.toBeInTheDocument();
    expect(screen.getAllByText("Acceso restringido")).toHaveLength(6);
  });

  it("allows teacher access to the routes enabled for that role", () => {
    useAuthMock.mockReturnValue({
      user: { roles: ["teacher"], permissions: [] },
    });

    render(
      <>
        <DashboardPage />
        <DevicesPage />
        <GamesPage />
        <SyncsPage />
        <TerritorialAlertsPage />
        <TerritorialOverviewPage />
      </>,
    );

    expect(screen.getByText("dashboard-home")).toBeInTheDocument();
    expect(screen.getByText("devices-table")).toBeInTheDocument();
    expect(screen.getByText("games-table")).toBeInTheDocument();
    expect(screen.getByText("syncs-table")).toBeInTheDocument();
    expect(screen.queryByText("territorial-alerts-center")).not.toBeInTheDocument();
    expect(screen.queryByText("territorial-overview-center")).not.toBeInTheDocument();
  });

  it("allows researcher into dashboard, games and syncs while keeping devices blocked", () => {
    useAuthMock.mockReturnValue({
      user: { roles: ["researcher"], permissions: [] },
    });

    render(
      <>
        <DashboardPage />
        <DevicesPage />
        <GamesPage />
        <SyncsPage />
        <TerritorialAlertsPage />
        <TerritorialOverviewPage />
      </>,
    );

    expect(screen.getByText("dashboard-home")).toBeInTheDocument();
    expect(screen.getByText("games-table")).toBeInTheDocument();
    expect(screen.getByText("syncs-table")).toBeInTheDocument();
    expect(screen.queryByText("devices-table")).not.toBeInTheDocument();
    expect(screen.queryByText("territorial-alerts-center")).not.toBeInTheDocument();
    expect(screen.queryByText("territorial-overview-center")).not.toBeInTheDocument();
    expect(screen.getAllByText("Acceso restringido")).toHaveLength(3);
  });

  it("allows government-viewer into dashboard but keeps technical routes blocked", () => {
    useAuthMock.mockReturnValue({
      user: { roles: ["government-viewer"], permissions: [] },
    });

    render(
      <>
        <DashboardPage />
        <DevicesPage />
        <GamesPage />
        <SyncsPage />
        <TerritorialAlertsPage />
        <TerritorialOverviewPage />
      </>,
    );

    expect(screen.getByText("dashboard-home")).toBeInTheDocument();
    expect(screen.getByText("territorial-alerts-center")).toBeInTheDocument();
    expect(screen.getByText("territorial-overview-center")).toBeInTheDocument();
    expect(screen.queryByText("devices-table")).not.toBeInTheDocument();
    expect(screen.queryByText("games-table")).not.toBeInTheDocument();
    expect(screen.queryByText("syncs-table")).not.toBeInTheDocument();
    expect(screen.getAllByText("Acceso restringido")).toHaveLength(3);
  });
});
