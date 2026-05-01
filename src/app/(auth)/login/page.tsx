"use client";

import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/features/auth/login-form";
import { useLanguage } from "@/features/i18n/i18n-context";

function LoginFallback() {
  const { t } = useLanguage();
  return <div className="text-sm text-muted-foreground">{t.auth.pages.login.loading}</div>;
}

export default function LoginPage() {
  return (
    <AuthShell page="login">
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
