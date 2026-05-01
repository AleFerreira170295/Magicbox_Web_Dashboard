"use client";

import { useMemo, useState } from "react";
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
  filterDashboardItemsByRange,
  useDashboardModuleControls,
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

function getDashboardDateValue(...values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(value)) || null;
}

export function FamilyDashboard() {
  const { tokens, user } = useAuth();
  const [selectedDetail, setSelectedDetail] = useState<{ kind: string; label: string } | null>(null);
  const { getRange: getModuleRange, setRange: setModuleRange } = useDashboardModuleControls();
  const devicesQuery = useDevices(tokens?.accessToken);
  const gamesQuery = useGames(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);
  const usersQuery = useUsers(tokens?.accessToken);
  const profilesQuery = useProfilesOverview(tokens?.accessToken);

  const devices = useMemo(() => devicesQuery.data?.data || [], [devicesQuery.data?.data]);
  const games = useMemo(() => gamesQuery.data?.data || [], [gamesQuery.data?.data]);
  const syncs = useMemo(() => syncsQuery.data?.data || [], [syncsQuery.data?.data]);
  const users = useMemo(() => usersQuery.data?.data || [], [usersQuery.data?.data]);
  const profiles = useMemo(() => profilesQuery.data || [], [profilesQuery.data]);
  const isLoading = devicesQuery.isLoading || gamesQuery.isLoading || syncsQuery.isLoading || usersQuery.isLoading || profilesQuery.isLoading;
  const error = devicesQuery.error || gamesQuery.error || syncsQuery.error || usersQuery.error || profilesQuery.error;

  const activityRange = getModuleRange("family-activity");
  const deckRange = getModuleRange("family-deck");
  const userRoleRange = getModuleRange("family-user-role");
  const profileCoverageRange = getModuleRange("family-profile-coverage");
  const profileAgeRange = getModuleRange("family-profile-age");
  const profileRecencyRange = getModuleRange("family-profile-recency");
  const resourceRange = getModuleRange("family-resource-balance");
  const userRecencyRange = getModuleRange("family-user-recency");

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
  const profileAgeProfiles = useMemo(
    () => filterDashboardItemsByRange(profiles, profileAgeRange, (profile) => getDashboardDateValue(profile.createdAt, profile.updatedAt, profile.lastSessionAt)),
    [profileAgeRange, profiles],
  );
  const profileRecencyProfiles = useMemo(
    () => filterDashboardItemsByRange(profiles, profileRecencyRange, (profile) => getDashboardDateValue(profile.lastSessionAt, profile.createdAt, profile.updatedAt)),
    [profileRecencyRange, profiles],
  );
  const resourceUsers = useMemo(
    () => filterDashboardItemsByRange(users, resourceRange, (entry) => getDashboardDateValue(entry.lastLoginAt, entry.createdAt, entry.updatedAt)),
    [resourceRange, users],
  );
  const resourceDevices = useMemo(
    () => filterDashboardItemsByRange(devices, resourceRange, (device) => getDashboardDateValue(device.createdAt, device.updatedAt)),
    [devices, resourceRange],
  );
  const resourceProfiles = useMemo(
    () => filterDashboardItemsByRange(profiles, resourceRange, (profile) => getDashboardDateValue(profile.lastSessionAt, profile.createdAt, profile.updatedAt)),
    [profiles, resourceRange],
  );
  const userRecencyUsers = useMemo(
    () => filterDashboardItemsByRange(users, userRecencyRange, (entry) => getDashboardDateValue(entry.lastLoginAt, entry.createdAt, entry.updatedAt)),
    [userRecencyRange, users],
  );

  const totalTurns = games.reduce((sum, game) => sum + game.turns.length, 0);
  const successRate = getSuccessRate(games);
  const averageTurnTime = getAverageTurnTime(games);
  const activitySeries = buildGameActivitySeries(activityGames);
  const deckUsage = buildDeckUsageSeries(deckGames);
  const userRoleSeries = buildUserRoleSeries(userRoleUsers);
  const userRecencySeries = buildUserRecencySeries(userRecencyUsers);
  const profileCoverageSeries = buildProfileCoverageSeries(profileCoverageProfiles);
  const profileAgeSeries = buildProfileAgeCategorySeries(profileAgeProfiles);
  const profileRecencySeries = buildProfileRecencySeries(profileRecencyProfiles);
  const visibleResources = buildResourceBalanceSeries({
    users: resourceUsers.length,
    devices: resourceDevices.length,
    profiles: resourceProfiles.length,
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
        return { title: `Actividad del ${selectedDetail.label}`, description: "Partidas que caen en la fecha seleccionada.", filterLabel: selectedDetail.label, rows: gameRows(activityGames.filter((game) => getDateBucketLabel(game.startDate || game.createdAt || game.updatedAt) === selectedDetail.label)) };
      case "deck":
        return { title: `Mazo ${selectedDetail.label}`, description: "Partidas asociadas al contenido seleccionado.", filterLabel: selectedDetail.label, rows: gameRows(deckGames.filter((game) => normalizeLabel(game.deckName || "Sin mazo") === normalizeLabel(selectedDetail.label))) };
      case "user-role":
        return { title: `Usuarios con rol ${selectedDetail.label}`, description: "Personas del rol elegido.", filterLabel: selectedDetail.label, rows: userRoleUsers.map((entry) => ({ label: entry.fullName || entry.email || `Usuario ${entry.id}`, value: entry.roles?.join(", ") || "Sin rol", hint: entry.email || "Sin email registrado", badge: entry.lastLoginAt ? `Login ${getDateBucketLabel(entry.lastLoginAt)}` : "Sin login" })).filter((row) => normalizeLabel(row.value).includes(normalizeLabel(selectedDetail.label))) };
      case "profile-coverage": {
        const normalized = normalizeLabel(selectedDetail.label);
        return {
          title: `Estado de perfiles · ${selectedDetail.label}`,
          description: "Perfiles filtrados por el bloque elegido.",
          filterLabel: selectedDetail.label,
          rows: profileCoverageProfiles.map((profile) => ({
            label: profile.displayName || `Perfil ${profile.id}`,
            value: `${profile.sessionCount} sesiones`,
            hint: `${profile.activeBindingCount} bindings activos · ${profile.ageCategory || "sin categoría"}`,
            badge: profile.isActive ? "Activo" : "Inactivo",
          })).filter((row, index) => {
            const profile = profileCoverageProfiles[index];
            if (normalized.includes("activos")) return profile.isActive;
            if (normalized.includes("binding") && !normalized.includes("sin")) return profile.activeBindingCount > 0;
            if (normalized.includes("sesiones")) return profile.sessionCount > 0;
            if (normalized.includes("sin binding")) return profile.activeBindingCount === 0;
            return false;
          }),
        };
      }
      case "profile-age":
        return { title: `Perfiles por categoría · ${selectedDetail.label}`, description: "Perfiles dentro de la cohorte elegida.", filterLabel: selectedDetail.label, rows: profileAgeProfiles.map((profile) => ({ label: profile.displayName || `Perfil ${profile.id}`, value: `${profile.sessionCount} sesiones`, hint: `${profile.activeBindingCount} bindings activos · ${profile.ageCategory || "sin categoría"}`, badge: profile.isActive ? "Activo" : "Inactivo" })).filter((row, index) => normalizeLabel(profileAgeProfiles[index]?.ageCategory || "Sin categoría") === normalizeLabel(selectedDetail.label)) };
      case "profile-recency":
        return { title: `Recencia de perfiles · ${selectedDetail.label}`, description: "Perfiles dentro del período seleccionado.", filterLabel: selectedDetail.label, rows: profileRecencyProfiles.map((profile) => ({ label: profile.displayName || `Perfil ${profile.id}`, value: `${profile.sessionCount} sesiones`, hint: `${profile.activeBindingCount} bindings activos · ${profile.ageCategory || "sin categoría"}`, badge: profile.isActive ? "Activo" : "Inactivo" })).filter((row, index) => matchesRecencyLabel(selectedDetail.label, profileRecencyProfiles[index]?.lastSessionAt)) };
      case "resource": {
        const normalized = normalizeLabel(selectedDetail.label);
        if (normalized.includes("usuario")) return { title: "Recursos · usuarios", description: "Personas registradas en esta cuenta.", filterLabel: selectedDetail.label, rows: userRows };
        if (normalized.includes("dispositivo")) return { title: "Recursos · dispositivos", description: "Equipos asociados a esta cuenta.", filterLabel: selectedDetail.label, rows: deviceRows };
        return { title: "Recursos · perfiles", description: "Perfiles registrados en esta cuenta.", filterLabel: selectedDetail.label, rows: profileRows };
      }
      case "user-recency":
        return { title: `Recencia de usuarios · ${selectedDetail.label}`, description: "Usuarios dentro del período seleccionado.", filterLabel: selectedDetail.label, rows: userRecencyUsers.map((entry) => ({ label: entry.fullName || entry.email || `Usuario ${entry.id}`, value: entry.roles?.join(", ") || "Sin rol", hint: entry.email || "Sin email registrado", badge: entry.lastLoginAt ? `Login ${getDateBucketLabel(entry.lastLoginAt)}` : "Sin login" })).filter((row, index) => matchesRecencyLabel(selectedDetail.label, userRecencyUsers[index]?.lastLoginAt)) };
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
          range={activityRange}
          onRangeChange={(range) => setModuleRange("family-activity", range)}
          csvFileName={`family-dashboard-actividad-${activityRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "activity-date", label })}
          activeDatumLabel={selectedDetail?.kind === "activity-date" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Mazos usados"
          description="Qué tipos de contenido aparecen más en la actividad registrada."
          data={deckUsage}
          range={deckRange}
          onRangeChange={(range) => setModuleRange("family-deck", range)}
          csvFileName={`family-dashboard-mazos-${deckRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "deck", label })}
          activeDatumLabel={selectedDetail?.kind === "deck" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title="Usuarios por rol"
          description="Distribución simple de las personas asociadas al grupo familiar."
          data={userRoleSeries}
          range={userRoleRange}
          onRangeChange={(range) => setModuleRange("family-user-role", range)}
          csvFileName={`family-dashboard-usuarios-por-rol-${userRoleRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-role", label })}
          activeDatumLabel={selectedDetail?.kind === "user-role" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Estado de perfiles"
          description="Perfiles activos, con binding y con sesiones para leer rápidamente qué tan conectada está la experiencia."
          data={profileCoverageSeries}
          range={profileCoverageRange}
          onRangeChange={(range) => setModuleRange("family-profile-coverage", range)}
          csvFileName={`family-dashboard-estado-perfiles-${profileCoverageRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-coverage", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-coverage" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title="Perfiles por categoría"
          description="Cohortes por categoría para entender si la experiencia actual se concentra en algún tramo específico."
          data={profileAgeSeries}
          range={profileAgeRange}
          onRangeChange={(range) => setModuleRange("family-profile-age", range)}
          csvFileName={`family-dashboard-perfiles-por-categoria-${profileAgeRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-age", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-age" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Recencia de perfiles"
          description="Última sesión por perfil para ver rápidamente quién viene activo y quién quedó más quieto."
          data={profileRecencySeries}
          range={profileRecencyRange}
          onRangeChange={(range) => setModuleRange("family-profile-recency", range)}
          csvFileName={`family-dashboard-recencia-perfiles-${profileRecencyRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-recency", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-recency" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title="Recursos principales"
          description="Balance simple entre personas y dispositivos asociados a la cuenta."
          data={visibleResources}
          range={resourceRange}
          onRangeChange={(range) => setModuleRange("family-resource-balance", range)}
          csvFileName={`family-dashboard-recursos-${resourceRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "resource", label })}
          activeDatumLabel={selectedDetail?.kind === "resource" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Recencia de usuarios"
          description="Lectura suave de accesos recientes para detectar si el entorno viene activo o con señales más frías."
          data={userRecencySeries}
          range={userRecencyRange}
          onRangeChange={(range) => setModuleRange("family-user-recency", range)}
          csvFileName={`family-dashboard-recencia-usuarios-${userRecencyRange}`}
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
