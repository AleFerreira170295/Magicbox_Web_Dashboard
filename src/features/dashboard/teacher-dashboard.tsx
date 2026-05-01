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
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";
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

const teacherDashboardMessages: Record<AppLanguage, {
  header: { eyebrow: string; title: string; description: string };
  metrics: { games: string; turns: string; success: string; turnTime: string; gameTime: string; devices: string; users: string; profiles: string; gamesHint: string; turnsHint: string; successHint: string; turnTimeHint: string; gameTimeHint: string; devicesHint: string; usersHint: string; profilesHint: string };
  charts: { activity: string; activityDesc: string; decks: string; decksDesc: string; usersByRole: string; usersByRoleDesc: string; profileCoverage: string; profileCoverageDesc: string; userRecency: string; userRecencyDesc: string; profileAge: string; profileAgeDesc: string; syncSources: string; syncSourcesDesc: string; profileRecency: string; profileRecencyDesc: string; todayFocus: string; todayFocusDesc: string; noAlerts: string };
  error: (message: string) => string;
}> = {
  es: {
    header: { eyebrow: "Docente", title: "Dashboard analítico del aula", description: "Esta home deja de ser una portada y pasa a ser un tablero de lectura rápida: actividad, acierto, tiempos, mazos usados, sincronización y señales claras para intervenir." },
    metrics: { games: "Partidas", turns: "Turnos jugados", success: "Acierto general", turnTime: "Tiempo promedio por turno", gameTime: "Duración promedio por partida", devices: "Dispositivos", users: "Usuarios", profiles: "Perfiles", gamesHint: "Volumen total de sesiones registradas en el contexto docente.", turnsHint: "Interacciones reales registradas en la muestra.", successHint: "Porcentaje de turnos correctos para lectura rápida de desempeño.", turnTimeHint: "Señal simple de ritmo de respuesta y carga cognitiva.", gameTimeHint: "Tiempo acumulado por sesión usando los turnos registrados.", devicesHint: "Parque disponible para operar la jornada.", usersHint: "Padrón docente o institucional asociado a esta vista.", profilesHint: "Perfiles o estudiantes que ya aparecen en la lectura del aula." },
    charts: { activity: "Actividad reciente", activityDesc: "Cruza partidas y turnos por fecha para ver si la jornada viene cargada, plana o con caídas puntuales.", decks: "Mazos más usados", decksDesc: "Qué contenidos aparecen más en la actividad del aula.", usersByRole: "Usuarios por rol", usersByRoleDesc: "Cómo se reparte hoy la actividad entre los tipos de usuario que participan de la experiencia.", profileCoverage: "Cobertura de perfiles", profileCoverageDesc: "Lectura rápida de perfiles activos, con binding y con sesiones reales dentro del aula.", userRecency: "Recencia del padrón", userRecencyDesc: "Qué parte de los usuarios tuvo login reciente y qué parte sigue fría o sin señales de acceso.", profileAge: "Perfiles por categoría", profileAgeDesc: "Cohortes por categoría etaria para entender rápidamente a qué tramo del aula responde más la actividad.", syncSources: "Fuentes de sincronización", syncSourcesDesc: "Cómo está entrando la actividad: útil para detectar dependencia de una sola fuente o huecos de captura.", profileRecency: "Recencia de perfiles", profileRecencyDesc: "Qué tan recientes son las últimas sesiones por perfil para detectar cohortes activas, tibias o inactivas.", todayFocus: "Qué conviene mirar hoy", todayFocusDesc: "Alertas priorizadas para no tener que entrar a ciegas a cada módulo.", noAlerts: "No aparecen alertas fuertes ahora mismo. La actividad se ve razonablemente sana." },
    error: (message) => `No pude cargar una parte del dashboard docente: ${message}`,
  },
  en: {
    header: { eyebrow: "Teacher", title: "Classroom analytics dashboard", description: "This home stops being a cover and becomes a quick-read board: activity, success, timing, deck usage, sync, and clear intervention signals." },
    metrics: { games: "Games", turns: "Played turns", success: "Overall success", turnTime: "Average turn time", gameTime: "Average game duration", devices: "Devices", users: "Users", profiles: "Profiles", gamesHint: "Total session volume recorded in the teacher context.", turnsHint: "Real interactions recorded in the sample.", successHint: "Percentage of correct turns for quick performance reading.", turnTimeHint: "Simple signal of response pace and cognitive load.", gameTimeHint: "Accumulated time per session using recorded turns.", devicesHint: "Available fleet to run the day.", usersHint: "Teacher or institutional roster linked to this view.", profilesHint: "Profiles or students already appearing in the classroom reading." },
    charts: { activity: "Recent activity", activityDesc: "Crosses games and turns by date to see whether the day is busy, flat, or dropping at specific points.", decks: "Most used decks", decksDesc: "Which content appears most in classroom activity.", usersByRole: "Users by role", usersByRoleDesc: "How activity is distributed today among the user types taking part in the experience.", profileCoverage: "Profile coverage", profileCoverageDesc: "Quick read of active profiles, with bindings and real sessions inside the classroom.", userRecency: "Roster recency", userRecencyDesc: "Which users logged in recently and which ones remain cold or without access signals.", profileAge: "Profiles by category", profileAgeDesc: "Cohorts by age category to quickly understand which classroom segment responds most.", syncSources: "Sync sources", syncSourcesDesc: "How activity is coming in: useful to detect dependency on a single source or capture gaps.", profileRecency: "Profile recency", profileRecencyDesc: "How recent the last sessions are by profile to detect active, warm, or inactive cohorts.", todayFocus: "What deserves attention today", todayFocusDesc: "Prioritized alerts so you don't have to enter each module blindly.", noAlerts: "No strong alerts appear right now. Activity looks reasonably healthy." },
    error: (message) => `I couldn't load part of the teacher dashboard: ${message}`,
  },
  pt: {
    header: { eyebrow: "Docente", title: "Dashboard analítico da sala", description: "Esta home deixa de ser uma capa e vira um painel de leitura rápida: atividade, acerto, tempos, baralhos usados, sincronização e sinais claros para intervir." },
    metrics: { games: "Partidas", turns: "Turnos jogados", success: "Acerto geral", turnTime: "Tempo médio por turno", gameTime: "Duração média por partida", devices: "Dispositivos", users: "Usuários", profiles: "Perfis", gamesHint: "Volume total de sessões registradas no contexto docente.", turnsHint: "Interações reais registradas na amostra.", successHint: "Percentual de turnos corretos para leitura rápida de desempenho.", turnTimeHint: "Sinal simples de ritmo de resposta e carga cognitiva.", gameTimeHint: "Tempo acumulado por sessão usando os turnos registrados.", devicesHint: "Parque disponível para operar a jornada.", usersHint: "Cadastro docente ou institucional associado a esta visão.", profilesHint: "Perfis ou estudantes que já aparecem na leitura da sala." },
    charts: { activity: "Atividade recente", activityDesc: "Cruza partidas e turnos por data para ver se a jornada vem carregada, plana ou com quedas pontuais.", decks: "Baralhos mais usados", decksDesc: "Quais conteúdos aparecem mais na atividade da sala.", usersByRole: "Usuários por papel", usersByRoleDesc: "Como a atividade se distribui hoje entre os tipos de usuário que participam da experiência.", profileCoverage: "Cobertura de perfis", profileCoverageDesc: "Leitura rápida de perfis ativos, com binding e com sessões reais dentro da sala.", userRecency: "Recência do cadastro", userRecencyDesc: "Que parte dos usuários teve login recente e que parte segue fria ou sem sinais de acesso.", profileAge: "Perfis por categoria", profileAgeDesc: "Coortes por categoria etária para entender rapidamente a que faixa da sala a atividade responde mais.", syncSources: "Fontes de sincronização", syncSourcesDesc: "Como a atividade está entrando: útil para detectar dependência de uma única fonte ou lacunas de captura.", profileRecency: "Recência de perfis", profileRecencyDesc: "Quão recentes são as últimas sessões por perfil para detectar coortes ativas, mornas ou inativas.", todayFocus: "O que convém olhar hoje", todayFocusDesc: "Alertas priorizados para não precisar entrar às cegas em cada módulo.", noAlerts: "Não aparecem alertas fortes agora. A atividade parece razoavelmente saudável." },
    error: (message) => `Não consegui carregar parte do dashboard docente: ${message}`,
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

  if (diffDays == null) {
    return normalized.includes("sin") || normalized.includes("without") || normalized.includes("sem");
  }

  if (normalized.includes("7 días") || normalized.includes("7 days") || normalized.includes("7 dias")) return diffDays <= 7;
  if (normalized.includes("8 30 días") || normalized.includes("8/30 días") || normalized.includes("8 30 days") || normalized.includes("8/30 days") || normalized.includes("8 30 dias") || normalized.includes("8/30 dias")) return diffDays > 7 && diffDays <= 30;
  if (normalized.includes("31 90 días") || normalized.includes("31/90 días") || normalized.includes("31 90 days") || normalized.includes("31/90 days") || normalized.includes("31 90 dias") || normalized.includes("31/90 dias")) return diffDays > 30 && diffDays <= 90;
  if (normalized.includes("> 90 días") || normalized.includes("> 90 days") || normalized.includes("> 90 dias")) return diffDays > 90;

  return false;
}

function getDashboardDateValue(...values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(value)) || null;
}

export function TeacherDashboard() {
  const { language } = useLanguage();
  const t = teacherDashboardMessages[language];
  const localText = language === "en"
    ? {
        gamesWithoutTurns: "Games without turns",
        reviewIncompleteSession: "Review incomplete session",
        devicesWithoutStatus: "Devices without status",
        suggestedTechnicalCheck: "Suggested technical check",
        syncsWithoutRaw: "Syncs without raw",
        evidenceCoverage: "Evidence coverage",
        game: "Game",
        sync: "Sync",
        turns: (count: number) => `${count} turns`,
        dateDuration: (date: string, duration: string) => `Date ${date} · duration ${duration}`,
        withActivity: "With activity",
        withoutTurns: "Without turns",
        device: "Device",
        noStatus: "No status",
        noOwner: "No assigned owner",
        unassigned: "unassigned",
        user: "User",
        noRole: "No role",
        noEmail: "No recorded email",
        login: (label: string) => `Login ${label}`,
        noLogin: "No login",
        profile: "Profile",
        sessions: (count: number) => `${count} sessions`,
        bindingsAge: (count: number, age: string) => `${count} active bindings · ${age}`,
        noCategory: "uncategorized",
        active: "Active",
        inactive: "Inactive",
        gameDetail: "Game detail",
        gameDetailDesc: "Sessions recorded in the teaching context.",
        turnsDetail: "Played turns detail",
        turnsDetailDesc: "Breakdown by game to see where interaction is concentrated.",
        successDetail: "Overall success detail",
        successDetailDesc: "Success by game to move from the aggregate to the concrete case.",
        correctTurns: (ok: number, total: number) => `${ok}/${total} correct turns`,
        turnTimeDetail: "Turn time detail",
        turnTimeDetailDesc: "Average by game to detect faster or slower rhythms.",
        measuredTurns: (count: number) => `${count} measured turns`,
        gameDurationDetail: "Game duration detail",
        gameDurationDetailDesc: "Accumulated time per session using the sum of recorded turns.",
        devicesDetail: "Device detail",
        devicesDetailDesc: "Status and assigned owner for the teaching device pool.",
        usersDetail: "User detail",
        usersDetailDesc: "Who is participating today and with which roles.",
        profilesDetail: "Profile detail",
        profilesDetailDesc: "Profiles available with activity and binding.",
        activityOf: (label: string) => `Activity on ${label}`,
        activityOfDesc: "Games that fall on the selected chart date.",
        deckDetail: (label: string) => `Deck detail ${label}`,
        deckDetailDesc: "Games linked to the selected content.",
        usersWithRole: (label: string) => `Users with role ${label}`,
        usersWithRoleDesc: "Roster filtered by the role chosen in the chart.",
        profileCoverage: (label: string) => `Profile coverage · ${label}`,
        profileCoverageDesc: "Profiles that fall within the selected segment.",
        userRecency: (label: string) => `User recency · ${label}`,
        userRecencyDesc: "Users that match the selected period.",
        profileAge: (label: string) => `Profiles by category · ${label}`,
        profileAgeDesc: "Profiles inside the chosen cohort.",
        noDeck: "No deck",
        syncSources: (label: string) => `Sync sources · ${label}`,
        syncSourcesDesc: "Sync sessions that belong to the chosen source.",
        rawRecordsDate: (count: number, date: string) => `${count} raw records · ${date}`,
        noDevice: "no device",
        profileRecency: (label: string) => `Profile recency · ${label}`,
        profileRecencyDesc: "Profiles inside the selected period.",
        gamesWithoutTurnsDesc: "Sessions worth reviewing because they show no interaction.",
        devicesWithoutStatusDesc: "Devices that need a technical check or status update.",
        syncsWithoutRawDesc: "Sync sessions without raw evidence available.",
        source: (value: string) => `Source ${value}`,
        unknown: "unknown",
      }
    : language === "pt"
      ? {
          gamesWithoutTurns: "Partidas sem turnos",
          reviewIncompleteSession: "Revisar sessão incompleta",
          devicesWithoutStatus: "Dispositivos sem status",
          suggestedTechnicalCheck: "Verificação técnica sugerida",
          syncsWithoutRaw: "Syncs sem raw",
          evidenceCoverage: "Cobertura de evidência",
          game: "Partida",
          sync: "Sync",
          turns: (count: number) => `${count} turnos`,
          dateDuration: (date: string, duration: string) => `Data ${date} · duração ${duration}`,
          withActivity: "Com atividade",
          withoutTurns: "Sem turnos",
          device: "Dispositivo",
          noStatus: "Sem status",
          noOwner: "Sem responsável atribuído",
          unassigned: "sem atribuição",
          user: "Usuário",
          noRole: "Sem papel",
          noEmail: "Sem email registrado",
          login: (label: string) => `Login ${label}`,
          noLogin: "Sem login",
          profile: "Perfil",
          sessions: (count: number) => `${count} sessões`,
          bindingsAge: (count: number, age: string) => `${count} bindings ativos · ${age}`,
          noCategory: "sem categoria",
          active: "Ativo",
          inactive: "Inativo",
          gameDetail: "Detalhe de partidas",
          gameDetailDesc: "Sessões registradas no contexto docente.",
          turnsDetail: "Detalhe de turnos jogados",
          turnsDetailDesc: "Desdobramento por partida para ver onde a interação se concentra.",
          successDetail: "Detalhe de acerto geral",
          successDetailDesc: "Acerto por partida para descer do agregado ao caso concreto.",
          correctTurns: (ok: number, total: number) => `${ok}/${total} turnos corretos`,
          turnTimeDetail: "Detalhe de tempo por turno",
          turnTimeDetailDesc: "Média por partida para detectar ritmos mais altos ou mais lentos.",
          measuredTurns: (count: number) => `${count} turnos medidos`,
          gameDurationDetail: "Detalhe de duração por partida",
          gameDurationDetailDesc: "Tempo acumulado por sessão usando a soma dos turnos registrados.",
          devicesDetail: "Detalhe de dispositivos",
          devicesDetailDesc: "Status e responsável atribuído para o parque docente.",
          usersDetail: "Detalhe de usuários",
          usersDetailDesc: "Quem participa hoje e com quais papéis.",
          profilesDetail: "Detalhe de perfis",
          profilesDetailDesc: "Perfis disponíveis com atividade e binding.",
          activityOf: (label: string) => `Atividade de ${label}`,
          activityOfDesc: "Partidas que caem na data selecionada do gráfico.",
          deckDetail: (label: string) => `Detalhe do baralho ${label}`,
          deckDetailDesc: "Partidas associadas ao conteúdo selecionado.",
          usersWithRole: (label: string) => `Usuários com papel ${label}`,
          usersWithRoleDesc: "Cadastro filtrado segundo o papel escolhido no gráfico.",
          profileCoverage: (label: string) => `Cobertura de perfis · ${label}`,
          profileCoverageDesc: "Perfis que caem dentro do segmento selecionado.",
          userRecency: (label: string) => `Recência de usuários · ${label}`,
          userRecencyDesc: "Usuários que coincidem com o período selecionado.",
          profileAge: (label: string) => `Perfis por categoria · ${label}`,
          profileAgeDesc: "Perfis dentro da coorte escolhida.",
          noDeck: "Sem baralho",
          syncSources: (label: string) => `Fontes de sincronização · ${label}`,
          syncSourcesDesc: "Sessões de sync que pertencem à fonte escolhida.",
          rawRecordsDate: (count: number, date: string) => `${count} raw records · ${date}`,
          noDevice: "sem dispositivo",
          profileRecency: (label: string) => `Recência de perfis · ${label}`,
          profileRecencyDesc: "Perfis dentro do período selecionado.",
          gamesWithoutTurnsDesc: "Sessões que vale revisar porque não mostram interação.",
          devicesWithoutStatusDesc: "Equipamentos que precisam de verificação técnica ou atualização de status.",
          syncsWithoutRawDesc: "Sincronizações sem evidência crua disponível.",
          source: (value: string) => `Fonte ${value}`,
          unknown: "desconhecida",
        }
      : {
          gamesWithoutTurns: "Partidas sin turnos",
          reviewIncompleteSession: "Revisar sesión incompleta",
          devicesWithoutStatus: "Dispositivos sin status",
          suggestedTechnicalCheck: "Chequeo técnico sugerido",
          syncsWithoutRaw: "Syncs sin raw",
          evidenceCoverage: "Cobertura de evidencia",
          game: "Partida",
          sync: "Sync",
          turns: (count: number) => `${count} turnos`,
          dateDuration: (date: string, duration: string) => `Fecha ${date} · duración ${duration}`,
          withActivity: "Con actividad",
          withoutTurns: "Sin turnos",
          device: "Dispositivo",
          noStatus: "Sin status",
          noOwner: "Sin owner asignado",
          unassigned: "sin asignación",
          user: "Usuario",
          noRole: "Sin rol",
          noEmail: "Sin email registrado",
          login: (label: string) => `Login ${label}`,
          noLogin: "Sin login",
          profile: "Perfil",
          sessions: (count: number) => `${count} sesiones`,
          bindingsAge: (count: number, age: string) => `${count} bindings activos · ${age}`,
          noCategory: "sin categoría",
          active: "Activo",
          inactive: "Inactivo",
          gameDetail: "Detalle de partidas",
          gameDetailDesc: "Sesiones registradas en el contexto docente.",
          turnsDetail: "Detalle de turnos jugados",
          turnsDetailDesc: "Desglose por partida para ver dónde está concentrada la interacción.",
          successDetail: "Detalle de acierto general",
          successDetailDesc: "Acierto por partida para bajar del agregado al caso concreto.",
          correctTurns: (ok: number, total: number) => `${ok}/${total} turnos correctos`,
          turnTimeDetail: "Detalle de tiempo por turno",
          turnTimeDetailDesc: "Promedio por partida para detectar ritmos más altos o más lentos.",
          measuredTurns: (count: number) => `${count} turnos medidos`,
          gameDurationDetail: "Detalle de duración por partida",
          gameDurationDetailDesc: "Tiempo acumulado por sesión usando la suma de turnos registrados.",
          devicesDetail: "Detalle de dispositivos",
          devicesDetailDesc: "Estado y owner asignado para el parque docente.",
          usersDetail: "Detalle de usuarios",
          usersDetailDesc: "Quiénes participan hoy y con qué roles.",
          profilesDetail: "Detalle de perfiles",
          profilesDetailDesc: "Perfiles disponibles con actividad y binding.",
          activityOf: (label: string) => `Actividad del ${label}`,
          activityOfDesc: "Partidas que caen en la fecha seleccionada del gráfico.",
          deckDetail: (label: string) => `Detalle del mazo ${label}`,
          deckDetailDesc: "Partidas asociadas al contenido seleccionado.",
          usersWithRole: (label: string) => `Usuarios con rol ${label}`,
          usersWithRoleDesc: "Padrón filtrado según el rol elegido en la gráfica.",
          profileCoverage: (label: string) => `Cobertura de perfiles · ${label}`,
          profileCoverageDesc: "Perfiles que caen dentro del segmento seleccionado.",
          userRecency: (label: string) => `Recencia de usuarios · ${label}`,
          userRecencyDesc: "Usuarios que coinciden con el período seleccionado.",
          profileAge: (label: string) => `Perfiles por categoría · ${label}`,
          profileAgeDesc: "Perfiles dentro de la cohorte elegida.",
          noDeck: "Sin mazo",
          syncSources: (label: string) => `Fuentes de sincronización · ${label}`,
          syncSourcesDesc: "Sesiones de sync que pertenecen a la fuente elegida.",
          rawRecordsDate: (count: number, date: string) => `${count} raw records · ${date}`,
          noDevice: "sin device",
          profileRecency: (label: string) => `Recencia de perfiles · ${label}`,
          profileRecencyDesc: "Perfiles dentro del período seleccionado.",
          gamesWithoutTurnsDesc: "Sesiones que conviene revisar porque no muestran interacción.",
          devicesWithoutStatusDesc: "Equipos que necesitan chequeo técnico o actualización de estado.",
          syncsWithoutRawDesc: "Sincronizaciones sin evidencia cruda disponible.",
          source: (value: string) => `Fuente ${value}`,
          unknown: "desconocida",
        };
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
      label: localText.gamesWithoutTurns,
      value: String(games.filter((game) => game.turns.length === 0).length),
      badge: localText.reviewIncompleteSession,
    },
    {
      label: localText.devicesWithoutStatus,
      value: String(devices.filter((device) => !device.status).length),
      badge: localText.suggestedTechnicalCheck,
    },
    {
      label: localText.syncsWithoutRaw,
      value: String(syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) === 0).length),
      badge: localText.evidenceCoverage,
    },
  ].filter((item) => Number(item.value) > 0);

  const detailPanel = (() => {
    if (!selectedDetail) return null;

    const gameRows = (items = games): DashboardDetailRow[] =>
      items.map((game) => {
        const totalDuration = game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0);
        return {
          label: game.deckName || `${localText.game} ${game.id}`,
          value: localText.turns(game.turns.length),
          hint: localText.dateDuration(getDateBucketLabel(game.startDate || game.createdAt || game.updatedAt), formatDurationSeconds(totalDuration)),
          badge: game.turns.length > 0 ? localText.withActivity : localText.withoutTurns,
        };
      });

    const deviceRows = devices.map((device) => ({
      label: device.name || device.deviceId || `${localText.device} ${device.id}`,
      value: device.status || localText.noStatus,
      hint: device.ownerUserName || device.ownerUserEmail || localText.noOwner,
      badge: device.assignmentScope || localText.unassigned,
    }));

    const userRows = users.map((user) => ({
      label: user.fullName || user.email || `${localText.user} ${user.id}`,
      value: user.roles.join(", ") || localText.noRole,
      hint: user.email || localText.noEmail,
      badge: user.lastLoginAt ? localText.login(getDateBucketLabel(user.lastLoginAt)) : localText.noLogin,
    }));

    const profileRows = profiles.map((profile) => ({
      label: profile.displayName || `${localText.profile} ${profile.id}`,
      value: localText.sessions(profile.sessionCount),
      hint: localText.bindingsAge(profile.activeBindingCount, profile.ageCategory || localText.noCategory),
      badge: profile.isActive ? localText.active : localText.inactive,
    }));

    switch (selectedDetail.kind) {
      case "metric-games":
        return {
          title: localText.gameDetail,
          description: localText.gameDetailDesc,
          filterLabel: selectedDetail.label,
          rows: gameRows(),
        };
      case "metric-turns":
        return {
          title: localText.turnsDetail,
          description: localText.turnsDetailDesc,
          filterLabel: selectedDetail.label,
          rows: gameRows().filter((row) => row.value !== localText.turns(0)),
        };
      case "metric-success":
        return {
          title: localText.successDetail,
          description: localText.successDetailDesc,
          filterLabel: selectedDetail.label,
          rows: games.map((game) => {
            const successes = game.turns.filter((turn) => turn.success).length;
            const rate = game.turns.length > 0 ? Math.round((successes / game.turns.length) * 100) : 0;
            return {
              label: game.deckName || `${localText.game} ${game.id}`,
              value: `${rate}%`,
              hint: localText.correctTurns(successes, game.turns.length),
            };
          }),
        };
      case "metric-turn-time":
        return {
          title: localText.turnTimeDetail,
          description: localText.turnTimeDetailDesc,
          filterLabel: selectedDetail.label,
          rows: games.map((game) => {
            const total = game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0);
            const average = game.turns.length > 0 ? total / game.turns.length : 0;
            return {
              label: game.deckName || `${localText.game} ${game.id}`,
              value: formatDurationSeconds(average),
              hint: localText.measuredTurns(game.turns.length),
            };
          }),
        };
      case "metric-game-time":
        return {
          title: localText.gameDurationDetail,
          description: localText.gameDurationDetailDesc,
          filterLabel: selectedDetail.label,
          rows: games.map((game) => ({
            label: game.deckName || `${localText.game} ${game.id}`,
            value: formatDurationSeconds(game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0)),
            hint: localText.turns(game.turns.length),
          })),
        };
      case "metric-devices":
        return {
          title: localText.devicesDetail,
          description: localText.devicesDetailDesc,
          filterLabel: selectedDetail.label,
          rows: deviceRows,
        };
      case "metric-users":
        return {
          title: localText.usersDetail,
          description: localText.usersDetailDesc,
          filterLabel: selectedDetail.label,
          rows: userRows,
        };
      case "metric-profiles":
        return {
          title: localText.profilesDetail,
          description: localText.profilesDetailDesc,
          filterLabel: selectedDetail.label,
          rows: profileRows,
        };
      case "activity-date":
        return {
          title: localText.activityOf(selectedDetail.label),
          description: localText.activityOfDesc,
          filterLabel: selectedDetail.label,
          rows: gameRows(activityGames.filter((game) => getDateBucketLabel(game.startDate || game.createdAt || game.updatedAt) === selectedDetail.label)),
        };
      case "deck":
        return {
          title: localText.deckDetail(selectedDetail.label),
          description: localText.deckDetailDesc,
          filterLabel: selectedDetail.label,
          rows: gameRows(deckGames.filter((game) => normalizeLabel(game.deckName || localText.noDeck) === normalizeLabel(selectedDetail.label))),
        };
      case "user-role":
        return {
          title: localText.usersWithRole(selectedDetail.label),
          description: localText.usersWithRoleDesc,
          filterLabel: selectedDetail.label,
          rows: userRows.filter((row) => normalizeLabel(row.value).includes(normalizeLabel(selectedDetail.label))),
        };
      case "profile-coverage":
        return {
          title: localText.profileCoverage(selectedDetail.label),
          description: localText.profileCoverageDesc,
          filterLabel: selectedDetail.label,
          rows: profileCoverageProfiles.map((profile) => ({
            label: profile.displayName || `${localText.profile} ${profile.id}`,
            value: localText.sessions(profile.sessionCount),
            hint: localText.bindingsAge(profile.activeBindingCount, profile.ageCategory || localText.noCategory),
            badge: profile.isActive ? localText.active : localText.inactive,
          })).filter((row, index) => {
            const profile = profileCoverageProfiles[index];
            const normalized = normalizeLabel(selectedDetail.label);
            if (normalized.includes("activos") || normalized.includes("active") || normalized.includes("ativos")) return profile.isActive;
            if ((normalized.includes("binding") || normalized.includes("bindings")) && !normalized.includes("sin") && !normalized.includes("without") && !normalized.includes("sem")) return profile.activeBindingCount > 0;
            if (normalized.includes("sesiones") || normalized.includes("sessions") || normalized.includes("sessões")) return profile.sessionCount > 0;
            if (normalized.includes("sin binding") || normalized.includes("without binding") || normalized.includes("sem binding")) return profile.activeBindingCount === 0;
            return false;
          }),
        };
      case "user-recency":
        return {
          title: localText.userRecency(selectedDetail.label),
          description: localText.userRecencyDesc,
          filterLabel: selectedDetail.label,
          rows: userRecencyUsers.map((user) => ({
            label: user.fullName || user.email || `${localText.user} ${user.id}`,
            value: user.roles.join(", ") || localText.noRole,
            hint: user.email || localText.noEmail,
            badge: user.lastLoginAt ? localText.login(getDateBucketLabel(user.lastLoginAt)) : localText.noLogin,
          })).filter((row, index) => matchesRecencyLabel(selectedDetail.label, userRecencyUsers[index]?.lastLoginAt)),
        };
      case "profile-age":
        return {
          title: localText.profileAge(selectedDetail.label),
          description: localText.profileAgeDesc,
          filterLabel: selectedDetail.label,
          rows: profileAgeProfiles.map((profile) => ({
            label: profile.displayName || `${localText.profile} ${profile.id}`,
            value: localText.sessions(profile.sessionCount),
            hint: localText.bindingsAge(profile.activeBindingCount, profile.ageCategory || localText.noCategory),
            badge: profile.isActive ? localText.active : localText.inactive,
          })).filter((row, index) => normalizeLabel(profileAgeProfiles[index]?.ageCategory || localText.noCategory) === normalizeLabel(selectedDetail.label)),
        };
      case "sync-source":
        return {
          title: localText.syncSources(selectedDetail.label),
          description: localText.syncSourcesDesc,
          filterLabel: selectedDetail.label,
          rows: syncSourceSyncs
            .filter((sync) => normalizeLabel(sync.source || sync.sourceType || localText.unknown) === normalizeLabel(selectedDetail.label))
            .map((sync) => ({
              label: sync.deckName || `${localText.sync} ${sync.id}`,
              value: sync.status || localText.noStatus,
              hint: localText.rawRecordsDate(sync.rawRecordCount || sync.rawRecordIds.length || 0, getDateBucketLabel(sync.startedAt || sync.createdAt || sync.updatedAt)),
              badge: sync.deviceId || sync.bleDeviceId || localText.noDevice,
            })),
        };
      case "profile-recency":
        return {
          title: localText.profileRecency(selectedDetail.label),
          description: localText.profileRecencyDesc,
          filterLabel: selectedDetail.label,
          rows: profileRecencyProfiles.map((profile) => ({
            label: profile.displayName || `${localText.profile} ${profile.id}`,
            value: localText.sessions(profile.sessionCount),
            hint: localText.bindingsAge(profile.activeBindingCount, profile.ageCategory || localText.noCategory),
            badge: profile.isActive ? localText.active : localText.inactive,
          })).filter((row, index) => matchesRecencyLabel(selectedDetail.label, profileRecencyProfiles[index]?.lastSessionAt)),
        };
      case "alert": {
        const normalized = normalizeLabel(selectedDetail.label);
        if (normalized.includes("partidas sin turnos") || normalized.includes("games without turns") || normalized.includes("partidas sem turnos")) {
          return {
            title: localText.gamesWithoutTurns,
            description: localText.gamesWithoutTurnsDesc,
            filterLabel: selectedDetail.label,
            rows: gameRows(games.filter((game) => game.turns.length === 0)),
          };
        }
        if (normalized.includes("dispositivos sin status") || normalized.includes("devices without status") || normalized.includes("dispositivos sem status")) {
          return {
            title: localText.devicesWithoutStatus,
            description: localText.devicesWithoutStatusDesc,
            filterLabel: selectedDetail.label,
            rows: deviceRows.filter((row) => row.value === localText.noStatus),
          };
        }
        return {
          title: localText.syncsWithoutRaw,
          description: localText.syncsWithoutRawDesc,
          filterLabel: selectedDetail.label,
          rows: syncs
            .filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) === 0)
            .map((sync) => ({
              label: sync.deckName || `${localText.sync} ${sync.id}`,
              value: sync.status || localText.noStatus,
              hint: localText.source(sync.source || sync.sourceType || localText.unknown),
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
        <DashboardMetricCard label={t.metrics.turns} value={String(totalTurns)} hint={t.metrics.turnsHint} icon={Activity} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-turns", label: t.metrics.turns })} isActive={selectedDetail?.kind === "metric-turns"} />
        <DashboardMetricCard label={t.metrics.success} value={`${successRate}%`} hint={t.metrics.successHint} icon={BookOpen} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-success", label: t.metrics.success })} isActive={selectedDetail?.kind === "metric-success"} />
        <DashboardMetricCard label={t.metrics.turnTime} value={formatDurationSeconds(averageTurnTime)} hint={t.metrics.turnTimeHint} icon={TimerReset} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-turn-time", label: t.metrics.turnTime })} isActive={selectedDetail?.kind === "metric-turn-time"} />
        <DashboardMetricCard label={t.metrics.gameTime} value={formatDurationSeconds(averageGameTime)} hint={t.metrics.gameTimeHint} icon={Layers3} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-game-time", label: t.metrics.gameTime })} isActive={selectedDetail?.kind === "metric-game-time"} />
        <DashboardMetricCard label={t.metrics.devices} value={String(devicesQuery.data?.total || devices.length)} hint={t.metrics.devicesHint} icon={Smartphone} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-devices", label: t.metrics.devices })} isActive={selectedDetail?.kind === "metric-devices"} />
        <DashboardMetricCard label={t.metrics.users} value={String(usersQuery.data?.total || users.length)} hint={t.metrics.usersHint} icon={Database} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-users", label: t.metrics.users })} isActive={selectedDetail?.kind === "metric-users"} />
        <DashboardMetricCard label={t.metrics.profiles} value={String(profiles.length)} hint={t.metrics.profilesHint} icon={BookOpen} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-profiles", label: t.metrics.profiles })} isActive={selectedDetail?.kind === "metric-profiles"} />
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
          onRangeChange={(range) => setModuleRange("teacher-activity", range)}
          csvFileName={`teacher-dashboard-actividad-${activityRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "activity-date", label })}
          activeDatumLabel={selectedDetail?.kind === "activity-date" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.decks}
          description={t.charts.decksDesc}
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
          title={t.charts.usersByRole}
          description={t.charts.usersByRoleDesc}
          data={userRoleSeries}
          range={userRoleRange}
          onRangeChange={(range) => setModuleRange("teacher-user-role", range)}
          csvFileName={`teacher-dashboard-usuarios-por-rol-${userRoleRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-role", label })}
          activeDatumLabel={selectedDetail?.kind === "user-role" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.profileCoverage}
          description={t.charts.profileCoverageDesc}
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
          title={t.charts.userRecency}
          description={t.charts.userRecencyDesc}
          data={userRecencySeries}
          range={userRecencyRange}
          onRangeChange={(range) => setModuleRange("teacher-user-recency", range)}
          csvFileName={`teacher-dashboard-recencia-usuarios-${userRecencyRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-recency", label })}
          activeDatumLabel={selectedDetail?.kind === "user-recency" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.profileAge}
          description={t.charts.profileAgeDesc}
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
          title={t.charts.syncSources}
          description={t.charts.syncSourcesDesc}
          data={syncSourceSeries}
          range={syncSourceRange}
          onRangeChange={(range) => setModuleRange("teacher-sync-source", range)}
          csvFileName={`teacher-dashboard-fuentes-sync-${syncSourceRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "sync-source", label })}
          activeDatumLabel={selectedDetail?.kind === "sync-source" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.profileRecency}
          description={t.charts.profileRecencyDesc}
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
          title={t.charts.todayFocus}
          description={t.charts.todayFocusDesc}
          items={attentionRows}
          emptyLabel={t.charts.noAlerts}
          onItemSelect={(label) => setSelectedDetail({ kind: "alert", label })}
          activeItemLabel={selectedDetail?.kind === "alert" ? selectedDetail.label : null}
        />
      </div>

    </div>
  );
}
