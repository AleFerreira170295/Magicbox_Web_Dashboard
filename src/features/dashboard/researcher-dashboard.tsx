"use client";

import { useMemo, useState } from "react";
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

const researcherDashboardMessages: Record<AppLanguage, {
  header: { eyebrow: string; title: string; description: string };
  metrics: { games: string; turns: string; success: string; turnTime: string; gameTime: string; decks: string; users: string; profiles: string; gamesHint: string; turnsHint: string; successHint: string; turnTimeHint: string; gameTimeHint: string; decksHint: string; usersHint: string; profilesHint: string };
  charts: { activity: string; activityDesc: string; sampleDecks: string; sampleDecksDesc: string; userTypes: string; userTypesDesc: string; profileCoverage: string; profileCoverageDesc: string; signups: string; signupsDesc: string; userRecency: string; userRecencyDesc: string; profileAge: string; profileAgeDesc: string; profileRecency: string; profileRecencyDesc: string; syncSources: string; syncSourcesDesc: string; depth: string; depthDesc: string; evidence: string; evidenceDesc: string; noEvidenceAlerts: string };
  error: (message: string) => string;
}> = {
  es: {
    header: { eyebrow: "Investigación", title: "Dashboard de evidencia y trazabilidad", description: "Esta home se concentra en lectura analítica: volumen de muestra, acierto, tiempos, mazos, consistencia de captura y señales de calidad de evidencia." },
    metrics: { games: "Partidas", turns: "Turnos", success: "Acierto general", turnTime: "Tiempo por turno", gameTime: "Tiempo por partida", decks: "Mazos activos", users: "Usuarios", profiles: "Perfiles", gamesHint: "Base actual para análisis de sesiones y comportamiento.", turnsHint: "Volumen de interacción real dentro de la muestra analizada.", successHint: "Porcentaje agregado de aciertos para lectura comparativa rápida.", turnTimeHint: "Tiempo medio de respuesta dentro de la muestra analizada.", gameTimeHint: "Duración promedio agregada por sesión.", decksHint: "Diversidad de contenido presente en la muestra.", usersHint: "Padrón que alimenta la muestra y sus cohortes.", profilesHint: "Perfiles incluidos en la lectura de evidencia actual." },
    charts: { activity: "Actividad por fecha", activityDesc: "Partidas y turnos por día para observar estabilidad o picos de la muestra analizada.", sampleDecks: "Mazos en la muestra", sampleDecksDesc: "Distribución de uso por mazo para orientar el análisis por contenido.", userTypes: "Tipos de usuario en la muestra", userTypesDesc: "Distribución de cohortes para saber desde qué tipo de cuenta se compone la evidencia.", profileCoverage: "Cobertura de perfiles", profileCoverageDesc: "Perfiles activos, con binding y con sesiones para medir madurez real de la muestra observable.", signups: "Altas y logins", signupsDesc: "Serie temporal de usuarios creados y usuarios con login para seguir formación y reactivación de la muestra.", userRecency: "Recencia del padrón", userRecencyDesc: "Agrupa usuarios por recencia de acceso para detectar rápidamente cohortes activas, tibias o inertes.", profileAge: "Perfiles por categoría", profileAgeDesc: "Segmentación etaria para leer si la muestra está sesgada hacia algún tramo puntual.", profileRecency: "Recencia de perfiles", profileRecencyDesc: "Última sesión por perfil para medir frescura real de la muestra disponible.", syncSources: "Fuentes de sync", syncSourcesDesc: "Cómo entra la evidencia y si hay dependencia de un solo canal de captura.", depth: "Cohortes de profundidad", depthDesc: "Perfiles agrupados por cantidad de sesiones para separar exploración temprana de uso sostenido.", evidence: "Alertas de calidad de evidencia", evidenceDesc: "Puntos que conviene revisar antes de sacar conclusiones sobre la muestra.", noEvidenceAlerts: "La muestra no presenta alertas fuertes de captura o consistencia." },
    error: (message) => `No pude cargar una parte del dashboard researcher: ${message}`,
  },
  en: {
    header: { eyebrow: "Research", title: "Evidence and traceability dashboard", description: "This home focuses on analytical reading: sample volume, success, timing, decks, capture consistency, and evidence quality signals." },
    metrics: { games: "Games", turns: "Turns", success: "Overall success", turnTime: "Turn time", gameTime: "Game time", decks: "Active decks", users: "Users", profiles: "Profiles", gamesHint: "Current base for session and behavior analysis.", turnsHint: "Real interaction volume inside the analyzed sample.", successHint: "Aggregate success percentage for quick comparative reading.", turnTimeHint: "Average response time within the analyzed sample.", gameTimeHint: "Average aggregated duration per session.", decksHint: "Content diversity present in the sample.", usersHint: "Roster feeding the sample and its cohorts.", profilesHint: "Profiles included in the current evidence reading." },
    charts: { activity: "Activity by date", activityDesc: "Games and turns per day to observe stability or spikes in the analyzed sample.", sampleDecks: "Decks in the sample", sampleDecksDesc: "Usage distribution by deck to orient content-level analysis.", userTypes: "User types in the sample", userTypesDesc: "Cohort distribution to understand which account types compose the evidence.", profileCoverage: "Profile coverage", profileCoverageDesc: "Active profiles, with bindings and sessions, to measure real maturity of the observable sample.", signups: "Signups and logins", signupsDesc: "Time series of created users and users with login to follow sample formation and reactivation.", userRecency: "Roster recency", userRecencyDesc: "Groups users by access recency to quickly detect active, warm, or inert cohorts.", profileAge: "Profiles by category", profileAgeDesc: "Age segmentation to see whether the sample is biased toward a specific segment.", profileRecency: "Profile recency", profileRecencyDesc: "Latest session per profile to measure the real freshness of the available sample.", syncSources: "Sync sources", syncSourcesDesc: "How evidence comes in and whether there is dependency on a single capture channel.", depth: "Depth cohorts", depthDesc: "Profiles grouped by number of sessions to separate early exploration from sustained use.", evidence: "Evidence quality alerts", evidenceDesc: "Points worth reviewing before drawing conclusions from the sample.", noEvidenceAlerts: "The sample does not show strong capture or consistency alerts." },
    error: (message) => `I couldn't load part of the researcher dashboard: ${message}`,
  },
  pt: {
    header: { eyebrow: "Pesquisa", title: "Dashboard de evidência e rastreabilidade", description: "Esta home se concentra em leitura analítica: volume da amostra, acerto, tempos, baralhos, consistência de captura e sinais de qualidade da evidência." },
    metrics: { games: "Partidas", turns: "Turnos", success: "Acerto geral", turnTime: "Tempo por turno", gameTime: "Tempo por partida", decks: "Baralhos ativos", users: "Usuários", profiles: "Perfis", gamesHint: "Base atual para análise de sessões e comportamento.", turnsHint: "Volume de interação real dentro da amostra analisada.", successHint: "Percentual agregado de acertos para leitura comparativa rápida.", turnTimeHint: "Tempo médio de resposta dentro da amostra analisada.", gameTimeHint: "Duração média agregada por sessão.", decksHint: "Diversidade de conteúdo presente na amostra.", usersHint: "Cadastro que alimenta a amostra e suas coortes.", profilesHint: "Perfis incluídos na leitura atual de evidência." },
    charts: { activity: "Atividade por data", activityDesc: "Partidas e turnos por dia para observar estabilidade ou picos da amostra analisada.", sampleDecks: "Baralhos na amostra", sampleDecksDesc: "Distribuição de uso por baralho para orientar a análise por conteúdo.", userTypes: "Tipos de usuário na amostra", userTypesDesc: "Distribuição de coortes para saber de que tipo de conta a evidência é composta.", profileCoverage: "Cobertura de perfis", profileCoverageDesc: "Perfis ativos, com binding e com sessões para medir a maturidade real da amostra observável.", signups: "Cadastros e logins", signupsDesc: "Série temporal de usuários criados e usuários com login para acompanhar formação e reativação da amostra.", userRecency: "Recência do cadastro", userRecencyDesc: "Agrupa usuários por recência de acesso para detectar rapidamente coortes ativas, mornas ou inertes.", profileAge: "Perfis por categoria", profileAgeDesc: "Segmentação etária para ver se a amostra está enviesada para algum trecho específico.", profileRecency: "Recência de perfis", profileRecencyDesc: "Última sessão por perfil para medir o frescor real da amostra disponível.", syncSources: "Fontes de sync", syncSourcesDesc: "Como a evidência entra e se há dependência de um único canal de captura.", depth: "Coortes de profundidade", depthDesc: "Perfis agrupados por quantidade de sessões para separar exploração inicial de uso sustentado.", evidence: "Alertas de qualidade da evidência", evidenceDesc: "Pontos que convém revisar antes de tirar conclusões sobre a amostra.", noEvidenceAlerts: "A amostra não apresenta alertas fortes de captura ou consistência." },
    error: (message) => `Não consegui carregar parte do dashboard researcher: ${message}`,
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

export function ResearcherDashboard() {
  const { language } = useLanguage();
  const t = researcherDashboardMessages[language];
  const localText = language === "en"
    ? {
        syncsWithoutRaw: "Syncs without raw",
        ingestionQuality: "Ingestion quality",
        mixedGames: "Mixed games",
        heterogeneousSample: "Heterogeneous sample",
        gamesWithoutTurns: "Games without turns",
        interactionGap: "Interaction gap",
        game: "Game",
        turns: (count: number) => `${count} turns`,
        datePlayers: (date: string, count: number) => `Date ${date} · ${count} players`,
        withManualLoad: "With manual load",
        standardRecord: "Standard record",
        user: "User",
        noType: "No type",
        noRole: "No role",
        login: (value: string) => `Login ${value}`,
        noLogin: "No login",
        profile: "Profile",
        sessions: (count: number) => `${count} sessions`,
        bindingsAge: (bindings: number, age: string) => `${bindings} active bindings · ${age}`,
        noCategory: "uncategorized",
        active: "Active",
        inactive: "Inactive",
        sync: "Sync",
        noStatus: "No status",
        rawRecordsDate: (count: number, date: string) => `${count} raw records · ${date}`,
        noSource: "No source",
        gameDetail: "Game detail",
        gameDetailDesc: "Current base for session and behavior analysis.",
        turnsDetail: "Turn detail",
        turnsDetailDesc: "Real interaction volume within the analyzed sample.",
        successDetail: "Overall success detail",
        successDetailDesc: "Success by game for quick comparative reading.",
        correctTurns: (ok: number, total: number) => `${ok}/${total} correct turns`,
        turnTime: "Turn time",
        turnTimeDesc: "Average response time within the analyzed sample.",
        measuredTurns: (count: number) => `${count} measured turns`,
        gameTime: "Game time",
        gameTimeDesc: "Average aggregate duration per session.",
        activeDecks: "Active decks",
        associatedGames: "Associated games",
        users: "Users",
        usersDesc: "Roster feeding the sample and its cohorts.",
        profiles: "Profiles",
        profilesDesc: "Profiles included in the current evidence view.",
        activityOf: (label: string) => `Activity on ${label}`,
        activityOfDesc: "Games that fall on the selected date.",
        deckOf: (label: string) => `Deck ${label}`,
        deckOfDesc: "Usage distribution by deck to guide content analysis.",
        noDeck: "No deck",
        userType: (label: string) => `User types · ${label}`,
        userTypeDesc: "Users within the chosen type.",
        profileCoverage: (label: string) => `Profile coverage · ${label}`,
        profileCoverageDesc: "Profiles filtered by observable maturity.",
        signupsLogins: (label: string) => `Signups and logins · ${label}`,
        signupsLoginsDesc: "Users created or logged in on the selected date.",
        rosterRecency: (label: string) => `Roster recency · ${label}`,
        rosterRecencyDesc: "Users inside the selected period.",
        profileAge: (label: string) => `Profiles by category · ${label}`,
        profileAgeDesc: "Age segmentation inside the chosen cohort.",
        profileRecency: (label: string) => `Profile recency · ${label}`,
        profileRecencyDesc: "Profiles inside the selected period.",
        syncSources: (label: string) => `Sync sources · ${label}`,
        syncSourcesDesc: "Sync sessions belonging to the selected source.",
        depthCohorts: (label: string) => `Depth cohorts · ${label}`,
        depthCohortsDesc: "Profiles grouped by number of sessions.",
        evidenceFocuses: "Incomplete traceability focuses within the sample.",
        mixedGamesDesc: "Sessions mixing manual and registered players.",
        gamesWithoutTurnsDesc: "Interaction gaps worth reviewing before analyzing the sample.",
      }
    : language === "pt"
      ? {
          syncsWithoutRaw: "Syncs sem raw",
          ingestionQuality: "Qualidade de ingestão",
          mixedGames: "Partidas mistas",
          heterogeneousSample: "Amostra heterogênea",
          gamesWithoutTurns: "Partidas sem turnos",
          interactionGap: "Vazio de interação",
          game: "Partida",
          turns: (count: number) => `${count} turnos`,
          datePlayers: (date: string, count: number) => `Data ${date} · ${count} jogadores`,
          withManualLoad: "Com carga manual",
          standardRecord: "Registro padrão",
          user: "Usuário",
          noType: "Sem tipo",
          noRole: "Sem papel",
          login: (value: string) => `Login ${value}`,
          noLogin: "Sem login",
          profile: "Perfil",
          sessions: (count: number) => `${count} sessões`,
          bindingsAge: (bindings: number, age: string) => `${bindings} bindings ativos · ${age}`,
          noCategory: "sem categoria",
          active: "Ativo",
          inactive: "Inativo",
          sync: "Sync",
          noStatus: "Sem status",
          rawRecordsDate: (count: number, date: string) => `${count} raw records · ${date}`,
          noSource: "Sem fonte",
          gameDetail: "Detalhe de partidas",
          gameDetailDesc: "Base atual para análise de sessões e comportamento.",
          turnsDetail: "Detalhe de turnos",
          turnsDetailDesc: "Volume de interação real dentro da amostra analisada.",
          successDetail: "Detalhe de acerto geral",
          successDetailDesc: "Acerto por partida para leitura comparativa rápida.",
          correctTurns: (ok: number, total: number) => `${ok}/${total} turnos corretos`,
          turnTime: "Tempo por turno",
          turnTimeDesc: "Tempo médio de resposta dentro da amostra analisada.",
          measuredTurns: (count: number) => `${count} turnos medidos`,
          gameTime: "Tempo por partida",
          gameTimeDesc: "Duração média agregada por sessão.",
          activeDecks: "Baralhos ativos",
          associatedGames: "Partidas associadas",
          users: "Usuários",
          usersDesc: "Cadastro que alimenta a amostra e suas coortes.",
          profiles: "Perfis",
          profilesDesc: "Perfis incluídos na leitura de evidência atual.",
          activityOf: (label: string) => `Atividade de ${label}`,
          activityOfDesc: "Partidas que caem na data selecionada.",
          deckOf: (label: string) => `Baralho ${label}`,
          deckOfDesc: "Distribuição de uso por baralho para orientar a análise por conteúdo.",
          noDeck: "Sem baralho",
          userType: (label: string) => `Tipos de usuário · ${label}`,
          userTypeDesc: "Usuários dentro do tipo escolhido.",
          profileCoverage: (label: string) => `Cobertura de perfis · ${label}`,
          profileCoverageDesc: "Perfis filtrados por maturidade observável.",
          signupsLogins: (label: string) => `Altas e logins · ${label}`,
          signupsLoginsDesc: "Usuários criados ou com login na data escolhida.",
          rosterRecency: (label: string) => `Recência do cadastro · ${label}`,
          rosterRecencyDesc: "Usuários dentro do período selecionado.",
          profileAge: (label: string) => `Perfis por categoria · ${label}`,
          profileAgeDesc: "Segmentação etária dentro da coorte escolhida.",
          profileRecency: (label: string) => `Recência de perfis · ${label}`,
          profileRecencyDesc: "Perfis dentro do período selecionado.",
          syncSources: (label: string) => `Fontes de sync · ${label}`,
          syncSourcesDesc: "Sessões de sync que pertencem à fonte escolhida.",
          depthCohorts: (label: string) => `Coortes de profundidade · ${label}`,
          depthCohortsDesc: "Perfis agrupados pela quantidade de sessões.",
          evidenceFocuses: "Focos de rastreabilidade incompleta dentro da amostra.",
          mixedGamesDesc: "Sessões com mistura de jogadores manuais e registrados.",
          gamesWithoutTurnsDesc: "Vazios de interação que vale revisar antes de analisar a amostra.",
        }
      : {
          syncsWithoutRaw: "Syncs sin raw",
          ingestionQuality: "Calidad de ingesta",
          mixedGames: "Partidas mixtas",
          heterogeneousSample: "Muestra heterogénea",
          gamesWithoutTurns: "Partidas sin turnos",
          interactionGap: "Vacío de interacción",
          game: "Partida",
          turns: (count: number) => `${count} turnos`,
          datePlayers: (date: string, count: number) => `Fecha ${date} · ${count} jugadores`,
          withManualLoad: "Con carga manual",
          standardRecord: "Registro estándar",
          user: "Usuario",
          noType: "Sin tipo",
          noRole: "Sin rol",
          login: (value: string) => `Login ${value}`,
          noLogin: "Sin login",
          profile: "Perfil",
          sessions: (count: number) => `${count} sesiones`,
          bindingsAge: (bindings: number, age: string) => `${bindings} bindings activos · ${age}`,
          noCategory: "sin categoría",
          active: "Activo",
          inactive: "Inactivo",
          sync: "Sync",
          noStatus: "Sin status",
          rawRecordsDate: (count: number, date: string) => `${count} raw records · ${date}`,
          noSource: "Sin fuente",
          gameDetail: "Detalle de partidas",
          gameDetailDesc: "Base actual para análisis de sesiones y comportamiento.",
          turnsDetail: "Detalle de turnos",
          turnsDetailDesc: "Volumen de interacción real dentro de la muestra analizada.",
          successDetail: "Detalle de acierto general",
          successDetailDesc: "Acierto por partida para lectura comparativa rápida.",
          correctTurns: (ok: number, total: number) => `${ok}/${total} turnos correctos`,
          turnTime: "Tiempo por turno",
          turnTimeDesc: "Tiempo medio de respuesta dentro de la muestra analizada.",
          measuredTurns: (count: number) => `${count} turnos medidos`,
          gameTime: "Tiempo por partida",
          gameTimeDesc: "Duración promedio agregada por sesión.",
          activeDecks: "Mazos activos",
          associatedGames: "Partidas asociadas",
          users: "Usuarios",
          usersDesc: "Padrón que alimenta la muestra y sus cohortes.",
          profiles: "Perfiles",
          profilesDesc: "Perfiles incluidos en la lectura de evidencia actual.",
          activityOf: (label: string) => `Actividad del ${label}`,
          activityOfDesc: "Partidas que caen en la fecha seleccionada.",
          deckOf: (label: string) => `Mazo ${label}`,
          deckOfDesc: "Distribución de uso por mazo para orientar el análisis por contenido.",
          noDeck: "Sin mazo",
          userType: (label: string) => `Tipos de usuario · ${label}`,
          userTypeDesc: "Usuarios dentro del tipo elegido.",
          profileCoverage: (label: string) => `Cobertura de perfiles · ${label}`,
          profileCoverageDesc: "Perfiles filtrados por madurez observable.",
          signupsLogins: (label: string) => `Altas y logins · ${label}`,
          signupsLoginsDesc: "Usuarios creados o con login dentro de la fecha elegida.",
          rosterRecency: (label: string) => `Recencia del padrón · ${label}`,
          rosterRecencyDesc: "Usuarios dentro del período seleccionado.",
          profileAge: (label: string) => `Perfiles por categoría · ${label}`,
          profileAgeDesc: "Segmentación etaria dentro de la cohorte elegida.",
          profileRecency: (label: string) => `Recencia de perfiles · ${label}`,
          profileRecencyDesc: "Perfiles dentro del período seleccionado.",
          syncSources: (label: string) => `Fuentes de sync · ${label}`,
          syncSourcesDesc: "Sesiones de sync que pertenecen a la fuente elegida.",
          depthCohorts: (label: string) => `Cohortes de profundidad · ${label}`,
          depthCohortsDesc: "Perfiles agrupados por cantidad de sesiones.",
          evidenceFocuses: "Focos de trazabilidad incompleta dentro de la muestra.",
          mixedGamesDesc: "Sesiones con mezcla de jugadores manuales y registrados.",
          gamesWithoutTurnsDesc: "Vacíos de interacción que conviene revisar antes de analizar la muestra.",
        };
  const { tokens } = useAuth();
  const [selectedDetail, setSelectedDetail] = useState<{ kind: string; label: string } | null>(null);
  const { getRange: getModuleRange, setRange: setModuleRange } = useDashboardModuleControls();
  const gamesQuery = useGames(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);
  const usersQuery = useUsers(tokens?.accessToken);
  const profilesQuery = useProfilesOverview(tokens?.accessToken);

  const games = useMemo(() => gamesQuery.data?.data || [], [gamesQuery.data?.data]);
  const syncs = useMemo(() => syncsQuery.data?.data || [], [syncsQuery.data?.data]);
  const users = useMemo(() => usersQuery.data?.data || [], [usersQuery.data?.data]);
  const profiles = useMemo(() => profilesQuery.data || [], [profilesQuery.data]);
  const isLoading = gamesQuery.isLoading || syncsQuery.isLoading || usersQuery.isLoading || profilesQuery.isLoading;
  const error = gamesQuery.error || syncsQuery.error || usersQuery.error || profilesQuery.error;

  const activityRange = getModuleRange("researcher-activity");
  const deckRange = getModuleRange("researcher-deck");
  const userTypeRange = getModuleRange("researcher-user-type");
  const profileCoverageRange = getModuleRange("researcher-profile-coverage");
  const userCreationRange = getModuleRange("researcher-user-creation");
  const userRecencyRange = getModuleRange("researcher-user-recency");
  const profileAgeRange = getModuleRange("researcher-profile-age");
  const profileRecencyRange = getModuleRange("researcher-profile-recency");
  const syncSourceRange = getModuleRange("researcher-sync-source");
  const profileSessionsRange = getModuleRange("researcher-profile-sessions");

  const activityGames = useMemo(
    () => filterDashboardItemsByRange(games, activityRange, (game) => getDashboardDateValue(game.startDate, game.createdAt, game.updatedAt)),
    [activityRange, games],
  );
  const deckGames = useMemo(
    () => filterDashboardItemsByRange(games, deckRange, (game) => getDashboardDateValue(game.startDate, game.createdAt, game.updatedAt)),
    [deckRange, games],
  );
  const userTypeUsers = useMemo(
    () => filterDashboardItemsByRange(users, userTypeRange, (entry) => getDashboardDateValue(entry.lastLoginAt, entry.createdAt, entry.updatedAt)),
    [userTypeRange, users],
  );
  const profileCoverageProfiles = useMemo(
    () => filterDashboardItemsByRange(profiles, profileCoverageRange, (profile) => getDashboardDateValue(profile.lastSessionAt, profile.createdAt, profile.updatedAt)),
    [profileCoverageRange, profiles],
  );
  const userCreationUsers = useMemo(
    () => filterDashboardItemsByRange(users, userCreationRange, (entry) => getDashboardDateValue(entry.createdAt, entry.lastLoginAt, entry.updatedAt)),
    [userCreationRange, users],
  );
  const userRecencyUsers = useMemo(
    () => filterDashboardItemsByRange(users, userRecencyRange, (entry) => getDashboardDateValue(entry.lastLoginAt, entry.createdAt, entry.updatedAt)),
    [userRecencyRange, users],
  );
  const profileAgeProfiles = useMemo(
    () => filterDashboardItemsByRange(profiles, profileAgeRange, (profile) => getDashboardDateValue(profile.createdAt, profile.updatedAt, profile.lastSessionAt)),
    [profileAgeRange, profiles],
  );
  const profileRecencyProfiles = useMemo(
    () => filterDashboardItemsByRange(profiles, profileRecencyRange, (profile) => getDashboardDateValue(profile.lastSessionAt, profile.createdAt, profile.updatedAt)),
    [profileRecencyRange, profiles],
  );
  const syncSourceSyncs = useMemo(
    () => filterDashboardItemsByRange(syncs, syncSourceRange, (sync) => getDashboardDateValue(sync.startedAt, sync.createdAt, sync.updatedAt, sync.receivedAt, sync.capturedAt)),
    [syncSourceRange, syncs],
  );
  const profileSessionProfiles = useMemo(
    () => filterDashboardItemsByRange(profiles, profileSessionsRange, (profile) => getDashboardDateValue(profile.lastSessionAt, profile.createdAt, profile.updatedAt)),
    [profileSessionsRange, profiles],
  );

  const totalTurns = games.reduce((sum, game) => sum + game.turns.length, 0);
  const activeDecks = new Set(games.map((game) => game.deckName).filter(Boolean)).size;
  const successRate = getSuccessRate(games);
  const averageGameTime = getAverageGameTime(games);
  const averageTurnTime = getAverageTurnTime(games);
  const activitySeries = buildGameActivitySeries(activityGames);
  const deckUsage = buildDeckUsageSeries(deckGames);
  const syncSourceSeries = buildSyncSourceSeries(syncSourceSyncs);
  const userTypeSeries = buildUserTypeSeries(userTypeUsers);
  const userCreationSeries = buildUserCreationSeries(userCreationUsers);
  const userRecencySeries = buildUserRecencySeries(userRecencyUsers);
  const profileCoverageSeries = buildProfileCoverageSeries(profileCoverageProfiles);
  const profileAgeSeries = buildProfileAgeCategorySeries(profileAgeProfiles);
  const profileRecencySeries = buildProfileRecencySeries(profileRecencyProfiles);
  const profileSessionCohorts = buildProfileSessionCohortSeries(profileSessionProfiles);
  const evidenceRows = [
    {
      label: localText.syncsWithoutRaw,
      value: String(syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) === 0).length),
      badge: localText.ingestionQuality,
    },
    {
      label: localText.mixedGames,
      value: String(
        games.filter((game) => {
          const manual = game.players.filter((player) => player.playerSource === "manual").length;
          const registered = game.players.filter((player) => player.playerSource !== "manual").length;
          return manual > 0 && registered > 0;
        }).length,
      ),
      badge: localText.heterogeneousSample,
    },
    {
      label: localText.gamesWithoutTurns,
      value: String(games.filter((game) => game.turns.length === 0).length),
      badge: localText.interactionGap,
    },
  ].filter((item) => Number(item.value) > 0);

  const detailPanel = (() => {
    if (!selectedDetail) return null;

    const gameRows = (items = games): DashboardDetailRow[] =>
      items.map((game) => ({
        label: game.deckName || `${localText.game} ${game.id}`,
        value: localText.turns(game.turns.length),
        hint: localText.datePlayers(getDateBucketLabel(game.startDate || game.createdAt || game.updatedAt), game.players.length),
        badge: game.players.some((player) => player.playerSource === "manual") ? localText.withManualLoad : localText.standardRecord,
      }));

    const userRows: DashboardDetailRow[] = users.map((entry) => ({
      label: entry.fullName || entry.email || `${localText.user} ${entry.id}`,
      value: entry.userType || localText.noType,
      hint: entry.roles.join(", ") || localText.noRole,
      badge: entry.lastLoginAt ? localText.login(getDateBucketLabel(entry.lastLoginAt)) : localText.noLogin,
    }));

    const profileRows: DashboardDetailRow[] = profiles.map((profile) => ({
      label: profile.displayName || `${localText.profile} ${profile.id}`,
      value: localText.sessions(profile.sessionCount),
      hint: localText.bindingsAge(profile.activeBindingCount, profile.ageCategory || localText.noCategory),
      badge: profile.isActive ? localText.active : localText.inactive,
    }));

    const syncRows: DashboardDetailRow[] = syncs.map((sync) => ({
      label: sync.deckName || `${localText.sync} ${sync.id}`,
      value: sync.status || localText.noStatus,
      hint: localText.rawRecordsDate(sync.rawRecordCount || sync.rawRecordIds.length || 0, getDateBucketLabel(sync.startedAt || sync.createdAt || sync.updatedAt)),
      badge: sync.source || sync.sourceType || localText.noSource,
    }));

    switch (selectedDetail.kind) {
      case "metric-games":
        return { title: localText.gameDetail, description: localText.gameDetailDesc, filterLabel: selectedDetail.label, rows: gameRows() };
      case "metric-turns":
        return { title: localText.turnsDetail, description: localText.turnsDetailDesc, filterLabel: selectedDetail.label, rows: gameRows().filter((row) => row.value !== localText.turns(0)) };
      case "metric-success":
        return {
          title: localText.successDetail,
          description: localText.successDetailDesc,
          filterLabel: selectedDetail.label,
          rows: games.map((game) => {
            const successes = game.turns.filter((turn) => turn.success).length;
            const rate = game.turns.length > 0 ? Math.round((successes / game.turns.length) * 100) : 0;
            return { label: game.deckName || `${localText.game} ${game.id}`, value: `${rate}%`, hint: localText.correctTurns(successes, game.turns.length) };
          }),
        };
      case "metric-turn-time":
        return {
          title: localText.turnTime,
          description: localText.turnTimeDesc,
          filterLabel: selectedDetail.label,
          rows: games.map((game) => ({
            label: game.deckName || `${localText.game} ${game.id}`,
            value: formatDurationSeconds(game.turns.length > 0 ? game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0) / game.turns.length : 0),
            hint: localText.measuredTurns(game.turns.length),
          })),
        };
      case "metric-game-time":
        return {
          title: localText.gameTime,
          description: localText.gameTimeDesc,
          filterLabel: selectedDetail.label,
          rows: games.map((game) => ({
            label: game.deckName || `${localText.game} ${game.id}`,
            value: formatDurationSeconds(game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0)),
            hint: localText.turns(game.turns.length),
          })),
        };
      case "metric-decks":
        return { title: localText.activeDecks, description: t.metrics.decksHint, filterLabel: selectedDetail.label, rows: deckUsage.map((item) => ({ label: item.label, value: String(item.value), hint: localText.associatedGames })) };
      case "metric-users":
        return { title: localText.users, description: localText.usersDesc, filterLabel: selectedDetail.label, rows: userRows };
      case "metric-profiles":
        return { title: localText.profiles, description: localText.profilesDesc, filterLabel: selectedDetail.label, rows: profileRows };
      case "activity-date":
        return { title: localText.activityOf(selectedDetail.label), description: localText.activityOfDesc, filterLabel: selectedDetail.label, rows: gameRows(activityGames.filter((game) => getDateBucketLabel(game.startDate || game.createdAt || game.updatedAt) === selectedDetail.label)) };
      case "deck":
        return { title: localText.deckOf(selectedDetail.label), description: localText.deckOfDesc, filterLabel: selectedDetail.label, rows: gameRows(deckGames.filter((game) => normalizeLabel(game.deckName || localText.noDeck) === normalizeLabel(selectedDetail.label))) };
      case "user-type":
        return { title: localText.userType(selectedDetail.label), description: localText.userTypeDesc, filterLabel: selectedDetail.label, rows: userTypeUsers.map((entry) => ({ label: entry.fullName || entry.email || `${localText.user} ${entry.id}`, value: entry.userType || localText.noType, hint: entry.roles.join(", ") || localText.noRole, badge: entry.lastLoginAt ? localText.login(getDateBucketLabel(entry.lastLoginAt)) : localText.noLogin })).filter((row) => normalizeLabel(row.value) === normalizeLabel(selectedDetail.label)) };
      case "profile-coverage": {
        const normalized = normalizeLabel(selectedDetail.label);
        return {
          title: localText.profileCoverage(selectedDetail.label),
          description: localText.profileCoverageDesc,
          filterLabel: selectedDetail.label,
          rows: profileCoverageProfiles.map((profile) => ({ label: profile.displayName || `${localText.profile} ${profile.id}`, value: localText.sessions(profile.sessionCount), hint: localText.bindingsAge(profile.activeBindingCount, profile.ageCategory || localText.noCategory), badge: profile.isActive ? localText.active : localText.inactive })).filter((row, index) => {
            const profile = profileCoverageProfiles[index];
            if (normalized.includes("activos") || normalized.includes("active") || normalized.includes("ativos")) return profile.isActive;
            if ((normalized.includes("binding") || normalized.includes("bindings")) && !normalized.includes("sin") && !normalized.includes("without") && !normalized.includes("sem")) return profile.activeBindingCount > 0;
            if (normalized.includes("sesiones") || normalized.includes("sessions") || normalized.includes("sessões")) return profile.sessionCount > 0;
            if (normalized.includes("sin binding") || normalized.includes("without binding") || normalized.includes("sem binding")) return profile.activeBindingCount === 0;
            return false;
          }),
        };
      }
      case "user-creation-date":
        return {
          title: localText.signupsLogins(selectedDetail.label),
          description: localText.signupsLoginsDesc,
          filterLabel: selectedDetail.label,
          rows: userCreationUsers.map((entry) => ({ label: entry.fullName || entry.email || `${localText.user} ${entry.id}`, value: entry.userType || localText.noType, hint: entry.roles.join(", ") || localText.noRole, badge: entry.lastLoginAt ? localText.login(getDateBucketLabel(entry.lastLoginAt)) : localText.noLogin })).filter((row, index) => {
            const userRecord = userCreationUsers[index];
            return getDateBucketLabel(userRecord?.createdAt || userRecord?.lastLoginAt) === selectedDetail.label
              || getDateBucketLabel(userRecord?.lastLoginAt) === selectedDetail.label;
          }),
        };
      case "user-recency":
        return { title: localText.rosterRecency(selectedDetail.label), description: localText.rosterRecencyDesc, filterLabel: selectedDetail.label, rows: userRecencyUsers.map((entry) => ({ label: entry.fullName || entry.email || `${localText.user} ${entry.id}`, value: entry.userType || localText.noType, hint: entry.roles.join(", ") || localText.noRole, badge: entry.lastLoginAt ? localText.login(getDateBucketLabel(entry.lastLoginAt)) : localText.noLogin })).filter((row, index) => matchesRecencyLabel(selectedDetail.label, userRecencyUsers[index]?.lastLoginAt)) };
      case "profile-age":
        return { title: localText.profileAge(selectedDetail.label), description: localText.profileAgeDesc, filterLabel: selectedDetail.label, rows: profileAgeProfiles.map((profile) => ({ label: profile.displayName || `${localText.profile} ${profile.id}`, value: localText.sessions(profile.sessionCount), hint: localText.bindingsAge(profile.activeBindingCount, profile.ageCategory || localText.noCategory), badge: profile.isActive ? localText.active : localText.inactive })).filter((row, index) => normalizeLabel(profileAgeProfiles[index]?.ageCategory || localText.noCategory) === normalizeLabel(selectedDetail.label)) };
      case "profile-recency":
        return { title: localText.profileRecency(selectedDetail.label), description: localText.profileRecencyDesc, filterLabel: selectedDetail.label, rows: profileRecencyProfiles.map((profile) => ({ label: profile.displayName || `${localText.profile} ${profile.id}`, value: localText.sessions(profile.sessionCount), hint: localText.bindingsAge(profile.activeBindingCount, profile.ageCategory || localText.noCategory), badge: profile.isActive ? localText.active : localText.inactive })).filter((row, index) => matchesRecencyLabel(selectedDetail.label, profileRecencyProfiles[index]?.lastSessionAt)) };
      case "sync-source":
        return { title: localText.syncSources(selectedDetail.label), description: localText.syncSourcesDesc, filterLabel: selectedDetail.label, rows: syncSourceSyncs.map((sync) => ({ label: sync.deckName || `${localText.sync} ${sync.id}`, value: sync.status || localText.noStatus, hint: localText.rawRecordsDate(sync.rawRecordCount || sync.rawRecordIds.length || 0, getDateBucketLabel(sync.startedAt || sync.createdAt || sync.updatedAt)), badge: sync.source || sync.sourceType || localText.noSource })).filter((row) => normalizeLabel(row.badge) === normalizeLabel(selectedDetail.label)) };
      case "profile-sessions": {
        const normalized = normalizeLabel(selectedDetail.label);
        return {
          title: localText.depthCohorts(selectedDetail.label),
          description: localText.depthCohortsDesc,
          filterLabel: selectedDetail.label,
          rows: profileSessionProfiles.map((profile) => ({ label: profile.displayName || `${localText.profile} ${profile.id}`, value: localText.sessions(profile.sessionCount), hint: localText.bindingsAge(profile.activeBindingCount, profile.ageCategory || localText.noCategory), badge: profile.isActive ? localText.active : localText.inactive })).filter((row, index) => {
            const count = profileSessionProfiles[index]?.sessionCount || 0;
            if (normalized.includes("sin sesiones") || normalized.includes("without sessions") || normalized.includes("sem sessões")) return count <= 0;
            if (normalized.includes("1 3 sesiones") || normalized.includes("1/3 sesiones") || normalized.includes("1 3 sessions") || normalized.includes("1/3 sessions") || normalized.includes("1 3 sessões") || normalized.includes("1/3 sessões")) return count >= 1 && count <= 3;
            if (normalized.includes("4 10 sesiones") || normalized.includes("4/10 sesiones") || normalized.includes("4 10 sessions") || normalized.includes("4/10 sessions") || normalized.includes("4 10 sessões") || normalized.includes("4/10 sessões")) return count >= 4 && count <= 10;
            if (normalized.includes("11+ sesiones") || normalized.includes("11+ sessions") || normalized.includes("11+ sessões")) return count >= 11;
            return false;
          }),
        };
      }
      case "evidence": {
        const normalized = normalizeLabel(selectedDetail.label);
        if (normalized.includes("syncs sin raw") || normalized.includes("syncs without raw") || normalized.includes("syncs sem raw")) return { title: localText.syncsWithoutRaw, description: localText.evidenceFocuses, filterLabel: selectedDetail.label, rows: syncRows.filter((row, index) => (syncs[index]?.rawRecordCount || syncs[index]?.rawRecordIds.length || 0) === 0) };
        if (normalized.includes("partidas mixtas") || normalized.includes("mixed games") || normalized.includes("partidas mistas")) return { title: localText.mixedGames, description: localText.mixedGamesDesc, filterLabel: selectedDetail.label, rows: gameRows(games.filter((game) => {
          const manual = game.players.filter((player) => player.playerSource === "manual").length;
          const registered = game.players.filter((player) => player.playerSource !== "manual").length;
          return manual > 0 && registered > 0;
        })) };
        return { title: localText.gamesWithoutTurns, description: localText.gamesWithoutTurnsDesc, filterLabel: selectedDetail.label, rows: gameRows(games.filter((game) => game.turns.length === 0)) };
      }
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={t.header.eyebrow}
        title={t.header.title}
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
        <DashboardMetricCard label={t.metrics.games} value={String(gamesQuery.data?.total || games.length)} hint={t.metrics.gamesHint} icon={Database} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-games", label: t.metrics.games })} isActive={selectedDetail?.kind === "metric-games"} />
        <DashboardMetricCard label={t.metrics.turns} value={String(totalTurns)} hint={t.metrics.turnsHint} icon={Layers3} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-turns", label: t.metrics.turns })} isActive={selectedDetail?.kind === "metric-turns"} />
        <DashboardMetricCard label={t.metrics.success} value={`${successRate}%`} hint={t.metrics.successHint} icon={BookOpen} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-success", label: t.metrics.success })} isActive={selectedDetail?.kind === "metric-success"} />
        <DashboardMetricCard label={t.metrics.turnTime} value={formatDurationSeconds(averageTurnTime)} hint={t.metrics.turnTimeHint} icon={TimerReset} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-turn-time", label: t.metrics.turnTime })} isActive={selectedDetail?.kind === "metric-turn-time"} />
        <DashboardMetricCard label={t.metrics.gameTime} value={formatDurationSeconds(averageGameTime)} hint={t.metrics.gameTimeHint} icon={SearchCheck} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-game-time", label: t.metrics.gameTime })} isActive={selectedDetail?.kind === "metric-game-time"} />
        <DashboardMetricCard label={t.metrics.decks} value={String(activeDecks)} hint={t.metrics.decksHint} icon={Target} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-decks", label: t.metrics.decks })} isActive={selectedDetail?.kind === "metric-decks"} />
        <DashboardMetricCard label={t.metrics.users} value={String(usersQuery.data?.total || users.length)} hint={t.metrics.usersHint} icon={Database} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-users", label: t.metrics.users })} isActive={selectedDetail?.kind === "metric-users"} />
        <DashboardMetricCard label={t.metrics.profiles} value={String(profiles.length)} hint={t.metrics.profilesHint} icon={Layers3} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-profiles", label: t.metrics.profiles })} isActive={selectedDetail?.kind === "metric-profiles"} />
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
          onRangeChange={(range) => setModuleRange("researcher-activity", range)}
          csvFileName={`researcher-dashboard-actividad-${activityRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "activity-date", label })}
          activeDatumLabel={selectedDetail?.kind === "activity-date" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.sampleDecks}
          description={t.charts.sampleDecksDesc}
          data={deckUsage}
          range={deckRange}
          onRangeChange={(range) => setModuleRange("researcher-deck", range)}
          csvFileName={`researcher-dashboard-mazos-${deckRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "deck", label })}
          activeDatumLabel={selectedDetail?.kind === "deck" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title={t.charts.userTypes}
          description={t.charts.userTypesDesc}
          data={userTypeSeries}
          range={userTypeRange}
          onRangeChange={(range) => setModuleRange("researcher-user-type", range)}
          csvFileName={`researcher-dashboard-tipos-usuario-${userTypeRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-type", label })}
          activeDatumLabel={selectedDetail?.kind === "user-type" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.profileCoverage}
          description={t.charts.profileCoverageDesc}
          data={profileCoverageSeries}
          range={profileCoverageRange}
          onRangeChange={(range) => setModuleRange("researcher-profile-coverage", range)}
          csvFileName={`researcher-dashboard-cobertura-perfiles-${profileCoverageRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-coverage", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-coverage" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardLineChartCard
          title={t.charts.signups}
          description={t.charts.signupsDesc}
          data={userCreationSeries}
          range={userCreationRange}
          onRangeChange={(range) => setModuleRange("researcher-user-creation", range)}
          csvFileName={`researcher-dashboard-altas-logins-${userCreationRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-creation-date", label })}
          activeDatumLabel={selectedDetail?.kind === "user-creation-date" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.userRecency}
          description={t.charts.userRecencyDesc}
          data={userRecencySeries}
          range={userRecencyRange}
          onRangeChange={(range) => setModuleRange("researcher-user-recency", range)}
          csvFileName={`researcher-dashboard-recencia-usuarios-${userRecencyRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-recency", label })}
          activeDatumLabel={selectedDetail?.kind === "user-recency" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title={t.charts.profileAge}
          description={t.charts.profileAgeDesc}
          data={profileAgeSeries}
          range={profileAgeRange}
          onRangeChange={(range) => setModuleRange("researcher-profile-age", range)}
          csvFileName={`researcher-dashboard-perfiles-por-categoria-${profileAgeRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-age", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-age" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.profileRecency}
          description={t.charts.profileRecencyDesc}
          data={profileRecencySeries}
          range={profileRecencyRange}
          onRangeChange={(range) => setModuleRange("researcher-profile-recency", range)}
          csvFileName={`researcher-dashboard-recencia-perfiles-${profileRecencyRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-recency", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-recency" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title={t.charts.syncSources}
          description={t.charts.syncSourcesDesc}
          data={syncSourceSeries}
          range={syncSourceRange}
          onRangeChange={(range) => setModuleRange("researcher-sync-source", range)}
          csvFileName={`researcher-dashboard-fuentes-sync-${syncSourceRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "sync-source", label })}
          activeDatumLabel={selectedDetail?.kind === "sync-source" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.depth}
          description={t.charts.depthDesc}
          data={profileSessionCohorts}
          range={profileSessionsRange}
          onRangeChange={(range) => setModuleRange("researcher-profile-sessions", range)}
          csvFileName={`researcher-dashboard-cohortes-profundidad-${profileSessionsRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-sessions", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-sessions" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardTopListCard
          title={t.charts.evidence}
          description={t.charts.evidenceDesc}
          items={evidenceRows}
          emptyLabel={t.charts.noEvidenceAlerts}
          onItemSelect={(label) => setSelectedDetail({ kind: "evidence", label })}
          activeItemLabel={selectedDetail?.kind === "evidence" ? selectedDetail.label : null}
        />
      </div>
    </div>
  );
}
