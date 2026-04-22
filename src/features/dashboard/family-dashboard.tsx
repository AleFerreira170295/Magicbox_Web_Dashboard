"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, BookHeart, Sparkles, Smartphone, Users2, Cable } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
import { useGames } from "@/features/games/api";
import { useSyncSessions } from "@/features/syncs/api";
import { useUsers } from "@/features/users/api";
import { getErrorMessage } from "@/lib/utils";

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="overflow-hidden border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p>
          </div>
          <div className="rounded-2xl bg-primary/12 p-3 text-primary">
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FamilyDashboard() {
  const { tokens, user } = useAuth();
  const devicesQuery = useDevices(tokens?.accessToken);
  const gamesQuery = useGames(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);
  const usersQuery = useUsers(tokens?.accessToken);

  const isLoading = devicesQuery.isLoading || gamesQuery.isLoading || syncsQuery.isLoading || usersQuery.isLoading;
  const error = devicesQuery.error || gamesQuery.error || syncsQuery.error || usersQuery.error;

  const metrics = useMemo(() => {
    const devices = devicesQuery.data?.data || [];
    const games = gamesQuery.data?.data || [];
    const syncs = syncsQuery.data?.data || [];
    const users = usersQuery.data?.data || [];

    return {
      totalDevices: devicesQuery.data?.total || devices.length,
      totalGames: gamesQuery.data?.total || games.length,
      totalSyncs: syncsQuery.data?.total || syncs.length,
      totalUsers: usersQuery.data?.total || users.length,
    };
  }, [devicesQuery.data, gamesQuery.data, syncsQuery.data, usersQuery.data]);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Family"
        title="Home simple para seguir lo visible"
        description="Esta vista evita módulos técnicos y se concentra en una lectura clara de tus dispositivos, partidas y usuarios visibles."
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="overflow-hidden border-none bg-[linear-gradient(135deg,#3d4f68_0%,#4f6887_52%,#6d86a5_100%)] text-white shadow-[0_20px_60px_rgba(31,42,55,0.22)]">
          <CardContent className="p-8 sm:p-10">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/14 text-white hover:bg-white/14">Seguimiento</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Dispositivos propios</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Usuarios visibles</Badge>
            </div>

            <div className="mt-6 max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                La vista family empieza por lo importante, tus dispositivos, partidas y usuarios visibles.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/78">
                La idea acá no es abrir operación interna, sino ofrecer un resumen amable y entendible del uso reciente.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-medium text-white">
                Dispositivos
                <span className="rounded-full bg-white/14 px-2 py-0.5 text-xs text-white/88">{metrics.totalDevices}</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-medium text-white">
                Partidas
                <span className="rounded-full bg-white/14 px-2 py-0.5 text-xs text-white/88">{metrics.totalGames}</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-medium text-white">
                Usuarios
                <span className="rounded-full bg-white/14 px-2 py-0.5 text-xs text-white/88">{metrics.totalUsers}</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-medium text-white">
                Syncs
                <span className="rounded-full bg-white/14 px-2 py-0.5 text-xs text-white/88">{metrics.totalSyncs}</span>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/devices"
                className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/16"
              >
                Ver dispositivos
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/games"
                className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/16"
              >
                Ver partidas
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/users"
                className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/16"
              >
                Ver usuarios
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/syncs"
                className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/16"
              >
                Ver sincronizaciones
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Qué muestra esta vista</CardTitle>
            <CardDescription>
              Una lectura cuidada de actividad, sin mezclarla con configuración, permisos ni hardware operativo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="font-medium text-foreground">Actividad reciente</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Partidas, dispositivos y señales simples para entender si hubo movimiento.</p>
            </div>
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="font-medium text-foreground">Lenguaje no técnico</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Esta home evita raw, ACL y módulos internos para que la lectura sea más amable.</p>
            </div>
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="font-medium text-foreground">Próxima capa</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Si seguimos después, se puede profundizar progreso, hábitos y evolución con mejor narrativa visual.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)
        ) : (
          <>
            <MetricCard label="Dispositivos visibles" value={String(metrics.totalDevices)} hint="Hardware que entra en tu alcance visible." icon={Smartphone} />
            <MetricCard label="Partidas visibles" value={String(metrics.totalGames)} hint="Sesiones visibles en esta cuenta." icon={BookHeart} />
            <MetricCard label="Usuarios visibles" value={String(metrics.totalUsers)} hint="Usuarios que podés ver desde esta cuenta." icon={Users2} />
            <MetricCard label="Syncs visibles" value={String(metrics.totalSyncs)} hint="Sincronizaciones recientes vinculadas a tu alcance." icon={Cable} />
          </>
        )}
      </div>

      {error ? (
        <Card className="border-destructive/20 bg-white/85">
          <CardContent className="p-6 text-sm text-destructive">No pude cargar una parte del dashboard: {getErrorMessage(error)}</CardContent>
        </Card>
      ) : null}

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Base visual family cerrada</CardTitle>
              <CardDescription>
                {user?.fullName || "La cuenta autenticada"} ya tiene una entrada más cuidada y entendible.
                El siguiente paso sería decidir si este perfil necesita solo dashboard o alguna vista adicional de seguimiento simplificado.
              </CardDescription>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              Visual base cerrada
              <Sparkles className="size-4" />
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
