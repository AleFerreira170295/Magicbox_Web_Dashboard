import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Recuperar contraseña">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
