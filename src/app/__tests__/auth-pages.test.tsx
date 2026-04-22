import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";
import LoginPage from "@/app/(auth)/login/page";
import RegisterPage from "@/app/(auth)/register/page";
import ResetPasswordPage from "@/app/(auth)/reset-password/page";
import VerifyOtpPage from "@/app/(auth)/verify-otp/page";

vi.mock("@/features/auth/login-form", () => ({
  LoginForm: () => <div>login-form</div>,
}));

vi.mock("@/features/auth/register-form", () => ({
  RegisterForm: () => <div>register-form</div>,
}));

vi.mock("@/features/auth/forgot-password-form", () => ({
  ForgotPasswordForm: () => <div>forgot-password-form</div>,
}));

vi.mock("@/features/auth/verify-otp-form", () => ({
  VerifyOtpForm: () => <div>verify-otp-form</div>,
}));

vi.mock("@/features/auth/reset-password-form", () => ({
  ResetPasswordForm: () => <div>reset-password-form</div>,
}));

describe("auth pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps the login page minimal", () => {
    render(<LoginPage />);

    expect(screen.getByText("MagicBox")).toBeInTheDocument();
    expect(screen.getByText("login-form")).toBeInTheDocument();
    expect(screen.queryByText(/Observabilidad total/i)).not.toBeInTheDocument();
  });

  it("renders the register page shell", () => {
    render(<RegisterPage />);

    expect(screen.getByText("Crear usuario")).toBeInTheDocument();
    expect(screen.getByText("register-form")).toBeInTheDocument();
  });

  it("renders the forgot password page shell", () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByText("Recuperar contraseña")).toBeInTheDocument();
    expect(screen.getByText("forgot-password-form")).toBeInTheDocument();
  });

  it("renders the OTP verification page shell", () => {
    render(<VerifyOtpPage />);

    expect(screen.getByText("Verificar código")).toBeInTheDocument();
    expect(screen.getByText("verify-otp-form")).toBeInTheDocument();
  });

  it("renders the reset password page shell", () => {
    render(<ResetPasswordPage />);

    expect(screen.getByText("Nueva contraseña")).toBeInTheDocument();
    expect(screen.getByText("reset-password-form")).toBeInTheDocument();
  });
});
