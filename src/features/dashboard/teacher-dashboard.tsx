"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Database,
  Download,
  Sparkles,
  Trophy,
  Users2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import {
  buildTeacherDashboardExportData,
  downloadTeacherDashboardExcel,
  downloadTeacherDashboardPdf,
} from "@/features/dashboard/teacher-dashboard-export";
import { useGames } from "@/features/games/api";
import type { GameRecord } from "@/features/games/types";
import { useSyncSessions } from "@/features/syncs/api";
import type { SyncSessionRecord } from "@/features/syncs/types";
import { getErrorMessage, formatDurationSeconds } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat("es-UY", { month: "short", day: "numeric" }).format(date);
}

function resolveTurnActor(game: { players: Array<{ id: string; playerName?: string | null; externalPlayerUid?: string | null; studentId?: string | null }> }, turn: { gamePlayerId?: string | null; externalPlayerUid?: string | null; studentId?: string | null; position?: number | null }) {
  const matchedPlayer = game.players.find((player) => player.id === turn.gamePlayerId);
  return (
    matchedPlayer?.playerName ||
    matchedPlayer?.externalPlayerUid ||
    matchedPlayer?.studentId ||
    turn.externalPlayerUid ||
    turn.studentId ||
    (turn.position ? `Jugador ${turn.position}` : "Jugador sin identificar")
  );
}

type TrendTone = "up" | "down" | "flat";

type TrendSummary = {
  label: string;
  tone: TrendTone;
};

type PlayerDrilldown = {
  name: string;
  totalTurns: number;
  totalGames: number;
  successRate: number;
  avgTurnTime: number;
  decks: Array<{ name: string; totalTurns: number }>;
};

type DeckDrilldown = {
  name: string;
  totalGames: number;
  totalTurns: number;
  successRate: number;
  avgTurnTime: number;
  players: Array<{ name: string; totalTurns: number }>;
};

type GameAnalysis = {
  recentGames: number;
  totalTurns: number;
  totalTurnTime: number;
  successfulTurns: number;
  activePlayers: number;
  deckChart: Array<{ name: string; total: number }>;
  playerDrilldowns: PlayerDrilldown[];
  deckDrilldowns: DeckDrilldown[];
};

function formatSignedDelta(value: number) {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function describeCountTrend(current: number, previous: number, noun: string): TrendSummary {
  const delta = current - previous;
  if (delta > 0) return { label: `${formatSignedDelta(delta)} ${noun} vs período anterior`, tone: "up" };
  if (delta < 0) return { label: `${formatSignedDelta(delta)} ${noun} vs período anterior`, tone: "down" };
  return { label: `Sin cambio vs período anterior`, tone: "flat" };
}

function describeRateTrend(current: number, previous: number): TrendSummary {
  const delta = current - previous;
  if (delta > 0) return { label: `${formatSignedDelta(delta)} pp de acierto`, tone: "up" };
  if (delta < 0) return { label: `${formatSignedDelta(delta)} pp de acierto`, tone: "down" };
  return { label: "Acierto estable", tone: "flat" };
}

function describeDurationTrend(current: number, previous: number): TrendSummary {
  const delta = Math.round(current - previous);
  if (delta > 0) return { label: `${formatSignedDelta(delta)}s por turno`, tone: "down" };
  if (delta < 0) return { label: `${formatSignedDelta(delta)}s por turno`, tone: "up" };
  return { label: "Ritmo estable", tone: "flat" };
}

function buildSupportTrendLabel(currentValue: number, previousValue?: number | null, unit = "pp") {
  if (previousValue == null) return "nuevo en foco";
  const delta = currentValue - previousValue;
  if (delta > 0) return `mejoró ${formatSignedDelta(delta)} ${unit}`;
  if (delta < 0) return `cayó ${formatSignedDelta(delta)} ${unit}`;
  return "sin cambio relevante";
}

function analyzeGames(games: GameRecord[]): GameAnalysis {
  let totalTurns = 0;
  let totalTurnTime = 0;
  let successfulTurns = 0;
  const playerStatsMap = new Map<
    string,
    { name: string; totalTurns: number; successfulTurns: number; totalPlayTime: number; games: Set<string>; decks: Map<string, number> }
  >();
  const deckStatsMap = new Map<
    string,
    { name: string; totalGames: number; totalTurns: number; successfulTurns: number; totalPlayTime: number; players: Map<string, number> }
  >();

  games.forEach((game) => {
    const deckKey = game.deckName || "Sin mazo";
    const deckStat = deckStatsMap.get(deckKey) || { name: deckKey, totalGames: 0, totalTurns: 0, successfulTurns: 0, totalPlayTime: 0, players: new Map<string, number>() };
    deckStat.totalGames += 1;

    game.turns.forEach((turn) => {
      const actor = resolveTurnActor(game, turn);
      const playTime = turn.playTimeSeconds || 0;
      const playerStat = playerStatsMap.get(actor) || { name: actor, totalTurns: 0, successfulTurns: 0, totalPlayTime: 0, games: new Set<string>(), decks: new Map<string, number>() };
      playerStat.totalTurns += 1;
      playerStat.successfulTurns += turn.success ? 1 : 0;
      playerStat.totalPlayTime += playTime;
      playerStat.games.add(game.id);
      playerStat.decks.set(deckKey, (playerStat.decks.get(deckKey) || 0) + 1);
      playerStatsMap.set(actor, playerStat);

      deckStat.totalTurns += 1;
      deckStat.successfulTurns += turn.success ? 1 : 0;
      deckStat.totalPlayTime += playTime;
      deckStat.players.set(actor, (deckStat.players.get(actor) || 0) + 1);

      totalTurns += 1;
      totalTurnTime += playTime;
      successfulTurns += turn.success ? 1 : 0;
    });

    deckStatsMap.set(deckKey, deckStat);
  });

  const playerDrilldowns = Array.from(playerStatsMap.values())
    .map((item) => ({
      name: item.name,
      totalTurns: item.totalTurns,
      totalGames: item.games.size,
      successRate: item.totalTurns > 0 ? Math.round((item.successfulTurns / item.totalTurns) * 100) : 0,
      avgTurnTime: item.totalTurns > 0 ? item.totalPlayTime / item.totalTurns : 0,
      decks: Array.from(item.decks.entries())
        .map(([name, totalTurns]) => ({ name, totalTurns }))
        .sort((left, right) => right.totalTurns - left.totalTurns)
        .slice(0, 3),
    }))
    .sort((left, right) => right.totalTurns - left.totalTurns || right.successRate - left.successRate);

  const deckDrilldowns = Array.from(deckStatsMap.values())
    .map((item) => ({
      name: item.name,
      totalGames: item.totalGames,
      totalTurns: item.totalTurns,
      successRate: item.totalTurns > 0 ? Math.round((item.successfulTurns / item.totalTurns) * 100) : 0,
      avgTurnTime: item.totalTurns > 0 ? item.totalPlayTime / item.totalTurns : 0,
      players: Array.from(item.players.entries())
        .map(([name, totalTurns]) => ({ name, totalTurns }))
        .sort((left, right) => right.totalTurns - left.totalTurns)
        .slice(0, 4),
    }))
    .sort((left, right) => left.successRate - right.successRate || right.totalTurns - left.totalTurns);

  return {
    recentGames: games.length,
    totalTurns,
    totalTurnTime,
    successfulTurns,
    activePlayers: playerDrilldowns.length,
    deckChart: Object.entries(
      games.reduce<Record<string, number>>((acc, game) => {
        const key = game.deckName || "Sin mazo";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    )
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6),
    playerDrilldowns,
    deckDrilldowns,
  };
}

function MetricCard({
  label,
  value,
  hint,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  trend?: TrendSummary;
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
            {trend ? (
              <Badge variant="outline" className="mt-3">
                {trend.label}
              </Badge>
            ) : null}
          </div>
          <div className="rounded-2xl bg-primary/12 p-3 text-primary">
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightRow({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white/70 p-4">
      <div className="rounded-2xl bg-accent p-2.5 text-accent-foreground">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function TeacherDashboard() {
  const { tokens, user } = useAuth();
  const gamesQuery = useGames(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);
  const [referenceNow] = useState(() => Date.now());
  const [periodFilter, setPeriodFilter] = useState<"7d" | "30d" | "all">("7d");
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);
  const [selectedDeckName, setSelectedDeckName] = useState<string | null>(null);
  const [selectedActivityDayKey, setSelectedActivityDayKey] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<"pdf" | "excel" | null>(null);

  const isLoading = gamesQuery.isLoading || syncsQuery.isLoading;
  const error = gamesQuery.error || syncsQuery.error;

  const metrics = useMemo(() => {
    const games = (gamesQuery.data?.data || []) as GameRecord[];
    const syncs = (syncsQuery.data?.data || []) as SyncSessionRecord[];
    const windowDays = periodFilter === "all" ? null : Number(periodFilter.replace("d", ""));
    const chartWindowDays = windowDays || 30;
    const recentThreshold = windowDays ? referenceNow - windowDays * DAY_MS : null;
    const previousThresholdStart = referenceNow - chartWindowDays * DAY_MS * 2;
    const previousThresholdEnd = referenceNow - chartWindowDays * DAY_MS;
    const hasDatedGames = games.some((game) => Boolean(parseDate(game.startDate || game.createdAt || game.updatedAt)));
    const hasDatedSyncs = syncs.some((sync) => Boolean(parseDate(sync.startedAt || sync.syncedAt || sync.createdAt || sync.capturedAt)));
    const filteredGames = recentThreshold && hasDatedGames
      ? games.filter((game) => {
          const date = parseDate(game.startDate || game.createdAt || game.updatedAt);
          return Boolean(date && date.getTime() >= recentThreshold && date.getTime() <= referenceNow);
        })
      : games;
    const filteredSyncs = recentThreshold && hasDatedSyncs
      ? syncs.filter((sync) => {
          const date = parseDate(sync.startedAt || sync.syncedAt || sync.createdAt || sync.capturedAt);
          return Boolean(date && date.getTime() >= recentThreshold && date.getTime() <= referenceNow);
        })
      : syncs;
    const previousGames = hasDatedGames
      ? games.filter((game) => {
          const date = parseDate(game.startDate || game.createdAt || game.updatedAt);
          return Boolean(date && date.getTime() >= previousThresholdStart && date.getTime() < previousThresholdEnd);
        })
      : [];

    const currentAnalysis = analyzeGames(filteredGames);
    const previousAnalysis = analyzeGames(previousGames);
    const avgTurnTime = currentAnalysis.totalTurns > 0 ? currentAnalysis.totalTurnTime / currentAnalysis.totalTurns : 0;
    const successRate = currentAnalysis.totalTurns > 0 ? Math.round((currentAnalysis.successfulTurns / currentAnalysis.totalTurns) * 100) : 0;
    const previousAvgTurnTime = previousAnalysis.totalTurns > 0 ? previousAnalysis.totalTurnTime / previousAnalysis.totalTurns : 0;
    const previousSuccessRate = previousAnalysis.totalTurns > 0 ? Math.round((previousAnalysis.successfulTurns / previousAnalysis.totalTurns) * 100) : 0;
    const activityBuckets = Array.from({ length: chartWindowDays }, (_, index) => {
      const date = new Date(referenceNow - (chartWindowDays - index - 1) * DAY_MS);
      const key = date.toISOString().slice(0, 10);
      return { key, name: formatDayLabel(date), total: 0 };
    });
    const activityByKey = new Map(activityBuckets.map((bucket) => [bucket.key, bucket]));
    const datedActivity = [
      ...filteredGames.map((game) => parseDate(game.startDate || game.createdAt || game.updatedAt)),
      ...filteredSyncs.map((sync) => parseDate(sync.startedAt || sync.syncedAt || sync.createdAt || sync.capturedAt)),
    ].filter((value): value is Date => Boolean(value));

    datedActivity.forEach((date) => {
      const key = date.toISOString().slice(0, 10);
      const bucket = activityByKey.get(key);
      if (bucket) bucket.total += 1;
    });

    const playerStats = currentAnalysis.playerDrilldowns.slice(0, 5);
    const deckInsights = currentAnalysis.deckDrilldowns.slice(0, 5);
    const previousPlayers = new Map(previousAnalysis.playerDrilldowns.map((item) => [item.name, item]));
    const previousDecks = new Map(previousAnalysis.deckDrilldowns.map((item) => [item.name, item]));
    const activityDaySummary = new Map(
      activityBuckets.map((bucket) => [bucket.key, { ...bucket, matches: 0, turns: 0, syncs: 0, decks: new Set<string>() }]),
    );

    filteredGames.forEach((game) => {
      const date = parseDate(game.startDate || game.createdAt || game.updatedAt);
      if (!date) return;
      const key = date.toISOString().slice(0, 10);
      const day = activityDaySummary.get(key);
      if (!day) return;
      day.matches += 1;
      day.turns += game.turns.length;
      day.decks.add(game.deckName || "Sin mazo");
    });

    filteredSyncs.forEach((sync) => {
      const date = parseDate(sync.startedAt || sync.syncedAt || sync.createdAt || sync.capturedAt);
      if (!date) return;
      const key = date.toISOString().slice(0, 10);
      const day = activityDaySummary.get(key);
      if (!day) return;
      day.syncs += 1;
    });

    const activityDayDrilldowns = activityBuckets.map((bucket) => {
      const day = activityDaySummary.get(bucket.key);
      return {
        key: bucket.key,
        name: bucket.name,
        total: bucket.total,
        matches: day?.matches || 0,
        turns: day?.turns || 0,
        syncs: day?.syncs || 0,
        decks: Array.from(day?.decks || []).slice(0, 4),
      };
    });

    return {
      recentGames: currentAnalysis.recentGames,
      activePlayers: currentAnalysis.activePlayers,
      avgTurnTime,
      successRate,
      deckChart: currentAnalysis.deckChart,
      activityChart: activityBuckets,
      activityDayDrilldowns,
      hasDatedActivity: datedActivity.length > 0,
      playerStats,
      deckInsights,
      playerDrilldowns: currentAnalysis.playerDrilldowns,
      deckDrilldowns: currentAnalysis.deckDrilldowns,
      supportPlayers: playerStats
        .filter((item) => item.totalTurns >= 2 && item.successRate < 60)
        .map((item) => ({
          ...item,
          trendLabel: buildSupportTrendLabel(item.successRate, previousPlayers.get(item.name)?.successRate),
        }))
        .slice(0, 3),
      supportDecks: deckInsights
        .filter((item) => item.totalTurns >= 2 && item.successRate < 60)
        .map((item) => ({
          ...item,
          trendLabel: buildSupportTrendLabel(item.successRate, previousDecks.get(item.name)?.successRate),
        }))
        .slice(0, 3),
      periodLabel: periodFilter === "all" ? "visibles" : periodFilter === "30d" ? "30 días" : "7 días",
      periodWindowLabel: periodFilter === "all" ? "últimos 30 días" : periodFilter === "30d" ? "últimos 30 días" : "últimos 7 días",
      trends: {
        games: describeCountTrend(currentAnalysis.recentGames, previousAnalysis.recentGames, "partidas"),
        players: describeCountTrend(currentAnalysis.activePlayers, previousAnalysis.activePlayers, "estudiantes"),
        success: describeRateTrend(successRate, previousSuccessRate),
        pace: describeDurationTrend(avgTurnTime, previousAvgTurnTime),
      },
      exportGames: filteredGames,
    };
  }, [gamesQuery.data, periodFilter, referenceNow, syncsQuery.data]);

  const selectedPlayer = metrics.playerDrilldowns.find((item) => item.name === selectedPlayerName) || metrics.playerDrilldowns[0] || null;
  const selectedDeck = metrics.deckDrilldowns.find((item) => item.name === selectedDeckName) || metrics.deckDrilldowns[0] || null;
  const selectedActivityDay = metrics.activityDayDrilldowns.find((item) => item.key === selectedActivityDayKey)
    || metrics.activityDayDrilldowns.find((item) => item.total > 0)
    || null;

  const handleExport = async (format: "pdf" | "excel") => {
    try {
      setExportingFormat(format);
      const exportData = buildTeacherDashboardExportData(metrics.exportGames);
      if (format === "pdf") {
        await downloadTeacherDashboardPdf(exportData);
      } else {
        await downloadTeacherDashboardExcel(exportData);
      }
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Docente"
        title="Una vista más clara para acompañar el aula"
        description="Tomamos como referencia el tono del sitio público de MagicBox para empezar a mover el dashboard hacia una experiencia más cálida, simple y pedagógica, sin perder la capa operativa que ya tenemos."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Período</span>
            <select
              value={periodFilter}
              onChange={(event) => setPeriodFilter(event.target.value as "7d" | "30d" | "all")}
              className="h-10 min-w-32 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
              <option value="all">Todo</option>
            </select>
            <Button type="button" variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={exportingFormat !== null || metrics.exportGames.length === 0}>
              <Download className="size-4" />
              {exportingFormat === "pdf" ? "Generando PDF..." : "Descargar PDF"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => handleExport("excel")} disabled={exportingFormat !== null || metrics.exportGames.length === 0}>
              <Download className="size-4" />
              {exportingFormat === "excel" ? "Generando Excel..." : "Descargar Excel"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="overflow-hidden border-none bg-[linear-gradient(135deg,#1f2a37_0%,#31465e_52%,#3f5a74_100%)] text-white shadow-[0_20px_60px_rgba(31,42,55,0.22)]">
          <CardContent className="p-8 sm:p-10">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/14 text-white hover:bg-white/14">Aprendizaje colaborativo</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Sin pantallas</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Datos accionables</Badge>
            </div>

            <div className="mt-6 max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                La pantalla docente tiene que sentirse tan confiable y amable como la propuesta educativa.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/78">
                Este primer frente combina una lectura institucional con los indicadores operativos ya disponibles,
                para que luego podamos refinar módulos, profundidad analítica y la experiencia embebida.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Visión general</p>
                <p className="mt-2 text-lg font-medium">Panorama rápido del aula y de la actividad reciente.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Tono visual</p>
                <p className="mt-2 text-lg font-medium">Menos tablero industrial, más herramienta educativa.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Próxima capa</p>
                <p className="mt-2 text-lg font-medium">Métricas, progreso y narrativas por grupo y estudiante.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Qué mirar hoy</CardTitle>
            <CardDescription>
              Una primera columna de lectura rápida para docentes y coordinación.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <InsightRow
              title="Actividad reciente"
              description="Ver si el grupo viene jugando en la última semana y detectar rápido si el ritmo cayó."
              icon={Sparkles}
            />
            <InsightRow
              title="Participación del grupo"
              description="Mirar cuántos estudiantes participaron y cómo se está repartiendo la interacción."
              icon={Users2}
            />
            <InsightRow
              title="Seguimiento por contenido"
              description="Identificar qué mazos tienen más tracción para ordenar después la lectura didáctica."
              icon={BookOpen}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)
        ) : (
          <>
            <MetricCard
              label={`Partidas ${metrics.periodLabel}`}
              value={String(metrics.recentGames)}
              hint="Volumen reciente de juego para leer continuidad de uso, no solo histórico acumulado."
              trend={metrics.trends.games}
              icon={Database}
            />
            <MetricCard
              label="Estudiantes participantes"
              value={String(metrics.activePlayers)}
              hint="Cuenta única de jugadores visibles en la muestra actual."
              trend={metrics.trends.players}
              icon={Users2}
            />
            <MetricCard
              label="Tiempo promedio por turno"
              value={formatDurationSeconds(metrics.avgTurnTime)}
              hint="Sirve para detectar ritmo de juego y posibles momentos de fricción."
              trend={metrics.trends.pace}
              icon={Activity}
            />
            <MetricCard
              label="Éxito de turnos"
              value={`${metrics.successRate}%`}
              hint="Proporción agregada de aciertos sobre el total de jugadas visibles."
              trend={metrics.trends.success}
              icon={Trophy}
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

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>Tendencias del período</CardTitle>
          <CardDescription>
            Lectura comparativa de {metrics.periodWindowLabel} contra el bloque anterior para detectar cambios de ritmo antes de que se vuelvan problema.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-background/70 p-4">
            <p className="text-sm font-medium text-foreground">Ritmo de juego</p>
            <p className="mt-2 text-sm text-muted-foreground">{metrics.trends.games.label}</p>
          </div>
          <div className="rounded-2xl bg-background/70 p-4">
            <p className="text-sm font-medium text-foreground">Participación</p>
            <p className="mt-2 text-sm text-muted-foreground">{metrics.trends.players.label}</p>
          </div>
          <div className="rounded-2xl bg-background/70 p-4">
            <p className="text-sm font-medium text-foreground">Acierto</p>
            <p className="mt-2 text-sm text-muted-foreground">{metrics.trends.success.label}</p>
          </div>
          <div className="rounded-2xl bg-background/70 p-4">
            <p className="text-sm font-medium text-foreground">Fluidez</p>
            <p className="mt-2 text-sm text-muted-foreground">{metrics.trends.pace.label}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>Señales de acompañamiento</CardTitle>
          <CardDescription>
            Heurísticas suaves para ubicar rápido estudiantes o contenidos que merecen una segunda mirada.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-background/70 p-4">
            <p className="text-sm font-medium text-foreground">Estudiantes para acompañar</p>
            <div className="mt-3 space-y-2">
              {metrics.supportPlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No aparecen estudiantes con señal de apoyo en el período seleccionado.</p>
              ) : (
                metrics.supportPlayers.map((player) => (
                  <div key={player.name} className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 p-3 text-sm">
                    <span className="font-medium text-foreground">{player.name}</span>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{player.totalTurns} turnos</Badge>
                      <Badge variant="secondary">{player.successRate}% éxito</Badge>
                      <Badge variant="outline">{player.trendLabel}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-2xl bg-background/70 p-4">
            <p className="text-sm font-medium text-foreground">Contenidos para reforzar</p>
            <div className="mt-3 space-y-2">
              {metrics.supportDecks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No aparecen mazos con señal de refuerzo en el período seleccionado.</p>
              ) : (
                metrics.supportDecks.map((deck) => (
                  <div key={deck.name} className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 p-3 text-sm">
                    <span className="font-medium text-foreground">{deck.name}</span>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{deck.totalTurns} turnos</Badge>
                      <Badge variant="secondary">{deck.successRate}% éxito</Badge>
                      <Badge variant="outline">{deck.trendLabel}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Partidas por mazo</CardTitle>
            <CardDescription>
              Un primer bloque de lectura curricular para ver qué materiales están teniendo más movimiento.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {isLoading ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : metrics.deckChart.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                Sin partidas para graficar todavía.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={metrics.deckChart}
                  onClick={(state) => {
                    const deckName = (state as { activePayload?: Array<{ payload?: { name?: string } }> }).activePayload?.[0]?.payload?.name;
                    if (deckName) setSelectedDeckName(deckName);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7dcc9" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#e67e22" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
            <CardDescription>
              {metrics.periodWindowLabel} combinando partidas y sincronizaciones fechadas para leer continuidad real.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {isLoading ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : !metrics.hasDatedActivity ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                Todavía no hay actividad fechada para graficar.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={metrics.activityChart}
                  onClick={(state) => {
                    const dayKey = (state as { activePayload?: Array<{ payload?: { key?: string } }> }).activePayload?.[0]?.payload?.key;
                    if (dayKey) setSelectedActivityDayKey(dayKey);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7dcc9" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#3f7d6b" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>Detalle de la jornada</CardTitle>
          <CardDescription>
            Hacé clic en la gráfica de actividad para fijar un día y ver cuántas partidas, turnos y sincronizaciones quedaron registradas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedActivityDay ? (
            <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
              Seleccioná una barra de actividad para ver el detalle diario.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-2xl bg-background/70 p-4">
                <p className="text-sm text-muted-foreground">Jornada seleccionada</p>
                <p className="mt-2 text-lg font-medium text-foreground">{selectedActivityDay.name}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline">{selectedActivityDay.matches} partidas</Badge>
                  <Badge variant="outline">{selectedActivityDay.turns} turnos</Badge>
                  <Badge variant="outline">{selectedActivityDay.syncs} syncs</Badge>
                </div>
              </div>
              <div className="rounded-2xl bg-background/70 p-4">
                <p className="text-sm font-medium text-foreground">Mazos activos ese día</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedActivityDay.decks.length === 0 ? (
                    <Badge variant="outline">sin partidas fechadas</Badge>
                  ) : (
                    selectedActivityDay.decks.map((deck) => (
                      <Badge key={deck} variant="outline">{deck}</Badge>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Participación del grupo</CardTitle>
            <CardDescription>
              Lectura rápida de quiénes están jugando más y con qué nivel de acierto en la muestra visible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.playerStats.length === 0 ? (
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                Todavía no hay jugadas suficientes para construir una lectura por estudiante.
              </div>
            ) : (
              metrics.playerStats.map((player) => (
                <button
                  key={player.name}
                  type="button"
                  onClick={() => setSelectedPlayerName(player.name)}
                  className="w-full rounded-2xl bg-background/70 p-4 text-left transition-colors hover:bg-background"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{player.name}</p>
                      <p className="text-xs text-muted-foreground">{player.totalTurns} turnos observados</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{player.successRate}% éxito</Badge>
                      <Badge variant="outline">{formatDurationSeconds(player.avgTurnTime)}</Badge>
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Mazos para mirar de cerca</CardTitle>
            <CardDescription>
              Combina volumen y desempeño para ayudar a detectar contenidos que quizá necesiten acompañamiento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.deckInsights.length === 0 ? (
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                Aún no hay suficiente actividad para construir señales por mazo.
              </div>
            ) : (
              metrics.deckInsights.map((deck) => (
                <button
                  key={deck.name}
                  type="button"
                  onClick={() => setSelectedDeckName(deck.name)}
                  className="w-full rounded-2xl bg-background/70 p-4 text-left transition-colors hover:bg-background"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{deck.name}</p>
                      <p className="text-xs text-muted-foreground">{deck.totalGames} partidas, {deck.totalTurns} turnos</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{deck.successRate}% éxito</Badge>
                      <Badge variant="outline">{formatDurationSeconds(deck.avgTurnTime)}</Badge>
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Detalle de estudiante</CardTitle>
            <CardDescription>
              Drilldown rápido desde el dashboard docente, sin salir a otra pantalla, para entender participación y foco de apoyo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedPlayer ? (
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                Seleccioná un estudiante para ver su detalle.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{selectedPlayer.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedPlayer.totalGames} partidas visibles en el período</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{selectedPlayer.successRate}% éxito</Badge>
                      <Badge variant="outline">{formatDurationSeconds(selectedPlayer.avgTurnTime)}</Badge>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Mazos más frecuentes</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedPlayer.decks.length === 0 ? (
                      <Badge variant="outline">sin mazos detectados</Badge>
                    ) : (
                      selectedPlayer.decks.map((deck) => (
                        <Badge key={deck.name} variant="outline">{deck.name} · {deck.totalTurns} turnos</Badge>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Detalle de mazo</CardTitle>
            <CardDescription>
              Drilldown rápido para leer volumen, desempeño y quiénes están interactuando con ese contenido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedDeck ? (
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                Seleccioná un mazo para ver su detalle.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{selectedDeck.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedDeck.totalGames} partidas, {selectedDeck.totalTurns} turnos</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{selectedDeck.successRate}% éxito</Badge>
                      <Badge variant="outline">{formatDurationSeconds(selectedDeck.avgTurnTime)}</Badge>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Jugadores más activos</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedDeck.players.length === 0 ? (
                      <Badge variant="outline">sin jugadores detectados</Badge>
                    ) : (
                      selectedDeck.players.map((player) => (
                        <Badge key={player.name} variant="outline">{player.name} · {player.totalTurns} turnos</Badge>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Dirección visual sugerida para la siguiente iteración</CardTitle>
              <CardDescription>
                {user?.fullName || "La cuenta autenticada"} ya puede ver una base más alineada con la marca.
                Lo próximo sería profundizar la pantalla con progreso por grupo, alertas suaves y narrativa por estudiante.
              </CardDescription>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              Siguiente paso
              <ArrowRight className="size-4" />
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
