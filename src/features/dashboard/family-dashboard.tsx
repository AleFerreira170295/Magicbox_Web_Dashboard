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
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";
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

const familyDashboardMessages: Record<AppLanguage, {
  header: { eyebrow: string; title: (name: string) => string; description: string };
  metrics: { games: string; turns: string; success: string; turnTime: string; devices: string; users: string; profiles: string; gamesHint: string; turnsHint: string; successHint: string; turnTimeHint: string; devicesHint: string; usersHint: string; profilesHint: string };
  charts: { activity: string; activityDesc: string; decks: string; decksDesc: string; usersByRole: string; usersByRoleDesc: string; profileState: string; profileStateDesc: string; profileAge: string; profileAgeDesc: string; profileRecency: string; profileRecencyDesc: string; resources: string; resourcesDesc: string; userRecency: string; userRecencyDesc: string; summary: string; summaryDesc: string };
  error: (message: string) => string;
}> = {
  es: {
    header: { eyebrow: "Familia", title: (name) => `Dashboard de seguimiento para ${name}`, description: "Esta home mantiene una lectura analítica y simple: actividad, recursos, tiempos y contenidos usados, sin ruido técnico." },
    metrics: { games: "Partidas", turns: "Turnos", success: "Acierto general", turnTime: "Tiempo por turno", devices: "Dispositivos", users: "Usuarios", profiles: "Perfiles", gamesHint: "Actividad reciente del grupo familiar.", turnsHint: "Interacciones registradas dentro de esas partidas.", successHint: "Porcentaje agregado de respuestas correctas en la actividad registrada.", turnTimeHint: "Ritmo promedio de juego en la actividad registrada.", devicesHint: "Equipos asociados a la cuenta.", usersHint: "Personas asociadas a la cuenta.", profilesHint: "Perfiles incorporados al seguimiento familiar." },
    charts: { activity: "Actividad reciente", activityDesc: "Partidas y turnos por fecha para ver si hubo movimiento reciente o días más tranquilos.", decks: "Mazos usados", decksDesc: "Qué tipos de contenido aparecen más en la actividad registrada.", usersByRole: "Usuarios por rol", usersByRoleDesc: "Distribución simple de las personas asociadas al grupo familiar.", profileState: "Estado de perfiles", profileStateDesc: "Perfiles activos, con binding y con sesiones para leer rápidamente qué tan conectada está la experiencia.", profileAge: "Perfiles por categoría", profileAgeDesc: "Cohortes por categoría para entender si la experiencia actual se concentra en algún tramo específico.", profileRecency: "Recencia de perfiles", profileRecencyDesc: "Última sesión por perfil para ver rápidamente quién viene activo y quién quedó más quieto.", resources: "Recursos principales", resourcesDesc: "Balance simple entre personas y dispositivos asociados a la cuenta.", userRecency: "Recencia de usuarios", userRecencyDesc: "Lectura suave de accesos recientes para detectar si el entorno viene activo o con señales más frías.", summary: "Resumen rápido", summaryDesc: "Lectura amable de los tres frentes más importantes de tu cuenta." },
    error: (message) => `No pude cargar una parte del dashboard family: ${message}`,
  },
  en: {
    header: { eyebrow: "Family", title: (name) => `Follow-up dashboard for ${name}`, description: "This home keeps an analytical but simple reading: activity, resources, timing, and used content, without technical noise." },
    metrics: { games: "Games", turns: "Turns", success: "Overall success", turnTime: "Turn time", devices: "Devices", users: "Users", profiles: "Profiles", gamesHint: "Recent activity for the family group.", turnsHint: "Interactions recorded inside those games.", successHint: "Aggregate percentage of correct answers in recorded activity.", turnTimeHint: "Average pace of play in recorded activity.", devicesHint: "Devices linked to the account.", usersHint: "People linked to the account.", profilesHint: "Profiles included in family follow-up." },
    charts: { activity: "Recent activity", activityDesc: "Games and turns by date to see whether there was recent movement or quieter days.", decks: "Used decks", decksDesc: "Which kinds of content appear most in the recorded activity.", usersByRole: "Users by role", usersByRoleDesc: "Simple distribution of the people linked to the family group.", profileState: "Profile state", profileStateDesc: "Active profiles, with bindings and sessions, to quickly read how connected the experience is.", profileAge: "Profiles by category", profileAgeDesc: "Cohorts by category to understand whether the current experience concentrates on a specific segment.", profileRecency: "Profile recency", profileRecencyDesc: "Latest session by profile to quickly see who is active and who has gone quieter.", resources: "Main resources", resourcesDesc: "Simple balance between people and devices linked to the account.", userRecency: "User recency", userRecencyDesc: "Gentle read of recent access to detect whether the environment is active or colder.", summary: "Quick summary", summaryDesc: "Friendly read of the three most important fronts in your account." },
    error: (message) => `I couldn't load part of the family dashboard: ${message}`,
  },
  pt: {
    header: { eyebrow: "Família", title: (name) => `Dashboard de acompanhamento para ${name}`, description: "Esta home mantém uma leitura analítica e simples: atividade, recursos, tempos e conteúdos usados, sem ruído técnico." },
    metrics: { games: "Partidas", turns: "Turnos", success: "Acerto geral", turnTime: "Tempo por turno", devices: "Dispositivos", users: "Usuários", profiles: "Perfis", gamesHint: "Atividade recente do grupo familiar.", turnsHint: "Interações registradas dentro dessas partidas.", successHint: "Percentual agregado de respostas corretas na atividade registrada.", turnTimeHint: "Ritmo médio de jogo na atividade registrada.", devicesHint: "Equipamentos associados à conta.", usersHint: "Pessoas associadas à conta.", profilesHint: "Perfis incorporados ao acompanhamento familiar." },
    charts: { activity: "Atividade recente", activityDesc: "Partidas e turnos por data para ver se houve movimento recente ou dias mais tranquilos.", decks: "Baralhos usados", decksDesc: "Que tipos de conteúdo aparecem mais na atividade registrada.", usersByRole: "Usuários por papel", usersByRoleDesc: "Distribuição simples das pessoas associadas ao grupo familiar.", profileState: "Estado dos perfis", profileStateDesc: "Perfis ativos, com binding e com sessões para ler rapidamente quão conectada está a experiência.", profileAge: "Perfis por categoria", profileAgeDesc: "Coortes por categoria para entender se a experiência atual se concentra em algum trecho específico.", profileRecency: "Recência de perfis", profileRecencyDesc: "Última sessão por perfil para ver rapidamente quem vem ativo e quem ficou mais quieto.", resources: "Recursos principais", resourcesDesc: "Equilíbrio simples entre pessoas e dispositivos associados à conta.", userRecency: "Recência de usuários", userRecencyDesc: "Leitura suave de acessos recentes para detectar se o ambiente vem ativo ou com sinais mais frios.", summary: "Resumo rápido", summaryDesc: "Leitura amigável das três frentes mais importantes da sua conta." },
    error: (message) => `Não consegui carregar parte do dashboard family: ${message}`,
  },
};

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

  if (diffDays == null) return normalized.includes("sin") || normalized.includes("without") || normalized.includes("sem");
  if (normalized.includes("7 días") || normalized.includes("7 days") || normalized.includes("7 dias")) return diffDays <= 7;
  if (normalized.includes("8 30 días") || normalized.includes("8/30 días") || normalized.includes("8 30 days") || normalized.includes("8/30 days") || normalized.includes("8 30 dias") || normalized.includes("8/30 dias")) return diffDays > 7 && diffDays <= 30;
  if (normalized.includes("31 90 días") || normalized.includes("31/90 días") || normalized.includes("31 90 days") || normalized.includes("31/90 days") || normalized.includes("31 90 dias") || normalized.includes("31/90 dias")) return diffDays > 30 && diffDays <= 90;
  if (normalized.includes("> 90 días") || normalized.includes("> 90 days") || normalized.includes("> 90 dias")) return diffDays > 90;
  return false;
}

function getDashboardDateValue(...values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(value)) || null;
}

export function FamilyDashboard() {
  const { language } = useLanguage();
  const t = familyDashboardMessages[language];
  const localText = language === "en"
    ? {
        recentActivity: "Recent activity",
        linkedPeople: "Linked people",
        linkedDevices: "Linked devices",
        usableCapture: "Usable capture",
        game: "Game",
        user: "User",
        device: "Device",
        profile: "Profile",
        turns: (count: number) => `${count} turns`,
        dateDuration: (date: string, duration: string) => `Date ${date} · duration ${duration}`,
        noRole: "No role",
        noEmail: "No recorded email",
        login: (value: string) => `Login ${value}`,
        noLogin: "No login",
        noStatus: "No status",
        homeUse: "Home use",
        institutionalUse: "Institutional use",
        noAssignment: "unassigned",
        sessions: (count: number) => `${count} sessions`,
        bindingsAge: (bindings: number, age: string) => `${bindings} active bindings · ${age}`,
        active: "Active",
        inactive: "Inactive",
        raws: (count: number) => `${count} raws`,
        noSource: "No source recorded",
        gameDetail: "Game detail",
        gameDetailDesc: "Recent activity for the family group.",
        turnsDetail: "Turn detail",
        turnsDetailDesc: "Interactions recorded in the games.",
        successDetail: "Success detail",
        successDetailDesc: "Success by game to move from aggregate to the concrete case.",
        correctTurns: (successes: number, turns: number) => `${successes}/${turns} correct turns`,
        turnTimeDetail: "Turn time detail",
        turnTimeDetailDesc: "Average by game to better understand the usage pace.",
        measuredTurns: (count: number) => `${count} measured turns`,
        devicesDetail: "Device detail",
        devicesDetailDesc: "Devices linked to the account.",
        usersDetail: "User detail",
        usersDetailDesc: "People linked to family follow-up.",
        profilesDetail: "Profile detail",
        profilesDetailDesc: "Profiles already included in family follow-up.",
        activityOf: (label: string) => `Activity on ${label}`,
        selectedDateGames: "Games that fall on the selected date.",
        deckOf: (label: string) => `Deck ${label}`,
        selectedContentGames: "Games linked to the selected content.",
        usersWithRole: (label: string) => `Users with role ${label}`,
        peopleInRole: "People in the selected role.",
        profileState: (label: string) => `Profile state · ${label}`,
        profilesByBlock: "Profiles filtered by the selected block.",
        profilesByCategory: (label: string) => `Profiles by category · ${label}`,
        profilesInCohort: "Profiles inside the chosen cohort.",
        profilesRecency: (label: string) => `Profile recency · ${label}`,
        profilesInPeriod: "Profiles inside the selected period.",
        resourcesUsers: "Resources · users",
        resourcesUsersDesc: "People registered in this account.",
        resourcesDevices: "Resources · devices",
        resourcesDevicesDesc: "Devices linked to this account.",
        resourcesProfiles: "Resources · profiles",
        resourcesProfilesDesc: "Profiles registered in this account.",
        usersRecency: (label: string) => `User recency · ${label}`,
        usersInPeriod: "Users inside the selected period.",
        syncsWithEvidence: "Syncs with evidence",
        syncsWithEvidenceDesc: "Sync sessions that bring usable capture.",
        devices: "Devices",
        familyDevicesDesc: "Devices linked to the family group.",
        users: "Users",
        familyUsersDesc: "People linked to the family group.",
        games: "Games",
        familyGamesDesc: "Recorded activity for the family group.",
        noDeck: "No deck",
        noCategory: "uncategorized",
      }
    : language === "pt"
      ? {
          recentActivity: "Atividade recente",
          linkedPeople: "Pessoas vinculadas",
          linkedDevices: "Equipamentos associados",
          usableCapture: "Captura utilizável",
          game: "Partida",
          user: "Usuário",
          device: "Dispositivo",
          profile: "Perfil",
          turns: (count: number) => `${count} turnos`,
          dateDuration: (date: string, duration: string) => `Data ${date} · duração ${duration}`,
          noRole: "Sem papel",
          noEmail: "Sem email registrado",
          login: (value: string) => `Login ${value}`,
          noLogin: "Sem login",
          noStatus: "Sem status",
          homeUse: "Uso em casa",
          institutionalUse: "Uso institucional",
          noAssignment: "sem atribuição",
          sessions: (count: number) => `${count} sessões`,
          bindingsAge: (bindings: number, age: string) => `${bindings} bindings ativos · ${age}`,
          active: "Ativo",
          inactive: "Inativo",
          raws: (count: number) => `${count} raws`,
          noSource: "Sem fonte registrada",
          gameDetail: "Detalhe de partidas",
          gameDetailDesc: "Atividade recente do grupo familiar.",
          turnsDetail: "Detalhe de turnos",
          turnsDetailDesc: "Interações registradas nas partidas.",
          successDetail: "Detalhe de acerto",
          successDetailDesc: "Acerto por partida para passar do agregado ao caso concreto.",
          correctTurns: (successes: number, turns: number) => `${successes}/${turns} turnos corretos`,
          turnTimeDetail: "Detalhe de tempo por turno",
          turnTimeDetailDesc: "Média por partida para entender melhor o ritmo de uso.",
          measuredTurns: (count: number) => `${count} turnos medidos`,
          devicesDetail: "Detalhe de dispositivos",
          devicesDetailDesc: "Equipamentos associados à conta.",
          usersDetail: "Detalhe de usuários",
          usersDetailDesc: "Pessoas associadas ao acompanhamento familiar.",
          profilesDetail: "Detalhe de perfis",
          profilesDetailDesc: "Perfis já incorporados ao acompanhamento familiar.",
          activityOf: (label: string) => `Atividade de ${label}`,
          selectedDateGames: "Partidas que caem na data selecionada.",
          deckOf: (label: string) => `Baralho ${label}`,
          selectedContentGames: "Partidas associadas ao conteúdo selecionado.",
          usersWithRole: (label: string) => `Usuários com papel ${label}`,
          peopleInRole: "Pessoas do papel escolhido.",
          profileState: (label: string) => `Estado dos perfis · ${label}`,
          profilesByBlock: "Perfis filtrados pelo bloco escolhido.",
          profilesByCategory: (label: string) => `Perfis por categoria · ${label}`,
          profilesInCohort: "Perfis dentro da coorte escolhida.",
          profilesRecency: (label: string) => `Recência de perfis · ${label}`,
          profilesInPeriod: "Perfis dentro do período selecionado.",
          resourcesUsers: "Recursos · usuários",
          resourcesUsersDesc: "Pessoas registradas nesta conta.",
          resourcesDevices: "Recursos · dispositivos",
          resourcesDevicesDesc: "Equipamentos associados a esta conta.",
          resourcesProfiles: "Recursos · perfis",
          resourcesProfilesDesc: "Perfis registrados nesta conta.",
          usersRecency: (label: string) => `Recência de usuários · ${label}`,
          usersInPeriod: "Usuários dentro do período selecionado.",
          syncsWithEvidence: "Syncs com evidência",
          syncsWithEvidenceDesc: "Sincronizações que trazem captura utilizável.",
          devices: "Dispositivos",
          familyDevicesDesc: "Equipamentos associados ao grupo familiar.",
          users: "Usuários",
          familyUsersDesc: "Pessoas associadas ao grupo familiar.",
          games: "Partidas",
          familyGamesDesc: "Atividade registrada do grupo familiar.",
          noDeck: "Sem baralho",
          noCategory: "sem categoria",
        }
      : {
          recentActivity: "Actividad reciente",
          linkedPeople: "Personas vinculadas",
          linkedDevices: "Equipos asociados",
          usableCapture: "Captura utilizable",
          game: "Partida",
          user: "Usuario",
          device: "Dispositivo",
          profile: "Perfil",
          turns: (count: number) => `${count} turnos`,
          dateDuration: (date: string, duration: string) => `Fecha ${date} · duración ${duration}`,
          noRole: "Sin rol",
          noEmail: "Sin email registrado",
          login: (value: string) => `Login ${value}`,
          noLogin: "Sin login",
          noStatus: "Sin status",
          homeUse: "Uso en casa",
          institutionalUse: "Uso institucional",
          noAssignment: "sin asignación",
          sessions: (count: number) => `${count} sesiones`,
          bindingsAge: (bindings: number, age: string) => `${bindings} bindings activos · ${age}`,
          active: "Activo",
          inactive: "Inactivo",
          raws: (count: number) => `${count} raws`,
          noSource: "Sin fuente registrada",
          gameDetail: "Detalle de partidas",
          gameDetailDesc: "Actividad reciente del grupo familiar.",
          turnsDetail: "Detalle de turnos",
          turnsDetailDesc: "Interacciones registradas en las partidas.",
          successDetail: "Detalle de acierto",
          successDetailDesc: "Acierto por partida para pasar del agregado al caso concreto.",
          correctTurns: (successes: number, turns: number) => `${successes}/${turns} turnos correctos`,
          turnTimeDetail: "Detalle de tiempo por turno",
          turnTimeDetailDesc: "Promedio por partida para entender mejor el ritmo de uso.",
          measuredTurns: (count: number) => `${count} turnos medidos`,
          devicesDetail: "Detalle de dispositivos",
          devicesDetailDesc: "Equipos asociados a la cuenta.",
          usersDetail: "Detalle de usuarios",
          usersDetailDesc: "Personas asociadas al seguimiento familiar.",
          profilesDetail: "Detalle de perfiles",
          profilesDetailDesc: "Perfiles ya incorporados al seguimiento familiar.",
          activityOf: (label: string) => `Actividad del ${label}`,
          selectedDateGames: "Partidas que caen en la fecha seleccionada.",
          deckOf: (label: string) => `Mazo ${label}`,
          selectedContentGames: "Partidas asociadas al contenido seleccionado.",
          usersWithRole: (label: string) => `Usuarios con rol ${label}`,
          peopleInRole: "Personas del rol elegido.",
          profileState: (label: string) => `Estado de perfiles · ${label}`,
          profilesByBlock: "Perfiles filtrados por el bloque elegido.",
          profilesByCategory: (label: string) => `Perfiles por categoría · ${label}`,
          profilesInCohort: "Perfiles dentro de la cohorte elegida.",
          profilesRecency: (label: string) => `Recencia de perfiles · ${label}`,
          profilesInPeriod: "Perfiles dentro del período seleccionado.",
          resourcesUsers: "Recursos · usuarios",
          resourcesUsersDesc: "Personas registradas en esta cuenta.",
          resourcesDevices: "Recursos · dispositivos",
          resourcesDevicesDesc: "Equipos asociados a esta cuenta.",
          resourcesProfiles: "Recursos · perfiles",
          resourcesProfilesDesc: "Perfiles registrados en esta cuenta.",
          usersRecency: (label: string) => `Recencia de usuarios · ${label}`,
          usersInPeriod: "Usuarios dentro del período seleccionado.",
          syncsWithEvidence: "Syncs con evidencia",
          syncsWithEvidenceDesc: "Sincronizaciones que sí traen captura utilizable.",
          devices: "Dispositivos",
          familyDevicesDesc: "Equipos asociados al grupo familiar.",
          users: "Usuarios",
          familyUsersDesc: "Personas asociadas al grupo familiar.",
          games: "Partidas",
          familyGamesDesc: "Actividad registrada del grupo familiar.",
          noDeck: "Sin mazo",
          noCategory: "sin categoría",
        };
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
      label: t.metrics.games,
      value: String(gamesQuery.data?.total || games.length),
      badge: localText.recentActivity,
    },
    {
      label: t.metrics.users,
      value: String(usersQuery.data?.total || users.length),
      badge: localText.linkedPeople,
    },
    {
      label: t.metrics.devices,
      value: String(devicesQuery.data?.total || devices.length),
      badge: localText.linkedDevices,
    },
    {
      label: localText.syncsWithEvidence,
      value: String(syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) > 0).length),
      badge: localText.usableCapture,
    },
  ];

  const detailPanel = (() => {
    if (!selectedDetail) return null;

    const gameRows = (items = games): DashboardDetailRow[] =>
      items.map((game) => ({
        label: game.deckName || `${localText.game} ${game.id}`,
        value: localText.turns(game.turns.length),
        hint: localText.dateDuration(getDateBucketLabel(game.startDate || game.createdAt || game.updatedAt), formatDurationSeconds(game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0))),
      }));

    const userRows: DashboardDetailRow[] = users.map((entry) => ({
      label: entry.fullName || entry.email || `${localText.user} ${entry.id}`,
      value: entry.roles?.join(", ") || localText.noRole,
      hint: entry.email || localText.noEmail,
      badge: entry.lastLoginAt ? localText.login(getDateBucketLabel(entry.lastLoginAt)) : localText.noLogin,
    }));

    const deviceRows: DashboardDetailRow[] = devices.map((device) => ({
      label: device.name || device.deviceId || `${localText.device} ${device.id}`,
      value: device.status || localText.noStatus,
      hint: device.assignmentScope === "home" ? localText.homeUse : localText.institutionalUse,
      badge: device.assignmentScope || localText.noAssignment,
    }));

    const profileRows: DashboardDetailRow[] = profiles.map((profile) => ({
      label: profile.displayName || `${localText.profile} ${profile.id}`,
      value: localText.sessions(profile.sessionCount),
      hint: localText.bindingsAge(profile.activeBindingCount, profile.ageCategory || localText.noCategory),
      badge: profile.isActive ? localText.active : localText.inactive,
    }));

    const syncRows: DashboardDetailRow[] = syncs.map((sync) => ({
      label: sync.deckName || `Sync ${sync.id}`,
      value: localText.raws(sync.rawRecordCount || sync.rawRecordIds.length || 0),
      hint: sync.source || sync.sourceType || localText.noSource,
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
            label: profile.displayName || `${localText.profile} ${profile.id}`,
            value: localText.sessions(profile.sessionCount),
            hint: localText.bindingsAge(profile.activeBindingCount, profile.ageCategory || localText.noCategory),
            badge: profile.isActive ? localText.active : localText.inactive,
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
        return { title: localText.profilesByCategory(selectedDetail.label), description: localText.profilesInCohort, filterLabel: selectedDetail.label, rows: profileAgeProfiles.map((profile) => ({ label: profile.displayName || `${localText.profile} ${profile.id}`, value: localText.sessions(profile.sessionCount), hint: localText.bindingsAge(profile.activeBindingCount, profile.ageCategory || localText.noCategory), badge: profile.isActive ? localText.active : localText.inactive })).filter((row, index) => normalizeLabel(profileAgeProfiles[index]?.ageCategory || localText.noCategory) === normalizeLabel(selectedDetail.label)) };
      case "profile-recency":
        return { title: localText.profilesRecency(selectedDetail.label), description: localText.profilesInPeriod, filterLabel: selectedDetail.label, rows: profileRecencyProfiles.map((profile) => ({ label: profile.displayName || `${localText.profile} ${profile.id}`, value: localText.sessions(profile.sessionCount), hint: localText.bindingsAge(profile.activeBindingCount, profile.ageCategory || localText.noCategory), badge: profile.isActive ? localText.active : localText.inactive })).filter((row, index) => matchesRecencyLabel(selectedDetail.label, profileRecencyProfiles[index]?.lastSessionAt)) };
      case "resource": {
        const normalized = normalizeLabel(selectedDetail.label);
        if (normalized.includes("usuario") || normalized.includes("user") || normalized.includes("usuário")) return { title: localText.resourcesUsers, description: localText.resourcesUsersDesc, filterLabel: selectedDetail.label, rows: userRows };
        if (normalized.includes("dispositivo") || normalized.includes("device")) return { title: localText.resourcesDevices, description: localText.resourcesDevicesDesc, filterLabel: selectedDetail.label, rows: deviceRows };
        return { title: localText.resourcesProfiles, description: localText.resourcesProfilesDesc, filterLabel: selectedDetail.label, rows: profileRows };
      }
      case "user-recency":
        return { title: localText.usersRecency(selectedDetail.label), description: localText.usersInPeriod, filterLabel: selectedDetail.label, rows: userRecencyUsers.map((entry) => ({ label: entry.fullName || entry.email || `${localText.user} ${entry.id}`, value: entry.roles?.join(", ") || localText.noRole, hint: entry.email || localText.noEmail, badge: entry.lastLoginAt ? localText.login(getDateBucketLabel(entry.lastLoginAt)) : localText.noLogin })).filter((row, index) => matchesRecencyLabel(selectedDetail.label, userRecencyUsers[index]?.lastLoginAt)) };
      case "signal": {
        const normalized = normalizeLabel(selectedDetail.label);
        if (normalized.includes("syncs con evidencia") || normalized.includes("syncs with evidence") || normalized.includes("syncs com evidência")) return { title: localText.syncsWithEvidence, description: localText.syncsWithEvidenceDesc, filterLabel: selectedDetail.label, rows: syncRows.filter((row, index) => (syncs[index]?.rawRecordCount || syncs[index]?.rawRecordIds.length || 0) > 0) };
        if (normalized.includes("dispositivos") || normalized.includes("devices")) return { title: localText.devices, description: localText.familyDevicesDesc, filterLabel: selectedDetail.label, rows: deviceRows };
        if (normalized.includes("usuarios") || normalized.includes("users") || normalized.includes("usuários")) return { title: localText.users, description: localText.familyUsersDesc, filterLabel: selectedDetail.label, rows: userRows };
        return { title: localText.games, description: localText.familyGamesDesc, filterLabel: selectedDetail.label, rows: gameRows() };
      }
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={t.header.eyebrow}
        title={t.header.title(user?.fullName || (language === "en" ? "family" : language === "pt" ? "família" : "familia"))}
        description={t.header.description}
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
        <DashboardMetricCard label={t.metrics.games} value={String(gamesQuery.data?.total || games.length)} hint={t.metrics.gamesHint} icon={BookHeart} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-games", label: t.metrics.games })} isActive={selectedDetail?.kind === "metric-games"} />
        <DashboardMetricCard label={t.metrics.turns} value={String(totalTurns)} hint={t.metrics.turnsHint} icon={Layers3} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-turns", label: t.metrics.turns })} isActive={selectedDetail?.kind === "metric-turns"} />
        <DashboardMetricCard label={t.metrics.success} value={`${successRate}%`} hint={t.metrics.successHint} icon={Database} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-success", label: t.metrics.success })} isActive={selectedDetail?.kind === "metric-success"} />
        <DashboardMetricCard label={t.metrics.turnTime} value={formatDurationSeconds(averageTurnTime)} hint={t.metrics.turnTimeHint} icon={TimerReset} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-turn-time", label: t.metrics.turnTime })} isActive={selectedDetail?.kind === "metric-turn-time"} />
        <DashboardMetricCard label={t.metrics.devices} value={String(devicesQuery.data?.total || devices.length)} hint={t.metrics.devicesHint} icon={Smartphone} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-devices", label: t.metrics.devices })} isActive={selectedDetail?.kind === "metric-devices"} />
        <DashboardMetricCard label={t.metrics.users} value={String(usersQuery.data?.total || users.length)} hint={t.metrics.usersHint} icon={Users2} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-users", label: t.metrics.users })} isActive={selectedDetail?.kind === "metric-users"} />
        <DashboardMetricCard label={t.metrics.profiles} value={String(profiles.length)} hint={t.metrics.profilesHint} icon={BookHeart} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-profiles", label: t.metrics.profiles })} isActive={selectedDetail?.kind === "metric-profiles"} />
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
          onRangeChange={(range) => setModuleRange("family-activity", range)}
          csvFileName={`family-dashboard-actividad-${activityRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "activity-date", label })}
          activeDatumLabel={selectedDetail?.kind === "activity-date" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.decks}
          description={t.charts.decksDesc}
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
          title={t.charts.usersByRole}
          description={t.charts.usersByRoleDesc}
          data={userRoleSeries}
          range={userRoleRange}
          onRangeChange={(range) => setModuleRange("family-user-role", range)}
          csvFileName={`family-dashboard-usuarios-por-rol-${userRoleRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-role", label })}
          activeDatumLabel={selectedDetail?.kind === "user-role" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.profileState}
          description={t.charts.profileStateDesc}
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
          title={t.charts.profileAge}
          description={t.charts.profileAgeDesc}
          data={profileAgeSeries}
          range={profileAgeRange}
          onRangeChange={(range) => setModuleRange("family-profile-age", range)}
          csvFileName={`family-dashboard-perfiles-por-categoria-${profileAgeRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-age", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-age" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.profileRecency}
          description={t.charts.profileRecencyDesc}
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
          title={t.charts.resources}
          description={t.charts.resourcesDesc}
          data={visibleResources}
          range={resourceRange}
          onRangeChange={(range) => setModuleRange("family-resource-balance", range)}
          csvFileName={`family-dashboard-recursos-${resourceRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "resource", label })}
          activeDatumLabel={selectedDetail?.kind === "resource" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.userRecency}
          description={t.charts.userRecencyDesc}
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
          title={t.charts.summary}
          description={t.charts.summaryDesc}
          items={gentleSignals}
          onItemSelect={(label) => setSelectedDetail({ kind: "signal", label })}
          activeItemLabel={selectedDetail?.kind === "signal" ? selectedDetail.label : null}
        />
      </div>
    </div>
  );
}
