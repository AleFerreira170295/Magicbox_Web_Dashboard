"use client";

import { useState } from "react";
import { BookHeart, Database, Layers3, Smartphone, TimerReset, Users2 } from "lucide-react";
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
  buildResourceBalanceSeries,
  buildUserRecencySeries,
  buildUserRoleSeries,
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

  if (diffDays == null) return normalized.includes("sin");
  if (normalized.includes("7 días")) return diffDays <= 7;
  if (normalized.includes("8 30 días") || normalized.includes("8/30 días")) return diffDays > 7 && diffDays <= 30;
  if (normalized.includes("31 90 días") || normalized.includes("31/90 días")) return diffDays > 30 && diffDays <= 90;
  if (normalized.includes("> 90 días")) return diffDays > 90;
  return false;
}

export function FamilyDashboard() {
  const { tokens, user } = useAuth();
  const [selectedDetail, setSelectedDetail] = useState<{ kind: string; label: string } | null>(null);
  const devicesQuery = useDevices(tokens?.accessToken);
  const gamesQuery = useGames(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);
  const usersQuery = useUsers(tokens?.accessToken);
  const profilesQuery = useProfilesOverview(tokens?.accessToken);

  const devices = devicesQuery.data?.data || [];
  const games = gamesQuery.data?.data || [];
  const syncs = syncsQuery.data?.data || [];
  const users = usersQuery.data?.data || [];
  const profiles = profilesQuery.data || [];
  const isLoading = devicesQuery.isLoading || gamesQuery.isLoading || syncsQuery.isLoading || usersQuery.isLoading || profilesQuery.isLoading;
  const error = devicesQuery.error || gamesQuery.error || syncsQuery.error || usersQuery.error || profilesQuery.error;

  const totalTurns = games.reduce((sum, game) => sum + game.turns.length, 0);
  const successRate = getSuccessRate(games);
  const averageTurnTime = getAverageTurnTime(games);
  const activitySeries = buildGameActivitySeries(games);
  const deckUsage = buildDeckUsageSeries(games);
  const userRoleSeries = buildUserRoleSeries(users);
  const userRecencySeries = buildUserRecencySeries(users);
  const profileCoverageSeries = buildProfileCoverageSeries(profiles);
  const profileAgeSeries = buildProfileAgeCategorySeries(profiles);
  const profileRecencySeries = buildProfileRecencySeries(profiles);
  const visibleResources = buildResourceBalanceSeries({
    users: usersQuery.data?.total || users.length,
    devices: devicesQuery.data?.total || devices.length,
    profiles: profiles.length,
    institutions: undefined,
  });
  const gentleSignals = [
    {
      label: "Partidas",
      value: String(gamesQuery.data?.total || games.length),
      badge: "Actividad reciente",
    },
    {
      label: "Usuarios",
      value: String(usersQuery.data?.total || users.length),
      badge: "Personas vinculadas",
    },
    {
      label: "Dispositivos",
      value: String(devicesQuery.data?.total || devices.length),
      badge: "Equipos asociados",
    },
    {
      label: "Syncs con evidencia",
      value: String(syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) > 0).length),
      badge: "Captura utilizable",
    },
  ];

  const detailPanel = (() => {
    if (!selectedDetail) return null;

    const gameRows = (items = games): DashboardDetailRow[] =>
      items.map((game) => ({
        label: game.deckName || `Partida ${game.id}`,
        value: `${game.turns.length} turnos`,
        hint: `Fecha ${getDateBucketLabel(game.startDate || game.createdAt || game.updatedAt)} · duración ${formatDurationSeconds(game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0))}`,
      }));

    const userRows: DashboardDetailRow[] = users.map((entry) => ({
      label: entry.fullName || entry.email || `Usuario ${entry.id}`,
      value: entry.roles?.join(", ") || "Sin rol",
      hint: entry.email || "Sin email registrado",
      badge: entry.lastLoginAt ? `Login ${getDateBucketLabel(entry.lastLoginAt)}` : "Sin login",
    }));

    const deviceRows: DashboardDetailRow[] = devices.map((device) => ({
      label: device.name || device.deviceId || `Dispositivo ${device.id}`,
      value: device.status || "Sin status",
      hint: device.assignmentScope === "home" ? "Uso en casa" : "Uso institucional",
      badge: device.assignmentScope || "sin asignación",
    }));

    const profileRows: DashboardDetailRow[] = profiles.map((profile) => ({
      label: profile.displayName || `Perfil ${profile.id}`,
      value: `${profile.sessionCount} sesiones`,
      hint: `${profile.activeBindingCount} bindings activos · ${profile.ageCategory || "sin categoría"}`,
      badge: profile.isActive ? "Activo" : "Inactivo",
    }));

    const syncRows: DashboardDetailRow[] = syncs.map((sync) => ({
      label: sync.deckName || `Sync ${sync.id}`,
      value: `${sync.rawRecordCount || sync.rawRecordIds.length || 0} raws`,
      hint: sync.source || sync.sourceType || "Sin fuente registrada",
    }));

    switch (selectedDetail.kind) {
      case "metric-games":
        return { title: "Detalle de partidas", description: "Actividad reciente del grupo familiar.", filterLabel: selectedDetail.label, rows: gameRows() };
      case "metric-turns":
        return { title: "Detalle de turnos", description: "Interacciones registradas en las partidas.", filterLabel: selectedDetail.label, rows: gameRows().filter((row) => row.value !== "0 turnos") };
      case "metric-success":
        return {
          title: "Detalle de acierto",
          description: "Acierto por partida para pasar del agregado al caso concreto.",
          filterLabel: selectedDetail.label,
          rows: games.map((game) => {
            const successes = game.turns.filter((turn) => turn.success).length;
            const rate = game.turns.length > 0 ? Math.round((successes / game.turns.length) * 100) : 0;
            return { label: game.deckName || `Partida ${game.id}`, value: `${rate}%`, hint: `${successes}/${game.turns.length} turnos correctos` };
          }),
        };
      case "metric-turn-time":
        return {
          title: "Detalle de tiempo por turno",
          description: "Promedio por partida para entender mejor el ritmo de uso.",
          filterLabel: selectedDetail.label,
          rows: games.map((game) => ({
            label: game.deckName || `Partida ${game.id}`,
            value: formatDurationSeconds(game.turns.length > 0 ? game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0) / game.turns.length : 0),
            hint: `${game.turns.length} turnos medidos`,
          })),
        };
      case "metric-devices":
        return { title: "Detalle de dispositivos", description: "Equipos asociados a la cuenta.", filterLabel: selectedDetail.label, rows: deviceRows };
      case "metric-users":
        return { title: "Detalle de usuarios", description: "Personas asociadas al seguimiento familiar.", filterLabel: selectedDetail.label, rows: userRows };
      case "metric-profiles":
        return { title: "Detalle de perfiles", description: "Perfiles ya incorporados al seguimiento familiar.", filterLabel: selectedDetail.label, rows: profileRows };
      case "activity-date":
        return { title: `Actividad del ${selectedDetail.label}`, description: "Partidas que caen en la fecha seleccionada.", filterLabel: selectedDetail.label, rows: gameRows(games.filter((game) => getDateBucketLabel(game.startDate || game.createdAt || game.updatedAt) === selectedDetail.label)) };
      case "deck":
        return { title: `Mazo ${selectedDetail.label}`, description: "Partidas asociadas al contenido seleccionado.", filterLabel: selectedDetail.label, rows: gameRows(games.filter((game) => normalizeLabel(game.deckName || "Sin mazo") === normalizeLabel(selectedDetail.label))) };
      case "user-role":
        return { title: `Usuarios con rol ${selectedDetail.label}`, description: "Personas del rol elegido.", filterLabel: selectedDetail.label, rows: userRows.filter((row) => normalizeLabel(row.value).includes(normalizeLabel(selectedDetail.label))) };
      case "profile-coverage": {
        const normalized = normalizeLabel(selectedDetail.label);
        return {
          title: `Estado de perfiles · ${selectedDetail.label}`,
          description: "Perfiles filtrados por el bloque elegido.",
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
      case "profile-age":
        return { title: `Perfiles por categoría · ${selectedDetail.label}`, description: "Perfiles dentro de la cohorte elegida.", filterLabel: selectedDetail.label, rows: profileRows.filter((row, index) => normalizeLabel(profiles[index]?.ageCategory || "Sin categoría") === normalizeLabel(selectedDetail.label)) };
      case "profile-recency":
        return { title: `Recencia de perfiles · ${selectedDetail.label}`, description: "Perfiles dentro del período seleccionado.", filterLabel: selectedDetail.label, rows: profileRows.filter((row, index) => matchesRecencyLabel(selectedDetail.label, profiles[index]?.lastSessionAt)) };
      case "resource": {
        const normalized = normalizeLabel(selectedDetail.label);
        if (normalized.includes("usuario")) return { title: "Recursos · usuarios", description: "Personas registradas en esta cuenta.", filterLabel: selectedDetail.label, rows: userRows };
        if (normalized.includes("dispositivo")) return { title: "Recursos · dispositivos", description: "Equipos asociados a esta cuenta.", filterLabel: selectedDetail.label, rows: deviceRows };
        return { title: "Recursos · perfiles", description: "Perfiles registrados en esta cuenta.", filterLabel: selectedDetail.label, rows: profileRows };
      }
      case "user-recency":
        return { title: `Recencia de usuarios · ${selectedDetail.label}`, description: "Usuarios dentro del período seleccionado.", filterLabel: selectedDetail.label, rows: userRows.filter((row, index) => matchesRecencyLabel(selectedDetail.label, users[index]?.lastLoginAt)) };
      case "signal": {
        const normalized = normalizeLabel(selectedDetail.label);
        if (normalized.includes("syncs con evidencia")) return { title: "Syncs con evidencia", description: "Sincronizaciones que sí traen captura utilizable.", filterLabel: selectedDetail.label, rows: syncRows.filter((row, index) => (syncs[index]?.rawRecordCount || syncs[index]?.rawRecordIds.length || 0) > 0) };
        if (normalized.includes("dispositivos")) return { title: "Dispositivos", description: "Equipos asociados al grupo familiar.", filterLabel: selectedDetail.label, rows: deviceRows };
        if (normalized.includes("usuarios")) return { title: "Usuarios", description: "Personas asociadas al grupo familiar.", filterLabel: selectedDetail.label, rows: userRows };
        return { title: "Partidas", description: "Actividad registrada del grupo familiar.", filterLabel: selectedDetail.label, rows: gameRows() };
      }
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Familia"
        title={`Dashboard de seguimiento para ${user?.fullName || "familia"}`}
        description="Esta home mantiene una lectura analítica y simple: actividad, recursos, tiempos y contenidos usados, sin ruido técnico."
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
        <DashboardMetricCard label="Partidas" value={String(gamesQuery.data?.total || games.length)} hint="Actividad reciente del grupo familiar." icon={BookHeart} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-games", label: "Partidas" })} isActive={selectedDetail?.kind === "metric-games"} />
        <DashboardMetricCard label="Turnos" value={String(totalTurns)} hint="Interacciones registradas dentro de esas partidas." icon={Layers3} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-turns", label: "Turnos" })} isActive={selectedDetail?.kind === "metric-turns"} />
        <DashboardMetricCard label="Acierto general" value={`${successRate}%`} hint="Porcentaje agregado de respuestas correctas en la actividad registrada." icon={Database} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-success", label: "Acierto general" })} isActive={selectedDetail?.kind === "metric-success"} />
        <DashboardMetricCard label="Tiempo por turno" value={formatDurationSeconds(averageTurnTime)} hint="Ritmo promedio de juego en la actividad registrada." icon={TimerReset} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-turn-time", label: "Tiempo por turno" })} isActive={selectedDetail?.kind === "metric-turn-time"} />
        <DashboardMetricCard label="Dispositivos" value={String(devicesQuery.data?.total || devices.length)} hint="Equipos asociados a la cuenta." icon={Smartphone} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-devices", label: "Dispositivos" })} isActive={selectedDetail?.kind === "metric-devices"} />
        <DashboardMetricCard label="Usuarios" value={String(usersQuery.data?.total || users.length)} hint="Personas asociadas a la cuenta." icon={Users2} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-users", label: "Usuarios" })} isActive={selectedDetail?.kind === "metric-users"} />
        <DashboardMetricCard label="Perfiles" value={String(profiles.length)} hint="Perfiles incorporados al seguimiento familiar." icon={BookHeart} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-profiles", label: "Perfiles" })} isActive={selectedDetail?.kind === "metric-profiles"} />
      </div>

      {error ? (
        <Card className="border-destructive/20 bg-white/85">
          <CardContent className="p-6 text-sm text-destructive">
            No pude cargar una parte del dashboard family: {getErrorMessage(error)}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardLineChartCard
          title="Actividad reciente"
          description="Partidas y turnos por fecha para ver si hubo movimiento reciente o días más tranquilos."
          data={activitySeries}
          onDatumSelect={(label) => setSelectedDetail({ kind: "activity-date", label })}
          activeDatumLabel={selectedDetail?.kind === "activity-date" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Mazos usados"
          description="Qué tipos de contenido aparecen más en la actividad registrada."
          data={deckUsage}
          onDatumSelect={(label) => setSelectedDetail({ kind: "deck", label })}
          activeDatumLabel={selectedDetail?.kind === "deck" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title="Usuarios por rol"
          description="Distribución simple de las personas asociadas al grupo familiar."
          data={userRoleSeries}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-role", label })}
          activeDatumLabel={selectedDetail?.kind === "user-role" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Estado de perfiles"
          description="Perfiles activos, con binding y con sesiones para leer rápidamente qué tan conectada está la experiencia."
          data={profileCoverageSeries}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-coverage", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-coverage" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title="Perfiles por categoría"
          description="Cohortes por categoría para entender si la experiencia actual se concentra en algún tramo específico."
          data={profileAgeSeries}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-age", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-age" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Recencia de perfiles"
          description="Última sesión por perfil para ver rápidamente quién viene activo y quién quedó más quieto."
          data={profileRecencySeries}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-recency", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-recency" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title="Recursos principales"
          description="Balance simple entre personas y dispositivos asociados a la cuenta."
          data={visibleResources}
          onDatumSelect={(label) => setSelectedDetail({ kind: "resource", label })}
          activeDatumLabel={selectedDetail?.kind === "resource" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Recencia de usuarios"
          description="Lectura suave de accesos recientes para detectar si el entorno viene activo o con señales más frías."
          data={userRecencySeries}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-recency", label })}
          activeDatumLabel={selectedDetail?.kind === "user-recency" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardTopListCard
          title="Resumen rápido"
          description="Lectura amable de los tres frentes más importantes de tu cuenta."
          items={gentleSignals}
          onItemSelect={(label) => setSelectedDetail({ kind: "signal", label })}
          activeItemLabel={selectedDetail?.kind === "signal" ? selectedDetail.label : null}
        />
      </div>
    </div>
  );
}
