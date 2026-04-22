import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Nueva contraseña" description="Elegí una clave segura para volver a entrar.">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando formulario...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
