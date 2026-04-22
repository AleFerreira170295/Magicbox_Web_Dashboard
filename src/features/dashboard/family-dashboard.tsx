"use client";

import { useMemo } from "react";
import { BookHeart, Clock3, Sparkles, Trophy, Users2 } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { useGames } from "@/features/games/api";
import { useSyncSessions } from "@/features/syncs/api";
import { formatDurationSeconds, getErrorMessage } from "@/lib/utils";

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
  const gamesQuery = useGames(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);

  const isLoading = gamesQuery.isLoading || syncsQuery.isLoading;
  const error = gamesQuery.error || syncsQuery.error;

  const metrics = useMemo(() => {
    const games = gamesQuery.data?.data || [];
    const syncs = syncsQuery.data?.data || [];
    const totalTurns = games.reduce((sum, game) => sum + game.turns.length, 0);
    const totalTurnTime = games.reduce(
      (sum, game) => sum + game.turns.reduce((turnSum, turn) => turnSum + (turn.playTimeSeconds || 0), 0),
      0,
    );
    const avgTurnTime = totalTurns > 0 ? totalTurnTime / totalTurns : 0;

    return {
      totalGames: gamesQuery.data?.total || games.length,
      totalSyncs: syncsQuery.data?.total || syncs.length,
      avgTurnTime,
      activeDecks: new Set(games.map((game) => game.deckName).filter(Boolean)).size,
      gamesWithTurns: games.filter((game) => game.turns.length > 0).length,
      syncsWithRaw: syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) > 0).length,
    };
  }, [gamesQuery.data, syncsQuery.data]);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Family"
        title="Home simple para seguir la actividad visible"
        description="Esta vista evita módulos técnicos y se concentra en una lectura más clara de actividad reciente, participación y progreso visible."
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="overflow-hidden border-none bg-[linear-gradient(135deg,#3d4f68_0%,#4f6887_52%,#6d86a5_100%)] text-white shadow-[0_20px_60px_rgba(31,42,55,0.22)]">
          <CardContent className="p-8 sm:p-10">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/14 text-white hover:bg-white/14">Seguimiento</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Actividad visible</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Lenguaje claro</Badge>
            </div>

            <div className="mt-6 max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                La vista family empieza por lo importante, qué actividad hubo y cómo se mueve la experiencia visible.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/78">
                La idea acá no es abrir operación interna, sino ofrecer un resumen amable y entendible del uso reciente.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-medium text-white">
                Partidas visibles
                <span className="rounded-full bg-white/14 px-2 py-0.5 text-xs text-white/88">{metrics.totalGames}</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-medium text-white">
                Syncs visibles
                <span className="rounded-full bg-white/14 px-2 py-0.5 text-xs text-white/88">{metrics.totalSyncs}</span>
              </div>
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
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Partidas visibles, tiempo de interacción y señales simples para entender si hubo movimiento.</p>
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
            <MetricCard label="Partidas visibles" value={String(metrics.totalGames)} hint="Sesiones visibles en esta cuenta." icon={BookHeart} />
            <MetricCard label="Con turnos" value={String(metrics.gamesWithTurns)} hint="Partidas donde ya hubo interacción observable." icon={Users2} />
            <MetricCard label="Tiempo promedio" value={formatDurationSeconds(metrics.avgTurnTime)} hint="Señal rápida del ritmo de juego visible." icon={Clock3} />
            <MetricCard label="Mazos activos" value={String(metrics.activeDecks)} hint="Diversidad de contenido vista recientemente." icon={Trophy} />
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

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Base family iniciada</CardTitle>
              <CardDescription>
                {user?.fullName || "La cuenta autenticada"} ya tiene una entrada más cuidada y entendible.
                El siguiente paso sería decidir si este perfil necesita solo dashboard o alguna vista adicional de seguimiento simplificado.
              </CardDescription>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              Perfil en marcha
              <Sparkles className="size-4" />
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
