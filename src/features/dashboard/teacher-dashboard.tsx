"use client";

import { useMemo, useState } from "react";
import { Activity, BookOpen, Database, Layers3, Smartphone, TimerReset } from "lucide-react";
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
  buildProfileAgeCategorySeries,
  buildProfileCoverageSeries,
  buildProfileRecencySeries,
  buildSyncSourceSeries,
  buildUserRecencySeries,
  buildUserRoleSeries,
  getAverageGameTime,
  getAverageTurnTime,
  getDateBucketLabel,
  getSuccessRate,
} from "@/features/dashboard/dashboard-analytics-utils";
import { useDevices } from "@/features/devices/api";
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

  if (diffDays == null) {
    return normalized.includes("sin");
  }

  if (normalized.includes("7 días")) return diffDays <= 7;
  if (normalized.includes("8 30 días") || normalized.includes("8/30 días")) return diffDays > 7 && diffDays <= 30;
  if (normalized.includes("31 90 días") || normalized.includes("31/90 días")) return diffDays > 30 && diffDays <= 90;
  if (normalized.includes("> 90 días")) return diffDays > 90;

  return false;
}

function getDashboardDateValue(...values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(value)) || null;
}

export function TeacherDashboard() {
  const { tokens } = useAuth();
  const [selectedDetail, setSelectedDetail] = useState<{ kind: string; label: string } | null>(null);
  const { getRange: getModuleRange, setRange: setModuleRange } = useDashboardModuleControls();
  const gamesQuery = useGames(tokens?.accessToken);
  const devicesQuery = useDevices(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);
  const usersQuery = useUsers(tokens?.accessToken);
  const profilesQuery = useProfilesOverview(tokens?.accessToken);

  const games = useMemo(() => gamesQuery.data?.data || [], [gamesQuery.data?.data]);
  const devices = useMemo(() => devicesQuery.data?.data || [], [devicesQuery.data?.data]);
  const syncs = useMemo(() => syncsQuery.data?.data || [], [syncsQuery.data?.data]);
  const users = useMemo(() => usersQuery.data?.data || [], [usersQuery.data?.data]);
  const profiles = useMemo(() => profilesQuery.data || [], [profilesQuery.data]);
  const isLoading = gamesQuery.isLoading || devicesQuery.isLoading || syncsQuery.isLoading || usersQuery.isLoading || profilesQuery.isLoading;
  const error = gamesQuery.error || devicesQuery.error || syncsQuery.error || usersQuery.error || profilesQuery.error;

  const activityRange = getModuleRange("teacher-activity");
  const deckRange = getModuleRange("teacher-deck");
  const userRoleRange = getModuleRange("teacher-user-role");
  const profileCoverageRange = getModuleRange("teacher-profile-coverage");
  const userRecencyRange = getModuleRange("teacher-user-recency");
  const profileAgeRange = getModuleRange("teacher-profile-age");
  const syncSourceRange = getModuleRange("teacher-sync-source");
  const profileRecencyRange = getModuleRange("teacher-profile-recency");

  const activityGames = useMemo(
    () => filterDashboardItemsByRange(games, activityRange, (game) => getDashboardDateValue(game.startDate, game.createdAt, game.updatedAt)),
    [activityRange, games],
  );
  const deckGames = useMemo(
    () => filterDashboardItemsByRange(games, deckRange, (game) => getDashboardDateValue(game.startDate, game.createdAt, game.updatedAt)),
    [deckRange, games],
  );
  const userRoleUsers = useMemo(
    () => filterDashboardItemsByRange(users, userRoleRange, (entry) => getDashboardDateValue(entry.lastLoginAt, entry.createdAt, entry.updatedAt)),
    [userRoleRange, users],
  );
  const profileCoverageProfiles = useMemo(
    () => filterDashboardItemsByRange(profiles, profileCoverageRange, (profile) => getDashboardDateValue(profile.lastSessionAt, profile.createdAt, profile.updatedAt)),
    [profileCoverageRange, profiles],
  );
  const userRecencyUsers = useMemo(
    () => filterDashboardItemsByRange(users, userRecencyRange, (entry) => getDashboardDateValue(entry.lastLoginAt, entry.createdAt, entry.updatedAt)),
    [userRecencyRange, users],
  );
  const profileAgeProfiles = useMemo(
    () => filterDashboardItemsByRange(profiles, profileAgeRange, (profile) => getDashboardDateValue(profile.createdAt, profile.updatedAt, profile.lastSessionAt)),
    [profileAgeRange, profiles],
  );
  const syncSourceSyncs = useMemo(
    () => filterDashboardItemsByRange(syncs, syncSourceRange, (sync) => getDashboardDateValue(sync.startedAt, sync.createdAt, sync.updatedAt, sync.receivedAt, sync.capturedAt)),
    [syncSourceRange, syncs],
  );
  const profileRecencyProfiles = useMemo(
    () => filterDashboardItemsByRange(profiles, profileRecencyRange, (profile) => getDashboardDateValue(profile.lastSessionAt, profile.createdAt, profile.updatedAt)),
    [profileRecencyRange, profiles],
  );

  const totalTurns = games.reduce((sum, game) => sum + game.turns.length, 0);
  const successRate = getSuccessRate(games);
  const averageTurnTime = getAverageTurnTime(games);
  const averageGameTime = getAverageGameTime(games);
  const deckUsage = buildDeckUsageSeries(deckGames);
  const activitySeries = buildGameActivitySeries(activityGames);
  const syncSourceSeries = buildSyncSourceSeries(syncSourceSyncs);
  const userRoleSeries = buildUserRoleSeries(userRoleUsers);
  const userRecencySeries = buildUserRecencySeries(userRecencyUsers);
  const profileCoverageSeries = buildProfileCoverageSeries(profileCoverageProfiles);
  const profileAgeSeries = buildProfileAgeCategorySeries(profileAgeProfiles);
  const profileRecencySeries = buildProfileRecencySeries(profileRecencyProfiles);
  const attentionRows = [
    {
      label: "Partidas sin turnos",
      value: String(games.filter((game) => game.turns.length === 0).length),
      badge: "Revisar sesión incompleta",
    },
    {
      label: "Dispositivos sin status",
      value: String(devices.filter((device) => !device.status).length),
      badge: "Chequeo técnico sugerido",
    },
    {
      label: "Syncs sin raw",
      value: String(syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) === 0).length),
      badge: "Cobertura de evidencia",
    },
  ].filter((item) => Number(item.value) > 0);

  const detailPanel = (() => {
    if (!selectedDetail) return null;

    const gameRows = (items = games): DashboardDetailRow[] =>
      items.map((game) => {
        const totalDuration = game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0);
        return {
          label: game.deckName || `Partida ${game.id}`,
          value: `${game.turns.length} turnos`,
          hint: `Fecha ${getDateBucketLabel(game.startDate || game.createdAt || game.updatedAt)} · duración ${formatDurationSeconds(totalDuration)}`,
          badge: game.turns.length > 0 ? "Con actividad" : "Sin turnos",
        };
      });

    const deviceRows = devices.map((device) => ({
      label: device.name || device.deviceId || `Dispositivo ${device.id}`,
      value: device.status || "Sin status",
      hint: device.ownerUserName || device.ownerUserEmail || "Sin owner asignado",
      badge: device.assignmentScope || "sin asignación",
    }));

    const userRows = users.map((user) => ({
      label: user.fullName || user.email || `Usuario ${user.id}`,
      value: user.roles.join(", ") || "Sin rol",
      hint: user.email || "Sin email registrado",
      badge: user.lastLoginAt ? `Login ${getDateBucketLabel(user.lastLoginAt)}` : "Sin login",
    }));

    const profileRows = profiles.map((profile) => ({
      label: profile.displayName || `Perfil ${profile.id}`,
      value: `${profile.sessionCount} sesiones`,
      hint: `${profile.activeBindingCount} bindings activos · ${profile.ageCategory || "sin categoría"}`,
      badge: profile.isActive ? "Activo" : "Inactivo",
    }));

    switch (selectedDetail.kind) {
      case "metric-games":
        return {
          title: "Detalle de partidas",
          description: "Sesiones registradas en el contexto docente.",
          filterLabel: selectedDetail.label,
          rows: gameRows(),
        };
      case "metric-turns":
        return {
          title: "Detalle de turnos jugados",
          description: "Desglose por partida para ver dónde está concentrada la interacción.",
          filterLabel: selectedDetail.label,
          rows: gameRows().filter((row) => row.value !== "0 turnos"),
        };
      case "metric-success":
        return {
          title: "Detalle de acierto general",
          description: "Acierto por partida para bajar del agregado al caso concreto.",
          filterLabel: selectedDetail.label,
          rows: games.map((game) => {
            const successes = game.turns.filter((turn) => turn.success).length;
            const rate = game.turns.length > 0 ? Math.round((successes / game.turns.length) * 100) : 0;
            return {
              label: game.deckName || `Partida ${game.id}`,
              value: `${rate}%`,
              hint: `${successes}/${game.turns.length} turnos correctos`,
            };
          }),
        };
      case "metric-turn-time":
        return {
          title: "Detalle de tiempo por turno",
          description: "Promedio por partida para detectar ritmos más altos o más lentos.",
          filterLabel: selectedDetail.label,
          rows: games.map((game) => {
            const total = game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0);
            const average = game.turns.length > 0 ? total / game.turns.length : 0;
            return {
              label: game.deckName || `Partida ${game.id}`,
              value: formatDurationSeconds(average),
              hint: `${game.turns.length} turnos medidos`,
            };
          }),
        };
      case "metric-game-time":
        return {
          title: "Detalle de duración por partida",
          description: "Tiempo acumulado por sesión usando la suma de turnos registrados.",
          filterLabel: selectedDetail.label,
          rows: games.map((game) => ({
            label: game.deckName || `Partida ${game.id}`,
            value: formatDurationSeconds(game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0)),
            hint: `${game.turns.length} turnos`,
          })),
        };
      case "metric-devices":
        return {
          title: "Detalle de dispositivos",
          description: "Estado y owner asignado para el parque docente.",
          filterLabel: selectedDetail.label,
          rows: deviceRows,
        };
      case "metric-users":
        return {
          title: "Detalle de usuarios",
          description: "Quiénes participan hoy y con qué roles.",
          filterLabel: selectedDetail.label,
          rows: userRows,
        };
      case "metric-profiles":
        return {
          title: "Detalle de perfiles",
          description: "Perfiles disponibles con actividad y binding.",
          filterLabel: selectedDetail.label,
          rows: profileRows,
        };
      case "activity-date":
        return {
          title: `Actividad del ${selectedDetail.label}`,
          description: "Partidas que caen en la fecha seleccionada del gráfico.",
          filterLabel: selectedDetail.label,
          rows: gameRows(activityGames.filter((game) => getDateBucketLabel(game.startDate || game.createdAt || game.updatedAt) === selectedDetail.label)),
        };
      case "deck":
        return {
          title: `Detalle del mazo ${selectedDetail.label}`,
          description: "Partidas asociadas al contenido seleccionado.",
          filterLabel: selectedDetail.label,
          rows: gameRows(deckGames.filter((game) => normalizeLabel(game.deckName || "Sin mazo") === normalizeLabel(selectedDetail.label))),
        };
      case "user-role":
        return {
          title: `Usuarios con rol ${selectedDetail.label}`,
          description: "Padrón filtrado según el rol elegido en la gráfica.",
          filterLabel: selectedDetail.label,
          rows: userRows.filter((row) => normalizeLabel(row.value).includes(normalizeLabel(selectedDetail.label))),
        };
      case "profile-coverage":
        return {
          title: `Cobertura de perfiles · ${selectedDetail.label}`,
          description: "Perfiles que caen dentro del segmento seleccionado.",
          filterLabel: selectedDetail.label,
          rows: profileCoverageProfiles.map((profile) => ({
            label: profile.displayName || `Perfil ${profile.id}`,
            value: `${profile.sessionCount} sesiones`,
            hint: `${profile.activeBindingCount} bindings activos · ${profile.ageCategory || "sin categoría"}`,
            badge: profile.isActive ? "Activo" : "Inactivo",
          })).filter((row, index) => {
            const profile = profileCoverageProfiles[index];
            const normalized = normalizeLabel(selectedDetail.label);
            if (normalized.includes("activos")) return profile.isActive;
            if (normalized.includes("binding") && !normalized.includes("sin")) return profile.activeBindingCount > 0;
            if (normalized.includes("sesiones")) return profile.sessionCount > 0;
            if (normalized.includes("sin binding")) return profile.activeBindingCount === 0;
            return false;
          }),
        };
      case "user-recency":
        return {
          title: `Recencia de usuarios · ${selectedDetail.label}`,
          description: "Usuarios que coinciden con el período seleccionado.",
          filterLabel: selectedDetail.label,
          rows: userRecencyUsers.map((user) => ({
            label: user.fullName || user.email || `Usuario ${user.id}`,
            value: user.roles.join(", ") || "Sin rol",
            hint: user.email || "Sin email registrado",
            badge: user.lastLoginAt ? `Login ${getDateBucketLabel(user.lastLoginAt)}` : "Sin login",
          })).filter((row, index) => matchesRecencyLabel(selectedDetail.label, userRecencyUsers[index]?.lastLoginAt)),
        };
      case "profile-age":
        return {
          title: `Perfiles por categoría · ${selectedDetail.label}`,
          description: "Perfiles dentro de la cohorte elegida.",
          filterLabel: selectedDetail.label,
          rows: profileAgeProfiles.map((profile) => ({
            label: profile.displayName || `Perfil ${profile.id}`,
            value: `${profile.sessionCount} sesiones`,
            hint: `${profile.activeBindingCount} bindings activos · ${profile.ageCategory || "sin categoría"}`,
            badge: profile.isActive ? "Activo" : "Inactivo",
          })).filter((row, index) => normalizeLabel(profileAgeProfiles[index]?.ageCategory || "Sin categoría") === normalizeLabel(selectedDetail.label)),
        };
      case "sync-source":
        return {
          title: `Fuentes de sincronización · ${selectedDetail.label}`,
          description: "Sesiones de sync que pertenecen a la fuente elegida.",
          filterLabel: selectedDetail.label,
          rows: syncSourceSyncs
            .filter((sync) => normalizeLabel(sync.source || sync.sourceType || "desconocido") === normalizeLabel(selectedDetail.label))
            .map((sync) => ({
              label: sync.deckName || `Sync ${sync.id}`,
              value: sync.status || "sin status",
              hint: `${sync.rawRecordCount || sync.rawRecordIds.length || 0} raw records · ${getDateBucketLabel(sync.startedAt || sync.createdAt || sync.updatedAt)}`,
              badge: sync.deviceId || sync.bleDeviceId || "sin device",
            })),
        };
      case "profile-recency":
        return {
          title: `Recencia de perfiles · ${selectedDetail.label}`,
          description: "Perfiles dentro del período seleccionado.",
          filterLabel: selectedDetail.label,
          rows: profileRecencyProfiles.map((profile) => ({
            label: profile.displayName || `Perfil ${profile.id}`,
            value: `${profile.sessionCount} sesiones`,
            hint: `${profile.activeBindingCount} bindings activos · ${profile.ageCategory || "sin categoría"}`,
            badge: profile.isActive ? "Activo" : "Inactivo",
          })).filter((row, index) => matchesRecencyLabel(selectedDetail.label, profileRecencyProfiles[index]?.lastSessionAt)),
        };
      case "alert": {
        const normalized = normalizeLabel(selectedDetail.label);
        if (normalized.includes("partidas sin turnos")) {
          return {
            title: "Partidas sin turnos",
            description: "Sesiones que conviene revisar porque no muestran interacción.",
            filterLabel: selectedDetail.label,
            rows: gameRows(games.filter((game) => game.turns.length === 0)),
          };
        }
        if (normalized.includes("dispositivos sin status")) {
          return {
            title: "Dispositivos sin status",
            description: "Equipos que necesitan chequeo técnico o actualización de estado.",
            filterLabel: selectedDetail.label,
            rows: deviceRows.filter((row) => row.value === "Sin status"),
          };
        }
        return {
          title: "Syncs sin raw",
          description: "Sincronizaciones sin evidencia cruda disponible.",
          filterLabel: selectedDetail.label,
          rows: syncs
            .filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) === 0)
            .map((sync) => ({
              label: sync.deckName || `Sync ${sync.id}`,
              value: sync.status || "sin status",
              hint: `Fuente ${sync.source || sync.sourceType || "desconocida"}`,
            })),
        };
      }
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Docente"
        title="Dashboard analítico del aula"
        description="Esta home deja de ser una portada y pasa a ser un tablero de lectura rápida: actividad, acierto, tiempos, mazos usados, sincronización y señales claras para intervenir." 
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
        <DashboardMetricCard label="Partidas" value={String(gamesQuery.data?.total || games.length)} hint="Volumen total de sesiones registradas en el contexto docente." icon={Database} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-games", label: "Partidas" })} isActive={selectedDetail?.kind === "metric-games"} />
        <DashboardMetricCard label="Turnos jugados" value={String(totalTurns)} hint="Interacciones reales registradas en la muestra." icon={Activity} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-turns", label: "Turnos jugados" })} isActive={selectedDetail?.kind === "metric-turns"} />
        <DashboardMetricCard label="Acierto general" value={`${successRate}%`} hint="Porcentaje de turnos correctos para lectura rápida de desempeño." icon={BookOpen} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-success", label: "Acierto general" })} isActive={selectedDetail?.kind === "metric-success"} />
        <DashboardMetricCard label="Tiempo promedio por turno" value={formatDurationSeconds(averageTurnTime)} hint="Señal simple de ritmo de respuesta y carga cognitiva." icon={TimerReset} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-turn-time", label: "Tiempo promedio por turno" })} isActive={selectedDetail?.kind === "metric-turn-time"} />
        <DashboardMetricCard label="Duración promedio por partida" value={formatDurationSeconds(averageGameTime)} hint="Tiempo acumulado por sesión usando los turnos registrados." icon={Layers3} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-game-time", label: "Duración promedio por partida" })} isActive={selectedDetail?.kind === "metric-game-time"} />
        <DashboardMetricCard label="Dispositivos" value={String(devicesQuery.data?.total || devices.length)} hint="Parque disponible para operar la jornada." icon={Smartphone} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-devices", label: "Dispositivos" })} isActive={selectedDetail?.kind === "metric-devices"} />
        <DashboardMetricCard label="Usuarios" value={String(usersQuery.data?.total || users.length)} hint="Padrón docente o institucional asociado a esta vista." icon={Database} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-users", label: "Usuarios" })} isActive={selectedDetail?.kind === "metric-users"} />
        <DashboardMetricCard label="Perfiles" value={String(profiles.length)} hint="Perfiles o estudiantes que ya aparecen en la lectura del aula." icon={BookOpen} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-profiles", label: "Perfiles" })} isActive={selectedDetail?.kind === "metric-profiles"} />
      </div>

      {error ? (
        <Card className="border-destructive/20 bg-white/85">
          <CardContent className="p-6 text-sm text-destructive">
            No pude cargar una parte del dashboard docente: {getErrorMessage(error)}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardLineChartCard
          title="Actividad reciente"
          description="Cruza partidas y turnos por fecha para ver si la jornada viene cargada, plana o con caídas puntuales."
          data={activitySeries}
          range={activityRange}
          onRangeChange={(range) => setModuleRange("teacher-activity", range)}
          csvFileName={`teacher-dashboard-actividad-${activityRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "activity-date", label })}
          activeDatumLabel={selectedDetail?.kind === "activity-date" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Mazos más usados"
          description="Qué contenidos aparecen más en la actividad del aula."
          data={deckUsage}
          range={deckRange}
          onRangeChange={(range) => setModuleRange("teacher-deck", range)}
          csvFileName={`teacher-dashboard-mazos-${deckRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "deck", label })}
          activeDatumLabel={selectedDetail?.kind === "deck" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title="Usuarios por rol"
          description="Cómo se reparte hoy la actividad entre los tipos de usuario que participan de la experiencia."
          data={userRoleSeries}
          range={userRoleRange}
          onRangeChange={(range) => setModuleRange("teacher-user-role", range)}
          csvFileName={`teacher-dashboard-usuarios-por-rol-${userRoleRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-role", label })}
          activeDatumLabel={selectedDetail?.kind === "user-role" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Cobertura de perfiles"
          description="Lectura rápida de perfiles activos, con binding y con sesiones reales dentro del aula."
          data={profileCoverageSeries}
          range={profileCoverageRange}
          onRangeChange={(range) => setModuleRange("teacher-profile-coverage", range)}
          csvFileName={`teacher-dashboard-cobertura-perfiles-${profileCoverageRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-coverage", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-coverage" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title="Recencia del padrón"
          description="Qué parte de los usuarios tuvo login reciente y qué parte sigue fría o sin señales de acceso."
          data={userRecencySeries}
          range={userRecencyRange}
          onRangeChange={(range) => setModuleRange("teacher-user-recency", range)}
          csvFileName={`teacher-dashboard-recencia-usuarios-${userRecencyRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-recency", label })}
          activeDatumLabel={selectedDetail?.kind === "user-recency" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Perfiles por categoría"
          description="Cohortes por categoría etaria para entender rápidamente a qué tramo del aula responde más la actividad."
          data={profileAgeSeries}
          range={profileAgeRange}
          onRangeChange={(range) => setModuleRange("teacher-profile-age", range)}
          csvFileName={`teacher-dashboard-perfiles-por-categoria-${profileAgeRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-age", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-age" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title="Fuentes de sincronización"
          description="Cómo está entrando la actividad: útil para detectar dependencia de una sola fuente o huecos de captura."
          data={syncSourceSeries}
          range={syncSourceRange}
          onRangeChange={(range) => setModuleRange("teacher-sync-source", range)}
          csvFileName={`teacher-dashboard-fuentes-sync-${syncSourceRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "sync-source", label })}
          activeDatumLabel={selectedDetail?.kind === "sync-source" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Recencia de perfiles"
          description="Qué tan recientes son las últimas sesiones por perfil para detectar cohortes activas, tibias o inactivas."
          data={profileRecencySeries}
          range={profileRecencyRange}
          onRangeChange={(range) => setModuleRange("teacher-profile-recency", range)}
          csvFileName={`teacher-dashboard-recencia-perfiles-${profileRecencyRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-recency", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-recency" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardTopListCard
          title="Qué conviene mirar hoy"
          description="Alertas priorizadas para no tener que entrar a ciegas a cada módulo."
          items={attentionRows}
          emptyLabel="No aparecen alertas fuertes ahora mismo. La actividad se ve razonablemente sana."
          onItemSelect={(label) => setSelectedDetail({ kind: "alert", label })}
          activeItemLabel={selectedDetail?.kind === "alert" ? selectedDetail.label : null}
        />
      </div>

    </div>
  );
}
