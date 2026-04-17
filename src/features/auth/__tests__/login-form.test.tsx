import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/features/auth/login-form";

const useAuthMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      login: vi.fn().mockResolvedValue(undefined),
      status: "unauthenticated",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects authenticated sessions straight to dashboard", async () => {
    useAuthMock.mockReturnValue({
      login: vi.fn(),
      status: "authenticated",
    });

    render(<LoginForm />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("logs in and lands on dashboard after submit", async () => {
    const loginMock = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      login: loginMock,
      status: "unauthenticated",
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({
        email: "ana@example.com",
        password: "secret123",
      });
    });
    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });
});
