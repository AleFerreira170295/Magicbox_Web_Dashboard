"use client";

import Link from "next/link";
import { type ComponentType, useMemo } from "react";
import { Building2, Database, KeyRound, Layers3, Smartphone, UserRound, Users } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
import { useGames } from "@/features/games/api";
import { useInstitutions } from "@/features/institutions/api";
import { useProfilesOverview } from "@/features/profiles/api";
import { useSyncSessions } from "@/features/syncs/api";
import { useUsers } from "@/features/users/api";
import { getErrorMessage } from "@/lib/utils";

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  isLoading = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  isLoading?: boolean;
}) {
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
          <div className="rounded-2xl bg-primary/12 p-3 text-primary">
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
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href}>
      <Card className="h-full border-border/80 bg-card/95 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(31,42,55,0.08)]">
        <CardContent className="flex h-full flex-col p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="rounded-2xl bg-primary/12 p-3 text-primary">
              <Icon className="size-5" />
            </div>
            <Badge variant="outline">Operativo</Badge>
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

export function InstitutionDashboard() {
  const { tokens, user } = useAuth();
  const isInstitutionAdmin = user?.roles.includes("institution-admin") || false;
  const isDirector = user?.roles.includes("director") || false;
  const canSeeUsers = isInstitutionAdmin;
  const canSeePermissions = Boolean(
    isInstitutionAdmin && (
      user?.permissions.includes("access_control:read")
      || user?.permissions.includes("access-control:read")
      || user?.permissions.includes("feature:read")
      || user?.permissions.includes("feature:read:any")
    ),
  );

  const usersQuery = useUsers(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);
  const devicesQuery = useDevices(tokens?.accessToken);
  const gamesQuery = useGames(tokens?.accessToken);
  const profilesQuery = useProfilesOverview(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);

  const institutions = institutionsQuery.data?.data || [];
  const scopedInstitution = institutions.length === 1 ? institutions[0] : null;
  const isLoading = [usersQuery, institutionsQuery, devicesQuery, gamesQuery, profilesQuery, syncsQuery].some((query) => query.isLoading);
  const error = usersQuery.error || institutionsQuery.error || devicesQuery.error || gamesQuery.error || profilesQuery.error || syncsQuery.error;

  const metrics = useMemo(() => {
    const users = usersQuery.data?.data || [];
    const devices = devicesQuery.data?.data || [];
    const games = gamesQuery.data?.data || [];
    const profiles = profilesQuery.data || [];
    const syncs = syncsQuery.data?.data || [];

    return {
      totalUsers: usersQuery.data?.total || users.length,
      totalInstitutions: institutionsQuery.data?.total || institutions.length,
      totalDevices: devicesQuery.data?.total || devices.length,
      totalGames: gamesQuery.data?.total || games.length,
      totalProfiles: profiles.length,
      totalSyncs: syncsQuery.data?.total || syncs.length,
      devicesWithoutStatus: devices.filter((device) => !device.status).length,
      devicesWithoutOwner: devices.filter((device) => !(device.ownerUserId || device.ownerUserEmail)).length,
      profilesWithoutBindings: profiles.filter((profile) => profile.activeBindingCount === 0).length,
      gamesWithoutTurns: games.filter((game) => (game.turns?.length || 0) === 0).length,
      syncsWithoutRaw: syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) === 0).length,
    };
  }, [devicesQuery.data, gamesQuery.data, institutions.length, institutionsQuery.data, profilesQuery.data, syncsQuery.data, usersQuery.data]);

  const roleLabel = isInstitutionAdmin ? "Institution admin" : isDirector ? "Dirección" : "Institución";
  const moduleCards = [
    { title: "Usuarios", description: "Altas, revisión y lectura del padrón visible para tu institución.", href: "/users", icon: Users, visible: canSeeUsers },
    { title: "Permisos", description: "Lectura del contrato ACL efectivo cuando la sesión lo permite.", href: "/permissions", icon: KeyRound, visible: canSeePermissions },
    { title: "Instituciones", description: "Resumen operativo de la institución o alcance visible.", href: "/institutions", icon: Building2, visible: true },
    { title: "Dispositivos", description: "Parque de hardware visible para tu institución.", href: "/devices", icon: Smartphone, visible: true },
    { title: "Partidas", description: "Lectura de uso real y actividad de juego.", href: "/games", icon: Database, visible: true },
    { title: "Perfiles", description: "Perfiles y bindings visibles en el alcance actual.", href: "/profiles", icon: UserRound, visible: true },
  ].filter((module) => module.visible);

  const topPriorities = [
    { title: "Dispositivos sin status", value: metrics.devicesWithoutStatus, hint: "Conviene revisar conectividad o normalización del parque." },
    { title: "Dispositivos sin owner", value: metrics.devicesWithoutOwner, hint: "Sigue habiendo hardware que no apunta todavía a un responsable claro." },
    { title: "Profiles sin bindings", value: metrics.profilesWithoutBindings, hint: "Hay perfiles visibles que todavía no están conectados a una experiencia activa." },
    { title: "Partidas sin turnos", value: metrics.gamesWithoutTurns, hint: "Ayuda a detectar sesiones que no terminan de despegar o cargas parciales." },
    { title: "Syncs sin raw", value: metrics.syncsWithoutRaw, hint: "Señal temprana para trazabilidad incompleta en la ingesta." },
  ]
    .filter((item) => item.value > 0)
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={roleLabel}
        title={scopedInstitution ? scopedInstitution.name : "Centro institucional"}
        description={
          scopedInstitution
            ? `Home operativo de ${scopedInstitution.name}. Organiza padrón, parque, juego, perfiles y sincronizaciones dentro del alcance visible de esta sesión.`
            : `Home operativo institucional para ${metrics.totalInstitutions} instituciones visibles en el alcance actual.`
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Card className="overflow-hidden border-none bg-[linear-gradient(135deg,#1f2a37_0%,#31465e_52%,#3f5a74_100%)] text-white shadow-[0_20px_60px_rgba(31,42,55,0.22)]">
          <CardContent className="p-8 sm:p-10">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/14 text-white hover:bg-white/14">Alcance institucional</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Operación cotidiana</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Sin ruido técnico</Badge>
            </div>

            <div className="mt-6 max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Esta home está pensada para operar la institución, no para navegar como superadmin global.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/78">
                Prioriza visibilidad rápida de usuarios, dispositivos, partidas, perfiles y sincronizaciones dentro del alcance efectivo de la sesión.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Cobertura</p>
                <p className="mt-2 text-lg font-medium">{metrics.totalUsers} usuarios, {metrics.totalDevices} dispositivos y {metrics.totalProfiles} perfiles.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Actividad</p>
                <p className="mt-2 text-lg font-medium">{metrics.totalGames} partidas y {metrics.totalSyncs} syncs visibles.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Alcance</p>
                <p className="mt-2 text-lg font-medium">{scopedInstitution ? `Institución activa: ${scopedInstitution.name}.` : `${metrics.totalInstitutions} instituciones dentro del scope actual.`}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Qué resolver primero</CardTitle>
            <CardDescription>
              Señales concretas para ordenar el día sin salir de la home.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)
            ) : topPriorities.length > 0 ? (
              topPriorities.map((item) => (
                <div key={item.title} className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <Badge variant="warning">{item.value}</Badge>
                  </div>
                  <p className="mt-2">{item.hint}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                No aparecen señales urgentes en el alcance actual. Puedes avanzar sobre los módulos operativos.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Usuarios visibles" value={String(metrics.totalUsers)} hint="Padrón operativo bajo este perfil." icon={Users} isLoading={isLoading} />
        <MetricCard label="Dispositivos" value={String(metrics.totalDevices)} hint="Hardware visible y asignable en el scope actual." icon={Smartphone} isLoading={isLoading} />
        <MetricCard label="Partidas" value={String(metrics.totalGames)} hint="Uso real de juego dentro del alcance actual." icon={Database} isLoading={isLoading} />
        <MetricCard label="Profiles" value={String(metrics.totalProfiles)} hint="Perfiles activos o pendientes de conexión." icon={Layers3} isLoading={isLoading} />
      </div>

      {error ? (
        <Card className="border-destructive/20 bg-white/85">
          <CardContent className="p-6 text-sm text-destructive">
            No pude cargar una parte de la home institucional: {getErrorMessage(error)}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>Módulos principales</CardTitle>
          <CardDescription>
            Accesos rápidos a las funciones que este perfil realmente necesita usar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {moduleCards.map((module) => (
              <ModuleCard key={module.href} title={module.title} description={module.description} href={module.href} icon={module.icon} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
