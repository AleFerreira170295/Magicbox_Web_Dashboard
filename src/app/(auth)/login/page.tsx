import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(71,185,239,0.18),_transparent_30%),linear-gradient(180deg,#ffffff_0%,#f4faff_100%)]">
      <div className="container-shell flex min-h-screen items-center justify-center py-12">
        <Suspense fallback={<div className="w-full max-w-6xl rounded-[36px] border border-border bg-white/80 p-10 text-center text-sm text-muted-foreground shadow-[0_24px_56px_rgba(66,128,164,0.12)]">Cargando acceso al dashboard...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
