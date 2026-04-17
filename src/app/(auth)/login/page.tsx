import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(71,185,239,0.18),_transparent_30%),linear-gradient(180deg,#ffffff_0%,#f4faff_100%)]">
      <div className="container-shell flex min-h-screen items-center justify-center py-12">
        <LoginForm />
      </div>
    </main>
  );
}
