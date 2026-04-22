import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/features/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthShell title="Crear usuario" description="El alta autónoma está disponible solo para cuentas family.">
      <RegisterForm />
    </AuthShell>
  );
}
