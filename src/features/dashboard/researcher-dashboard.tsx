"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Database, FlaskConical, Layers3, SearchCheck, Sparkles, Target, TimerReset } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { useGames } from "@/features/games/api";
import { useSyncSessions } from "@/features/syncs/api";
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

function ModuleCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href}>
      <Card className="h-full border-border/80 bg-card/95 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(31,42,55,0.08)]">
        <CardContent className="flex h-full flex-col p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="rounded-2xl bg-primary/12 p-3 text-primary">
              <Icon className="size-5" />
            </div>
            <Badge variant="outline">Researcher</Badge>
          </div>
          <div className="mt-5">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <div className="mt-auto flex items-center gap-2 pt-5 text-sm font-medium text-primary">
            Abrir módulo
            <ArrowRight className="size-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function ResearcherDashboard() {
  const { tokens, user } = useAuth();
  const gamesQuery = useGames(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);

  const isLoading = gamesQuery.isLoading || syncsQuery.isLoading;
  const error = gamesQuery.error || syncsQuery.error;

  const metrics = useMemo(() => {
    const games = gamesQuery.data?.data || [];
    const syncs = syncsQuery.data?.data || [];
    const totalTurns = games.reduce((sum, game) => sum + game.turns.length, 0);
    const activeDecks = new Set(games.map((game) => game.deckName).filter(Boolean)).size;
    const syncsWithRaw = syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) > 0).length;
    const mixedGames = games.filter((game) => {
      const manual = game.players.filter((player) => player.playerSource === "manual").length;
      const registered = game.players.filter((player) => player.playerSource !== "manual").length;
      return manual > 0 && registered > 0;
    }).length;

    return {
      totalGames: gamesQuery.data?.total || games.length,
      totalSyncs: syncsQuery.data?.total || syncs.length,
      totalTurns,
      activeDecks,
      syncsWithRaw,
      mixedGames,
      gamesWithoutTurns: games.filter((game) => game.turns.length === 0).length,
      syncsWithoutRaw: syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) === 0).length,
    };
  }, [gamesQuery.data, syncsQuery.data]);

  const focusRows = [
    {
      title: "Syncs sin raw",
      value: metrics.syncsWithoutRaw,
      description: "Punto de entrada para revisar calidad de ingesta y cobertura de captura.",
    },
    {
      title: "Partidas sin turnos",
      value: metrics.gamesWithoutTurns,
      description: "Sirve para separar sesiones vacías de sesiones con interacción real.",
    },
    {
      title: "Partidas mixtas",
      value: metrics.mixedGames,
      description: "Ayuda a detectar mezcla de jugadores manuales y registrados dentro de la misma muestra.",
    },
  ];

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Researcher"
        title="Home operativa para lectura de evidencia"
        description="Esta vista prioriza trazabilidad, consistencia de muestra y acceso rápido a los dos módulos que este perfil usa de verdad, partidas y sincronizaciones."
      />

      <div className="grid gap-6 2xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="overflow-hidden border-none bg-[linear-gradient(135deg,#1d2a33_0%,#243d4a_52%,#2e5a68_100%)] text-white shadow-[0_20px_60px_rgba(31,42,55,0.22)]">
          <CardContent className="p-8 sm:p-10">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/14 text-white hover:bg-white/14">Trazabilidad</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Muestra visible</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Análisis operativo</Badge>
            </div>

            <div className="mt-6 max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                La home researcher ya prioriza cobertura de datos, calidad de captura y consistencia entre sync y partida.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/78">
                En vez de mezclarlo con operación de aula, este perfil arranca desde señales útiles para exploración, validación y lectura de evidencia visible.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/games" className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/16">
                Ver partidas
                <span className="rounded-full bg-white/14 px-2 py-0.5 text-xs text-white/88">{metrics.totalGames}</span>
                <ArrowRight className="size-4" />
              </Link>
              <Link href="/syncs" className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/16">
                Ver syncs
                <span className="rounded-full bg-white/14 px-2 py-0.5 text-xs text-white/88">{metrics.totalSyncs}</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Qué conviene revisar primero</CardTitle>
            <CardDescription>
              Señales rápidas para separar problemas de captura, vacíos de muestra y casos interesantes para análisis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {focusRows.map((item) => (
              <div key={item.title} className="rounded-2xl bg-background/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-foreground">{item.title}</p>
                  <Badge variant={item.value > 0 ? "secondary" : "outline"}>{item.value}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)
        ) : (
          <>
            <MetricCard label="Partidas visibles" value={String(metrics.totalGames)} hint="Base visible para análisis de sesiones y cobertura." icon={Database} />
            <MetricCard label="Syncs visibles" value={String(metrics.totalSyncs)} hint="Superficie disponible para revisar captura y trazabilidad." icon={Layers3} />
            <MetricCard label="Turnos" value={String(metrics.totalTurns)} hint="Volumen operativo de interacción dentro de la muestra visible." icon={TimerReset} />
            <MetricCard label="Mazos activos" value={String(metrics.activeDecks)} hint="Diversidad de contenido presente en la muestra actual." icon={Target} />
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
          <CardTitle>Módulos principales</CardTitle>
          <CardDescription>
            Este perfil queda enfocado en los dos frentes donde la lectura de evidencia ocurre de verdad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 md:grid-cols-2">
            <ModuleCard href="/games" title="Partidas" description="Cruce de sesiones, jugadores, turnos y contexto visible para análisis." icon={SearchCheck} />
            <ModuleCard href="/syncs" title="Sincronizaciones" description="Revisión de captura, payload raw y correlación operativa con partidas." icon={FlaskConical} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Base visual researcher cerrada</CardTitle>
              <CardDescription>
                {user?.fullName || "La cuenta autenticada"} ya tiene una home más alineada con trazabilidad y evidencia.
                El siguiente paso natural sería adaptar también `Partidas` y `Sincronizaciones` con copy y focos propios de investigación.
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
