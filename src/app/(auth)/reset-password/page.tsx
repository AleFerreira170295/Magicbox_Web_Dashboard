"use client";

import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { useLanguage } from "@/features/i18n/i18n-context";

function ResetPasswordFallback() {
  const { t } = useLanguage();
  return <div className="text-sm text-muted-foreground">{t.auth.pages.resetPassword.loading}</div>;
}

export default function ResetPasswordPage() {
  return (
    <AuthShell page="resetPassword">
      <Suspense fallback={<ResetPasswordFallback />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
