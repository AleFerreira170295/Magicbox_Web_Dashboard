"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/features/auth/auth-api";
import { validatePasswordConfirmation, validateSecureBackendPassword } from "@/features/auth/validators";
import { getErrorMessage } from "@/lib/utils";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ newPassword: string; confirmPassword: string }>({
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!email) {
      router.replace("/auth/forgot-password");
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
      router.replace("/auth/login");
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-sky-100 bg-sky-50 px-5 py-4 text-sm leading-6 text-sky-900">
        Elegí una nueva clave segura y no la reutilices en otros servicios.
      </div>

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Creá una nueva contraseña para:</p>
        <p className="font-medium text-foreground">{email || "tu cuenta"}</p>
      </div>

      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="newPassword">Nueva contraseña</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            {...form.register("newPassword", { validate: (value) => validateSecureBackendPassword(value) })}
          />
          {form.formState.errors.newPassword ? <p className="text-sm text-destructive">{form.formState.errors.newPassword.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...form.register("confirmPassword", {
              validate: (value) => validatePasswordConfirmation(value, form.getValues("newPassword")),
            })}
          />
          {form.formState.errors.confirmPassword ? <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p> : null}
        </div>

        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting || !email}>
          {form.formState.isSubmitting ? "Actualizando..." : "Actualizar contraseña"}
        </Button>
      </form>

      <div className="flex items-center justify-between gap-3 text-sm">
        <Link href="/auth/login" className="font-medium text-primary hover:underline">
          Volver al login
        </Link>
        <Link href="/auth/forgot-password" className="font-medium text-primary hover:underline">
          Reenviar código
        </Link>
      </div>
    </div>
  );
}
