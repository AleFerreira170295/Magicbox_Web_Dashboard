"use client";

import { useMemo, useState } from "react";
import { BookHeart, Cable, Database, Layers3, TimerReset } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import {
  DashboardBarChartCard,
  DashboardDetailPanel,
  DashboardLineChartCard,
  type DashboardDetailRow,
  DashboardMetricCard,
  DashboardTopListCard,
  filterDashboardItemsByRange,
  useDashboardModuleControls,
} from "@/features/dashboard/dashboard-analytics-shared";
import {
  buildDeckUsageSeries,
  buildGameActivitySeries,
  getAverageTurnTime,
  getDateBucketLabel,
  getSuccessRate,
} from "@/features/dashboard/dashboard-analytics-utils";
import { useGames } from "@/features/games/api";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";
import { useSyncSessions } from "@/features/syncs/api";
import { formatDurationSeconds, getErrorMessage } from "@/lib/utils";

const messages: Record<AppLanguage, {
  header: { eyebrow: string; title: (name: string) => string; description: string };
  metrics: { games: string; turns: string; success: string; turnTime: string; syncs: string; gamesHint: string; turnsHint: string; successHint: string; turnTimeHint: string; syncsHint: string };
  charts: { activity: string; activityDesc: string; decks: string; decksDesc: string; summary: string; summaryDesc: string };
  detail: { games: string; turnsTitle: string; success: string; turnTime: string; syncs: string; gameDesc: string; syncDesc: string; noSource: string; raw: (count: number) => string; turnsCount: (count: number) => string; correct: (success: number, total: number) => string };
  summary: { recent: string; evidence: string; manual: string; noDeck: string; captured: string; game: string };
  error: (message: string) => string;
}> = {
  es: {
    header: { eyebrow: "Familia", title: (name) => `Seguimiento de ${name}`, description: "Vista acotada para leer actividad, partidas y sincronizaciones recientes sin módulos operativos ni administración." },
    metrics: { games: "Partidas", turns: "Turnos", success: "Acierto", turnTime: "Tiempo por turno", syncs: "Sincronizaciones", gamesHint: "Actividad visible asociada a la cuenta.", turnsHint: "Interacciones registradas dentro de esas partidas.", successHint: "Porcentaje de respuestas correctas en la actividad visible.", turnTimeHint: "Ritmo promedio de juego.", syncsHint: "Evidencia recibida desde la app o la MagicBox." },
    charts: { activity: "Actividad reciente", activityDesc: "Partidas y turnos por fecha.", decks: "Mazos usados", decksDesc: "Contenidos más presentes en la actividad visible.", summary: "Resumen simple", summaryDesc: "Lectura rápida de actividad y evidencia disponible." },
    detail: { games: "Detalle de partidas", turnsTitle: "Detalle de turnos", success: "Detalle de acierto", turnTime: "Detalle de tiempos", syncs: "Detalle de sincronizaciones", gameDesc: "Partidas visibles para la cuenta family.", syncDesc: "Sincronizaciones propias o visibles sin datos administrativos.", noSource: "Sin origen informado", raw: (count) => `${count} raw`, turnsCount: (count) => `${count} turnos`, correct: (success, total) => `${success}/${total} correctos` },
    summary: { recent: "Actividad reciente", evidence: "Syncs con evidencia", manual: "Partidas con jugadores manuales", noDeck: "Sin mazo", captured: "captura utilizable", game: "Partida" },
    error: (message) => `No pude cargar el dashboard family: ${message}`,
  },
  en: {
    header: { eyebrow: "Family", title: (name) => `${name} follow-up`, description: "Limited view for recent activity, games, and syncs without operational or admin modules." },
    metrics: { games: "Games", turns: "Turns", success: "Success", turnTime: "Turn time", syncs: "Syncs", gamesHint: "Visible activity linked to the account.", turnsHint: "Interactions recorded inside those games.", successHint: "Correct answer percentage in visible activity.", turnTimeHint: "Average pace of play.", syncsHint: "Evidence received from the app or MagicBox." },
    charts: { activity: "Recent activity", activityDesc: "Games and turns by date.", decks: "Used decks", decksDesc: "Most present content in visible activity.", summary: "Simple summary", summaryDesc: "Quick read of activity and available evidence." },
    detail: { games: "Game detail", turnsTitle: "Turn detail", success: "Success detail", turnTime: "Timing detail", syncs: "Sync detail", gameDesc: "Games visible to the family account.", syncDesc: "Own or visible syncs without admin data.", noSource: "No source recorded", raw: (count) => `${count} raw`, turnsCount: (count) => `${count} turns`, correct: (success, total) => `${success}/${total} correct` },
    summary: { recent: "Recent activity", evidence: "Syncs with evidence", manual: "Games with manual players", noDeck: "No deck", captured: "usable capture", game: "Game" },
    error: (message) => `I couldn't load the family dashboard: ${message}`,
  },
  pt: {
    header: { eyebrow: "Família", title: (name) => `Acompanhamento de ${name}`, description: "Vista limitada para ler atividade, partidas e sincronizações recentes sem módulos operacionais nem administração." },
    metrics: { games: "Partidas", turns: "Turnos", success: "Acerto", turnTime: "Tempo por turno", syncs: "Sincronizações", gamesHint: "Atividade visível associada à conta.", turnsHint: "Interações registradas dentro dessas partidas.", successHint: "Percentual de respostas corretas na atividade visível.", turnTimeHint: "Ritmo médio de jogo.", syncsHint: "Evidência recebida pelo app ou pela MagicBox." },
    charts: { activity: "Atividade recente", activityDesc: "Partidas e turnos por data.", decks: "Baralhos usados", decksDesc: "Conteúdos mais presentes na atividade visível.", summary: "Resumo simples", summaryDesc: "Leitura rápida de atividade e evidência disponível." },
    detail: { games: "Detalhe de partidas", turnsTitle: "Detalhe de turnos", success: "Detalhe de acerto", turnTime: "Detalhe de tempos", syncs: "Detalhe de sincronizações", gameDesc: "Partidas visíveis para a conta family.", syncDesc: "Sincronizações próprias ou visíveis sem dados administrativos.", noSource: "Sem origem informada", raw: (count) => `${count} raw`, turnsCount: (count) => `${count} turnos`, correct: (success, total) => `${success}/${total} corretos` },
    summary: { recent: "Atividade recente", evidence: "Syncs com evidência", manual: "Partidas com jogadores manuais", noDeck: "Sem baralho", captured: "captura utilizável", game: "Partida" },
    error: (message) => `Não consegui carregar o dashboard family: ${message}`,
  },
};

function getDateValue(...values: Array<string | null | undefined>) {
  return values.find(Boolean) || null;
}

export function FamilyDashboard() {
  const { language } = useLanguage();
  const t = messages[language];
  const { tokens, user } = useAuth();
  const [selectedDetail, setSelectedDetail] = useState<{ kind: string; label: string } | null>(null);
  const { getRange, setRange } = useDashboardModuleControls();
  const activityRange = getRange("family-activity");
  const deckRange = getRange("family-decks");
  const permissionKeys = useMemo(() => new Set(user?.permissions || []), [user?.permissions]);
  const canReadCanonicalGames = Boolean(
    user?.roles.includes("admin") ||
      permissionKeys.has("game_data:read") ||
      permissionKeys.has("game-data:read"),
  );

  const gamesQuery = useGames(canReadCanonicalGames ? tokens?.accessToken : undefined, { limit: 100, sortBy: "created_at", order: "desc" });
  const syncsQuery = useSyncSessions(tokens?.accessToken);

  const games = useMemo(() => gamesQuery.data?.data || [], [gamesQuery.data?.data]);
  const syncs = useMemo(() => syncsQuery.data?.data || [], [syncsQuery.data?.data]);
  const activityGames = useMemo(
    () => filterDashboardItemsByRange(games, activityRange, (game) => getDateValue(game.startDate, game.createdAt, game.updatedAt)),
    [activityRange, games],
  );
  const deckGames = useMemo(
    () => filterDashboardItemsByRange(games, deckRange, (game) => getDateValue(game.startDate, game.createdAt, game.updatedAt)),
    [deckRange, games],
  );

  const totalTurns = games.reduce((sum, game) => sum + (game.turns || []).length, 0);
  const successRate = getSuccessRate(games);
  const averageTurnTime = getAverageTurnTime(games);
  const syncsWithEvidence = syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) > 0 || Object.keys(sync.rawPayload || {}).length > 0).length;
  const manualGames = games.filter((game) => (game.players || []).some((player) => player.playerSource === "manual")).length;
  const activitySeries = buildGameActivitySeries(activityGames);
  const deckUsage = buildDeckUsageSeries(deckGames);

  const gameRows = (items = games): DashboardDetailRow[] => items.map((game) => ({
    label: game.deckName || `${t.summary.game} ${game.gameId || game.id}`,
    value: t.detail.turnsCount((game.turns || []).length),
    hint: getDateBucketLabel(game.startDate || game.createdAt || game.updatedAt),
    badge: (game.players || []).some((player) => player.playerSource === "manual") ? t.summary.manual : undefined,
  }));

  const syncRows: DashboardDetailRow[] = syncs.map((sync) => ({
    label: sync.deckName || `Sync ${sync.syncId || sync.id}`,
    value: t.detail.raw(sync.rawRecordCount || sync.rawRecordIds.length || 0),
    hint: sync.source || sync.sourceType || t.detail.noSource,
    badge: syncsWithEvidence > 0 ? t.summary.captured : undefined,
  }));

  const detailPanel = (() => {
    if (!selectedDetail) return null;
    if (selectedDetail.kind === "syncs") return { title: t.detail.syncs, description: t.detail.syncDesc, rows: syncRows };
    if (selectedDetail.kind === "success") {
      return {
        title: t.detail.success,
        description: t.detail.gameDesc,
        rows: games.map((game) => {
          const turns = game.turns || [];
          const successes = turns.filter((turn) => turn.success).length;
          return {
            label: game.deckName || `${t.summary.game} ${game.gameId || game.id}`,
            value: turns.length > 0 ? `${Math.round((successes / turns.length) * 100)}%` : "0%",
            hint: t.detail.correct(successes, turns.length),
          };
        }),
      };
    }
    return { title: selectedDetail.kind === "turnTime" ? t.detail.turnTime : selectedDetail.kind === "turns" ? t.detail.turnsTitle : t.detail.games, description: t.detail.gameDesc, rows: gameRows() };
  })();

  const isLoading = gamesQuery.isLoading || syncsQuery.isLoading;
  const error = gamesQuery.error || syncsQuery.error;

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={t.header.eyebrow}
        title={t.header.title(user?.fullName || t.header.eyebrow.toLowerCase())}
        description={t.header.description}
      />

      {detailPanel ? (
        <DashboardDetailPanel
          title={detailPanel.title}
          description={detailPanel.description}
          rows={detailPanel.rows}
          activeFilterLabel={selectedDetail?.label || ""}
          onClear={() => setSelectedDetail(null)}
        />
      ) : null}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <DashboardMetricCard label={t.metrics.games} value={String(gamesQuery.data?.total || games.length)} hint={t.metrics.gamesHint} icon={BookHeart} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "games", label: t.metrics.games })} isActive={selectedDetail?.kind === "games"} />
        <DashboardMetricCard label={t.metrics.turns} value={String(totalTurns)} hint={t.metrics.turnsHint} icon={Layers3} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "turns", label: t.metrics.turns })} isActive={selectedDetail?.kind === "turns"} />
        <DashboardMetricCard label={t.metrics.success} value={`${successRate}%`} hint={t.metrics.successHint} icon={Database} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "success", label: t.metrics.success })} isActive={selectedDetail?.kind === "success"} />
        <DashboardMetricCard label={t.metrics.turnTime} value={formatDurationSeconds(averageTurnTime)} hint={t.metrics.turnTimeHint} icon={TimerReset} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "turnTime", label: t.metrics.turnTime })} isActive={selectedDetail?.kind === "turnTime"} />
        <DashboardMetricCard label={t.metrics.syncs} value={String(syncs.length)} hint={t.metrics.syncsHint} icon={Cable} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "syncs", label: t.metrics.syncs })} isActive={selectedDetail?.kind === "syncs"} />
      </div>

      {error ? (
        <Card className="border-destructive/20 bg-white/85">
          <CardContent className="p-6 text-sm text-destructive">
            {t.error(getErrorMessage(error))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardLineChartCard
          title={t.charts.activity}
          description={t.charts.activityDesc}
          data={activitySeries}
          range={activityRange}
          onRangeChange={(range) => setRange("family-activity", range)}
          csvFileName={`family-activity-${activityRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "games", label })}
          activeDatumLabel={selectedDetail?.kind === "games" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.decks}
          description={t.charts.decksDesc}
          data={deckUsage}
          range={deckRange}
          onRangeChange={(range) => setRange("family-decks", range)}
          csvFileName={`family-decks-${deckRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "games", label })}
          activeDatumLabel={selectedDetail?.kind === "games" ? selectedDetail.label : null}
        />
      </div>

      <DashboardTopListCard
        title={t.charts.summary}
        description={t.charts.summaryDesc}
        items={[
          { label: t.summary.recent, value: String(games.length), badge: t.metrics.games },
          { label: t.summary.evidence, value: String(syncsWithEvidence), badge: t.summary.captured },
          { label: t.summary.manual, value: String(manualGames), badge: t.metrics.games },
        ]}
        onItemSelect={(label) => setSelectedDetail({ kind: label === t.summary.evidence ? "syncs" : "games", label })}
        activeItemLabel={selectedDetail?.label || null}
      />
    </div>
  );
}
