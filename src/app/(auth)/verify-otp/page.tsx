"use client";

import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { VerifyOtpForm } from "@/features/auth/verify-otp-form";
import { useLanguage } from "@/features/i18n/i18n-context";

function VerifyOtpFallback() {
  const { t } = useLanguage();
  return <div className="text-sm text-muted-foreground">{t.auth.pages.verifyOtp.loading}</div>;
}

export default function VerifyOtpPage() {
  return (
    <AuthShell page="verifyOtp">
      <Suspense fallback={<VerifyOtpFallback />}>
        <VerifyOtpForm />
      </Suspense>
    </AuthShell>
  );
}
