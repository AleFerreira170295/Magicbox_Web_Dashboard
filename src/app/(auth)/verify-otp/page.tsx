import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { VerifyOtpForm } from "@/features/auth/verify-otp-form";

export default function VerifyOtpPage() {
  return (
    <AuthShell title="Verificar código" description="Ingresá el código de 6 dígitos que te llegó por correo.">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando verificación...</div>}>
        <VerifyOtpForm />
      </Suspense>
    </AuthShell>
  );
}
