"use client";

import { LockKeyhole, RadioTower, Settings, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { appConfig } from "@/lib/api/config";

const configurationTracks = [
  {
    title: "Autenticación y acceso",
    description: "Políticas globales de login, claims, roles, permisos efectivos y overrides administrativos.",
    status: "En diseño",
    icon: LockKeyhole,
  },
  {
    title: "Sincronización y operación",
    description: "Parámetros globales para salud del sistema, calidad de sync, thresholds y alertas futuras.",
    status: "En diseño",
    icon: RadioTower,
  },
  {
    title: "Feature flags y comportamiento",
    description: "Activación gradual de módulos, experiencias por rol y visibilidad de funcionalidades.",
    status: "En diseño",
    icon: SlidersHorizontal,
  },
  {
    title: "Seguridad y gobernanza",
    description: "Auditoría, trazabilidad, privacidad y reglas globales de administración del sistema.",
    status: "En diseño",
    icon: ShieldCheck,
  },
];

export function SystemSettingsCenter() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Superadmin"
        title="Configuración global"
        description="Centro inicial para visualizar y ordenar configuraciones transversales del sistema. La idea es que aquí converjan las políticas que afectan a todos los módulos del superadmin."
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.95fr]">
        <Card className="overflow-hidden border-none bg-[linear-gradient(135deg,#1f2a37_0%,#2c4156_55%,#39546f_100%)] text-white shadow-[0_20px_60px_rgba(31,42,55,0.22)]">
          <CardContent className="p-8 sm:p-10">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/14 text-white hover:bg-white/14">Centro de control</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Políticas globales</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Superadmin</Badge>
            </div>

            <div className="mt-6 max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                La configuración global tiene que explicar cómo se comporta el sistema, no solo dónde se cambia cada cosa.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/78">
                Esta primera versión organiza la columna vertebral de políticas y parámetros transversales para que luego podamos enchufar settings reales sin improvisar la UX.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Login y roles</p>
                <p className="mt-2 text-lg font-medium">Quién entra, con qué alcance y bajo qué reglas.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Operación</p>
                <p className="mt-2 text-lg font-medium">Qué umbrales, señales y criterios globales guían el soporte.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Gobernanza</p>
                <p className="mt-2 text-lg font-medium">Cómo se controla la plataforma a nivel completo.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Contexto actual del frontend</CardTitle>
            <CardDescription>
              Dejo visibles algunos valores efectivos del dashboard para que esta pantalla ya sea útil antes de conectar settings persistentes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">App name</p>
              <p className="mt-1 text-sm text-muted-foreground">{appConfig.appName}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">API base URL</p>
              <p className="mt-1 break-all text-sm text-muted-foreground">{appConfig.apiBaseUrl}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Default role fallback</p>
              <p className="mt-1 text-sm text-muted-foreground">{appConfig.defaultRole}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Sesión actual</p>
              <p className="mt-1 text-sm text-muted-foreground">{user?.email || "Sin email"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {configurationTracks.map((track) => {
          const Icon = track.icon;
          return (
            <Card key={track.title} className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-2xl bg-primary/12 p-3 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <Badge variant="secondary">{track.status}</Badge>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-foreground">{track.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{track.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Qué conviene colgar primero aquí</CardTitle>
            <CardDescription>
              Para que esta pantalla deje de ser solo estructural y empiece a gobernar el producto de verdad.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">1. Matriz real de roles y permisos</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Qué puede hacer cada perfil, a nivel global e institucional.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">2. Feature flags</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Qué módulos se activan por cliente, por entorno o por etapa del producto.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">3. Reglas operativas</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Thresholds, criterios de health, alertas y políticas de soporte.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="size-5 text-primary" />
              <CardTitle>Lectura de esta iteración</CardTitle>
            </div>
            <CardDescription>
              Esta pantalla ya cumple una función útil: ordenar la conversación del producto y darte una navegación coherente mientras el backend madura.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
              Aunque todavía no haya settings persistentes del lado servidor, la estructura frontend ya deja claro dónde vivirán las decisiones globales del sistema y cómo se relacionan con usuarios, permisos, instituciones y salud operativa.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
