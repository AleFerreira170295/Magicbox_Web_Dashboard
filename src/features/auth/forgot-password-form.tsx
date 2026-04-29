"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPassword } from "@/features/auth/auth-api";
import { validateEmail } from "@/features/auth/validators";
import { getErrorMessage } from "@/lib/utils";
import { useState } from "react";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ email: string }>({
    defaultValues: { email: "" },
  });

  async function onSubmit(values: { email: string }) {
    setError(null);
    try {
      const email = values.email.trim();
      await forgotPassword(email);
      router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-sky-100 bg-sky-50 px-5 py-4 text-sm leading-6 text-sky-900">
        Te enviamos un código al correo asociado a tu cuenta para continuar con el restablecimiento.
      </div>

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
      ) : null}

      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...form.register("email", { validate: (value) => validateEmail(value) })} />
          {form.formState.errors.email ? <p className="text-sm text-destructive">{form.formState.errors.email.message}</p> : null}
        </div>

        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Enviando..." : "Enviar código"}
        </Button>
      </form>

      <div className="flex items-center justify-between gap-3 text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Volver al login
        </Link>
        <Link href="/register" className="font-medium text-primary hover:underline">
          Crear usuario
        </Link>
      </div>
    </div>
  );
}
