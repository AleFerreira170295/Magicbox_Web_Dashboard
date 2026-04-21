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
import { useSystemDashboardSummary } from "@/features/dashboard/api";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
import { useGames } from "@/features/games/api";
import { useBasicHealth, useReadinessHealth } from "@/features/health/api";
import { useInstitutions } from "@/features/institutions/api";
import { useProfilesOverview } from "@/features/profiles/api";
import { useSyncSessions } from "@/features/syncs/api";
import { useUsers } from "@/features/users/api";
import { getErrorMessage } from "@/lib/utils";

function formatPercent(value: number, total: number) {
  if (total <= 0) return "Sin datos";
  return `${Math.round((value / total) * 100)}%`;
}

function formatAverage(total: number, count: number, digits = 1) {
  if (count <= 0) return "Sin datos";
  return (total / count).toFixed(digits);
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  isLoading = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "primary" | "accent" | "warning";
  isLoading?: boolean;
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
            {isLoading ? (
              <>
                <Skeleton className="mt-3 h-8 w-20 rounded-xl" />
                <Skeleton className="mt-3 h-4 w-40 rounded-xl" />
              </>
            ) : (
              <>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p>
              </>
            )}
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
  const isInstitutionAdmin = user?.roles.includes("institution-admin") || false;
  const isDirector = user?.roles.includes("director") || false;
  const canSeeUsersModule = isAdmin || isInstitutionAdmin;
  const canSeePermissionsModule = Boolean(
    isAdmin ||
      (isInstitutionAdmin &&
        (user?.permissions.includes("access_control:read") ||
          user?.permissions.includes("access-control:read") ||
          user?.permissions.includes("feature:read") ||
          user?.permissions.includes("feature:read:any"))),
  );
  const canSeeHealthModule = isAdmin;
  const canSeeSettingsModule = isAdmin;

  const summaryQuery = useSystemDashboardSummary(tokens?.accessToken, isAdmin);
  const usersQuery = useUsers(!isAdmin ? tokens?.accessToken : undefined);
  const institutionsQuery = useInstitutions(!isAdmin ? tokens?.accessToken : undefined);
  const devicesQuery = useDevices(!isAdmin ? tokens?.accessToken : undefined);
  const syncsQuery = useSyncSessions(!isAdmin ? tokens?.accessToken : undefined);
  const gamesQuery = useGames(!isAdmin ? tokens?.accessToken : undefined);
  const profilesQuery = useProfilesOverview(!isAdmin ? tokens?.accessToken : undefined);
  const healthQuery = useBasicHealth({ enabled: canSeeHealthModule });
  const readinessQuery = useReadinessHealth({ enabled: canSeeHealthModule });

  const users = isAdmin ? [] : usersQuery.data?.data || [];
  const institutions = isAdmin ? [] : institutionsQuery.data?.data || [];
  const devices = isAdmin ? [] : devicesQuery.data?.data || [];
  const syncs = isAdmin ? [] : syncsQuery.data?.data || [];
  const games = isAdmin ? [] : gamesQuery.data?.data || [];
  const profiles = isAdmin ? [] : profilesQuery.data || [];
  const readinessChecks = readinessQuery.data?.checks || {};

  const visibleQueryStates = isAdmin
    ? [summaryQuery, ...(canSeeHealthModule ? [healthQuery, readinessQuery] : [])]
    : [
        usersQuery,
        institutionsQuery,
        devicesQuery,
        syncsQuery,
        gamesQuery,
        profilesQuery,
        ...(canSeeHealthModule ? [healthQuery, readinessQuery] : []),
      ];

  const totalSources = visibleQueryStates.length;
  const loadedSources = visibleQueryStates.filter((query) => query.data).length;
  const failedSources = visibleQueryStates.filter((query) => query.error).length;
  const hasAnyData = isAdmin
    ? Boolean(summaryQuery.data)
    : [users.length, institutions.length, devices.length, syncs.length, games.length, profiles.length].some(
        (count) => count > 0,
      );
  const showInitialLoading = !hasAnyData && visibleQueryStates.some((query) => query.isLoading);
  const errors = visibleQueryStates
    .map((query) => query.error)
    .filter(Boolean)
    .map((error) => getErrorMessage(error));
  const error = errors[0] || null;

  const metrics = useMemo(() => {
    if (isAdmin && summaryQuery.data) {
      return {
        totalUsers: summaryQuery.data.totals.users,
        totalInstitutions: summaryQuery.data.totals.institutions,
        totalDevices: summaryQuery.data.totals.devices,
        totalSyncs: summaryQuery.data.totals.syncs,
        totalGames: summaryQuery.data.totals.games,
        totalProfiles: summaryQuery.data.totals.profiles,
        institutionsNeedingReview: summaryQuery.data.stats.institutions_needing_review,
        devicesWithoutStatus: summaryQuery.data.stats.devices_without_status,
        syncsWithoutRaw: Math.max(summaryQuery.data.totals.syncs - summaryQuery.data.stats.syncs_with_raw, 0),
        profilesWithoutBindings: Math.max(summaryQuery.data.totals.profiles - summaryQuery.data.stats.profiles_with_bindings, 0),
        homeDevices: summaryQuery.data.stats.home_devices,
        institutionDevices: summaryQuery.data.stats.institution_devices,
        devicesWithOwner: summaryQuery.data.stats.devices_with_owner,
        devicesWithFirmware: summaryQuery.data.stats.devices_with_firmware,
        syncsWithRaw: summaryQuery.data.stats.syncs_with_raw,
        activeProfiles: summaryQuery.data.stats.active_profiles,
        profilesWithBindings: summaryQuery.data.stats.profiles_with_bindings,
        profilesWithSessions: summaryQuery.data.stats.profiles_with_sessions,
        totalTurns: summaryQuery.data.totals.turns,
        successfulTurns: summaryQuery.data.stats.successful_turns,
        totalPlayers: summaryQuery.data.stats.total_players,
        gamesWithTurns: summaryQuery.data.stats.games_with_turns,
        degradedChecks: Object.values(readinessChecks).filter((check) => check?.status !== "healthy").length,
        environment: canSeeHealthModule ? healthQuery.data?.environment || "-" : "scopeado",
        version: canSeeHealthModule ? healthQuery.data?.version || "-" : "no disponible",
        readiness: canSeeHealthModule ? readinessQuery.data?.status || "unknown" : "no disponible",
      };
    }

    const gamesWithTurns = games.filter((game) => (game.turns?.length || 0) > 0);
    const totalTurns = games.reduce((sum, game) => sum + (game.turns?.length || 0), 0);
    const successfulTurns = games.reduce(
      (sum, game) => sum + (game.turns?.filter((turn) => turn.success).length || 0),
      0,
    );
    const totalPlayers = games.reduce((sum, game) => sum + (game.totalPlayers || game.players?.length || 0), 0);
    const homeDevices = devices.filter((device) => device.assignmentScope === "home").length;
    const institutionDevices = devices.filter((device) => device.assignmentScope === "institution").length;
    const devicesWithOwner = devices.filter((device) => device.ownerUserId || device.ownerUserEmail).length;
    const devicesWithFirmware = devices.filter((device) => device.firmwareVersion).length;
    const syncsWithRaw = syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) > 0).length;
    const profilesWithBindings = profiles.filter((profile) => profile.activeBindingCount > 0).length;
    const activeProfiles = profiles.filter((profile) => profile.isActive).length;
    const profilesWithSessions = profiles.filter((profile) => profile.sessionCount > 0).length;

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
      homeDevices,
      institutionDevices,
      devicesWithOwner,
      devicesWithFirmware,
      syncsWithRaw,
      activeProfiles,
      profilesWithBindings,
      profilesWithSessions,
      totalTurns,
      successfulTurns,
      totalPlayers,
      gamesWithTurns: gamesWithTurns.length,
      degradedChecks: Object.values(readinessChecks).filter((check) => check?.status !== "healthy").length,
      environment: canSeeHealthModule ? healthQuery.data?.environment || "-" : "scopeado",
      version: canSeeHealthModule ? healthQuery.data?.version || "-" : "no disponible",
      readiness: canSeeHealthModule ? readinessQuery.data?.status || "unknown" : "no disponible",
    };
  }, [canSeeHealthModule, devices, devicesQuery.data, games, gamesQuery.data, healthQuery.data, institutions, institutionsQuery.data, isAdmin, profiles, profilesQuery.data, readinessChecks, readinessQuery.data, summaryQuery.data, syncs, syncsQuery.data, users, usersQuery.data]);

  const scopeLabel = isAdmin ? "Superadmin" : isInstitutionAdmin ? "Institution admin" : isDirector ? "Dirección" : "Operación";

  const moduleCards = [
    { title: "Usuarios", description: "Alta, edición, roles, ACL y revisión operativa del padrón.", icon: UserPlus, href: "/users", visible: canSeeUsersModule },
    { title: "Permisos", description: "Catálogo ACL, acciones y reglas activas de acceso.", icon: KeyRound, href: "/permissions", visible: canSeePermissionsModule },
    { title: "Instituciones", description: "Resumen operativo, previews y estado institucional.", icon: Building2, href: "/institutions", visible: isAdmin || isInstitutionAdmin || isDirector },
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
                <p className="mt-2 text-sm text-white/70">{loadedSources}/{totalSources} fuentes cargadas, {failedSources} con error.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Actividad</p>
                <p className="mt-2 text-lg font-medium">{metrics.totalSyncs} syncs, {metrics.totalGames} partidas, {metrics.totalTurns} turnos y {metrics.totalProfiles} profiles.</p>
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
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{metrics.devicesWithoutStatus} dispositivos visibles siguen sin `status` explícito, y {metrics.totalDevices - metrics.devicesWithOwner} no tienen owner asociado.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Cobertura de raw y bindings</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{formatPercent(metrics.syncsWithRaw, metrics.totalSyncs)} de syncs tienen raw visible y {formatPercent(metrics.profilesWithBindings, metrics.totalProfiles)} de profiles tienen binding activo.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {showInitialLoading ? (
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label="Usuarios" value={String(metrics.totalUsers)} hint="Padrón operativo visible." icon={Users} isLoading={(isAdmin ? summaryQuery.isLoading : usersQuery.isLoading) && users.length === 0} />
            <SummaryCard label="Instituciones" value={String(metrics.totalInstitutions)} hint="Clientes y alcance actual." icon={Building2} isLoading={(isAdmin ? summaryQuery.isLoading : institutionsQuery.isLoading) && institutions.length === 0} />
            <SummaryCard label="Devices" value={String(metrics.totalDevices)} hint={`${metrics.homeDevices} Home y ${metrics.institutionDevices} institucionales.`} icon={Smartphone} isLoading={(isAdmin ? summaryQuery.isLoading : devicesQuery.isLoading) && devices.length === 0} />
            <SummaryCard label="Syncs" value={String(metrics.totalSyncs)} hint={`${formatPercent(metrics.syncsWithRaw, metrics.totalSyncs)} con raw visible.`} icon={Layers3} tone="accent" isLoading={(isAdmin ? summaryQuery.isLoading : syncsQuery.isLoading) && syncs.length === 0} />
            <SummaryCard label="Games" value={String(metrics.totalGames)} hint={`${formatAverage(metrics.totalPlayers, metrics.totalGames)} jugadores por partida.`} icon={Database} tone="accent" isLoading={(isAdmin ? summaryQuery.isLoading : gamesQuery.isLoading) && games.length === 0} />
            {canSeeHealthModule ? (
              <SummaryCard label="Health" value={metrics.readiness} hint={`Backend ${metrics.version}.`} icon={HeartPulse} tone={metrics.degradedChecks === 0 ? "accent" : "warning"} isLoading={canSeeHealthModule && healthQuery.isLoading && !healthQuery.data} />
            ) : (
              <SummaryCard label="Profiles" value={String(metrics.totalProfiles)} hint={`${metrics.activeProfiles} activos y ${metrics.profilesWithSessions} con sesiones.`} icon={UserSquare2} tone="accent" isLoading={(isAdmin ? summaryQuery.isLoading : profilesQuery.isLoading) && profiles.length === 0} />
            )}
          </>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Uso y actividad</CardTitle>
            <CardDescription>Estadísticas rápidas para leer el movimiento real del sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">Turnos y partidas</p>
              <p className="mt-1">{metrics.totalTurns} turnos visibles, {formatAverage(metrics.totalTurns, metrics.gamesWithTurns || metrics.totalGames)} turnos por partida con actividad.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">Éxito de turnos</p>
              <p className="mt-1">{formatPercent(metrics.successfulTurns, metrics.totalTurns)} de los turnos visibles terminaron en éxito.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Calidad del dato</CardTitle>
            <CardDescription>Cobertura útil para detectar dónde falta trazabilidad o vínculo operativo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">Dispositivos identificados</p>
              <p className="mt-1">{formatPercent(metrics.devicesWithFirmware, metrics.totalDevices)} tienen firmware visible y {formatPercent(metrics.devicesWithOwner, metrics.totalDevices)} tienen owner asociado.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">Profiles útiles</p>
              <p className="mt-1">{formatPercent(metrics.profilesWithSessions, metrics.totalProfiles)} tienen sesiones y {formatPercent(metrics.profilesWithBindings, metrics.totalProfiles)} tienen binding activo.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Distribución operativa</CardTitle>
            <CardDescription>Cómo está repartido hoy el parque y el alcance visible.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">Devices Home vs institución</p>
              <p className="mt-1">{metrics.homeDevices} Home, {metrics.institutionDevices} institucionales.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">Cobertura de fuentes</p>
              <p className="mt-1">{loadedSources} fuentes respondieron correctamente, {failedSources} fallaron y la home sigue operativa con degradación parcial.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <Card className="border-destructive/20 bg-white/85">
          <CardContent className="p-6 text-sm text-destructive">
            No pude cargar una parte del dashboard: {error}. La home sigue mostrando las fuentes que sí respondieron.
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
