"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/features/auth/auth-api";
import { useLanguage } from "@/features/i18n/i18n-context";
import { validatePasswordConfirmation, validateSecureBackendPassword } from "@/features/auth/validators";
import { getErrorMessage } from "@/lib/utils";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const validation = t.auth.validation;
  const email = searchParams.get("email") || "";
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ newPassword: string; confirmPassword: string }>({
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!email) {
      router.replace("/forgot-password");
    }
  }, [email, router]);

  async function onSubmit(values: { newPassword: string; confirmPassword: string }) {
    if (!email) return;
    setError(null);
    try {
      await resetPassword({
        email,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      router.replace("/login");
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-sky-100 bg-sky-50 px-5 py-4 text-sm leading-6 text-sky-900">
        {t.auth.resetPasswordForm.notice}
      </div>

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="space-y-2 text-sm text-muted-foreground">
        <p>{t.auth.resetPasswordForm.createFor}</p>
        <p className="font-medium text-foreground">{email || t.auth.resetPasswordForm.fallbackAccount}</p>
      </div>

      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="newPassword">{t.auth.resetPasswordForm.newPassword}</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            {...form.register("newPassword", { validate: (value) => validateSecureBackendPassword(value, validation) })}
          />
          {form.formState.errors.newPassword ? <p className="text-sm text-destructive">{form.formState.errors.newPassword.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t.auth.resetPasswordForm.confirmPassword}</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...form.register("confirmPassword", {
              validate: (value) => validatePasswordConfirmation(value, form.getValues("newPassword"), validation),
            })}
          />
          {form.formState.errors.confirmPassword ? <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p> : null}
        </div>

        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting || !email}>
          {form.formState.isSubmitting ? t.auth.resetPasswordForm.submitting : t.auth.resetPasswordForm.submit}
        </Button>
      </form>

      <div className="flex items-center justify-between gap-3 text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t.auth.resetPasswordForm.backToLogin}
        </Link>
        <Link href="/forgot-password" className="font-medium text-primary hover:underline">
          {t.auth.resetPasswordForm.resend}
        </Link>
      </div>
    </div>
  );
}
