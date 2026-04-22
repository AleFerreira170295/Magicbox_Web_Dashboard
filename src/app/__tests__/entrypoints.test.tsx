import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/(auth)/login/page";
import HomePage from "@/app/page";

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

vi.mock("@/features/auth/login-form", () => ({
  LoginForm: () => <div>login-form</div>,
}));

describe("app entrypoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects the home entrypoint to dashboard", () => {
    HomePage();

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("renders the login entrypoint shell", () => {
    render(<LoginPage />);

    expect(screen.getByText("MagicBox")).toBeInTheDocument();
    expect(screen.getByText("login-form")).toBeInTheDocument();
    expect(screen.queryByText("Cargando acceso al dashboard...")).not.toBeInTheDocument();
    expect(screen.queryByText(/Observabilidad total/i)).not.toBeInTheDocument();
  });
});
