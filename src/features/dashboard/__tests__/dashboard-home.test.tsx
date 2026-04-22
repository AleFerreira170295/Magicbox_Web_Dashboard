import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardHome } from "@/features/dashboard/dashboard-home";

const useAuthMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/dashboard/superadmin-dashboard", () => ({
  SuperadminDashboard: () => <div>superadmin-dashboard</div>,
}));

vi.mock("@/features/dashboard/institution-dashboard", () => ({
  InstitutionDashboard: () => <div>institution-dashboard</div>,
}));

vi.mock("@/features/dashboard/teacher-dashboard", () => ({
  TeacherDashboard: () => <div>teacher-dashboard</div>,
}));

vi.mock("@/features/dashboard/researcher-dashboard", () => ({
  ResearcherDashboard: () => <div>researcher-dashboard</div>,
}));

describe("DashboardHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("routes institution-admin users to the institution dashboard home", () => {
    useAuthMock.mockReturnValue({
      user: {
        roles: ["institution-admin"],
      },
    });

    render(<DashboardHome />);

    expect(screen.getByText("institution-dashboard")).toBeInTheDocument();
    expect(screen.queryByText("teacher-dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("superadmin-dashboard")).not.toBeInTheDocument();
  });

  it("keeps teacher users on the teacher dashboard", () => {
    useAuthMock.mockReturnValue({
      user: {
        roles: ["teacher"],
      },
    });

    render(<DashboardHome />);

    expect(screen.getByText("teacher-dashboard")).toBeInTheDocument();
    expect(screen.queryByText("superadmin-dashboard")).not.toBeInTheDocument();
  });

  it("routes government-viewer users to the executive dashboard home", () => {
    useAuthMock.mockReturnValue({
      user: {
        roles: ["government-viewer"],
      },
    });

    render(<DashboardHome />);

    expect(screen.getByText("superadmin-dashboard")).toBeInTheDocument();
    expect(screen.queryByText("teacher-dashboard")).not.toBeInTheDocument();
  });

  it("routes researcher users to the researcher dashboard home", () => {
    useAuthMock.mockReturnValue({
      user: {
        roles: ["researcher"],
      },
    });

    render(<DashboardHome />);

    expect(screen.getByText("researcher-dashboard")).toBeInTheDocument();
    expect(screen.queryByText("teacher-dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("superadmin-dashboard")).not.toBeInTheDocument();
  });

  it("routes director users to the institution dashboard home", () => {
    useAuthMock.mockReturnValue({
      user: {
        roles: ["director"],
      },
    });

    render(<DashboardHome />);

    expect(screen.getByText("institution-dashboard")).toBeInTheDocument();
    expect(screen.queryByText("teacher-dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("superadmin-dashboard")).not.toBeInTheDocument();
  });
});
