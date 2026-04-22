import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Nueva contraseña">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando formulario...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
