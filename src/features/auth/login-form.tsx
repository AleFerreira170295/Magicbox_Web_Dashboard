"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck, DatabaseZap, LineChart, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/auth-context";
import { getErrorMessage } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("Ingresá un email válido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, status } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const nextParam = searchParams.get("next");
  const redirectTo = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
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
    <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="soft-panel rounded-[36px] p-8 lg:p-10">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <span className="size-2 rounded-full bg-primary" />
          MagicBox
        </p>
        <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-[-0.05em] text-slate-950 lg:text-6xl">
          Observabilidad total, analítica trazable y datos sin pérdida.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          Esta base web ya queda preparada para navegar sincronizaciones, partidas y dispositivos, y para evolucionar a un pipeline verdaderamente lossless desde firmware hasta dashboard.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[
            [DatabaseZap, "Raw first", "Persistir payload completo antes de interpretar."],
            [LineChart, "Analítica preparada", "Modelos canónicos y métricas derivadas sin perder vínculo con la base."],
            [Lock, "Privacidad y permisos", "Diseño preparado para roles, institución y datasets anonimizados."],
            [ShieldCheck, "Trazabilidad", "Cada sync y partida vinculados a device, firmware, timestamps y origen."],
          ].map(([Icon, title, description]) => (
            <div key={title as string} className="rounded-[28px] border border-border bg-white/92 p-5 shadow-[0_18px_34px_rgba(66,128,164,0.08)]">
              <div className="mb-3 inline-flex rounded-2xl bg-primary/12 p-2.5 text-primary">
                <Icon className="size-5" />
              </div>
              <h2 className="text-base font-semibold text-slate-950">{title as string}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description as string}</p>
            </div>
          ))}
        </div>
      </div>

      <Card className="border-white/60 bg-white/95 shadow-[0_24px_56px_rgba(66,128,164,0.12)] backdrop-blur">
        <CardHeader>
          <CardTitle>Ingresar al dashboard</CardTitle>
          <CardDescription>
            Usa el backend Flask actual. Si el backend todavía no expone roles reales, la navegación usa el fallback configurado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="tu@magicbox.com" {...form.register("email")} />
              {form.formState.errors.email ? (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" placeholder="••••••••" {...form.register("password")} />
              {form.formState.errors.password ? (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              ) : null}
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Ingresando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
