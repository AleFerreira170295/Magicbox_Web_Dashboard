import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <AuthShell title="MagicBox" description="Ingresá con tu cuenta para seguir en la web.">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando formulario...</div>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
