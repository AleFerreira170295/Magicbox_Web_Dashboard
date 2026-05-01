"use client";

import { useMemo, useState } from "react";
import { BookOpen, Database, Smartphone, TimerReset, UserRound, Users } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { canAccessPermissionsModule } from "@/features/auth/permission-contract";
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
  buildDeviceStatusSeries,
  buildGameActivitySeries,
  buildInstitutionCoverageSeries,
  buildProfileAgeCategorySeries,
  buildProfileActivitySeries,
  buildProfileBindingSeries,
  buildProfileSessionCohortSeries,
  buildResourceBalanceSeries,
  buildTopInstitutionsList,
  buildTopUsersList,
  buildUserCreationSeries,
  buildUserRoleSeries,
  getDateBucketLabel,
  getAverageGameTime,
  getSuccessRate,
} from "@/features/dashboard/dashboard-analytics-utils";
import { useDevices } from "@/features/devices/api";
import { useGames } from "@/features/games/api";
import { useInstitutions } from "@/features/institutions/api";
import { useProfilesOverview } from "@/features/profiles/api";
import { useSyncSessions } from "@/features/syncs/api";
import { useUsers } from "@/features/users/api";
import { formatDurationSeconds, getErrorMessage } from "@/lib/utils";

function normalizeLabel(value?: string | null) {
  return (value || "sin dato").replace(/[|]/g, " / ").replace(/[-_]/g, " ").trim().toLowerCase();
}

function getDashboardDateValue(...values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(value)) || null;
}

export function InstitutionDashboard() {
  const { tokens, user } = useAuth();
  const [selectedDetail, setSelectedDetail] = useState<{ kind: string; label: string } | null>(null);
  const { getRange: getModuleRange, setRange: setModuleRange } = useDashboardModuleControls();
  const isInstitutionAdmin = user?.roles.includes("institution-admin") || false;
  const isDirector = user?.roles.includes("director") || false;
  const canSeePermissions = canAccessPermissionsModule(user);

  const usersQuery = useUsers(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);
  const devicesQuery = useDevices(tokens?.accessToken);
  const gamesQuery = useGames(tokens?.accessToken);
  const profilesQuery = useProfilesOverview(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);

  const users = useMemo(() => usersQuery.data?.data || [], [usersQuery.data?.data]);
  const institutions = useMemo(() => institutionsQuery.data?.data || [], [institutionsQuery.data?.data]);
  const devices = useMemo(() => devicesQuery.data?.data || [], [devicesQuery.data?.data]);
  const games = useMemo(() => gamesQuery.data?.data || [], [gamesQuery.data?.data]);
  const profiles = useMemo(() => profilesQuery.data || [], [profilesQuery.data]);
  const syncs = useMemo(() => syncsQuery.data?.data || [], [syncsQuery.data?.data]);
  const scopedInstitution = institutions.length === 1 ? institutions[0] : null;
  const isLoading = [usersQuery, institutionsQuery, devicesQuery, gamesQuery, profilesQuery, syncsQuery].some((query) => query.isLoading);
  const error = usersQuery.error || institutionsQuery.error || devicesQuery.error || gamesQuery.error || profilesQuery.error || syncsQuery.error;

  const activityRange = getModuleRange("institution-activity");
  const resourceRange = getModuleRange("institution-resource-balance");
  const deckRange = getModuleRange("institution-deck");
  const deviceStatusRange = getModuleRange("institution-device-status");
  const userRoleRange = getModuleRange("institution-user-role");
  const profileActivityRange = getModuleRange("institution-profile-activity");
  const userCreationRange = getModuleRange("institution-user-creation");
  const profileAgeRange = getModuleRange("institution-profile-age");
  const profileBindingRange = getModuleRange("institution-profile-binding");
  const profileSessionsRange = getModuleRange("institution-profile-sessions");
  const institutionCoverageRange = getModuleRange("institution-coverage");

  const activityGames = useMemo(
    () => filterDashboardItemsByRange(games, activityRange, (game) => getDashboardDateValue(game.startDate, game.createdAt, game.updatedAt)),
    [activityRange, games],
  );
  const resourceUsers = useMemo(
    () => filterDashboardItemsByRange(users, resourceRange, (entry) => getDashboardDateValue(entry.lastLoginAt, entry.createdAt, entry.updatedAt)),
    [resourceRange, users],
  );
  const resourceInstitutions = useMemo(
    () => filterDashboardItemsByRange(institutions, resourceRange, (institution) => getDashboardDateValue(institution.createdAt, institution.updatedAt)),
    [institutions, resourceRange],
  );
  const resourceDevices = useMemo(
    () => filterDashboardItemsByRange(devices, resourceRange, (device) => getDashboardDateValue(device.createdAt, device.updatedAt)),
    [devices, resourceRange],
  );
  const resourceProfiles = useMemo(
    () => filterDashboardItemsByRange(profiles, resourceRange, (profile) => getDashboardDateValue(profile.lastSessionAt, profile.createdAt, profile.updatedAt)),
    [profiles, resourceRange],
  );
  const deckGames = useMemo(
    () => filterDashboardItemsByRange(games, deckRange, (game) => getDashboardDateValue(game.startDate, game.createdAt, game.updatedAt)),
    [deckRange, games],
  );
  const deviceStatusDevices = useMemo(
    () => filterDashboardItemsByRange(devices, deviceStatusRange, (device) => getDashboardDateValue(device.createdAt, device.updatedAt)),
    [deviceStatusRange, devices],
  );
  const userRoleUsers = useMemo(
    () => filterDashboardItemsByRange(users, userRoleRange, (entry) => getDashboardDateValue(entry.lastLoginAt, entry.createdAt, entry.updatedAt)),
    [userRoleRange, users],
  );
  const profileActivityProfiles = useMemo(
    () => filterDashboardItemsByRange(profiles, profileActivityRange, (profile) => getDashboardDateValue(profile.lastSessionAt, profile.createdAt, profile.updatedAt)),
    [profileActivityRange, profiles],
  );
  const userCreationUsers = useMemo(
    () => filterDashboardItemsByRange(users, userCreationRange, (entry) => getDashboardDateValue(entry.createdAt, entry.lastLoginAt, entry.updatedAt)),
    [userCreationRange, users],
  );
  const profileAgeProfiles = useMemo(
    () => filterDashboardItemsByRange(profiles, profileAgeRange, (profile) => getDashboardDateValue(profile.createdAt, profile.updatedAt, profile.lastSessionAt)),
    [profileAgeRange, profiles],
  );
  const profileBindingProfiles = useMemo(
    () => filterDashboardItemsByRange(profiles, profileBindingRange, (profile) => getDashboardDateValue(profile.lastSessionAt, profile.createdAt, profile.updatedAt)),
    [profileBindingRange, profiles],
  );
  const profileSessionProfiles = useMemo(
    () => filterDashboardItemsByRange(profiles, profileSessionsRange, (profile) => getDashboardDateValue(profile.lastSessionAt, profile.createdAt, profile.updatedAt)),
    [profileSessionsRange, profiles],
  );
  const coverageInstitutions = useMemo(
    () => filterDashboardItemsByRange(institutions, institutionCoverageRange, (institution) => getDashboardDateValue(institution.updatedAt, institution.createdAt)),
    [institutionCoverageRange, institutions],
  );

  const successRate = getSuccessRate(games);
  const averageGameTime = getAverageGameTime(games);
  const resourceBalance = buildResourceBalanceSeries({
    users: resourceUsers.length,
    institutions: resourceInstitutions.length,
    devices: resourceDevices.length,
    profiles: resourceProfiles.length,
  });
  const activitySeries = buildGameActivitySeries(activityGames);
  const deckUsage = buildDeckUsageSeries(deckGames);
  const deviceStatusSeries = buildDeviceStatusSeries(deviceStatusDevices);
  const institutionCoverageSeries = buildInstitutionCoverageSeries(coverageInstitutions);
  const userRoleSeries = buildUserRoleSeries(userRoleUsers);
  const userCreationSeries = buildUserCreationSeries(userCreationUsers);
  const profileAgeSeries = buildProfileAgeCategorySeries(profileAgeProfiles);
  const profileActivitySeries = buildProfileActivitySeries(profileActivityProfiles);
  const profileBindingSeries = buildProfileBindingSeries(profileBindingProfiles);
  const profileSessionCohorts = buildProfileSessionCohortSeries(profileSessionProfiles);
  const topInstitutions = buildTopInstitutionsList(institutions);
  const visibleUsers = buildTopUsersList(users);
  const operationalAlerts = [
    {
      label: "Dispositivos sin status",
      value: String(devices.filter((device) => !device.status).length),
      badge: "Revisar parque",
    },
    {
      label: "Profiles sin binding",
      value: String(profiles.filter((profile) => profile.activeBindingCount === 0).length),
      badge: "Conectar experiencia",
    },
    {
      label: "Partidas sin turnos",
      value: String(games.filter((game) => game.turns.length === 0).length),
      badge: "Sesiones vacías",
    },
    {
      label: "Syncs sin raw",
      value: String(syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) === 0).length),
      badge: "Trazabilidad incompleta",
    },
  ].filter((item) => Number(item.value) > 0);

  const detailPanel = (() => {
    if (!selectedDetail) return null;

    const institutionRows: DashboardDetailRow[] = institutions.map((institution) => ({
      label: institution.name,
      value: String(institution.operationalSummary?.studentCount ?? 0),
      hint: `${institution.operationalSummary?.userCount ?? 0} usuarios · ${institution.operationalSummary?.classGroupCount ?? 0} grupos`,
      badge: institution.status || institution.city || "Institución",
    }));

    const userRows: DashboardDetailRow[] = users.map((entry) => ({
      label: entry.fullName || entry.email || `Usuario ${entry.id}`,
      value: entry.roles.join(", ") || "Sin rol",
      hint: entry.email || "Sin email registrado",
      badge: entry.lastLoginAt ? `Login ${getDateBucketLabel(entry.lastLoginAt)}` : "Sin login",
    }));

    const deviceRows: DashboardDetailRow[] = devices.map((device) => ({
      label: device.name || device.deviceId || `Dispositivo ${device.id}`,
      value: device.status || "Sin status",
      hint: device.ownerUserName || device.ownerUserEmail || device.educationalCenterName || "Sin referencia registrada",
      badge: device.assignmentScope || "sin asignación",
    }));

    const gameRows = (items = games): DashboardDetailRow[] =>
      items.map((game) => {
        const totalDuration = game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0);
        return {
          label: game.deckName || `Partida ${game.id}`,
          value: `${game.turns.length} turnos`,
          hint: `Fecha ${getDateBucketLabel(game.startDate || game.createdAt || game.updatedAt)} · duración ${formatDurationSeconds(totalDuration)}`,
          badge: game.educationalCenterId || "Sin institución",
        };
      });

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
      case "metric-users":
        return { title: "Detalle de usuarios", description: "Padrón de usuarios de la institución actual.", filterLabel: selectedDetail.label, rows: userRows };
      case "metric-profiles":
        return { title: "Detalle de perfiles", description: "Perfiles y estudiantes con actividad o setup disponible.", filterLabel: selectedDetail.label, rows: profileRows };
      case "metric-games":
        return { title: "Detalle de partidas", description: "Sesiones registradas en la institución.", filterLabel: selectedDetail.label, rows: gameRows() };
      case "metric-success":
        return {
          title: "Detalle de acierto general",
          description: "Acierto por partida para bajar del agregado al caso concreto.",
          filterLabel: selectedDetail.label,
          rows: games.map((game) => {
            const successes = game.turns.filter((turn) => turn.success).length;
            const rate = game.turns.length > 0 ? Math.round((successes / game.turns.length) * 100) : 0;
            return { label: game.deckName || `Partida ${game.id}`, value: `${rate}%`, hint: `${successes}/${game.turns.length} turnos correctos` };
          }),
        };
      case "metric-game-time":
        return {
          title: "Duración por partida",
          description: "Tiempo acumulado por sesión usando turnos registrados.",
          filterLabel: selectedDetail.label,
          rows: games.map((game) => ({ label: game.deckName || `Partida ${game.id}`, value: formatDurationSeconds(game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0)), hint: `${game.turns.length} turnos` })),
        };
      case "metric-devices":
        return { title: "Detalle de dispositivos", description: "Cobertura actual del parque y su estado.", filterLabel: selectedDetail.label, rows: deviceRows };
      case "activity-date":
        return {
          title: `Actividad del ${selectedDetail.label}`,
          description: "Partidas que caen en la fecha seleccionada.",
          filterLabel: selectedDetail.label,
          rows: gameRows(activityGames.filter((game) => getDateBucketLabel(game.startDate || game.createdAt || game.updatedAt) === selectedDetail.label)),
        };
      case "resource-balance": {
        const normalized = normalizeLabel(selectedDetail.label);
        if (normalized.includes("usuario")) return { title: "Balance · usuarios", description: "Detalle del padrón actual.", filterLabel: selectedDetail.label, rows: resourceUsers.map((entry) => ({ label: entry.fullName || entry.email || `Usuario ${entry.id}`, value: entry.roles.join(", ") || "Sin rol", hint: entry.email || "Sin email registrado", badge: entry.lastLoginAt ? `Login ${getDateBucketLabel(entry.lastLoginAt)}` : "Sin login" })) };
        if (normalized.includes("instituci")) return { title: "Balance · instituciones", description: "Instituciones incluidas en esta vista.", filterLabel: selectedDetail.label, rows: resourceInstitutions.map((institution) => ({ label: institution.name, value: String(institution.operationalSummary?.studentCount ?? 0), hint: `${institution.operationalSummary?.userCount ?? 0} usuarios · ${institution.operationalSummary?.classGroupCount ?? 0} grupos`, badge: institution.status || institution.city || "Institución" })) };
        if (normalized.includes("dispositivo")) return { title: "Balance · dispositivos", description: "Parque disponible en esta vista.", filterLabel: selectedDetail.label, rows: resourceDevices.map((device) => ({ label: device.name || device.deviceId || `Dispositivo ${device.id}`, value: device.status || "Sin status", hint: device.ownerUserName || device.ownerUserEmail || device.educationalCenterName || "Sin referencia registrada", badge: device.assignmentScope || "sin asignación" })) };
        return { title: "Balance · perfiles", description: "Perfiles incluidos en esta vista.", filterLabel: selectedDetail.label, rows: resourceProfiles.map((profile) => ({ label: profile.displayName || `Perfil ${profile.id}`, value: `${profile.sessionCount} sesiones`, hint: `${profile.activeBindingCount} bindings activos · ${profile.ageCategory || "sin categoría"}`, badge: profile.isActive ? "Activo" : "Inactivo" })) };
      }
      case "deck":
        return { title: `Detalle del mazo ${selectedDetail.label}`, description: "Partidas asociadas al contenido seleccionado.", filterLabel: selectedDetail.label, rows: gameRows(deckGames.filter((game) => normalizeLabel(game.deckName || "Sin mazo") === normalizeLabel(selectedDetail.label))) };
      case "device-status": {
        const normalized = normalizeLabel(selectedDetail.label);
        return {
          title: `Hardware · ${selectedDetail.label}`,
          description: "Dispositivos filtrados por la dimensión elegida en el bloque de hardware.",
          filterLabel: selectedDetail.label,
          rows: deviceStatusDevices.map((device) => ({ label: device.name || device.deviceId || `Dispositivo ${device.id}`, value: device.status || "Sin status", hint: device.ownerUserName || device.ownerUserEmail || device.educationalCenterName || "Sin referencia registrada", badge: device.assignmentScope || "sin asignación" })).filter((row, index) => {
            const device = deviceStatusDevices[index];
            if (normalized.includes("con status")) return row.value !== "Sin status";
            if (normalized.includes("sin status")) return row.value === "Sin status";
            if (normalized.includes("institución")) return device.assignmentScope === "institution";
            if (normalized.includes("home")) return device.assignmentScope === "home";
            return false;
          }),
        };
      }
      case "user-role":
        return { title: `Usuarios con rol ${selectedDetail.label}`, description: "Usuarios que pertenecen al rol seleccionado.", filterLabel: selectedDetail.label, rows: userRoleUsers.map((entry) => ({ label: entry.fullName || entry.email || `Usuario ${entry.id}`, value: entry.roles.join(", ") || "Sin rol", hint: entry.email || "Sin email registrado", badge: entry.lastLoginAt ? `Login ${getDateBucketLabel(entry.lastLoginAt)}` : "Sin login" })).filter((row) => normalizeLabel(row.value).includes(normalizeLabel(selectedDetail.label))) };
      case "profile-activity": {
        const normalized = normalizeLabel(selectedDetail.label);
        return {
          title: `Actividad de perfiles · ${selectedDetail.label}`,
          description: "Perfiles dentro de la dimensión elegida del gráfico.",
          filterLabel: selectedDetail.label,
          rows: profileActivityProfiles.map((profile) => ({ label: profile.displayName || `Perfil ${profile.id}`, value: `${profile.sessionCount} sesiones`, hint: `${profile.activeBindingCount} bindings activos · ${profile.ageCategory || "sin categoría"}`, badge: profile.isActive ? "Activo" : "Inactivo" })).filter((row, index) => {
            const profile = profileActivityProfiles[index];
            if (normalized.includes("sesión")) return Boolean(profile.lastSessionAt);
            return getDateBucketLabel(profile.createdAt || profile.updatedAt || profile.lastSessionAt) === selectedDetail.label;
          }),
        };
      }
      case "user-creation-date":
        return {
          title: `Altas y reingresos · ${selectedDetail.label}`,
          description: "Usuarios cuyo alta o último acceso cae dentro de la fecha elegida.",
          filterLabel: selectedDetail.label,
          rows: userCreationUsers.map((entry) => ({ label: entry.fullName || entry.email || `Usuario ${entry.id}`, value: entry.roles.join(", ") || "Sin rol", hint: entry.email || "Sin email registrado", badge: entry.lastLoginAt ? `Login ${getDateBucketLabel(entry.lastLoginAt)}` : "Sin login" })).filter((row, index) => {
            const userRecord = userCreationUsers[index];
            return getDateBucketLabel(userRecord?.createdAt || userRecord?.lastLoginAt) === selectedDetail.label
              || getDateBucketLabel(userRecord?.lastLoginAt) === selectedDetail.label;
          }),
        };
      case "profile-age":
        return { title: `Perfiles por categoría · ${selectedDetail.label}`, description: "Perfiles dentro de la cohorte elegida.", filterLabel: selectedDetail.label, rows: profileAgeProfiles.map((profile) => ({ label: profile.displayName || `Perfil ${profile.id}`, value: `${profile.sessionCount} sesiones`, hint: `${profile.activeBindingCount} bindings activos · ${profile.ageCategory || "sin categoría"}`, badge: profile.isActive ? "Activo" : "Inactivo" })).filter((row, index) => normalizeLabel(profileAgeProfiles[index]?.ageCategory || "Sin categoría") === normalizeLabel(selectedDetail.label)) };
      case "profile-binding": {
        const normalized = normalizeLabel(selectedDetail.label);
        return {
          title: `Vínculos de perfiles · ${selectedDetail.label}`,
          description: "Perfiles filtrados por nivel de vinculación y uso.",
          filterLabel: selectedDetail.label,
          rows: profileBindingProfiles.map((profile) => ({ label: profile.displayName || `Perfil ${profile.id}`, value: `${profile.sessionCount} sesiones`, hint: `${profile.activeBindingCount} bindings activos · ${profile.ageCategory || "sin categoría"}`, badge: profile.isActive ? "Activo" : "Inactivo" })).filter((row, index) => {
            const profile = profileBindingProfiles[index];
            if (normalized.includes("bindings activos")) return profile.activeBindingCount > 0;
            if (normalized.includes("sin binding")) return profile.activeBindingCount === 0;
            if (normalized.includes("con sesiones")) return profile.sessionCount > 0;
            return false;
          }),
        };
      }
      case "profile-sessions": {
        const normalized = normalizeLabel(selectedDetail.label);
        return {
          title: `Cohortes por sesiones · ${selectedDetail.label}`,
          description: "Perfiles agrupados por profundidad de uso.",
          filterLabel: selectedDetail.label,
          rows: profileSessionProfiles.map((profile) => ({ label: profile.displayName || `Perfil ${profile.id}`, value: `${profile.sessionCount} sesiones`, hint: `${profile.activeBindingCount} bindings activos · ${profile.ageCategory || "sin categoría"}`, badge: profile.isActive ? "Activo" : "Inactivo" })).filter((row, index) => {
            const count = profileSessionProfiles[index]?.sessionCount || 0;
            if (normalized.includes("sin sesiones")) return count <= 0;
            if (normalized.includes("1 3 sesiones") || normalized.includes("1/3 sesiones")) return count >= 1 && count <= 3;
            if (normalized.includes("4 10 sesiones") || normalized.includes("4/10 sesiones")) return count >= 4 && count <= 10;
            if (normalized.includes("11+ sesiones")) return count >= 11;
            return false;
          }),
        };
      }
      case "institution-coverage":
        return { title: `Cobertura institucional · ${selectedDetail.label}`, description: "Instituciones dentro del ranking de cobertura seleccionado.", filterLabel: selectedDetail.label, rows: coverageInstitutions.map((institution) => ({ label: institution.name, value: String(institution.operationalSummary?.studentCount ?? 0), hint: `${institution.operationalSummary?.userCount ?? 0} usuarios · ${institution.operationalSummary?.classGroupCount ?? 0} grupos`, badge: institution.status || institution.city || "Institución" })).filter((row) => normalizeLabel(row.label) === normalizeLabel(selectedDetail.label)) };
      case "alert": {
        const normalized = normalizeLabel(selectedDetail.label);
        if (normalized.includes("dispositivos sin status")) return { title: "Dispositivos sin status", description: "Equipos que necesitan chequeo técnico o actualización de estado.", filterLabel: selectedDetail.label, rows: deviceRows.filter((row) => row.value === "Sin status") };
        if (normalized.includes("profiles sin binding")) return { title: "Perfiles sin binding", description: "Perfiles todavía no conectados a experiencia real.", filterLabel: selectedDetail.label, rows: profileRows.filter((row, index) => (profiles[index]?.activeBindingCount || 0) === 0) };
        if (normalized.includes("partidas sin turnos")) return { title: "Partidas sin turnos", description: "Sesiones que conviene revisar porque no muestran interacción.", filterLabel: selectedDetail.label, rows: gameRows(games.filter((game) => game.turns.length === 0)) };
        return { title: "Syncs sin raw", description: "Sincronizaciones sin evidencia cruda disponible.", filterLabel: selectedDetail.label, rows: syncRows.filter((row, index) => (syncs[index]?.rawRecordCount || syncs[index]?.rawRecordIds.length || 0) === 0) };
      }
      case "top-institution":
        return { title: `Institución · ${selectedDetail.label}`, description: "Detalle expandido de la institución elegida en el ranking.", filterLabel: selectedDetail.label, rows: institutionRows.filter((row) => normalizeLabel(row.label) === normalizeLabel(selectedDetail.label)) };
      case "top-user":
        return { title: `Usuario · ${selectedDetail.label}`, description: "Detalle expandido del usuario elegido en el ranking.", filterLabel: selectedDetail.label, rows: userRows.filter((row) => normalizeLabel(row.label) === normalizeLabel(selectedDetail.label)) };
      default:
        return null;
    }
  })();

  const roleLabel = isInstitutionAdmin ? "Admin institucional" : isDirector ? "Dirección" : "Institución";

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={roleLabel}
        title={scopedInstitution ? scopedInstitution.name : "Dashboard institucional"}
        description={
          scopedInstitution
            ? `Vista analítica de ${scopedInstitution.name}: usuarios, perfiles, actividad, tiempos, hardware y señales concretas para priorizar la operación diaria.`
            : "Vista analítica institucional para esta sesión: métricas, gráficos y prioridades concretas, sin ruido de portada."
        }
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
        <DashboardMetricCard label="Usuarios" value={String(usersQuery.data?.total || users.length)} hint="Padrón de usuarios de la institución actual." icon={Users} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-users", label: "Usuarios" })} isActive={selectedDetail?.kind === "metric-users"} />
        <DashboardMetricCard label="Perfiles / estudiantes" value={String(profiles.length)} hint="Volumen de perfiles y estudiantes activos o pendientes." icon={UserRound} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-profiles", label: "Perfiles / estudiantes" })} isActive={selectedDetail?.kind === "metric-profiles"} />
        <DashboardMetricCard label="Partidas" value={String(gamesQuery.data?.total || games.length)} hint="Uso real registrado en la institución." icon={Database} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-games", label: "Partidas" })} isActive={selectedDetail?.kind === "metric-games"} />
        <DashboardMetricCard label="Acierto general" value={`${successRate}%`} hint="Lectura rápida del rendimiento agregado." icon={BookOpen} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-success", label: "Acierto general" })} isActive={selectedDetail?.kind === "metric-success"} />
        <DashboardMetricCard label="Duración promedio por partida" value={formatDurationSeconds(averageGameTime)} hint="Tiempo acumulado por sesión usando turnos registrados." icon={TimerReset} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-game-time", label: "Duración promedio por partida" })} isActive={selectedDetail?.kind === "metric-game-time"} />
        <DashboardMetricCard label="Dispositivos" value={String(devicesQuery.data?.total || devices.length)} hint="Cobertura actual del parque." icon={Smartphone} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-devices", label: "Dispositivos" })} isActive={selectedDetail?.kind === "metric-devices"} />
      </div>

      {error ? (
        <Card className="border-destructive/20 bg-white/85">
          <CardContent className="p-6 text-sm text-destructive">
            No pude cargar una parte del dashboard institucional: {getErrorMessage(error)}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardLineChartCard
          title="Actividad por fecha"
          description="Partidas y turnos por día para leer volumen, caídas y repuntes de uso."
          data={activitySeries}
          range={activityRange}
          onRangeChange={(range) => setModuleRange("institution-activity", range)}
          csvFileName={`institution-dashboard-actividad-${activityRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "activity-date", label })}
          activeDatumLabel={selectedDetail?.kind === "activity-date" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Balance de recursos"
          description="Usuarios, instituciones, dispositivos y perfiles dentro de esta vista."
          data={resourceBalance}
          range={resourceRange}
          onRangeChange={(range) => setModuleRange("institution-resource-balance", range)}
          csvFileName={`institution-dashboard-balance-recursos-${resourceRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "resource-balance", label })}
          activeDatumLabel={selectedDetail?.kind === "resource-balance" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title="Mazos más usados"
          description="Qué contenidos están moviendo la actividad en la institución."
          data={deckUsage}
          range={deckRange}
          onRangeChange={(range) => setModuleRange("institution-deck", range)}
          csvFileName={`institution-dashboard-mazos-${deckRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "deck", label })}
          activeDatumLabel={selectedDetail?.kind === "deck" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Estado de hardware"
          description="Cruza estado y tipo de asignación para entender la salud del parque."
          data={deviceStatusSeries}
          range={deviceStatusRange}
          onRangeChange={(range) => setModuleRange("institution-device-status", range)}
          csvFileName={`institution-dashboard-hardware-${deviceStatusRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "device-status", label })}
          activeDatumLabel={selectedDetail?.kind === "device-status" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title="Usuarios por rol"
          description="Distribución del padrón para leer rápido qué perfiles sostienen la actividad institucional."
          data={userRoleSeries}
          range={userRoleRange}
          onRangeChange={(range) => setModuleRange("institution-user-role", range)}
          csvFileName={`institution-dashboard-usuarios-por-rol-${userRoleRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-role", label })}
          activeDatumLabel={selectedDetail?.kind === "user-role" ? selectedDetail.label : null}
        />
        <DashboardLineChartCard
          title="Actividad reciente de perfiles"
          description="Perfiles con sesión y perfiles incorporados por fecha para seguir activación real y crecimiento."
          data={profileActivitySeries}
          range={profileActivityRange}
          onRangeChange={(range) => setModuleRange("institution-profile-activity", range)}
          csvFileName={`institution-dashboard-actividad-perfiles-${profileActivityRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-activity", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-activity" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardLineChartCard
          title="Altas y reingresos"
          description="Alta de usuarios y últimos accesos por fecha para detectar onboarding reciente o reactivaciones."
          data={userCreationSeries}
          range={userCreationRange}
          onRangeChange={(range) => setModuleRange("institution-user-creation", range)}
          csvFileName={`institution-dashboard-altas-reingresos-${userCreationRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-creation-date", label })}
          activeDatumLabel={selectedDetail?.kind === "user-creation-date" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Perfiles por categoría"
          description="Distribución por cohortes etarias para entender mejor qué segmento concentra la operación actual."
          data={profileAgeSeries}
          range={profileAgeRange}
          onRangeChange={(range) => setModuleRange("institution-profile-age", range)}
          csvFileName={`institution-dashboard-perfiles-por-categoria-${profileAgeRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-age", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-age" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title="Vínculos de perfiles"
          description="Cuántos perfiles ya están conectados a experiencia real y cuántos siguen flojos."
          data={profileBindingSeries}
          range={profileBindingRange}
          onRangeChange={(range) => setModuleRange("institution-profile-binding", range)}
          csvFileName={`institution-dashboard-vinculos-perfiles-${profileBindingRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-binding", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-binding" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Cohortes por sesiones"
          description="Agrupa perfiles según profundidad de uso para separar rápidamente adopción inicial de uso sostenido."
          data={profileSessionCohorts}
          range={profileSessionsRange}
          onRangeChange={(range) => setModuleRange("institution-profile-sessions", range)}
          csvFileName={`institution-dashboard-cohortes-sesiones-${profileSessionsRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-sessions", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-sessions" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title="Instituciones por cobertura"
          description="Comparativa por estudiantes con referencia secundaria de usuarios, útil cuando la vista incluye más de una institución."
          data={institutionCoverageSeries}
          secondaryDataKey="secondaryValue"
          secondaryLabel="Usuarios"
          range={institutionCoverageRange}
          onRangeChange={(range) => setModuleRange("institution-coverage", range)}
          csvFileName={`institution-dashboard-cobertura-instituciones-${institutionCoverageRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "institution-coverage", label })}
          activeDatumLabel={selectedDetail?.kind === "institution-coverage" ? selectedDetail.label : null}
        />
        <DashboardTopListCard
          title="Prioridades operativas"
          description="Alertas rápidas para decidir dónde intervenir primero."
          items={operationalAlerts}
          emptyLabel="No aparecen alertas fuertes en la institución actual."
          onItemSelect={(label) => setSelectedDetail({ kind: "alert", label })}
          activeItemLabel={selectedDetail?.kind === "alert" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardTopListCard
          title="Instituciones con más volumen"
          description="Ranking por estudiantes, útil sobre todo para vistas multi-institución."
          items={topInstitutions}
          valueLabel="estudiantes"
          emptyLabel="Con la visibilidad actual no hace falta un ranking institucional más profundo."
          onItemSelect={(label) => setSelectedDetail({ kind: "top-institution", label })}
          activeItemLabel={selectedDetail?.kind === "top-institution" ? selectedDetail.label : null}
        />
        <DashboardTopListCard
          title={canSeePermissions ? "Usuarios y permisos" : "Usuarios"}
          description={canSeePermissions ? "Lectura rápida del padrón y su mezcla de roles." : "Lectura rápida del padrón de usuarios."}
          items={visibleUsers}
          valueLabel="roles"
          emptyLabel="No hay suficientes usuarios como para armar un ranking útil todavía."
          onItemSelect={(label) => setSelectedDetail({ kind: "top-user", label })}
          activeItemLabel={selectedDetail?.kind === "top-user" ? selectedDetail.label : null}
        />
      </div>
    </div>
  );
}
