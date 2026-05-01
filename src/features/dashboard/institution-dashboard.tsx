"use client";

import { useMemo, useState } from "react";
import { BookOpen, Database, Smartphone, TimerReset, UserRound, Users } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { canAccessPermissionsModule } from "@/features/auth/permission-contract";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";
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

const institutionDashboardMessages: Record<AppLanguage, {
  role: { institutionAdmin: string; director: string; default: string };
  header: { defaultTitle: string; scopedDescription: (name: string) => string; defaultDescription: string };
  metrics: { users: string; profiles: string; games: string; success: string; gameTime: string; devices: string; usersHint: string; profilesHint: string; gamesHint: string; successHint: string; gameTimeHint: string; devicesHint: string };
  charts: { activity: string; activityDesc: string; resourceBalance: string; resourceBalanceDesc: string; decks: string; decksDesc: string; hardware: string; hardwareDesc: string; usersByRole: string; usersByRoleDesc: string; profileActivity: string; profileActivityDesc: string; signups: string; signupsDesc: string; profileAge: string; profileAgeDesc: string; profileLinks: string; profileLinksDesc: string; sessionCohorts: string; sessionCohortsDesc: string; institutionCoverage: string; institutionCoverageDesc: string; operationalPriorities: string; operationalPrioritiesDesc: string; noAlerts: string; topInstitutions: string; topInstitutionsDesc: string; topInstitutionsEmpty: string; usersAndPermissions: string; usersOnly: string; usersAndPermissionsDesc: string; usersOnlyDesc: string; usersEmpty: string; secondaryUsers: string; students: string; roles: string };
  error: (message: string) => string;
}> = {
  es: {
    role: { institutionAdmin: "Admin institucional", director: "Dirección", default: "Institución" },
    header: { defaultTitle: "Dashboard institucional", scopedDescription: (name) => `Vista analítica de ${name}: usuarios, perfiles, actividad, tiempos, hardware y señales concretas para priorizar la operación diaria.`, defaultDescription: "Vista analítica institucional para esta sesión: métricas, gráficos y prioridades concretas, sin ruido de portada." },
    metrics: { users: "Usuarios", profiles: "Perfiles / estudiantes", games: "Partidas", success: "Acierto general", gameTime: "Duración promedio por partida", devices: "Dispositivos", usersHint: "Padrón de usuarios de la institución actual.", profilesHint: "Volumen de perfiles y estudiantes activos o pendientes.", gamesHint: "Uso real registrado en la institución.", successHint: "Lectura rápida del rendimiento agregado.", gameTimeHint: "Tiempo acumulado por sesión usando turnos registrados.", devicesHint: "Cobertura actual del parque." },
    charts: { activity: "Actividad por fecha", activityDesc: "Partidas y turnos por día para leer volumen, caídas y repuntes de uso.", resourceBalance: "Balance de recursos", resourceBalanceDesc: "Usuarios, instituciones, dispositivos y perfiles dentro de esta vista.", decks: "Mazos más usados", decksDesc: "Qué contenidos están moviendo la actividad en la institución.", hardware: "Estado de hardware", hardwareDesc: "Cruza estado y tipo de asignación para entender la salud del parque.", usersByRole: "Usuarios por rol", usersByRoleDesc: "Distribución del padrón para leer rápido qué perfiles sostienen la actividad institucional.", profileActivity: "Actividad reciente de perfiles", profileActivityDesc: "Perfiles con sesión y perfiles incorporados por fecha para seguir activación real y crecimiento.", signups: "Altas y reingresos", signupsDesc: "Alta de usuarios y últimos accesos por fecha para detectar onboarding reciente o reactivaciones.", profileAge: "Perfiles por categoría", profileAgeDesc: "Distribución por cohortes etarias para entender mejor qué segmento concentra la operación actual.", profileLinks: "Vínculos de perfiles", profileLinksDesc: "Cuántos perfiles ya están conectados a experiencia real y cuántos siguen flojos.", sessionCohorts: "Cohortes por sesiones", sessionCohortsDesc: "Agrupa perfiles según profundidad de uso para separar rápidamente adopción inicial de uso sostenido.", institutionCoverage: "Instituciones por cobertura", institutionCoverageDesc: "Comparativa por estudiantes con referencia secundaria de usuarios, útil cuando la vista incluye más de una institución.", operationalPriorities: "Prioridades operativas", operationalPrioritiesDesc: "Alertas rápidas para decidir dónde intervenir primero.", noAlerts: "No aparecen alertas fuertes en la institución actual.", topInstitutions: "Instituciones con más volumen", topInstitutionsDesc: "Ranking por estudiantes, útil sobre todo para vistas multi-institución.", topInstitutionsEmpty: "Con la visibilidad actual no hace falta un ranking institucional más profundo.", usersAndPermissions: "Usuarios y permisos", usersOnly: "Usuarios", usersAndPermissionsDesc: "Lectura rápida del padrón y su mezcla de roles.", usersOnlyDesc: "Lectura rápida del padrón de usuarios.", usersEmpty: "No hay suficientes usuarios como para armar un ranking útil todavía.", secondaryUsers: "Usuarios", students: "estudiantes", roles: "roles" },
    error: (message) => `No pude cargar una parte del dashboard institucional: ${message}`,
  },
  en: {
    role: { institutionAdmin: "Institution admin", director: "Leadership", default: "Institution" },
    header: { defaultTitle: "Institution dashboard", scopedDescription: (name) => `Analytical view of ${name}: users, profiles, activity, timing, hardware, and concrete signals to prioritize daily operations.`, defaultDescription: "Institutional analytical view for this session: metrics, charts, and concrete priorities without cover-page noise." },
    metrics: { users: "Users", profiles: "Profiles / students", games: "Games", success: "Overall success", gameTime: "Average game duration", devices: "Devices", usersHint: "User roster for the current institution.", profilesHint: "Volume of active or pending profiles and students.", gamesHint: "Real usage recorded in the institution.", successHint: "Quick read of aggregate performance.", gameTimeHint: "Accumulated time per session using recorded turns.", devicesHint: "Current fleet coverage." },
    charts: { activity: "Activity by date", activityDesc: "Games and turns per day to read volume, drops, and rebounds in usage.", resourceBalance: "Resource balance", resourceBalanceDesc: "Users, institutions, devices, and profiles inside this view.", decks: "Most used decks", decksDesc: "Which content is driving activity in the institution.", hardware: "Hardware state", hardwareDesc: "Crosses status and assignment type to understand fleet health.", usersByRole: "Users by role", usersByRoleDesc: "Roster distribution to quickly read which profiles sustain institutional activity.", profileActivity: "Recent profile activity", profileActivityDesc: "Profiles with sessions and newly added profiles by date to follow real activation and growth.", signups: "Signups and returns", signupsDesc: "User creation and latest access by date to detect recent onboarding or reactivations.", profileAge: "Profiles by category", profileAgeDesc: "Distribution by age cohorts to better understand which segment concentrates current operations.", profileLinks: "Profile links", profileLinksDesc: "How many profiles are already connected to real experience and how many remain weakly linked.", sessionCohorts: "Session cohorts", sessionCohortsDesc: "Groups profiles by usage depth to quickly separate early adoption from sustained use.", institutionCoverage: "Institutions by coverage", institutionCoverageDesc: "Comparison by students with secondary user reference, useful when the view includes more than one institution.", operationalPriorities: "Operational priorities", operationalPrioritiesDesc: "Quick alerts to decide where to intervene first.", noAlerts: "No strong alerts appear in the current institution.", topInstitutions: "Institutions with most volume", topInstitutionsDesc: "Ranking by students, especially useful for multi-institution views.", topInstitutionsEmpty: "With the current visibility, a deeper institutional ranking is not needed.", usersAndPermissions: "Users and permissions", usersOnly: "Users", usersAndPermissionsDesc: "Quick read of the roster and its role mix.", usersOnlyDesc: "Quick read of the user roster.", usersEmpty: "There are not enough users yet to build a useful ranking.", secondaryUsers: "Users", students: "students", roles: "roles" },
    error: (message) => `I couldn't load part of the institutional dashboard: ${message}`,
  },
  pt: {
    role: { institutionAdmin: "Admin institucional", director: "Direção", default: "Instituição" },
    header: { defaultTitle: "Dashboard institucional", scopedDescription: (name) => `Visão analítica de ${name}: usuários, perfis, atividade, tempos, hardware e sinais concretos para priorizar a operação diária.`, defaultDescription: "Visão analítica institucional para esta sessão: métricas, gráficos e prioridades concretas, sem ruído de capa." },
    metrics: { users: "Usuários", profiles: "Perfis / estudantes", games: "Partidas", success: "Acerto geral", gameTime: "Duração média por partida", devices: "Dispositivos", usersHint: "Cadastro de usuários da instituição atual.", profilesHint: "Volume de perfis e estudantes ativos ou pendentes.", gamesHint: "Uso real registrado na instituição.", successHint: "Leitura rápida do desempenho agregado.", gameTimeHint: "Tempo acumulado por sessão usando turnos registrados.", devicesHint: "Cobertura atual do parque." },
    charts: { activity: "Atividade por data", activityDesc: "Partidas e turnos por dia para ler volume, quedas e retomadas de uso.", resourceBalance: "Balanceamento de recursos", resourceBalanceDesc: "Usuários, instituições, dispositivos e perfis dentro desta visão.", decks: "Baralhos mais usados", decksDesc: "Quais conteúdos estão movendo a atividade na instituição.", hardware: "Estado do hardware", hardwareDesc: "Cruza estado e tipo de atribuição para entender a saúde do parque.", usersByRole: "Usuários por papel", usersByRoleDesc: "Distribuição do cadastro para ler rápido quais perfis sustentam a atividade institucional.", profileActivity: "Atividade recente de perfis", profileActivityDesc: "Perfis com sessão e perfis incorporados por data para acompanhar ativação real e crescimento.", signups: "Altas e retornos", signupsDesc: "Criação de usuários e últimos acessos por data para detectar onboarding recente ou reativações.", profileAge: "Perfis por categoria", profileAgeDesc: "Distribuição por coortes etárias para entender melhor qual segmento concentra a operação atual.", profileLinks: "Vínculos de perfis", profileLinksDesc: "Quantos perfis já estão conectados à experiência real e quantos seguem frágeis.", sessionCohorts: "Coortes por sessões", sessionCohortsDesc: "Agrupa perfis segundo profundidade de uso para separar rapidamente adoção inicial de uso sustentado.", institutionCoverage: "Instituições por cobertura", institutionCoverageDesc: "Comparativo por estudantes com referência secundária de usuários, útil quando a visão inclui mais de uma instituição.", operationalPriorities: "Prioridades operacionais", operationalPrioritiesDesc: "Alertas rápidos para decidir onde intervir primeiro.", noAlerts: "Não aparecem alertas fortes na instituição atual.", topInstitutions: "Instituições com maior volume", topInstitutionsDesc: "Ranking por estudantes, útil sobretudo para visões multi-instituição.", topInstitutionsEmpty: "Com a visibilidade atual, não faz falta um ranking institucional mais profundo.", usersAndPermissions: "Usuários e permissões", usersOnly: "Usuários", usersAndPermissionsDesc: "Leitura rápida do cadastro e da sua mistura de papéis.", usersOnlyDesc: "Leitura rápida do cadastro de usuários.", usersEmpty: "Ainda não há usuários suficientes para montar um ranking útil.", secondaryUsers: "Usuários", students: "estudantes", roles: "papéis" },
    error: (message) => `Não consegui carregar parte do dashboard institucional: ${message}`,
  },
};

function normalizeLabel(value?: string | null) {
  return (value || "sin dato").replace(/[|]/g, " / ").replace(/[-_]/g, " ").trim().toLowerCase();
}

function getDashboardDateValue(...values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(value)) || null;
}

export function InstitutionDashboard() {
  const { language } = useLanguage();
  const t = institutionDashboardMessages[language];
  const localText = language === "en"
    ? {
        devicesWithoutStatus: "Devices without status",
        reviewFleet: "Review fleet",
        profilesWithoutBinding: "Profiles without binding",
        connectExperience: "Connect experience",
        gamesWithoutTurns: "Games without turns",
        emptySessions: "Empty sessions",
        syncsWithoutRaw: "Syncs without raw",
        incompleteTraceability: "Incomplete traceability",
        usersGroups: (users: number, groups: number) => `${users} users · ${groups} groups`,
        institution: "Institution",
        user: "User",
        noRole: "No role",
        noEmail: "No recorded email",
        login: (value: string) => `Login ${value}`,
        noLogin: "No login",
        device: "Device",
        noStatus: "No status",
        noReference: "No recorded reference",
        unassigned: "unassigned",
        game: "Game",
        turns: (count: number) => `${count} turns`,
        dateDuration: (date: string, duration: string) => `Date ${date} · duration ${duration}`,
        noInstitution: "No institution",
        profile: "Profile",
        sessions: (count: number) => `${count} sessions`,
        bindingsAge: (bindings: number, age: string) => `${bindings} active bindings · ${age}`,
        noCategory: "uncategorized",
        active: "Active",
        inactive: "Inactive",
        sync: "Sync",
        rawRecordsDate: (count: number, date: string) => `${count} raw records · ${date}`,
        noSource: "No source",
        userDetail: "User detail",
        userDetailDesc: "User roster for the current institution.",
        profileDetail: "Profile detail",
        profileDetailDesc: "Profiles and students with activity or setup available.",
        gameDetail: "Game detail",
        gameDetailDesc: "Sessions recorded in the institution.",
        successDetail: "Overall success detail",
        successDetailDesc: "Success by game to move from the aggregate to the concrete case.",
        correctTurns: (ok: number, total: number) => `${ok}/${total} correct turns`,
        gameDuration: "Game duration",
        gameDurationDesc: "Accumulated time per session using recorded turns.",
        deviceDetail: "Device detail",
        deviceDetailDesc: "Current fleet coverage and status.",
        activityOf: (label: string) => `Activity on ${label}`,
        activityOfDesc: "Games that fall on the selected date.",
      }
    : language === "pt"
      ? {
          devicesWithoutStatus: "Dispositivos sem status",
          reviewFleet: "Revisar parque",
          profilesWithoutBinding: "Perfis sem binding",
          connectExperience: "Conectar experiência",
          gamesWithoutTurns: "Partidas sem turnos",
          emptySessions: "Sessões vazias",
          syncsWithoutRaw: "Syncs sem raw",
          incompleteTraceability: "Rastreabilidade incompleta",
          usersGroups: (users: number, groups: number) => `${users} usuários · ${groups} grupos`,
          institution: "Instituição",
          user: "Usuário",
          noRole: "Sem papel",
          noEmail: "Sem email registrado",
          login: (value: string) => `Login ${value}`,
          noLogin: "Sem login",
          device: "Dispositivo",
          noStatus: "Sem status",
          noReference: "Sem referência registrada",
          unassigned: "sem atribuição",
          game: "Partida",
          turns: (count: number) => `${count} turnos`,
          dateDuration: (date: string, duration: string) => `Data ${date} · duração ${duration}`,
          noInstitution: "Sem instituição",
          profile: "Perfil",
          sessions: (count: number) => `${count} sessões`,
          bindingsAge: (bindings: number, age: string) => `${bindings} bindings ativos · ${age}`,
          noCategory: "sem categoria",
          active: "Ativo",
          inactive: "Inativo",
          sync: "Sync",
          rawRecordsDate: (count: number, date: string) => `${count} raw records · ${date}`,
          noSource: "Sem fonte",
          userDetail: "Detalhe de usuários",
          userDetailDesc: "Cadastro de usuários da instituição atual.",
          profileDetail: "Detalhe de perfis",
          profileDetailDesc: "Perfis e estudantes com atividade ou setup disponível.",
          gameDetail: "Detalhe de partidas",
          gameDetailDesc: "Sessões registradas na instituição.",
          successDetail: "Detalhe de acerto geral",
          successDetailDesc: "Acerto por partida para descer do agregado ao caso concreto.",
          correctTurns: (ok: number, total: number) => `${ok}/${total} turnos corretos`,
          gameDuration: "Duração por partida",
          gameDurationDesc: "Tempo acumulado por sessão usando turnos registrados.",
          deviceDetail: "Detalhe de dispositivos",
          deviceDetailDesc: "Cobertura atual do parque e seu estado.",
          activityOf: (label: string) => `Atividade de ${label}`,
          activityOfDesc: "Partidas que caem na data selecionada.",
        }
      : {
          devicesWithoutStatus: "Dispositivos sin status",
          reviewFleet: "Revisar parque",
          profilesWithoutBinding: "Perfiles sin binding",
          connectExperience: "Conectar experiencia",
          gamesWithoutTurns: "Partidas sin turnos",
          emptySessions: "Sesiones vacías",
          syncsWithoutRaw: "Syncs sin raw",
          incompleteTraceability: "Trazabilidad incompleta",
          usersGroups: (users: number, groups: number) => `${users} usuarios · ${groups} grupos`,
          institution: "Institución",
          user: "Usuario",
          noRole: "Sin rol",
          noEmail: "Sin email registrado",
          login: (value: string) => `Login ${value}`,
          noLogin: "Sin login",
          device: "Dispositivo",
          noStatus: "Sin status",
          noReference: "Sin referencia registrada",
          unassigned: "sin asignación",
          game: "Partida",
          turns: (count: number) => `${count} turnos`,
          dateDuration: (date: string, duration: string) => `Fecha ${date} · duración ${duration}`,
          noInstitution: "Sin institución",
          profile: "Perfil",
          sessions: (count: number) => `${count} sesiones`,
          bindingsAge: (bindings: number, age: string) => `${bindings} bindings activos · ${age}`,
          noCategory: "sin categoría",
          active: "Activo",
          inactive: "Inactivo",
          sync: "Sync",
          rawRecordsDate: (count: number, date: string) => `${count} raw records · ${date}`,
          noSource: "Sin fuente",
          userDetail: "Detalle de usuarios",
          userDetailDesc: "Padrón de usuarios de la institución actual.",
          profileDetail: "Detalle de perfiles",
          profileDetailDesc: "Perfiles y estudiantes con actividad o setup disponible.",
          gameDetail: "Detalle de partidas",
          gameDetailDesc: "Sesiones registradas en la institución.",
          successDetail: "Detalle de acierto general",
          successDetailDesc: "Acierto por partida para bajar del agregado al caso concreto.",
          correctTurns: (ok: number, total: number) => `${ok}/${total} turnos correctos`,
          gameDuration: "Duración por partida",
          gameDurationDesc: "Tiempo acumulado por sesión usando turnos registrados.",
          deviceDetail: "Detalle de dispositivos",
          deviceDetailDesc: "Cobertura actual del parque y su estado.",
          activityOf: (label: string) => `Actividad del ${label}`,
          activityOfDesc: "Partidas que caen en la fecha seleccionada.",
        };
  const detailText = language === "en"
    ? {
        balanceUsers: "Balance · users",
        balanceUsersDesc: "Current roster detail.",
        balanceInstitutions: "Balance · institutions",
        balanceInstitutionsDesc: "Institutions included in this view.",
        balanceDevices: "Balance · devices",
        balanceDevicesDesc: "Available fleet in this view.",
        balanceProfiles: "Balance · profiles",
        balanceProfilesDesc: "Profiles included in this view.",
        deckDetail: (label: string) => `Deck detail ${label}`,
        deckDetailDesc: "Games linked to the selected content.",
        noDeck: "No deck",
        hardware: (label: string) => `Hardware · ${label}`,
        hardwareDesc: "Devices filtered by the selected hardware dimension.",
        usersWithRole: (label: string) => `Users with role ${label}`,
        usersWithRoleDesc: "Users that belong to the selected role.",
        profileActivity: (label: string) => `Profile activity · ${label}`,
        profileActivityDesc: "Profiles inside the selected chart dimension.",
        signupsReturns: (label: string) => `Signups and returns · ${label}`,
        signupsReturnsDesc: "Users whose signup or latest access falls on the selected date.",
        profileAge: (label: string) => `Profiles by category · ${label}`,
        profileAgeDesc: "Profiles inside the chosen cohort.",
        profileLinks: (label: string) => `Profile links · ${label}`,
        profileLinksDesc: "Profiles filtered by link and usage level.",
        profileSessions: (label: string) => `Session cohorts · ${label}`,
        profileSessionsDesc: "Profiles grouped by usage depth.",
        institutionCoverage: (label: string) => `Institution coverage · ${label}`,
        institutionCoverageDesc: "Institutions inside the selected coverage ranking.",
        devicesWithoutStatusDesc: "Devices that need a technical check or status update.",
        profilesWithoutBindingDesc: "Profiles not yet connected to real experience.",
        gamesWithoutTurnsDesc: "Sessions worth reviewing because they show no interaction.",
        syncsWithoutRawDesc: "Sync sessions without raw evidence available.",
        institutionDetail: (label: string) => `Institution · ${label}`,
        institutionDetailDesc: "Expanded detail for the institution selected in the ranking.",
        userExpanded: (label: string) => `User · ${label}`,
        userExpandedDesc: "Expanded detail for the user selected in the ranking.",
      }
    : language === "pt"
      ? {
          balanceUsers: "Balance · usuários",
          balanceUsersDesc: "Detalhe do cadastro atual.",
          balanceInstitutions: "Balance · instituições",
          balanceInstitutionsDesc: "Instituições incluídas nesta visão.",
          balanceDevices: "Balance · dispositivos",
          balanceDevicesDesc: "Parque disponível nesta visão.",
          balanceProfiles: "Balance · perfis",
          balanceProfilesDesc: "Perfis incluídos nesta visão.",
          deckDetail: (label: string) => `Detalhe do baralho ${label}`,
          deckDetailDesc: "Partidas associadas ao conteúdo selecionado.",
          noDeck: "Sem baralho",
          hardware: (label: string) => `Hardware · ${label}`,
          hardwareDesc: "Dispositivos filtrados pela dimensão escolhida no bloco de hardware.",
          usersWithRole: (label: string) => `Usuários com papel ${label}`,
          usersWithRoleDesc: "Usuários que pertencem ao papel selecionado.",
          profileActivity: (label: string) => `Atividade de perfis · ${label}`,
          profileActivityDesc: "Perfis dentro da dimensão escolhida do gráfico.",
          signupsReturns: (label: string) => `Altas e retornos · ${label}`,
          signupsReturnsDesc: "Usuários cujo cadastro ou último acesso cai na data escolhida.",
          profileAge: (label: string) => `Perfis por categoria · ${label}`,
          profileAgeDesc: "Perfis dentro da coorte escolhida.",
          profileLinks: (label: string) => `Vínculos de perfis · ${label}`,
          profileLinksDesc: "Perfis filtrados por nível de vínculo e uso.",
          profileSessions: (label: string) => `Coortes por sessões · ${label}`,
          profileSessionsDesc: "Perfis agrupados por profundidade de uso.",
          institutionCoverage: (label: string) => `Cobertura institucional · ${label}`,
          institutionCoverageDesc: "Instituições dentro do ranking de cobertura selecionado.",
          devicesWithoutStatusDesc: "Equipamentos que precisam de verificação técnica ou atualização de status.",
          profilesWithoutBindingDesc: "Perfis ainda não conectados à experiência real.",
          gamesWithoutTurnsDesc: "Sessões que vale revisar porque não mostram interação.",
          syncsWithoutRawDesc: "Sincronizações sem evidência crua disponível.",
          institutionDetail: (label: string) => `Instituição · ${label}`,
          institutionDetailDesc: "Detalhe expandido da instituição escolhida no ranking.",
          userExpanded: (label: string) => `Usuário · ${label}`,
          userExpandedDesc: "Detalhe expandido do usuário escolhido no ranking.",
        }
      : {
          balanceUsers: "Balance · usuarios",
          balanceUsersDesc: "Detalle del padrón actual.",
          balanceInstitutions: "Balance · instituciones",
          balanceInstitutionsDesc: "Instituciones incluidas en esta vista.",
          balanceDevices: "Balance · dispositivos",
          balanceDevicesDesc: "Parque disponible en esta vista.",
          balanceProfiles: "Balance · perfiles",
          balanceProfilesDesc: "Perfiles incluidos en esta vista.",
          deckDetail: (label: string) => `Detalle del mazo ${label}`,
          deckDetailDesc: "Partidas asociadas al contenido seleccionado.",
          noDeck: "Sin mazo",
          hardware: (label: string) => `Hardware · ${label}`,
          hardwareDesc: "Dispositivos filtrados por la dimensión elegida en el bloque de hardware.",
          usersWithRole: (label: string) => `Usuarios con rol ${label}`,
          usersWithRoleDesc: "Usuarios que pertenecen al rol seleccionado.",
          profileActivity: (label: string) => `Actividad de perfiles · ${label}`,
          profileActivityDesc: "Perfiles dentro de la dimensión elegida del gráfico.",
          signupsReturns: (label: string) => `Altas y reingresos · ${label}`,
          signupsReturnsDesc: "Usuarios cuyo alta o último acceso cae dentro de la fecha elegida.",
          profileAge: (label: string) => `Perfiles por categoría · ${label}`,
          profileAgeDesc: "Perfiles dentro de la cohorte elegida.",
          profileLinks: (label: string) => `Vínculos de perfiles · ${label}`,
          profileLinksDesc: "Perfiles filtrados por nivel de vinculación y uso.",
          profileSessions: (label: string) => `Cohortes por sesiones · ${label}`,
          profileSessionsDesc: "Perfiles agrupados por profundidad de uso.",
          institutionCoverage: (label: string) => `Cobertura institucional · ${label}`,
          institutionCoverageDesc: "Instituciones dentro del ranking de cobertura seleccionado.",
          devicesWithoutStatusDesc: "Equipos que necesitan chequeo técnico o actualización de estado.",
          profilesWithoutBindingDesc: "Perfiles todavía no conectados a experiencia real.",
          gamesWithoutTurnsDesc: "Sesiones que conviene revisar porque no muestran interacción.",
          syncsWithoutRawDesc: "Sincronizaciones sin evidencia cruda disponible.",
          institutionDetail: (label: string) => `Institución · ${label}`,
          institutionDetailDesc: "Detalle expandido de la institución elegida en el ranking.",
          userExpanded: (label: string) => `Usuario · ${label}`,
          userExpandedDesc: "Detalle expandido del usuario elegido en el ranking.",
        };
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
      label: localText.devicesWithoutStatus,
      value: String(devices.filter((device) => !device.status).length),
      badge: localText.reviewFleet,
    },
    {
      label: localText.profilesWithoutBinding,
      value: String(profiles.filter((profile) => profile.activeBindingCount === 0).length),
      badge: localText.connectExperience,
    },
    {
      label: localText.gamesWithoutTurns,
      value: String(games.filter((game) => game.turns.length === 0).length),
      badge: localText.emptySessions,
    },
    {
      label: localText.syncsWithoutRaw,
      value: String(syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) === 0).length),
      badge: localText.incompleteTraceability,
    },
  ].filter((item) => Number(item.value) > 0);

  const detailPanel = (() => {
    if (!selectedDetail) return null;

    const institutionRows: DashboardDetailRow[] = institutions.map((institution) => ({
      label: institution.name,
      value: String(institution.operationalSummary?.studentCount ?? 0),
      hint: localText.usersGroups(institution.operationalSummary?.userCount ?? 0, institution.operationalSummary?.classGroupCount ?? 0),
      badge: institution.status || institution.city || localText.institution,
    }));

    const userRows: DashboardDetailRow[] = users.map((entry) => ({
      label: entry.fullName || entry.email || `${localText.user} ${entry.id}`,
      value: entry.roles.join(", ") || localText.noRole,
      hint: entry.email || localText.noEmail,
      badge: entry.lastLoginAt ? localText.login(getDateBucketLabel(entry.lastLoginAt)) : localText.noLogin,
    }));

    const deviceRows: DashboardDetailRow[] = devices.map((device) => ({
      label: device.name || device.deviceId || `${localText.device} ${device.id}`,
      value: device.status || localText.noStatus,
      hint: device.ownerUserName || device.ownerUserEmail || device.educationalCenterName || localText.noReference,
      badge: device.assignmentScope || localText.unassigned,
    }));

    const gameRows = (items = games): DashboardDetailRow[] =>
      items.map((game) => {
        const totalDuration = game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0);
        return {
          label: game.deckName || `${localText.game} ${game.id}`,
          value: localText.turns(game.turns.length),
          hint: localText.dateDuration(getDateBucketLabel(game.startDate || game.createdAt || game.updatedAt), formatDurationSeconds(totalDuration)),
          badge: game.educationalCenterId || localText.noInstitution,
        };
      });

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
      case "metric-users":
        return { title: localText.userDetail, description: localText.userDetailDesc, filterLabel: selectedDetail.label, rows: userRows };
      case "metric-profiles":
        return { title: localText.profileDetail, description: localText.profileDetailDesc, filterLabel: selectedDetail.label, rows: profileRows };
      case "metric-games":
        return { title: localText.gameDetail, description: localText.gameDetailDesc, filterLabel: selectedDetail.label, rows: gameRows() };
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
      case "metric-game-time":
        return {
          title: localText.gameDuration,
          description: localText.gameDurationDesc,
          filterLabel: selectedDetail.label,
          rows: games.map((game) => ({ label: game.deckName || `${localText.game} ${game.id}`, value: formatDurationSeconds(game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0)), hint: localText.turns(game.turns.length) })),
        };
      case "metric-devices":
        return { title: localText.deviceDetail, description: localText.deviceDetailDesc, filterLabel: selectedDetail.label, rows: deviceRows };
      case "activity-date":
        return {
          title: localText.activityOf(selectedDetail.label),
          description: localText.activityOfDesc,
          filterLabel: selectedDetail.label,
          rows: gameRows(activityGames.filter((game) => getDateBucketLabel(game.startDate || game.createdAt || game.updatedAt) === selectedDetail.label)),
        };
      case "resource-balance": {
        const normalized = normalizeLabel(selectedDetail.label);
        if (normalized.includes("usuario") || normalized.includes("user") || normalized.includes("usuário")) return { title: detailText.balanceUsers, description: detailText.balanceUsersDesc, filterLabel: selectedDetail.label, rows: resourceUsers.map((entry) => ({ label: entry.fullName || entry.email || `${localText.user} ${entry.id}`, value: entry.roles.join(", ") || localText.noRole, hint: entry.email || localText.noEmail, badge: entry.lastLoginAt ? localText.login(getDateBucketLabel(entry.lastLoginAt)) : localText.noLogin })) };
        if (normalized.includes("instituci")) return { title: detailText.balanceInstitutions, description: detailText.balanceInstitutionsDesc, filterLabel: selectedDetail.label, rows: resourceInstitutions.map((institution) => ({ label: institution.name, value: String(institution.operationalSummary?.studentCount ?? 0), hint: localText.usersGroups(institution.operationalSummary?.userCount ?? 0, institution.operationalSummary?.classGroupCount ?? 0), badge: institution.status || institution.city || localText.institution })) };
        if (normalized.includes("dispositivo") || normalized.includes("device")) return { title: detailText.balanceDevices, description: detailText.balanceDevicesDesc, filterLabel: selectedDetail.label, rows: resourceDevices.map((device) => ({ label: device.name || device.deviceId || `${localText.device} ${device.id}`, value: device.status || localText.noStatus, hint: device.ownerUserName || device.ownerUserEmail || device.educationalCenterName || localText.noReference, badge: device.assignmentScope || localText.unassigned })) };
        return { title: detailText.balanceProfiles, description: detailText.balanceProfilesDesc, filterLabel: selectedDetail.label, rows: resourceProfiles.map((profile) => ({ label: profile.displayName || `${localText.profile} ${profile.id}`, value: localText.sessions(profile.sessionCount), hint: localText.bindingsAge(profile.activeBindingCount, profile.ageCategory || localText.noCategory), badge: profile.isActive ? localText.active : localText.inactive })) };
      }
      case "deck":
        return { title: detailText.deckDetail(selectedDetail.label), description: detailText.deckDetailDesc, filterLabel: selectedDetail.label, rows: gameRows(deckGames.filter((game) => normalizeLabel(game.deckName || detailText.noDeck) === normalizeLabel(selectedDetail.label))) };
      case "device-status": {
        const normalized = normalizeLabel(selectedDetail.label);
        return {
          title: detailText.hardware(selectedDetail.label),
          description: detailText.hardwareDesc,
          filterLabel: selectedDetail.label,
          rows: deviceStatusDevices.map((device) => ({ label: device.name || device.deviceId || `${localText.device} ${device.id}`, value: device.status || localText.noStatus, hint: device.ownerUserName || device.ownerUserEmail || device.educationalCenterName || localText.noReference, badge: device.assignmentScope || localText.unassigned })).filter((row, index) => {
            const device = deviceStatusDevices[index];
            if (normalized.includes("con status") || normalized.includes("with status") || normalized.includes("com status")) return row.value !== localText.noStatus;
            if (normalized.includes("sin status") || normalized.includes("without status") || normalized.includes("sem status")) return row.value === localText.noStatus;
            if (normalized.includes("institución") || normalized.includes("institution") || normalized.includes("instituição")) return device.assignmentScope === "institution";
            if (normalized.includes("home") || normalized.includes("casa")) return device.assignmentScope === "home";
            return false;
          }),
        };
      }
      case "user-role":
        return { title: detailText.usersWithRole(selectedDetail.label), description: detailText.usersWithRoleDesc, filterLabel: selectedDetail.label, rows: userRoleUsers.map((entry) => ({ label: entry.fullName || entry.email || `${localText.user} ${entry.id}`, value: entry.roles.join(", ") || localText.noRole, hint: entry.email || localText.noEmail, badge: entry.lastLoginAt ? localText.login(getDateBucketLabel(entry.lastLoginAt)) : localText.noLogin })).filter((row) => normalizeLabel(row.value).includes(normalizeLabel(selectedDetail.label))) };
      case "profile-activity": {
        const normalized = normalizeLabel(selectedDetail.label);
        return {
          title: detailText.profileActivity(selectedDetail.label),
          description: detailText.profileActivityDesc,
          filterLabel: selectedDetail.label,
          rows: profileActivityProfiles.map((profile) => ({ label: profile.displayName || `${localText.profile} ${profile.id}`, value: localText.sessions(profile.sessionCount), hint: localText.bindingsAge(profile.activeBindingCount, profile.ageCategory || localText.noCategory), badge: profile.isActive ? localText.active : localText.inactive })).filter((row, index) => {
            const profile = profileActivityProfiles[index];
            if (normalized.includes("sesión") || normalized.includes("session") || normalized.includes("sessão")) return Boolean(profile.lastSessionAt);
            return getDateBucketLabel(profile.createdAt || profile.updatedAt || profile.lastSessionAt) === selectedDetail.label;
          }),
        };
      }
      case "user-creation-date":
        return {
          title: detailText.signupsReturns(selectedDetail.label),
          description: detailText.signupsReturnsDesc,
          filterLabel: selectedDetail.label,
          rows: userCreationUsers.map((entry) => ({ label: entry.fullName || entry.email || `${localText.user} ${entry.id}`, value: entry.roles.join(", ") || localText.noRole, hint: entry.email || localText.noEmail, badge: entry.lastLoginAt ? localText.login(getDateBucketLabel(entry.lastLoginAt)) : localText.noLogin })).filter((row, index) => {
            const userRecord = userCreationUsers[index];
            return getDateBucketLabel(userRecord?.createdAt || userRecord?.lastLoginAt) === selectedDetail.label
              || getDateBucketLabel(userRecord?.lastLoginAt) === selectedDetail.label;
          }),
        };
      case "profile-age":
        return { title: detailText.profileAge(selectedDetail.label), description: detailText.profileAgeDesc, filterLabel: selectedDetail.label, rows: profileAgeProfiles.map((profile) => ({ label: profile.displayName || `${localText.profile} ${profile.id}`, value: localText.sessions(profile.sessionCount), hint: localText.bindingsAge(profile.activeBindingCount, profile.ageCategory || localText.noCategory), badge: profile.isActive ? localText.active : localText.inactive })).filter((row, index) => normalizeLabel(profileAgeProfiles[index]?.ageCategory || localText.noCategory) === normalizeLabel(selectedDetail.label)) };
      case "profile-binding": {
        const normalized = normalizeLabel(selectedDetail.label);
        return {
          title: detailText.profileLinks(selectedDetail.label),
          description: detailText.profileLinksDesc,
          filterLabel: selectedDetail.label,
          rows: profileBindingProfiles.map((profile) => ({ label: profile.displayName || `${localText.profile} ${profile.id}`, value: localText.sessions(profile.sessionCount), hint: localText.bindingsAge(profile.activeBindingCount, profile.ageCategory || localText.noCategory), badge: profile.isActive ? localText.active : localText.inactive })).filter((row, index) => {
            const profile = profileBindingProfiles[index];
            if (normalized.includes("bindings activos") || normalized.includes("active bindings") || normalized.includes("bindings ativos")) return profile.activeBindingCount > 0;
            if (normalized.includes("sin binding") || normalized.includes("without binding") || normalized.includes("sem binding")) return profile.activeBindingCount === 0;
            if (normalized.includes("con sesiones") || normalized.includes("with sessions") || normalized.includes("com sessões")) return profile.sessionCount > 0;
            return false;
          }),
        };
      }
      case "profile-sessions": {
        const normalized = normalizeLabel(selectedDetail.label);
        return {
          title: detailText.profileSessions(selectedDetail.label),
          description: detailText.profileSessionsDesc,
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
      case "institution-coverage":
        return { title: detailText.institutionCoverage(selectedDetail.label), description: detailText.institutionCoverageDesc, filterLabel: selectedDetail.label, rows: coverageInstitutions.map((institution) => ({ label: institution.name, value: String(institution.operationalSummary?.studentCount ?? 0), hint: localText.usersGroups(institution.operationalSummary?.userCount ?? 0, institution.operationalSummary?.classGroupCount ?? 0), badge: institution.status || institution.city || localText.institution })).filter((row) => normalizeLabel(row.label) === normalizeLabel(selectedDetail.label)) };
      case "alert": {
        const normalized = normalizeLabel(selectedDetail.label);
        if (normalized.includes("dispositivos sin status") || normalized.includes("devices without status") || normalized.includes("dispositivos sem status")) return { title: localText.devicesWithoutStatus, description: detailText.devicesWithoutStatusDesc, filterLabel: selectedDetail.label, rows: deviceRows.filter((row) => row.value === localText.noStatus) };
        if (normalized.includes("profiles sin binding") || normalized.includes("profiles without binding") || normalized.includes("perfis sem binding")) return { title: localText.profilesWithoutBinding, description: detailText.profilesWithoutBindingDesc, filterLabel: selectedDetail.label, rows: profileRows.filter((row, index) => (profiles[index]?.activeBindingCount || 0) === 0) };
        if (normalized.includes("partidas sin turnos") || normalized.includes("games without turns") || normalized.includes("partidas sem turnos")) return { title: localText.gamesWithoutTurns, description: detailText.gamesWithoutTurnsDesc, filterLabel: selectedDetail.label, rows: gameRows(games.filter((game) => game.turns.length === 0)) };
        return { title: localText.syncsWithoutRaw, description: detailText.syncsWithoutRawDesc, filterLabel: selectedDetail.label, rows: syncRows.filter((row, index) => (syncs[index]?.rawRecordCount || syncs[index]?.rawRecordIds.length || 0) === 0) };
      }
      case "top-institution":
        return { title: detailText.institutionDetail(selectedDetail.label), description: detailText.institutionDetailDesc, filterLabel: selectedDetail.label, rows: institutionRows.filter((row) => normalizeLabel(row.label) === normalizeLabel(selectedDetail.label)) };
      case "top-user":
        return { title: detailText.userExpanded(selectedDetail.label), description: detailText.userExpandedDesc, filterLabel: selectedDetail.label, rows: userRows.filter((row) => normalizeLabel(row.label) === normalizeLabel(selectedDetail.label)) };
      default:
        return null;
    }
  })();

  const roleLabel = isInstitutionAdmin ? t.role.institutionAdmin : isDirector ? t.role.director : t.role.default;

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={roleLabel}
        title={scopedInstitution ? scopedInstitution.name : t.header.defaultTitle}
        description={
          scopedInstitution
            ? t.header.scopedDescription(scopedInstitution.name)
            : t.header.defaultDescription
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
        <DashboardMetricCard label={t.metrics.users} value={String(usersQuery.data?.total || users.length)} hint={t.metrics.usersHint} icon={Users} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-users", label: t.metrics.users })} isActive={selectedDetail?.kind === "metric-users"} />
        <DashboardMetricCard label={t.metrics.profiles} value={String(profiles.length)} hint={t.metrics.profilesHint} icon={UserRound} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-profiles", label: t.metrics.profiles })} isActive={selectedDetail?.kind === "metric-profiles"} />
        <DashboardMetricCard label={t.metrics.games} value={String(gamesQuery.data?.total || games.length)} hint={t.metrics.gamesHint} icon={Database} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-games", label: t.metrics.games })} isActive={selectedDetail?.kind === "metric-games"} />
        <DashboardMetricCard label={t.metrics.success} value={`${successRate}%`} hint={t.metrics.successHint} icon={BookOpen} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-success", label: t.metrics.success })} isActive={selectedDetail?.kind === "metric-success"} />
        <DashboardMetricCard label={t.metrics.gameTime} value={formatDurationSeconds(averageGameTime)} hint={t.metrics.gameTimeHint} icon={TimerReset} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-game-time", label: t.metrics.gameTime })} isActive={selectedDetail?.kind === "metric-game-time"} />
        <DashboardMetricCard label={t.metrics.devices} value={String(devicesQuery.data?.total || devices.length)} hint={t.metrics.devicesHint} icon={Smartphone} isLoading={isLoading} onSelect={() => setSelectedDetail({ kind: "metric-devices", label: t.metrics.devices })} isActive={selectedDetail?.kind === "metric-devices"} />
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
          onRangeChange={(range) => setModuleRange("institution-activity", range)}
          csvFileName={`institution-dashboard-actividad-${activityRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "activity-date", label })}
          activeDatumLabel={selectedDetail?.kind === "activity-date" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.resourceBalance}
          description={t.charts.resourceBalanceDesc}
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
          title={t.charts.decks}
          description={t.charts.decksDesc}
          data={deckUsage}
          range={deckRange}
          onRangeChange={(range) => setModuleRange("institution-deck", range)}
          csvFileName={`institution-dashboard-mazos-${deckRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "deck", label })}
          activeDatumLabel={selectedDetail?.kind === "deck" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.hardware}
          description={t.charts.hardwareDesc}
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
          title={t.charts.usersByRole}
          description={t.charts.usersByRoleDesc}
          data={userRoleSeries}
          range={userRoleRange}
          onRangeChange={(range) => setModuleRange("institution-user-role", range)}
          csvFileName={`institution-dashboard-usuarios-por-rol-${userRoleRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-role", label })}
          activeDatumLabel={selectedDetail?.kind === "user-role" ? selectedDetail.label : null}
        />
        <DashboardLineChartCard
          title={t.charts.profileActivity}
          description={t.charts.profileActivityDesc}
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
          title={t.charts.signups}
          description={t.charts.signupsDesc}
          data={userCreationSeries}
          range={userCreationRange}
          onRangeChange={(range) => setModuleRange("institution-user-creation", range)}
          csvFileName={`institution-dashboard-altas-reingresos-${userCreationRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-creation-date", label })}
          activeDatumLabel={selectedDetail?.kind === "user-creation-date" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.profileAge}
          description={t.charts.profileAgeDesc}
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
          title={t.charts.profileLinks}
          description={t.charts.profileLinksDesc}
          data={profileBindingSeries}
          range={profileBindingRange}
          onRangeChange={(range) => setModuleRange("institution-profile-binding", range)}
          csvFileName={`institution-dashboard-vinculos-perfiles-${profileBindingRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-binding", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-binding" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.sessionCohorts}
          description={t.charts.sessionCohortsDesc}
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
          title={t.charts.institutionCoverage}
          description={t.charts.institutionCoverageDesc}
          data={institutionCoverageSeries}
          secondaryDataKey="secondaryValue"
          secondaryLabel={t.charts.secondaryUsers}
          range={institutionCoverageRange}
          onRangeChange={(range) => setModuleRange("institution-coverage", range)}
          csvFileName={`institution-dashboard-cobertura-instituciones-${institutionCoverageRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "institution-coverage", label })}
          activeDatumLabel={selectedDetail?.kind === "institution-coverage" ? selectedDetail.label : null}
        />
        <DashboardTopListCard
          title={t.charts.operationalPriorities}
          description={t.charts.operationalPrioritiesDesc}
          items={operationalAlerts}
          emptyLabel={t.charts.noAlerts}
          onItemSelect={(label) => setSelectedDetail({ kind: "alert", label })}
          activeItemLabel={selectedDetail?.kind === "alert" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardTopListCard
          title={t.charts.topInstitutions}
          description={t.charts.topInstitutionsDesc}
          items={topInstitutions}
          valueLabel={t.charts.students}
          emptyLabel={t.charts.topInstitutionsEmpty}
          onItemSelect={(label) => setSelectedDetail({ kind: "top-institution", label })}
          activeItemLabel={selectedDetail?.kind === "top-institution" ? selectedDetail.label : null}
        />
        <DashboardTopListCard
          title={canSeePermissions ? t.charts.usersAndPermissions : t.charts.usersOnly}
          description={canSeePermissions ? t.charts.usersAndPermissionsDesc : t.charts.usersOnlyDesc}
          items={visibleUsers}
          valueLabel={t.charts.roles}
          emptyLabel={t.charts.usersEmpty}
          onItemSelect={(label) => setSelectedDetail({ kind: "top-user", label })}
          activeItemLabel={selectedDetail?.kind === "top-user" ? selectedDetail.label : null}
        />
      </div>
    </div>
  );
}
