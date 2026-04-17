"use client";

import Link from "next/link";
import { type ComponentType, useMemo } from "react";
import {
  ArrowRight,
  Building2,
  Database,
  HeartPulse,
  KeyRound,
  Layers3,
  ShieldCheck,
  Smartphone,
  UserSquare2,
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
import { useBasicHealth, useReadinessHealth } from "@/features/health/api";
import { useInstitutions } from "@/features/institutions/api";
import { useProfilesOverview } from "@/features/profiles/api";
import { useSyncSessions } from "@/features/syncs/api";
import { useUsers } from "@/features/users/api";
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
  icon: ComponentType<{ className?: string }>;
  tone?: "primary" | "accent" | "warning";
}) {
  const toneClass = {
    primary: "bg-primary/12 text-primary",
    accent: "bg-accent text-accent-foreground",
    warning: "bg-amber-100 text-amber-700",
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
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full border-border/80 bg-card/95 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(31,42,55,0.08)]">
        <CardContent className="flex h-full flex-col p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="rounded-2xl bg-primary/12 p-3 text-primary">
              <Icon className="size-5" />
            </div>
            <Badge variant="success">Disponible</Badge>
          </div>
          <div className="mt-5">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <div className="mt-auto pt-5 text-sm font-medium text-primary">Abrir módulo</div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function SuperadminDashboard() {
  const { tokens, user } = useAuth();
  const isAdmin = user?.roles.includes("admin") || false;
  const canSeePermissionsModule = Boolean(
    isAdmin ||
      (user?.roles.includes("institution-admin") &&
        (user?.permissions.includes("access_control:read") ||
          user?.permissions.includes("access-control:read") ||
          user?.permissions.includes("feature:read") ||
          user?.permissions.includes("feature:read:any"))),
  );
  const canSeeHealthModule = isAdmin;
  const canSeeSettingsModule = isAdmin;

  const usersQuery = useUsers(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);
  const devicesQuery = useDevices(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);
  const gamesQuery = useGames(tokens?.accessToken);
  const profilesQuery = useProfilesOverview(tokens?.accessToken);
  const healthQuery = useBasicHealth({ enabled: canSeeHealthModule });
  const readinessQuery = useReadinessHealth({ enabled: canSeeHealthModule });

  const isLoading =
    usersQuery.isLoading ||
    institutionsQuery.isLoading ||
    devicesQuery.isLoading ||
    syncsQuery.isLoading ||
    gamesQuery.isLoading ||
    profilesQuery.isLoading ||
    (canSeeHealthModule && (healthQuery.isLoading || readinessQuery.isLoading));

  const error =
    usersQuery.error ||
    institutionsQuery.error ||
    devicesQuery.error ||
    syncsQuery.error ||
    gamesQuery.error ||
    profilesQuery.error ||
    (canSeeHealthModule ? healthQuery.error || readinessQuery.error : null);

  const metrics = useMemo(() => {
    const users = usersQuery.data?.data || [];
    const institutions = institutionsQuery.data?.data || [];
    const devices = devicesQuery.data?.data || [];
    const syncs = syncsQuery.data?.data || [];
    const games = gamesQuery.data?.data || [];
    const profiles = profilesQuery.data || [];
    const readinessChecks = readinessQuery.data?.checks || {};

    return {
      totalUsers: usersQuery.data?.total || users.length,
      totalInstitutions: institutionsQuery.data?.total || institutions.length,
      totalDevices: devicesQuery.data?.total || devices.length,
      totalSyncs: syncsQuery.data?.total || syncs.length,
      totalGames: gamesQuery.data?.total || games.length,
      totalProfiles: profiles.length,
      institutionsNeedingReview: institutions.filter((institution) => institution.operationalSummary?.needsReview).length,
      devicesWithoutStatus: devices.filter((device) => !device.status).length,
      syncsWithoutRaw: syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) === 0).length,
      profilesWithoutBindings: profiles.filter((profile) => profile.activeBindingCount === 0).length,
      degradedChecks: Object.values(readinessChecks).filter((check) => check?.status !== "healthy").length,
      environment: canSeeHealthModule ? healthQuery.data?.environment || "-" : "scopeado",
      version: canSeeHealthModule ? healthQuery.data?.version || "-" : "no disponible",
      readiness: canSeeHealthModule ? readinessQuery.data?.status || "unknown" : "no disponible",
    };
  }, [canSeeHealthModule, devicesQuery.data, gamesQuery.data, healthQuery.data, institutionsQuery.data, profilesQuery.data, readinessQuery.data, syncsQuery.data, usersQuery.data]);

  const scopeLabel = user?.roles.includes("institution-admin") ? "Institution admin" : "Superadmin";

  const moduleCards = [
    { title: "Usuarios", description: "Alta, edición, roles, ACL y revisión operativa del padrón.", icon: UserPlus, href: "/users", visible: true },
    { title: "Permisos", description: "Catálogo ACL, acciones y reglas activas de acceso.", icon: KeyRound, href: "/permissions", visible: canSeePermissionsModule },
    { title: "Instituciones", description: "Resumen operativo, previews y estado institucional.", icon: Building2, href: "/institutions", visible: true },
    { title: "Dispositivos", description: "Parque real con estado, owner y alcance Home/institución.", icon: Smartphone, href: "/devices", visible: true },
    { title: "Syncs", description: "Sesiones sincronizadas con detalle y raw reciente.", icon: ShieldCheck, href: "/syncs", visible: true },
    { title: "Games", description: "Partidas, jugadores, turnos y lectura operativa del juego.", icon: Database, href: "/games", visible: true },
    { title: "Profiles", description: "Perfiles Home reales con owner, bindings y sesiones.", icon: UserSquare2, href: "/profiles", visible: true },
    { title: "Health", description: "Health técnico real y señales operativas del sistema.", icon: HeartPulse, href: "/health", visible: canSeeHealthModule },
    { title: "Settings", description: "Runtime efectivo, OTA y catálogos ACL actuales.", icon: ShieldCheck, href: "/settings", visible: canSeeSettingsModule },
  ].filter((module) => module.visible);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={scopeLabel}
        title="Centro de control MagicBox"
        description="Home operativo real del dashboard. Resume usuarios, instituciones, devices, syncs, games, profiles y salud técnica sin depender de pantallas placeholder."
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="overflow-hidden border-none bg-[linear-gradient(135deg,#1f2a37_0%,#2c4156_55%,#39546f_100%)] text-white shadow-[0_20px_60px_rgba(31,42,55,0.22)]">
          <CardContent className="p-8 sm:p-10">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/14 text-white hover:bg-white/14">Operación real</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Dashboard home</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">MagicBox control plane</Badge>
            </div>

            <div className="mt-6 max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                La home ya puede resumir el estado del sistema completo en lugar de repetir promesas de módulos futuros.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/78">
                Desde acá ya se puede leer alcance operativo, focos de revisión y puertas de entrada a los módulos que aterrizamos en esta iteración.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Cobertura</p>
                <p className="mt-2 text-lg font-medium">{metrics.totalUsers} usuarios, {metrics.totalInstitutions} instituciones y {metrics.totalDevices} dispositivos visibles.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Actividad</p>
                <p className="mt-2 text-lg font-medium">{metrics.totalSyncs} syncs, {metrics.totalGames} partidas y {metrics.totalProfiles} profiles.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">{canSeeHealthModule ? "Salud" : "Alcance"}</p>
                <p className="mt-2 text-lg font-medium">
                  {canSeeHealthModule
                    ? `${metrics.readiness} · ${metrics.degradedChecks} checks degradados · ${metrics.environment}.`
                    : `${scopeLabel.toLowerCase()} · ${metrics.totalInstitutions} instituciones visibles · ${metrics.totalDevices} devices.`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Qué mirar primero</CardTitle>
            <CardDescription>
              Señales blandas para ubicar rápido el próximo foco de revisión.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Instituciones con review pendiente</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{metrics.institutionsNeedingReview} instituciones marcan `needs_review` en el resumen operativo.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Dispositivos sin estado</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{metrics.devicesWithoutStatus} dispositivos visibles siguen sin `status` explícito.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Syncs sin raw y profiles sin binding</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{metrics.syncsWithoutRaw} syncs sin raw visible y {metrics.profilesWithoutBindings} profiles sin binding activo.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label="Usuarios" value={String(metrics.totalUsers)} hint="Padrón operativo visible." icon={Users} />
            <SummaryCard label="Instituciones" value={String(metrics.totalInstitutions)} hint="Clientes y alcance actual." icon={Building2} />
            <SummaryCard label="Devices" value={String(metrics.totalDevices)} hint="Parque visible en dashboard." icon={Smartphone} />
            <SummaryCard label="Syncs" value={String(metrics.totalSyncs)} hint="Trazabilidad operativa actual." icon={Layers3} tone="accent" />
            <SummaryCard label="Games" value={String(metrics.totalGames)} hint="Partidas persistidas visibles." icon={Database} tone="accent" />
            {canSeeHealthModule ? (
              <SummaryCard label="Health" value={metrics.readiness} hint={`Backend ${metrics.version}.`} icon={HeartPulse} tone={metrics.degradedChecks === 0 ? "accent" : "warning"} />
            ) : (
              <SummaryCard label="Profiles" value={String(metrics.totalProfiles)} hint="Perfiles Home visibles en el alcance actual." icon={UserSquare2} tone="accent" />
            )}
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
        {moduleCards.map((module) => (
          <ModuleCard key={module.href} title={module.title} description={module.description} icon={module.icon} href={module.href} />
        ))}
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Prioridad sugerida después de esta home</CardTitle>
              <CardDescription>
                {user?.fullName || "La cuenta autenticada"} ya tiene un home operativo. El próximo paso lógico es pulir coherencia transversal, tests y pequeños huecos de contrato, no abrir más placeholders.
              </CardDescription>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              Siguiente paso sugerido
              <ArrowRight className="size-4" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">1. Coherencia de navegación</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Ajustar accesos y copy para institution-admin/director donde ya aplique.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">2. Cobertura de tests UI</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Agregar pruebas mínimas a módulos nuevos fuera de Users.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">3. QA consolidado</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Usar esta home como punto de entrada y validar el flujo completo en local.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
