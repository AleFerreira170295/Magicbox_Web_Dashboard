"use client";

import { useState } from "react";
import { BookOpen, Database, Layers3, SearchCheck, Target, TimerReset } from "lucide-react";
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
} from "@/features/dashboard/dashboard-analytics-shared";
import {
  buildDeckUsageSeries,
  buildGameActivitySeries,
  buildProfileAgeCategorySeries,
  buildProfileCoverageSeries,
  buildProfileRecencySeries,
  buildProfileSessionCohortSeries,
  buildSyncSourceSeries,
  buildUserCreationSeries,
  buildUserRecencySeries,
  buildUserTypeSeries,
  getAverageGameTime,
  getAverageTurnTime,
  getDateBucketLabel,
  getSuccessRate,
} from "@/features/dashboard/dashboard-analytics-utils";
import { useGames } from "@/features/games/api";
import { useProfilesOverview } from "@/features/profiles/api";
import { useSyncSessions } from "@/features/syncs/api";
import { useUsers } from "@/features/users/api";
import { formatDurationSeconds, getErrorMessage } from "@/lib/utils";

function normalizeLabel(value?: string | null) {
  return (value || "sin dato").replace(/[|]/g, " / ").replace(/[-_]/g, " ").trim().toLowerCase();
}

function getRelativeDays(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function matchesRecencyLabel(label: string, value?: string | null) {
  const diffDays = getRelativeDays(value);
  const normalized = normalizeLabel(label);

  if (diffDays == null) return normalized.includes("sin");
  if (normalized.includes("7 días")) return diffDays <= 7;
  if (normalized.includes("8 30 días") || normalized.includes("8/30 días")) return diffDays > 7 && diffDays <= 30;
  if (normalized.includes("31 90 días") || normalized.includes("31/90 días")) return diffDays > 30 && diffDays <= 90;
  if (normalized.includes("> 90 días")) return diffDays > 90;
  return false;
}

export function ResearcherDashboard() {
  const { tokens } = useAuth();
  const [selectedDetail, setSelectedDetail] = useState<{ kind: string; label: string } | null>(null);
  const gamesQuery = useGames(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);
  const usersQuery = useUsers(tokens?.accessToken);
  const profilesQuery = useProfilesOverview(tokens?.accessToken);

  const games = gamesQuery.data?.data || [];
  const syncs = syncsQuery.data?.data || [];
  const users = usersQuery.data?.data || [];
  const profiles = profilesQuery.data || [];
  const isLoading = gamesQuery.isLoading || syncsQuery.isLoading || usersQuery.isLoading || profilesQuery.isLoading;
  const error = gamesQuery.error || syncsQuery.error || usersQuery.error || profilesQuery.error;

  const totalTurns = games.reduce((sum, game) => sum + game.turns.length, 0);
  const activeDecks = new Set(games.map((game) => game.deckName).filter(Boolean)).size;
  const successRate = getSuccessRate(games);
  const averageGameTime = getAverageGameTime(games);
  const averageTurnTime = getAverageTurnTime(games);
  const activitySeries = buildGameActivitySeries(games);
  const deckUsage = buildDeckUsageSeries(games);
  const syncSourceSeries = buildSyncSourceSeries(syncs);
  const userTypeSeries = buildUserTypeSeries(users);
  const userCreationSeries = buildUserCreationSeries(users);
  const userRecencySeries = buildUserRecencySeries(users);
  const profileCoverageSeries = buildProfileCoverageSeries(profiles);
  const profileAgeSeries = buildProfileAgeCategorySeries(profiles);
  const profileRecencySeries = buildProfileRecencySeries(profiles);
  const profileSessionCohorts = buildProfileSessionCohortSeries(profiles);
  const evidenceRows = [
    {
      label: "Syncs sin raw",
      value: String(syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) === 0).length),
      badge: "Calidad de ingesta",
    },
    {
      label: "Partidas mixtas",
      value: String(
        games.filter((game) => {
          const manual = game.players.filter((player) => player.playerSource === "manual").length;
          const registered = game.players.filter((player) => player.playerSource !== "manual").length;
          return manual > 0 && registered > 0;
        }).length,
      ),
      badge: "Muestra heterogénea",
    },
    {
      label: "Partidas sin turnos",
      value: String(games.filter((game) => game.turns.length === 0).length),
      badge: "Vacío de interacción",
    },
  ].filter((item) => Number(item.value) > 0);

  const detailPanel = (() => {
    if (!selectedDetail) return null;

    const gameRows = (items = games): DashboardDetailRow[] =>
      items.map((game) => ({
        label: game.deckName || `Partida ${game.id}`,
        value: `${game.turns.length} turnos`,
        hint: `Fecha ${getDateBucketLabel(game.startDate || game.createdAt || game.updatedAt)} · ${game.players.length} jugadores`,
        badge: game.players.some((player) => player.playerSource === "manual") ? "Con carga manual" : "Registro estándar",
      }));

    const userRows: DashboardDetailRow[] = users.map((entry) => ({
      label: entry.fullName || entry.email || `Usuario ${entry.id}`,
      value: entry.userType || "Sin tipo",
      hint: entry.roles.join(", ") || "Sin rol",
      badge: entry.lastLoginAt ? `Login ${getDateBucketLabel(entry.lastLoginAt)}` : "Sin login",
    }));

    const profileRows: DashboardDetailRow[] = profiles.map((profile) => ({
      label: profile.displayName || `Perfil ${profile.id}`,
      value: `${profile.sessionCount} sesiones`,
      hint: `${profile.activeBindingCount} bindings activos · ${profile.ageCategory || "sin categoría"}`,
      badge: profile.isActive ? "Activo" : "Inactivo",
    }));

    const syncRows: DashboardDetailRow[] = syncs.map((sync) => ({
      label: sync.deckName || `Sync ${sync.id}`,
      value: sync.status || "Sin status",
      hint: `${sync.rawRecordCount || sync.rawRecordIds.length || 0} raw records · ${getDateBucketLabel(sync.startedAt || sync.createdAt || sync.updatedAt)}`,
      badge: sync.source || sync.sourceType || "Sin fuente",
    }));

    switch (selectedDetail.kind) {
      case "metric-games":
        return { title: "Detalle de partidas", description: "Base actual para análisis de sesiones y comportamiento.", filterLabel: selectedDetail.label, rows: gameRows() };
      case "metric-turns":
        return { title: "Detalle de turnos", description: "Volumen de interacción real dentro de la muestra analizada.", filterLabel: selectedDetail.label, rows: gameRows().filter((row) => row.value !== "0 turnos") };
      case "metric-success":
        return {
          title: "Detalle de acierto general",
          description: "Acierto por partida para lectura comparativa rápida.",
          filterLabel: selectedDetail.label,
          rows: games.map((game) => {
            const successes = game.turns.filter((turn) => turn.success).length;
            const rate = game.turns.length > 0 ? Math.round((successes / game.turns.length) * 100) : 0;
            return { label: game.deckName || `Partida ${game.id}`, value: `${rate}%`, hint: `${successes}/${game.turns.length} turnos correctos` };
          }),
        };
      case "metric-turn-time":
        return {
          title: "Tiempo por turno",
          description: "Tiempo medio de respuesta dentro de la muestra analizada.",
          filterLabel: selectedDetail.label,
          rows: games.map((game) => ({
            label: game.deckName || `Partida ${game.id}`,
            value: formatDurationSeconds(game.turns.length > 0 ? game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0) / game.turns.length : 0),
            hint: `${game.turns.length} turnos medidos`,
          })),
        };
      case "metric-game-time":
        return {
          title: "Tiempo por partida",
          description: "Duración promedio agregada por sesión.",
          filterLabel: selectedDetail.label,
          rows: games.map((game) => ({
            label: game.deckName || `Partida ${game.id}`,
            value: formatDurationSeconds(game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0)),
            hint: `${game.turns.length} turnos`,
          })),
        };
      case "metric-decks":
        return { title: "Mazos activos", description: "Diversidad de contenido presente en la muestra.", filterLabel: selectedDetail.label, rows: deckUsage.map((item) => ({ label: item.label, value: String(item.value), hint: "Partidas asociadas" })) };
      case "metric-users":
        return { title: "Usuarios", description: "Padrón que alimenta la muestra y sus cohortes.", filterLabel: selectedDetail.label, rows: userRows };
      case "metric-profiles":
        return { title: "Perfiles", description: "Perfiles incluidos en la lectura de evidencia actual.", filterLabel: selectedDetail.label, rows: profileRows };
      case "activity-date":
        return { title: `Actividad del ${selectedDetail.label}`, description: "Partidas que caen en la fecha seleccionada.", filterLabel: selectedDetail.label, rows: gameRows(games.filter((game) => getDateBucketLabel(game.startDate || game.createdAt || game.updatedAt) === selectedDetail.label)) };
      case "deck":
        return { title: `Mazo ${selectedDetail.label}`, description: "Distribución de uso por mazo para orientar el análisis por contenido.", filterLabel: selectedDetail.label, rows: gameRows(games.filter((game) => normalizeLabel(game.deckName || "Sin mazo") === normalizeLabel(selectedDetail.label))) };
      case "user-type":
        return { title: `Tipos de usuario · ${selectedDetail.label}`, description: "Usuarios dentro del tipo elegido.", filterLabel: selectedDetail.label, rows: userRows.filter((row) => normalizeLabel(row.value) === normalizeLabel(selectedDetail.label)) };
      case "profile-coverage": {
        const normalized = normalizeLabel(selectedDetail.label);
        return {
          title: `Cobertura de perfiles · ${selectedDetail.label}`,
          description: "Perfiles filtrados por madurez observable.",
          filterLabel: selectedDetail.label,
          rows: profileRows.filter((row, index) => {
            const profile = profiles[index];
            if (normalized.includes("activos")) return profile.isActive;
            if (normalized.includes("binding") && !normalized.includes("sin")) return profile.activeBindingCount > 0;
            if (normalized.includes("sesiones")) return profile.sessionCount > 0;
            if (normalized.includes("sin binding")) return profile.activeBindingCount === 0;
            return false;
          }),
        };
      }
      case "user-creation-date":
        return {
          title: `Altas y logins · ${selectedDetail.label}`,
          description: "Usuarios creados o con login dentro de la fecha elegida.",
          filterLabel: selectedDetail.label,
          rows: userRows.filter((row, index) => {
            const userRecord = users[index];
            return getDateBucketLabel(userRecord?.createdAt || userRecord?.lastLoginAt) === selectedDetail.label
              || getDateBucketLabel(userRecord?.lastLoginAt) === selectedDetail.label;
          }),
        };
      case "user-recency":
        return { title: `Recencia del padrón · ${selectedDetail.label}`, description: "Usuarios dentro del período seleccionado.", filterLabel: selectedDetail.label, rows: userRows.filter((row, index) => matchesRecencyLabel(selectedDetail.label, users[index]?.lastLoginAt)) };
      case "profile-age":
        return { title: `Perfiles por categoría · ${selectedDetail.label}`, description: "Segmentación etaria dentro de la cohorte elegida.", filterLabel: selectedDetail.label, rows: profileRows.filter((row, index) => normalizeLabel(profiles[index]?.ageCategory || "Sin categoría") === normalizeLabel(selectedDetail.label)) };
      case "profile-recency":
        return { title: `Recencia de perfiles · ${selectedDetail.label}`, description: "Perfiles dentro del período seleccionado.", filterLabel: selectedDetail.label, rows: profileRows.filter((row, index) => matchesRecencyLabel(selectedDetail.label, profiles[index]?.lastSessionAt)) };
      case "sync-source":
        return { title: `Fuentes de sync · ${selectedDetail.label}`, description: "Sesiones de sync que pertenecen a la fuente elegida.", filterLabel: selectedDetail.label, rows: syncRows.filter((row) => normalizeLabel(row.badge) === normalizeLabel(selectedDetail.label)) };
      case "profile-sessions": {
        const normalized = normalizeLabel(selectedDetail.label);
        return {
          title: `Cohortes de profundidad · ${selectedDetail.label}`,
          description: "Perfiles agrupados por cantidad de sesiones.",
          filterLabel: selectedDetail.label,
          rows: profileRows.filter((row, index) => {
            const count = profiles[index]?.sessionCount || 0;
            if (normalized.includes("sin sesiones")) return count <= 0;
            if (normalized.includes("1 3 sesiones") || normalized.includes("1/3 sesiones")) return count >= 1 && count <= 3;
            if (normalized.includes("4 10 sesiones") || normalized.includes("4/10 sesiones")) return count >= 4 && count <= 10;
            if (normalized.includes("11+ sesiones")) return count >= 11;
            return false;
          }),
        };
      }
      case "evidence": {
        const normalized = normalizeLabel(selectedDetail.label);
        if (normalized.includes("syncs sin raw")) return { title: "Syncs sin raw", description: "Focos de trazabilidad incompleta dentro de la muestra.", filterLabel: selectedDetail.label, rows: syncRows.filter((row, index) => (syncs[index]?.rawRecordCount || syncs[index]?.rawRecordIds.length || 0) === 0) };
        if (normalized.includes("partidas mixtas")) return { title: "Partidas mixtas", description: "Sesiones con mezcla de jugadores manuales y registrados.", filterLabel: selectedDetail.label, rows: gameRows(games.filter((game) => {
          const manual = game.players.filter((player) => player.playerSource === "manual").length;
          const registered = game.players.filter((player) => player.playerSource !== "manual").length;
          return manual > 0 && registered > 0;
        })) };
        return { title: "Partidas sin turnos", description: "Vacíos de interacción que conviene revisar antes de analizar la muestra.", filterLabel: selectedDetail.label, rows: gameRows(games.filter((game) => game.turns.length === 0)) };
      }
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Investigación"
        title="Dashboard de evidencia y trazabilidad"
        description="Esta home se concentra en lectura analítica: volumen de muestra, acierto, tiempos, mazos, consistencia de captura y señales de calidad de evidencia."
      />

      {detailPanel ? (
        <DashboardDetailPanel
          title={detailPanel.title}
          description={detailPanel.description}
          rows={detailPanel.rows}
          activeFilterLabel={detailPanel.filterLabel}
          onClear={() => setSelectedDetail(null)}
        />
      ) : null}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <DashboardMetricCard label="Partidas" value={String(gamesQuery.data?.total || games.length)} hint="Base actual para análisis de sesiones y comportamiento." icon={Database} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-games", label: "Partidas" })} isActive={selectedDetail?.kind === "metric-games"} />
        <DashboardMetricCard label="Turnos" value={String(totalTurns)} hint="Volumen de interacción real dentro de la muestra analizada." icon={Layers3} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-turns", label: "Turnos" })} isActive={selectedDetail?.kind === "metric-turns"} />
        <DashboardMetricCard label="Acierto general" value={`${successRate}%`} hint="Porcentaje agregado de aciertos para lectura comparativa rápida." icon={BookOpen} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-success", label: "Acierto general" })} isActive={selectedDetail?.kind === "metric-success"} />
        <DashboardMetricCard label="Tiempo por turno" value={formatDurationSeconds(averageTurnTime)} hint="Tiempo medio de respuesta dentro de la muestra analizada." icon={TimerReset} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-turn-time", label: "Tiempo por turno" })} isActive={selectedDetail?.kind === "metric-turn-time"} />
        <DashboardMetricCard label="Tiempo por partida" value={formatDurationSeconds(averageGameTime)} hint="Duración promedio agregada por sesión." icon={SearchCheck} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-game-time", label: "Tiempo por partida" })} isActive={selectedDetail?.kind === "metric-game-time"} />
        <DashboardMetricCard label="Mazos activos" value={String(activeDecks)} hint="Diversidad de contenido presente en la muestra." icon={Target} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-decks", label: "Mazos activos" })} isActive={selectedDetail?.kind === "metric-decks"} />
        <DashboardMetricCard label="Usuarios" value={String(usersQuery.data?.total || users.length)} hint="Padrón que alimenta la muestra y sus cohortes." icon={Database} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-users", label: "Usuarios" })} isActive={selectedDetail?.kind === "metric-users"} />
        <DashboardMetricCard label="Perfiles" value={String(profiles.length)} hint="Perfiles incluidos en la lectura de evidencia actual." icon={Layers3} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-profiles", label: "Perfiles" })} isActive={selectedDetail?.kind === "metric-profiles"} />
      </div>

      {error ? (
        <Card className="border-destructive/20 bg-white/85">
          <CardContent className="p-6 text-sm text-destructive">
            No pude cargar una parte del dashboard researcher: {getErrorMessage(error)}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardLineChartCard
          title="Actividad por fecha"
          description="Partidas y turnos por día para observar estabilidad o picos de la muestra analizada."
          data={activitySeries}
          onDatumSelect={(label) => setSelectedDetail({ kind: "activity-date", label })}
          activeDatumLabel={selectedDetail?.kind === "activity-date" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Mazos en la muestra"
          description="Distribución de uso por mazo para orientar el análisis por contenido."
          data={deckUsage}
          onDatumSelect={(label) => setSelectedDetail({ kind: "deck", label })}
          activeDatumLabel={selectedDetail?.kind === "deck" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title="Tipos de usuario en la muestra"
          description="Distribución de cohortes para saber desde qué tipo de cuenta se compone la evidencia."
          data={userTypeSeries}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-type", label })}
          activeDatumLabel={selectedDetail?.kind === "user-type" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Cobertura de perfiles"
          description="Perfiles activos, con binding y con sesiones para medir madurez real de la muestra observable."
          data={profileCoverageSeries}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-coverage", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-coverage" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardLineChartCard
          title="Altas y logins"
          description="Serie temporal de usuarios creados y usuarios con login para seguir formación y reactivación de la muestra."
          data={userCreationSeries}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-creation-date", label })}
          activeDatumLabel={selectedDetail?.kind === "user-creation-date" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Recencia del padrón"
          description="Agrupa usuarios por recencia de acceso para detectar rápidamente cohortes activas, tibias o inertes."
          data={userRecencySeries}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-recency", label })}
          activeDatumLabel={selectedDetail?.kind === "user-recency" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title="Perfiles por categoría"
          description="Segmentación etaria para leer si la muestra está sesgada hacia algún tramo puntual."
          data={profileAgeSeries}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-age", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-age" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Recencia de perfiles"
          description="Última sesión por perfil para medir frescura real de la muestra disponible."
          data={profileRecencySeries}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-recency", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-recency" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title="Fuentes de sync"
          description="Cómo entra la evidencia y si hay dependencia de un solo canal de captura."
          data={syncSourceSeries}
          onDatumSelect={(label) => setSelectedDetail({ kind: "sync-source", label })}
          activeDatumLabel={selectedDetail?.kind === "sync-source" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Cohortes de profundidad"
          description="Perfiles agrupados por cantidad de sesiones para separar exploración temprana de uso sostenido."
          data={profileSessionCohorts}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-sessions", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-sessions" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardTopListCard
          title="Alertas de calidad de evidencia"
          description="Puntos que conviene revisar antes de sacar conclusiones sobre la muestra."
          items={evidenceRows}
          emptyLabel="La muestra no presenta alertas fuertes de captura o consistencia."
          onItemSelect={(label) => setSelectedDetail({ kind: "evidence", label })}
          activeItemLabel={selectedDetail?.kind === "evidence" ? selectedDetail.label : null}
        />
      </div>
    </div>
  );
}
