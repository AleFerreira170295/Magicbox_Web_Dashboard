"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const { login, status } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [router, status]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values);
      router.replace("/dashboard");
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  });

  return (
    <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-3xl border border-primary/10 bg-white/70 p-8 shadow-sm backdrop-blur lg:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">MagicBox</p>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
          Observabilidad total, analítica trazable y datos sin pérdida.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
          Esta base web ya queda preparada para navegar sincronizaciones, partidas y dispositivos, y para evolucionar a un pipeline verdaderamente lossless desde firmware hasta dashboard.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[
            [DatabaseZap, "Raw first", "Persistir payload completo antes de interpretar."],
            [LineChart, "Analítica preparada", "Modelos canónicos y métricas derivadas sin perder vínculo con la base."],
            [Lock, "Privacidad y permisos", "Diseño preparado para roles, institución y datasets anonimizados."],
            [ShieldCheck, "Trazabilidad", "Cada sync y partida vinculados a device, firmware, timestamps y origen."],
          ].map(([Icon, title, description]) => (
            <div key={title as string} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 inline-flex rounded-xl bg-primary/10 p-2 text-primary">
                <Icon className="size-5" />
              </div>
              <h2 className="text-base font-semibold text-slate-950">{title as string}</h2>
              <p className="mt-1 text-sm text-slate-600">{description as string}</p>
            </div>
          ))}
        </div>
      </div>

      <Card className="border-white/60 bg-white/90 shadow-lg backdrop-blur">
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
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
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
