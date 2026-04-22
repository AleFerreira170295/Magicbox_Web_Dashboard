import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Recuperar contraseña" description="Te enviamos un código al correo para seguir con el restablecimiento.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
