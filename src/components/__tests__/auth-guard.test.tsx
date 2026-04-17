import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGuard } from "@/components/auth-guard";

const useAuthMock = vi.fn();
const usePathnameMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue("/devices");
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a restoring state while the session is loading", () => {
    useAuthMock.mockReturnValue({ status: "loading" });

    render(
      <AuthGuard>
        <div>contenido protegido</div>
      </AuthGuard>,
    );

    expect(screen.getByText("Restaurando sesión...")).toBeInTheDocument();
    expect(screen.queryByText("contenido protegido")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated sessions to login preserving the next path", async () => {
    useAuthMock.mockReturnValue({ status: "unauthenticated" });

    render(
      <AuthGuard>
        <div>contenido protegido</div>
      </AuthGuard>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login?next=%2Fdevices");
    });
    expect(screen.queryByText("contenido protegido")).not.toBeInTheDocument();
  });

  it("renders children for authenticated sessions", () => {
    useAuthMock.mockReturnValue({ status: "authenticated" });

    render(
      <AuthGuard>
        <div>contenido protegido</div>
      </AuthGuard>,
    );

    expect(screen.getByText("contenido protegido")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
