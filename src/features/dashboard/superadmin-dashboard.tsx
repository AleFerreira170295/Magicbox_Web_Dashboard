"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Database,
  KeyRound,
  Layers3,
  ShieldCheck,
  Smartphone,
  UserPlus,
  Users,
} from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
import { useGames } from "@/features/games/api";
import { useSyncSessions } from "@/features/syncs/api";
import { getErrorMessage } from "@/lib/utils";

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "accent" | "secondary";
}) {
  const toneClass = {
    primary: "bg-primary/12 text-primary",
    accent: "bg-accent text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground",
  }[tone];

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p>
          </div>
          <div className={`rounded-2xl p-3 ${toneClass}`}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleCard({
  title,
  description,
  icon: Icon,
  href,
  status,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  status: "live" | "next";
}) {
  const content = (
    <Card className="h-full border-border/80 bg-card/95 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(31,42,55,0.08)]">
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="rounded-2xl bg-primary/12 p-3 text-primary">
            <Icon className="size-5" />
          </div>
          <Badge variant={status === "live" ? "success" : "secondary"}>
            {status === "live" ? "Disponible" : "Próximo"}
          </Badge>
        </div>
        <div className="mt-5">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <div className="mt-auto pt-5 text-sm font-medium text-primary">
          {status === "live" && href ? "Abrir módulo" : "Diseñar siguiente fase"}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

export function SuperadminDashboard() {
  const { tokens, user } = useAuth();
  const gamesQuery = useGames(tokens?.accessToken);
  const devicesQuery = useDevices(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);

  const isLoading = gamesQuery.isLoading || devicesQuery.isLoading || syncsQuery.isLoading;
  const error = gamesQuery.error || devicesQuery.error || syncsQuery.error;

  const devices = devicesQuery.data?.data || [];
  const syncs = syncsQuery.data?.data || [];
  const games = gamesQuery.data?.data || [];

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Superadmin"
        title="Centro de control MagicBox"
        description="Esta vista ya piensa el dashboard como consola operativa global: usuarios, permisos, instituciones, estado de dispositivos y visibilidad transversal sobre la operación completa."
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="overflow-hidden border-none bg-[linear-gradient(135deg,#1f2a37_0%,#2c4156_55%,#39546f_100%)] text-white shadow-[0_20px_60px_rgba(31,42,55,0.22)]">
          <CardContent className="p-8 sm:p-10">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/14 text-white hover:bg-white/14">Operación global</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Permisos y accesos</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Estado institucional</Badge>
            </div>

            <div className="mt-6 max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Una home pensada para gobernar el sistema completo, no solo para mirar métricas.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/78">
                El objetivo es que desde aquí puedas dar de alta usuarios, gestionar permisos, revisar
                instituciones, monitorear dispositivos y detectar rápido cualquier anomalía operativa.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Acción crítica</p>
                <p className="mt-2 text-lg font-medium">Alta y gestión de usuarios con control de acceso.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Vista de red</p>
                <p className="mt-2 text-lg font-medium">Estado global de instituciones, dispositivos y sincronización.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Riesgo operativo</p>
                <p className="mt-2 text-lg font-medium">Permisos, perfiles y salud del sistema en un mismo lugar.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Foco del superadmin</CardTitle>
            <CardDescription>
              Primer mapa mental para la operación central de MagicBox.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Usuarios y permisos</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Altas, bajas, roles, permisos efectivos y trazabilidad de acceso.
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Instituciones y perfiles</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Seguimiento por institución, responsables, perfiles relevantes y contexto operativo.
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Dispositivos y sincronización</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Señales tempranas de fallos, desconexiones o problemas de calidad de dato.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard
              label="Usuarios administrables"
              value="Próximo"
              hint="La próxima API debería exponer usuarios, roles efectivos y estado de acceso."
              icon={Users}
              tone="secondary"
            />
            <SummaryCard
              label="Instituciones visibles"
              value="Próximo"
              hint="Vamos a necesitar una capa clara de instituciones, responsables y estado comercial/operativo."
              icon={Building2}
              tone="accent"
            />
            <SummaryCard
              label="Dispositivos visibles"
              value={String(devicesQuery.data?.total || devices.length)}
              hint="Dato real ya disponible para empezar la lectura operativa del parque." 
              icon={Smartphone}
            />
            <SummaryCard
              label="Sincronizaciones visibles"
              value={String(syncsQuery.data?.total || syncs.length)}
              hint="Buen punto de partida para salud del sistema y trazabilidad global."
              icon={Layers3}
              tone="accent"
            />
          </>
        )}
      </div>

      {error ? (
        <Card className="border-destructive/20 bg-white/85">
          <CardContent className="p-6 text-sm text-destructive">
            No pude cargar una parte del dashboard: {getErrorMessage(error)}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <ModuleCard
          title="Usuarios"
          description="Alta de cuentas, revisión de perfiles, estados de acceso y control operativo de identidad."
          icon={UserPlus}
          href="/users"
          status="live"
        />
        <ModuleCard
          title="Permisos"
          description="Vista clara de roles, permisos efectivos, excepciones y auditoría de cambios."
          icon={KeyRound}
          href="/permissions"
          status="live"
        />
        <ModuleCard
          title="Instituciones"
          description="Mapa institucional con responsables, configuración, adopción y salud general."
          icon={Building2}
          href="/institutions"
          status="live"
        />
        <ModuleCard
          title="Dispositivos"
          description="Estado del parque activo, última actividad y señales de atención técnica."
          icon={Smartphone}
          href="/devices"
          status="live"
        />
        <ModuleCard
          title="Sincronizaciones"
          description="Trazabilidad operativa y calidad de sync a nivel global."
          icon={ShieldCheck}
          href="/syncs"
          status="live"
        />
        <ModuleCard
          title="Salud operativa"
          description="Vista unificada de dispositivos, sincronización y señales tempranas de soporte."
          icon={Layers3}
          href="/health"
          status="live"
        />
        <ModuleCard
          title="Partidas y datos"
          description="Acceso transversal a la información visible actual para auditoría y soporte."
          icon={Database}
          href="/games"
          status="live"
        />
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Lo siguiente que conviene construir</CardTitle>
              <CardDescription>
                {user?.fullName || "Tu cuenta"} ya tiene una home superadmin diferenciada. La próxima iteración
                debería abrir primero el módulo de usuarios y permisos, y después instituciones y salud global.
              </CardDescription>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              Prioridad sugerida
              <ArrowRight className="size-4" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">1. Usuarios y roles</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Resolver alta, edición, desactivación y permisos.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">2. Instituciones</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Agrupar todo lo importante por cliente, contexto y estado.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">3. Salud del sistema</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Cruzar dispositivos, syncs y señales de soporte en una sola vista.</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
            Datos visibles hoy en esta home: <strong>{gamesQuery.data?.total || games.length}</strong> partidas,
            <strong> {devicesQuery.data?.total || devices.length}</strong> dispositivos y
            <strong> {syncsQuery.data?.total || syncs.length}</strong> sincronizaciones.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
