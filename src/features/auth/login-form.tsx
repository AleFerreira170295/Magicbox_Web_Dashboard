"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/auth-context";
import { useLanguage } from "@/features/i18n/i18n-context";
import { getErrorMessage } from "@/lib/utils";

type LoginFormValues = { email: string; password: string };

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, status } = useAuth();
  const { t } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const loginSchema = z.object({
    email: z.string().email(t.auth.loginForm.validation.invalidEmail),
    password: z.string().min(1, t.auth.loginForm.validation.requiredPassword),
  });
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const nextParam = searchParams.get("next");
  const redirectTo =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard";

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(redirectTo);
    }
  }, [redirectTo, router, status]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values);
      router.replace(redirectTo);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="email">{t.auth.loginForm.emailLabel}</Label>
        <Input id="email" type="email" autoComplete="email" placeholder={t.auth.loginForm.emailPlaceholder} {...form.register("email")} />
        {form.formState.errors.email ? <p className="text-sm text-destructive">{form.formState.errors.email.message}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t.auth.loginForm.passwordLabel}</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className="pr-20"
            {...form.register("password")}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-3 text-sm font-medium text-primary hover:underline"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? t.auth.loginForm.hidePassword : t.auth.loginForm.showPassword}
            aria-pressed={showPassword}
          >
            {showPassword ? t.auth.loginForm.hidePassword : t.auth.loginForm.showPassword}
          </button>
        </div>
        {form.formState.errors.password ? <p className="text-sm text-destructive">{form.formState.errors.password.message}</p> : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
          {t.auth.loginForm.forgotPassword}
        </Link>
        <Link href="/register" className="text-sm font-medium text-primary hover:underline">
          {t.auth.loginForm.createUser}
        </Link>
      </div>

      <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t.auth.loginForm.submitting : t.auth.loginForm.submit}
      </Button>
    </form>
  );
}
