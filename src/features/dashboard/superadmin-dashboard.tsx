"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Check,
  Copy,
  Database,
  HeartPulse,
  Layers3,
  Smartphone,
  UserSquare2,
  Users,
} from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSystemDashboardSummary } from "@/features/dashboard/api";
import {
  DashboardBarChartCard,
  DashboardDetailPanel,
  type DashboardDetailRow,
  filterDashboardItemsByRange,
  DashboardMetricCard,
  DashboardMultiLineChartCard,
  useDashboardModuleControls,
} from "@/features/dashboard/dashboard-analytics-shared";
import { DashboardLocationMapCard, type DashboardLocationSeed } from "@/features/dashboard/dashboard-location-map-card";
import {
  buildProfileCoverageBreakdown,
  buildUserRoleSeries,
  buildUserTypeSeries,
} from "@/features/dashboard/dashboard-analytics-utils";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
import type { GameRecord } from "@/features/games/types";
import { useGames } from "@/features/games/api";
import { useBasicHealth, useReadinessHealth } from "@/features/health/api";
import type { HealthCheckItem } from "@/features/health/types";
import type { InstitutionRecord } from "@/features/institutions/types";
import { useInstitutions } from "@/features/institutions/api";
import { useProfilesOverview } from "@/features/profiles/api";
import { useSyncSessions } from "@/features/syncs/api";
import type { SyncSessionRecord } from "@/features/syncs/types";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";
import { useUsers } from "@/features/users/api";
import type { UserRecord } from "@/features/users/types";
import { getErrorMessage } from "@/lib/utils";

const superadminMessages: Record<AppLanguage, {
  scope: { admin: string; government: string; institutionAdmin: string; director: string; operation: string };
  header: { title: string; description: string };
  quickLook: { title: string; description: string; institutions: string; institutionsHint: (count: number) => string; devices: string; devicesHint: (withoutStatus: number, withoutOwner: number) => string; syncs: string; syncsHint: (syncsRaw: string, profilesBound: string) => string; review: string; attention: string; follow: string; ok: string };
  metrics: { users: string; usersHint: string; institutions: string; institutionsHint: string; devices: string; devicesHint: (home: number, institution: number) => string; syncs: string; syncsHint: (raw: string) => string; games: string; gamesHint: (avgPlayers: string) => string; health: string; healthHint: (version: string) => string; profiles: string; profilesHint: (active: number, withSessions: number) => string };
  detail: { users: string; usersHint: string; institutions: string; institutionsHint: string; devices: string; devicesHint: string; syncs: string; syncsHint: string; games: string; gamesHint: string; profiles: string; profilesHint: string; health: string; healthHint: string; trendTitle: (label: string) => string; trendHint: string; trendSyncs: string; trendSyncsHint: string; trendGames: string; trendGamesHint: string; trendTurns: string; trendTurnsHint: (rate: number) => string; activeProfiles: string; activeProfilesHint: (count: number) => string; boundProfiles: string; boundProfilesHint: string; sessionProfiles: string; sessionProfilesHint: string; unboundProfiles: string; unboundProfilesHint: string; coverageTitle: (label: string) => string; coverageHint: string; usersByRoleTitle: (label: string) => string; usersByRoleHint: string; usersInRole: string; usersByTypeTitle: (label: string) => string; usersByTypeHint: string; usersInType: string; institutionTitle: (label: string) => string; institutionHint: string; readiness: string; degradedChecks: string; backend: (version: string) => string; noDetail: string; check: (index: number) => string };
  executive: { miniTrends: string; miniTrendsDesc: (rangeLabel: string) => string; trendSyncsPeriod: string; trendSyncsPeriodHint: (count: number) => string; trendGamesPeriod: string; trendGamesPeriodHint: (count: number) => string; recentSuccess: string; recentSuccessHint: (rate: number) => string; comparison: string; comparisonDesc: (window: string) => string; previousPeriod: (value: number) => string; semaphores: string; semaphoresDesc: string };
  territorial: { smartPresets: string; smartPresetsDesc: string; savedViews: string; savedViewsDesc: string; linkCopied: string; linkError: string; copyLink: string; saveView: string; promptName: string; delete: string; generalView: string; applyPreset: string; noPresets: string; drilldown: string; drilldownDesc: string; exportCsv: string; filterCountry: string; filterState: string; noDrilldown: string; territoryAlerts: string; territoryAlertsDesc: string; noTerritoryAlerts: string; territoryIndex: string; territoryIndexDesc: string; noTerritoryIndex: string; topTerritories: string; topTerritoriesDesc: string; topTerritory: string; noTopTerritories: string; cohorts: string; cohortsDesc: string; roles: string; userTypes: string; noData: string; featuredInstitutions: string; featuredInstitutionsDesc: string; noTerritoryDetail: string; noFeaturedInstitutions: string };
  summaries: { usage: string; usageDesc: string; turnsGames: string; turnsGamesHint: (turns: number, avg: string) => string; turnsSuccess: string; turnsSuccessHint: (rate: string) => string; dataQuality: string; dataQualityDesc: string; identifiedDevices: string; identifiedDevicesHint: (firmware: string, owner: string) => string; usefulProfiles: string; usefulProfilesHint: (sessions: string, bindings: string) => string; distribution: string; distributionDesc: string; homeVsInstitution: string; homeVsInstitutionHint: (home: number, institution: number) => string; sourceCoverage: string; sourceCoverageHint: (loaded: number, failed: number) => string };
  charts: { profileCoverage: string; profileCoverageDesc: string; usersByRole: string; usersByRoleDesc: string; usersByType: string; usersByTypeDesc: string; institutionLoad: string; institutionLoadDescSystem: string; institutionLoadDescLocal: string; turns: string };
  error: (message: string) => string;
}> = {
  es: {
    scope: { admin: "Superadmin", government: "Gobierno", institutionAdmin: "Admin institucional", director: "Dirección", operation: "Operación" },
    header: { title: "Centro de control MagicBox", description: "Panel principal para leer estado, riesgos y próximos focos sin perderte entre módulos." },
    quickLook: { title: "Qué mirar primero", description: "Tres atajos para arrancar por riesgo y no por intuición.", institutions: "Instituciones con review pendiente", institutionsHint: (count) => `${count} instituciones marcan \`needs_review\` en el resumen institucional.`, devices: "Dispositivos sin estado u owner", devicesHint: (withoutStatus, withoutOwner) => `${withoutStatus} sin estado explícito y ${withoutOwner} sin owner asociado.`, syncs: "Cobertura de sync y perfiles", syncsHint: (syncsRaw, profilesBound) => `${syncsRaw} de syncs tienen raw disponible y ${profilesBound} de perfiles tienen binding activo.`, review: "Revisar", attention: "Atención", follow: "Seguir", ok: "OK" },
    metrics: { users: "Usuarios", usersHint: "Padrón actual de usuarios.", institutions: "Instituciones", institutionsHint: "Instituciones incluidas en la vista principal.", devices: "Dispositivos", devicesHint: (home, institution) => `${home} Home y ${institution} institucionales.`, syncs: "Sincronizaciones", syncsHint: (raw) => `${raw} con raw disponible.`, games: "Partidas", gamesHint: (avgPlayers) => `${avgPlayers} jugadores por partida.`, health: "Salud", healthHint: (version) => `Backend ${version}.`, profiles: "Perfiles", profilesHint: (active, withSessions) => `${active} activos y ${withSessions} con sesiones.` },
    detail: { users: "Detalle de usuarios", usersHint: "Padrón actual de usuarios.", institutions: "Detalle de instituciones", institutionsHint: "Instituciones incluidas en la vista principal.", devices: "Detalle de dispositivos", devicesHint: "Cobertura del parque y su estado.", syncs: "Detalle de sincronizaciones", syncsHint: "Lectura ampliada de cobertura y trazabilidad.", games: "Detalle de partidas", gamesHint: "Movimiento real del sistema.", profiles: "Detalle de perfiles", profilesHint: "Madurez real a nivel perfil.", health: "Detalle de salud", healthHint: "Estado de readiness y checks disponibles en la home.", trendTitle: (label) => `Mini tendencias · ${label}`, trendHint: "Detalle del bucket temporal seleccionado en la serie comparada.", trendSyncs: "Syncs", trendSyncsHint: "Volumen del día/bucket", trendGames: "Partidas", trendGamesHint: "Actividad de sesiones", trendTurns: "Turnos", trendTurnsHint: (rate) => `${rate}% de éxito`, activeProfiles: "Activos", activeProfilesHint: (count) => `${count} perfiles en el recorte`, boundProfiles: "Con binding", boundProfilesHint: "Cobertura activa", sessionProfiles: "Con sesiones", sessionProfilesHint: "Uso observable", unboundProfiles: "Sin binding", unboundProfilesHint: "Brecha por cerrar", coverageTitle: (label) => `Cobertura de perfiles · ${label}`, coverageHint: "Desglose del indicador seleccionado.", usersByRoleTitle: (label) => `Usuarios por rol · ${label}`, usersByRoleHint: "Rol seleccionado dentro de la distribución actual.", usersInRole: "Usuarios en este rol", usersByTypeTitle: (label) => `Usuarios por tipo · ${label}`, usersByTypeHint: "Tipo de usuario seleccionado dentro de la distribución actual.", usersInType: "Usuarios en este tipo", institutionTitle: (label) => `Institución · ${label}`, institutionHint: "Detalle ampliado de la institución seleccionada.", readiness: "Readiness", degradedChecks: "Checks degradados", backend: (version) => `Backend ${version}`, noDetail: "Sin detalle", check: (index) => `Check ${index}` },
    executive: { miniTrends: "Mini tendencias", miniTrendsDesc: (rangeLabel) => `Evolución diaria de syncs, partidas y turnos para el recorte actual (${rangeLabel}). Ideal para la futura vista territorial de gobiernos.`, trendSyncsPeriod: "Syncs del período", trendSyncsPeriodHint: (count) => `${count} acumulados en la serie.`, trendGamesPeriod: "Partidas del período", trendGamesPeriodHint: (count) => `${count} registradas en la serie.`, recentSuccess: "Tasa de éxito reciente", recentSuccessHint: (rate) => `${rate}% en el último período de la serie.`, comparison: "Comparativa entre períodos", comparisonDesc: (window) => `Contraste del período actual contra el bloque inmediatamente anterior (${window}).`, previousPeriod: (value) => `Período anterior: ${value}`, semaphores: "Semáforos de seguimiento", semaphoresDesc: "Alertas rápidas construidas sobre la comparación entre períodos y el estado del recorte actual." },
    territorial: { smartPresets: "Presets inteligentes del sistema", smartPresetsDesc: "Vistas ejecutivas de fábrica para priorizar territorios sin tener que construir filtros manuales.", savedViews: "Vistas ejecutivas guardadas", savedViewsDesc: "Presets locales para recuperar rápido combinaciones territoriales que revisas seguido.", linkCopied: "Link copiado", linkError: "No pude copiar", copyLink: "Copiar link", saveView: "Guardar vista actual", promptName: "Nombre de la vista", delete: "Borrar", generalView: "Vista general", applyPreset: "Aplicar preset", noPresets: "Todavía no hay presets guardados. Puedes guardar la combinación actual de filtros y reutilizarla después.", drilldown: "Drilldown territorial", drilldownDesc: "Jerarquía país → estado → ciudad para bajar de nivel sin salir de la home.", exportCsv: "Exportar CSV ejecutivo", filterCountry: "Filtrar país", filterState: "Filtrar estado", noDrilldown: "No hay estructura territorial suficiente para mostrar drilldown en el recorte actual.", territoryAlerts: "Alertas por territorio", territoryAlertsDesc: "Focos subterritoriales que pueden quedar ocultos cuando el agregado país todavía se ve sano.", noTerritoryAlerts: "No hay alertas territoriales activas con el recorte actual.", territoryIndex: "Índice territorial compuesto", territoryIndexDesc: "Score ejecutivo para ordenar prioridades por territorio combinando actividad, cobertura y señales de riesgo.", noTerritoryIndex: "Todavía no hay suficiente señal para calcular un índice territorial útil.", topTerritories: "Territorios con mayor actividad", topTerritoriesDesc: "Lectura rápida de dónde se concentra hoy la población activa.", topTerritory: "Top territorio", noTopTerritories: "Todavía no hay suficiente señal para rankear territorios con el recorte actual.", cohorts: "Cohortes", cohortsDesc: "Mix resumido de roles y tipos de usuario dentro del territorio.", roles: "Roles", userTypes: "Tipos de usuario", noData: "Sin datos", featuredInstitutions: "Instituciones destacadas en el territorio", featuredInstitutionsDesc: "Comparativa compacta para detectar dónde hay mayor actividad o cobertura.", noTerritoryDetail: "Sin territorio detallado", noFeaturedInstitutions: "El recorte actual todavía no muestra instituciones con actividad suficiente para destacarlas." },
    summaries: { usage: "Uso y actividad", usageDesc: "Estadísticas rápidas para leer el movimiento real del sistema.", turnsGames: "Turnos y partidas", turnsGamesHint: (turns, avg) => `${turns} turnos, ${avg} turnos por partida con actividad.`, turnsSuccess: "Éxito de turnos", turnsSuccessHint: (rate) => `${rate} de los turnos terminaron en éxito.`, dataQuality: "Calidad del dato", dataQualityDesc: "Cobertura útil para detectar dónde falta trazabilidad o vínculo entre datos.", identifiedDevices: "Dispositivos identificados", identifiedDevicesHint: (firmware, owner) => `${firmware} tienen firmware registrado y ${owner} tienen owner asociado.`, usefulProfiles: "Profiles útiles", usefulProfilesHint: (sessions, bindings) => `${sessions} tienen sesiones y ${bindings} tienen binding activo.`, distribution: "Distribución general", distributionDesc: "Cómo está repartido hoy el parque disponible.", homeVsInstitution: "Devices Home vs institución", homeVsInstitutionHint: (home, institution) => `${home} Home, ${institution} institucionales.`, sourceCoverage: "Cobertura de fuentes", sourceCoverageHint: (loaded, failed) => `${loaded} fuentes respondieron correctamente y ${failed} fallaron; la home sigue disponible con degradación parcial.` },
    charts: { profileCoverage: "Cobertura de perfiles", profileCoverageDesc: "Perfiles activos, con binding y con sesiones para medir madurez real del uso.", usersByRole: "Usuarios por rol", usersByRoleDesc: "Distribución del padrón por rol para entender de un vistazo quién sostiene la operación observada.", usersByType: "Usuarios por tipo", usersByTypeDesc: "Composición por tipos de usuario para detectar sesgos de adopción o cobertura.", institutionLoad: "Instituciones con mayor carga", institutionLoadDescSystem: "Comparativa de instituciones por usuarios y referencia secundaria de turnos o actividad observada.", institutionLoadDescLocal: "Comparativa local por estudiantes con referencia secundaria de usuarios.", turns: "Turnos" },
    error: (message) => `No pude cargar una parte del dashboard: ${message}. La home sigue mostrando las fuentes que sí respondieron.`,
  },
  en: { scope: { admin: "Superadmin", government: "Government", institutionAdmin: "Institution admin", director: "Leadership", operation: "Operations" }, header: { title: "MagicBox control center", description: "Main panel to read status, risks, and next priorities without getting lost between modules." }, quickLook: { title: "What to look at first", description: "Three shortcuts to start from risk, not intuition.", institutions: "Institutions pending review", institutionsHint: (count) => `${count} institutions are flagged with \`needs_review\` in the institutional summary.`, devices: "Devices without status or owner", devicesHint: (withoutStatus, withoutOwner) => `${withoutStatus} without explicit status and ${withoutOwner} without an assigned owner.`, syncs: "Sync and profile coverage", syncsHint: (syncsRaw, profilesBound) => `${syncsRaw} of syncs have raw data available and ${profilesBound} of profiles have an active binding.`, review: "Review", attention: "Attention", follow: "Follow up", ok: "OK" }, metrics: { users: "Users", usersHint: "Current user roster.", institutions: "Institutions", institutionsHint: "Institutions included in the main view.", devices: "Devices", devicesHint: (home, institution) => `${home} Home and ${institution} institutional.`, syncs: "Syncs", syncsHint: (raw) => `${raw} with raw data available.`, games: "Games", gamesHint: (avgPlayers) => `${avgPlayers} players per game.`, health: "Health", healthHint: (version) => `Backend ${version}.`, profiles: "Profiles", profilesHint: (active, withSessions) => `${active} active and ${withSessions} with sessions.` }, detail: { users: "User details", usersHint: "Current user roster.", institutions: "Institution details", institutionsHint: "Institutions included in the main view.", devices: "Device details", devicesHint: "Fleet coverage and status.", syncs: "Sync details", syncsHint: "Expanded view of coverage and traceability.", games: "Game details", gamesHint: "Real system activity.", profiles: "Profile details", profilesHint: "Real maturity at profile level.", health: "Health details", healthHint: "Readiness state and checks available in the home view.", trendTitle: (label) => `Mini trends · ${label}`, trendHint: "Details for the selected time bucket in the compared series.", trendSyncs: "Syncs", trendSyncsHint: "Day/bucket volume", trendGames: "Games", trendGamesHint: "Session activity", trendTurns: "Turns", trendTurnsHint: (rate) => `${rate}% success`, activeProfiles: "Active", activeProfilesHint: (count) => `${count} profiles in the slice`, boundProfiles: "With binding", boundProfilesHint: "Active coverage", sessionProfiles: "With sessions", sessionProfilesHint: "Observable usage", unboundProfiles: "Without binding", unboundProfilesHint: "Gap to close", coverageTitle: (label) => `Profile coverage · ${label}`, coverageHint: "Breakdown of the selected indicator.", usersByRoleTitle: (label) => `Users by role · ${label}`, usersByRoleHint: "Selected role inside the current distribution.", usersInRole: "Users in this role", usersByTypeTitle: (label) => `Users by type · ${label}`, usersByTypeHint: "Selected user type inside the current distribution.", usersInType: "Users in this type", institutionTitle: (label) => `Institution · ${label}`, institutionHint: "Expanded detail for the selected institution.", readiness: "Readiness", degradedChecks: "Degraded checks", backend: (version) => `Backend ${version}`, noDetail: "No detail", check: (index) => `Check ${index}` }, executive: { miniTrends: "Mini trends", miniTrendsDesc: (rangeLabel) => `Daily evolution of syncs, games, and turns for the current slice (${rangeLabel}). Ideal for the future territorial government view.`, trendSyncsPeriod: "Syncs in period", trendSyncsPeriodHint: (count) => `${count} accumulated in the series.`, trendGamesPeriod: "Games in period", trendGamesPeriodHint: (count) => `${count} recorded in the series.`, recentSuccess: "Recent success rate", recentSuccessHint: (rate) => `${rate}% in the latest period of the series.`, comparison: "Period comparison", comparisonDesc: (window) => `Contrast between the current period and the immediately previous block (${window}).`, previousPeriod: (value) => `Previous period: ${value}`, semaphores: "Follow-up signals", semaphoresDesc: "Quick alerts built on the period comparison and the state of the current slice." }, territorial: { smartPresets: "Smart system presets", smartPresetsDesc: "Factory executive views to prioritize territories without manually building filters.", savedViews: "Saved executive views", savedViewsDesc: "Local presets to quickly recover territorial combinations you review often.", linkCopied: "Link copied", linkError: "Couldn't copy", copyLink: "Copy link", saveView: "Save current view", promptName: "View name", delete: "Delete", generalView: "General view", applyPreset: "Apply preset", noPresets: "There are no saved presets yet. You can save the current filter combination and reuse it later.", drilldown: "Territorial drilldown", drilldownDesc: "Country → state → city hierarchy to go deeper without leaving home.", exportCsv: "Export executive CSV", filterCountry: "Filter country", filterState: "Filter state", noDrilldown: "There is not enough territorial structure to show drilldown in the current slice.", territoryAlerts: "Territory alerts", territoryAlertsDesc: "Sub-territorial hotspots that can stay hidden when the country aggregate still looks healthy.", noTerritoryAlerts: "There are no active territorial alerts for the current slice.", territoryIndex: "Composite territorial index", territoryIndexDesc: "Executive score to order priorities by territory, combining activity, coverage, and risk signals.", noTerritoryIndex: "There is not enough signal yet to calculate a useful territorial index.", topTerritories: "Territories with highest activity", topTerritoriesDesc: "Quick read of where the active population is concentrated today.", topTerritory: "Top territory", noTopTerritories: "There is not enough signal yet to rank territories in the current slice.", cohorts: "Cohorts", cohortsDesc: "Compact mix of roles and user types inside the territory.", roles: "Roles", userTypes: "User types", noData: "No data", featuredInstitutions: "Featured institutions in the territory", featuredInstitutionsDesc: "Compact comparison to detect where activity or coverage is highest.", noTerritoryDetail: "No territorial detail", noFeaturedInstitutions: "The current slice still does not show institutions with enough activity to feature." }, summaries: { usage: "Usage and activity", usageDesc: "Quick stats to read real system movement.", turnsGames: "Turns and games", turnsGamesHint: (turns, avg) => `${turns} turns, ${avg} turns per active game.`, turnsSuccess: "Turn success", turnsSuccessHint: (rate) => `${rate} of turns ended successfully.`, dataQuality: "Data quality", dataQualityDesc: "Useful coverage to detect where traceability or data links are missing.", identifiedDevices: "Identified devices", identifiedDevicesHint: (firmware, owner) => `${firmware} have recorded firmware and ${owner} have an assigned owner.`, usefulProfiles: "Useful profiles", usefulProfilesHint: (sessions, bindings) => `${sessions} have sessions and ${bindings} have an active binding.`, distribution: "General distribution", distributionDesc: "How the available fleet is distributed today.", homeVsInstitution: "Home vs institution devices", homeVsInstitutionHint: (home, institution) => `${home} Home, ${institution} institutional.`, sourceCoverage: "Source coverage", sourceCoverageHint: (loaded, failed) => `${loaded} sources responded correctly and ${failed} failed; the home view remains available with partial degradation.` }, charts: { profileCoverage: "Profile coverage", profileCoverageDesc: "Active profiles, with binding, and with sessions to measure real usage maturity.", usersByRole: "Users by role", usersByRoleDesc: "Roster distribution by role to quickly understand who sustains the observed operation.", usersByType: "Users by type", usersByTypeDesc: "Composition by user types to detect adoption or coverage bias.", institutionLoad: "Institutions with highest load", institutionLoadDescSystem: "Institution comparison by users with a secondary reference of turns or observed activity.", institutionLoadDescLocal: "Local comparison by students with a secondary reference of users.", turns: "Turns" }, error: (message) => `I couldn't load part of the dashboard: ${message}. The home view still shows the sources that responded.` },
  pt: { scope: { admin: "Superadmin", government: "Governo", institutionAdmin: "Admin institucional", director: "Direção", operation: "Operação" }, header: { title: "Centro de controle MagicBox", description: "Painel principal para ler estado, riscos e próximos focos sem se perder entre módulos." }, quickLook: { title: "O que olhar primeiro", description: "Três atalhos para começar pelo risco e não pela intuição.", institutions: "Instituições com revisão pendente", institutionsHint: (count) => `${count} instituições marcam \`needs_review\` no resumo institucional.`, devices: "Dispositivos sem estado ou owner", devicesHint: (withoutStatus, withoutOwner) => `${withoutStatus} sem estado explícito e ${withoutOwner} sem owner associado.`, syncs: "Cobertura de sync e perfis", syncsHint: (syncsRaw, profilesBound) => `${syncsRaw} dos syncs têm raw disponível e ${profilesBound} dos perfis têm binding ativo.`, review: "Revisar", attention: "Atenção", follow: "Acompanhar", ok: "OK" }, metrics: { users: "Usuários", usersHint: "Cadastro atual de usuários.", institutions: "Instituições", institutionsHint: "Instituições incluídas na visão principal.", devices: "Dispositivos", devicesHint: (home, institution) => `${home} Home e ${institution} institucionais.`, syncs: "Sincronizações", syncsHint: (raw) => `${raw} com raw disponível.`, games: "Partidas", gamesHint: (avgPlayers) => `${avgPlayers} jogadores por partida.`, health: "Saúde", healthHint: (version) => `Backend ${version}.`, profiles: "Perfis", profilesHint: (active, withSessions) => `${active} ativos e ${withSessions} com sessões.` }, detail: { users: "Detalhe de usuários", usersHint: "Cadastro atual de usuários.", institutions: "Detalhe de instituições", institutionsHint: "Instituições incluídas na visão principal.", devices: "Detalhe de dispositivos", devicesHint: "Cobertura do parque e seu estado.", syncs: "Detalhe de sincronizações", syncsHint: "Leitura ampliada de cobertura e rastreabilidade.", games: "Detalhe de partidas", gamesHint: "Movimento real do sistema.", profiles: "Detalhe de perfis", profilesHint: "Maturidade real no nível de perfil.", health: "Detalhe de saúde", healthHint: "Estado de readiness e checks disponíveis na home.", trendTitle: (label) => `Mini tendências · ${label}`, trendHint: "Detalhe do bucket temporal selecionado na série comparada.", trendSyncs: "Syncs", trendSyncsHint: "Volume do dia/bucket", trendGames: "Partidas", trendGamesHint: "Atividade de sessões", trendTurns: "Turnos", trendTurnsHint: (rate) => `${rate}% de sucesso`, activeProfiles: "Ativos", activeProfilesHint: (count) => `${count} perfis no recorte`, boundProfiles: "Com binding", boundProfilesHint: "Cobertura ativa", sessionProfiles: "Com sessões", sessionProfilesHint: "Uso observável", unboundProfiles: "Sem binding", unboundProfilesHint: "Lacuna a fechar", coverageTitle: (label) => `Cobertura de perfis · ${label}`, coverageHint: "Desdobramento do indicador selecionado.", usersByRoleTitle: (label) => `Usuários por papel · ${label}`, usersByRoleHint: "Papel selecionado dentro da distribuição atual.", usersInRole: "Usuários neste papel", usersByTypeTitle: (label) => `Usuários por tipo · ${label}`, usersByTypeHint: "Tipo de usuário selecionado dentro da distribuição atual.", usersInType: "Usuários neste tipo", institutionTitle: (label) => `Instituição · ${label}`, institutionHint: "Detalhe ampliado da instituição selecionada.", readiness: "Readiness", degradedChecks: "Checks degradados", backend: (version) => `Backend ${version}`, noDetail: "Sem detalhe", check: (index) => `Check ${index}` }, executive: { miniTrends: "Mini tendências", miniTrendsDesc: (rangeLabel) => `Evolução diária de syncs, partidas e turnos para o recorte atual (${rangeLabel}). Ideal para a futura visão territorial de governos.`, trendSyncsPeriod: "Syncs do período", trendSyncsPeriodHint: (count) => `${count} acumulados na série.`, trendGamesPeriod: "Partidas do período", trendGamesPeriodHint: (count) => `${count} registradas na série.`, recentSuccess: "Taxa de sucesso recente", recentSuccessHint: (rate) => `${rate}% no último período da série.`, comparison: "Comparativo entre períodos", comparisonDesc: (window) => `Contraste do período atual com o bloco imediatamente anterior (${window}).`, previousPeriod: (value) => `Período anterior: ${value}`, semaphores: "Semáforos de acompanhamento", semaphoresDesc: "Alertas rápidos construídos sobre a comparação entre períodos e o estado do recorte atual." }, territorial: { smartPresets: "Presets inteligentes do sistema", smartPresetsDesc: "Visões executivas de fábrica para priorizar territórios sem montar filtros manualmente.", savedViews: "Visões executivas salvas", savedViewsDesc: "Presets locais para recuperar rápido combinações territoriais que você revisa com frequência.", linkCopied: "Link copiado", linkError: "Não consegui copiar", copyLink: "Copiar link", saveView: "Salvar visão atual", promptName: "Nome da visão", delete: "Excluir", generalView: "Visão geral", applyPreset: "Aplicar preset", noPresets: "Ainda não há presets salvos. Você pode salvar a combinação atual de filtros e reutilizá-la depois.", drilldown: "Drilldown territorial", drilldownDesc: "Hierarquia país → estado → cidade para descer de nível sem sair da home.", exportCsv: "Exportar CSV executivo", filterCountry: "Filtrar país", filterState: "Filtrar estado", noDrilldown: "Não há estrutura territorial suficiente para mostrar drilldown no recorte atual.", territoryAlerts: "Alertas por território", territoryAlertsDesc: "Focos subterritoriais que podem ficar escondidos quando o agregado do país ainda parece saudável.", noTerritoryAlerts: "Não há alertas territoriais ativos no recorte atual.", territoryIndex: "Índice territorial composto", territoryIndexDesc: "Score executivo para ordenar prioridades por território combinando atividade, cobertura e sinais de risco.", noTerritoryIndex: "Ainda não há sinal suficiente para calcular um índice territorial útil.", topTerritories: "Territórios com maior atividade", topTerritoriesDesc: "Leitura rápida de onde a população ativa se concentra hoje.", topTerritory: "Top território", noTopTerritories: "Ainda não há sinal suficiente para ranquear territórios com o recorte atual.", cohorts: "Coortes", cohortsDesc: "Mix resumido de papéis e tipos de usuário dentro do território.", roles: "Papéis", userTypes: "Tipos de usuário", noData: "Sem dados", featuredInstitutions: "Instituições destacadas no território", featuredInstitutionsDesc: "Comparativo compacto para detectar onde há maior atividade ou cobertura.", noTerritoryDetail: "Sem detalhe territorial", noFeaturedInstitutions: "O recorte atual ainda não mostra instituições com atividade suficiente para destacá-las." }, summaries: { usage: "Uso e atividade", usageDesc: "Estatísticas rápidas para ler o movimento real do sistema.", turnsGames: "Turnos e partidas", turnsGamesHint: (turns, avg) => `${turns} turnos, ${avg} turnos por partida com atividade.`, turnsSuccess: "Sucesso dos turnos", turnsSuccessHint: (rate) => `${rate} dos turnos terminaram com sucesso.`, dataQuality: "Qualidade do dado", dataQualityDesc: "Cobertura útil para detectar onde falta rastreabilidade ou vínculo entre dados.", identifiedDevices: "Dispositivos identificados", identifiedDevicesHint: (firmware, owner) => `${firmware} têm firmware registrado e ${owner} têm owner associado.`, usefulProfiles: "Perfis úteis", usefulProfilesHint: (sessions, bindings) => `${sessions} têm sessões e ${bindings} têm binding ativo.`, distribution: "Distribuição geral", distributionDesc: "Como o parque disponível está distribuído hoje.", homeVsInstitution: "Devices Home vs instituição", homeVsInstitutionHint: (home, institution) => `${home} Home, ${institution} institucionais.`, sourceCoverage: "Cobertura de fontes", sourceCoverageHint: (loaded, failed) => `${loaded} fontes responderam corretamente e ${failed} falharam; a home segue disponível com degradação parcial.` }, charts: { profileCoverage: "Cobertura de perfis", profileCoverageDesc: "Perfis ativos, com binding e com sessões para medir a maturidade real do uso.", usersByRole: "Usuários por papel", usersByRoleDesc: "Distribuição do cadastro por papel para entender rapidamente quem sustenta a operação observada.", usersByType: "Usuários por tipo", usersByTypeDesc: "Composição por tipos de usuário para detectar vieses de adoção ou cobertura.", institutionLoad: "Instituições com maior carga", institutionLoadDescSystem: "Comparativo de instituições por usuários com referência secundária de turnos ou atividade observada.", institutionLoadDescLocal: "Comparativo local por estudantes com referência secundária de usuários.", turns: "Turnos" }, error: (message) => `Não consegui carregar parte do dashboard: ${message}. A home continua mostrando as fontes que responderam.` },
};

function formatPercent(value: number, total: number) {
  if (total <= 0) return "Sin datos";
  return `${Math.round((value / total) * 100)}%`;
}

function formatAverage(total: number, count: number, digits = 1) {
  if (count <= 0) return "Sin datos";
  return (total / count).toFixed(digits);
}

function normalizeLabel(value?: string | null) {
  return (value || "sin dato").replace(/[|]/g, " / ").replace(/[-_]/g, " ").trim().toLowerCase();
}

type TerritorialPreset = {
  id: string;
  name: string;
  filters: Partial<Record<"range" | "institution_id" | "country_code" | "state" | "city" | "user_type" | "role_code" | "smart_preset", string>>;
};

const TERRITORIAL_PRESETS_STORAGE_KEY = "magicbox:territorial-presets";
const EMPTY_LIST: never[] = [];
const EMPTY_HEALTH_CHECKS: Record<string, HealthCheckItem> = {};
const territorialPresetListeners = new Set<() => void>();

function getDashboardDateValue(...values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(value)) || null;
}

function buildExecutiveTrendSeries(games: GameRecord[], syncs: SyncSessionRecord[]) {
  const map = new Map<string, { date: string; label: string; syncs: number; games: number; turns: number; success_rate: number; successfulTurns: number; totalTurns: number; sortValue: number }>();

  for (const game of games) {
    const source = getDashboardDateValue(game.startDate, game.createdAt, game.updatedAt);
    const date = source ? new Date(source) : null;
    if (!date || Number.isNaN(date.getTime())) continue;
    const key = date.toISOString().slice(0, 10);
    const current = map.get(key) || {
      date: key,
      label: key,
      syncs: 0,
      games: 0,
      turns: 0,
      success_rate: 0,
      successfulTurns: 0,
      totalTurns: 0,
      sortValue: date.getTime(),
    };

    current.games += 1;
    current.turns += game.turns.length;
    current.totalTurns += game.turns.length;
    current.successfulTurns += game.turns.filter((turn) => turn.success).length;
    current.success_rate = current.totalTurns > 0 ? Math.round((current.successfulTurns / current.totalTurns) * 100) : 0;
    map.set(key, current);
  }

  for (const sync of syncs) {
    const source = getDashboardDateValue(sync.startedAt, sync.createdAt, sync.updatedAt, sync.receivedAt, sync.capturedAt);
    const date = source ? new Date(source) : null;
    if (!date || Number.isNaN(date.getTime())) continue;
    const key = date.toISOString().slice(0, 10);
    const current = map.get(key) || {
      date: key,
      label: key,
      syncs: 0,
      games: 0,
      turns: 0,
      success_rate: 0,
      successfulTurns: 0,
      totalTurns: 0,
      sortValue: date.getTime(),
    };

    current.syncs += 1;
    map.set(key, current);
  }

  return [...map.values()]
    .sort((a, b) => a.sortValue - b.sortValue)
    .map((item) => ({
      date: item.date,
      label: item.label,
      syncs: item.syncs,
      games: item.games,
      turns: item.turns,
      success_rate: item.success_rate,
    }));
}

function buildInstitutionLoadSeriesFromActivity(institutions: InstitutionRecord[], users: UserRecord[], games: GameRecord[]) {
  const institutionById = new Map(institutions.map((institution) => [institution.id, institution.name]));
  const totals = new Map<string, { label: string; value: number; secondaryValue: number }>();

  for (const user of users) {
    const institutionId = user.educationalCenterId;
    if (!institutionId) continue;
    const current = totals.get(institutionId) || {
      label: institutionById.get(institutionId) || `Institución ${institutionId}`,
      value: 0,
      secondaryValue: 0,
    };
    current.value += 1;
    totals.set(institutionId, current);
  }

  for (const game of games) {
    const institutionId = game.educationalCenterId;
    if (!institutionId) continue;
    const current = totals.get(institutionId) || {
      label: institutionById.get(institutionId) || `Institución ${institutionId}`,
      value: 0,
      secondaryValue: 0,
    };
    current.secondaryValue += game.turns.length;
    totals.set(institutionId, current);
  }

  return [...totals.values()]
    .filter((item) => item.value > 0 || item.secondaryValue > 0)
    .sort((a, b) => (b.value + b.secondaryValue) - (a.value + a.secondaryValue))
    .slice(0, 8);
}

function buildDashboardLocationSeeds(institutions: InstitutionRecord[], devices: Array<{ educationalCenterId?: string | null; ownerUserId?: string | null; assignmentScope?: string | null }>, users: UserRecord[]) {
  const deviceCountByInstitutionId = new Map<string, number>();
  const deviceCountByOwnerId = new Map<string, number>();

  for (const device of devices) {
    if (device.educationalCenterId) {
      deviceCountByInstitutionId.set(device.educationalCenterId, (deviceCountByInstitutionId.get(device.educationalCenterId) || 0) + 1);
    }
    if (device.ownerUserId) {
      deviceCountByOwnerId.set(device.ownerUserId, (deviceCountByOwnerId.get(device.ownerUserId) || 0) + 1);
    }
  }

  const seeds: DashboardLocationSeed[] = [];

  for (const institution of institutions) {
    const query = [
      institution.address?.addressFirstLine,
      institution.address?.city || institution.city,
      institution.address?.state,
      institution.address?.countryCode || institution.country,
    ].filter(Boolean).join(", ");

    if (!query) continue;

    const institutionDeviceCount = deviceCountByInstitutionId.get(institution.id) || institution.operationalSummary?.deviceCount || 0;

    seeds.push({
      key: `institution-${institution.id}`,
      label: institution.name,
      query,
      detail: [institution.address?.city || institution.city, institution.address?.state, institution.address?.countryCode || institution.country].filter(Boolean).join(" · ") || "Institución con dirección cargada",
      kind: "institution",
      deviceCount: institutionDeviceCount,
      institutionCount: 1,
    });
  }

  const ownerSeeds = new Map<string, DashboardLocationSeed>();
  for (const user of users) {
    if (!user.address) continue;
    const ownerDeviceCount = deviceCountByOwnerId.get(user.id) || 0;
    if (ownerDeviceCount <= 0) continue;

    const query = [user.address.addressFirstLine, user.address.city, user.address.state, user.address.countryCode].filter(Boolean).join(", ");
    if (!query) continue;

    const key = `owner-${query.toLowerCase()}`;
    const current = ownerSeeds.get(key) || {
      key,
      label: user.fullName || user.email || "Owner home",
      query,
      detail: [user.address.city, user.address.state, user.address.countryCode].filter(Boolean).join(" · ") || "Owner con dirección cargada",
      kind: "home-device",
      deviceCount: 0,
      institutionCount: 0,
    } satisfies DashboardLocationSeed;

    current.deviceCount += ownerDeviceCount;
    ownerSeeds.set(key, current);
  }

  return [...seeds, ...ownerSeeds.values()]
    .filter((seed) => seed.deviceCount > 0 || seed.institutionCount > 0)
    .sort((a, b) => (b.deviceCount + b.institutionCount) - (a.deviceCount + a.institutionCount));
}

function readStoredTerritorialPresetsSnapshot() {
  if (typeof window === "undefined") return "[]";
  if (typeof window.localStorage?.getItem !== "function") return "[]";
  return window.localStorage.getItem(TERRITORIAL_PRESETS_STORAGE_KEY) || "[]";
}

function emitTerritorialPresetChange() {
  territorialPresetListeners.forEach((listener) => listener());
}

function subscribeToTerritorialPresets(onStoreChange: () => void) {
  territorialPresetListeners.add(onStoreChange);

  if (typeof window !== "undefined") {
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== TERRITORIAL_PRESETS_STORAGE_KEY) return;
      onStoreChange();
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      territorialPresetListeners.delete(onStoreChange);
      window.removeEventListener("storage", handleStorage);
    };
  }

  return () => {
    territorialPresetListeners.delete(onStoreChange);
  };
}

export function SuperadminDashboard() {
  const { language } = useLanguage();
  const t = superadminMessages[language];
  const formatPercentLocalized = (value: number, total: number) => {
    if (total <= 0) return t.territorial.noData;
    return `${Math.round((value / total) * 100)}%`;
  };
  const formatAverageLocalized = (total: number, count: number, digits = 1) => {
    if (count <= 0) return t.territorial.noData;
    return (total / count).toFixed(digits);
  };
  const localText = language === "en"
    ? {
        smartPreset: { all: "General view", critical: "Critical territories", scoreLt60: "Score < 60", noTurns: "No turns", highPopulationLowActivity: "High population, low activity" },
        detail: {
          total: "Total",
          role: "Role",
          roleMix: "Aggregated mix for the current slice",
          type: "Type",
          typeMix: "Composition by user type",
          user: "User",
          noRole: "No role",
          homeDevices: "Home devices",
          homeFleet: "Home fleet",
          institutionDevices: "Institution devices",
          institutionFleet: "Institutional fleet",
          withOwner: "With owner",
          withOwnerHint: "Devices linked to a person",
          withFirmware: "With firmware",
          withFirmwareHint: "Devices with recorded version",
          withoutStatus: "Without status",
          withoutStatusHint: "Devices to review",
          noStatus: "No status",
          noReference: "No recorded reference",
          withoutRaw: "Without raw",
          traceabilityGap: "Traceability gap",
          totalTurns: (turns: number) => `${turns} total turns`,
          success: (rate: number) => `${rate}% success`,
          turns: (count: number) => `${count} turns`,
          players: (count: number) => `${count} players`,
          active: (count: number) => `${count} active`,
          territorySummary: (users: number, institutions: number, games: number, turns: number) => `${users} users, ${institutions} institutions, ${games} games, ${turns} turns.`,
          citySummary: (city: string, users: number, turns: number) => `${city} · ${users} users · ${turns} turns`,
          activitySummary: (users: number, games: number, turns: number) => `${users} users, ${games} games, ${turns} turns.`,
          topTerritorySummary: (users: number, institutions: number, games: number, turns: number) => `${users} users, ${institutions} institutions, ${games} games, and ${turns} turns.`,
          institutionSummary: (users: number, games: number, turns: number) => `${users} users, ${games} games, ${turns} turns.`,
          usersGroups: (users: number, groups: number) => `${users} users · ${groups} groups`,
          rawAvailable: (count: number) => `${count} with raw data available`,
          rawRecords: (count: number) => `${count} raw records`,
        },
      }
    : language === "pt"
      ? {
          smartPreset: { all: "Visão geral", critical: "Territórios críticos", scoreLt60: "Score < 60", noTurns: "Sem turnos", highPopulationLowActivity: "Alta população, baixa atividade" },
          detail: {
            total: "Total",
            role: "Papel",
            roleMix: "Mix agregado do recorte atual",
            type: "Tipo",
            typeMix: "Composição por tipo de usuário",
            user: "Usuário",
            noRole: "Sem papel",
            homeDevices: "Dispositivos Home",
            homeFleet: "Parque doméstico",
            institutionDevices: "Dispositivos institucionais",
            institutionFleet: "Parque institucional",
            withOwner: "Com owner",
            withOwnerHint: "Dispositivos associados a uma pessoa",
            withFirmware: "Com firmware",
            withFirmwareHint: "Dispositivos com versão registrada",
            withoutStatus: "Sem estado",
            withoutStatusHint: "Equipamentos a revisar",
            noStatus: "Sem status",
            noReference: "Sem referência registrada",
            withoutRaw: "Sem raw",
            traceabilityGap: "Lacuna de rastreabilidade",
            totalTurns: (turns: number) => `${turns} turnos totais`,
            success: (rate: number) => `${rate}% de sucesso`,
            turns: (count: number) => `${count} turnos`,
            players: (count: number) => `${count} jogadores`,
            active: (count: number) => `${count} ativos`,
            territorySummary: (users: number, institutions: number, games: number, turns: number) => `${users} usuários, ${institutions} instituições, ${games} partidas, ${turns} turnos.`,
            citySummary: (city: string, users: number, turns: number) => `${city} · ${users} usuários · ${turns} turnos`,
            activitySummary: (users: number, games: number, turns: number) => `${users} usuários, ${games} partidas, ${turns} turnos.`,
            topTerritorySummary: (users: number, institutions: number, games: number, turns: number) => `${users} usuários, ${institutions} instituições, ${games} partidas e ${turns} turnos.`,
            institutionSummary: (users: number, games: number, turns: number) => `${users} usuários, ${games} partidas, ${turns} turnos.`,
            usersGroups: (users: number, groups: number) => `${users} usuários · ${groups} grupos`,
            rawAvailable: (count: number) => `${count} com raw disponível`,
            rawRecords: (count: number) => `${count} registros raw`,
          },
        }
      : {
          smartPreset: { all: "Vista general", critical: "Territorios críticos", scoreLt60: "Score < 60", noTurns: "Sin turnos", highPopulationLowActivity: "Alta población, baja actividad" },
          detail: {
            total: "Total",
            role: "Rol",
            roleMix: "Mix agregado del recorte actual",
            type: "Tipo",
            typeMix: "Composición por tipo de usuario",
            user: "Usuario",
            noRole: "Sin rol",
            homeDevices: "Dispositivos Home",
            homeFleet: "Parque doméstico",
            institutionDevices: "Dispositivos institucionales",
            institutionFleet: "Parque institucional",
            withOwner: "Con owner",
            withOwnerHint: "Dispositivos asociados a persona",
            withFirmware: "Con firmware",
            withFirmwareHint: "Dispositivos con versión registrada",
            withoutStatus: "Sin estado",
            withoutStatusHint: "Equipos a revisar",
            noStatus: "Sin status",
            noReference: "Sin referencia registrada",
            withoutRaw: "Sin raw",
            traceabilityGap: "Brecha de trazabilidad",
            totalTurns: (turns: number) => `${turns} turnos totales`,
            success: (rate: number) => `${rate}% éxito`,
            turns: (count: number) => `${count} turnos`,
            players: (count: number) => `${count} jugadores`,
            active: (count: number) => `${count} activos`,
            territorySummary: (users: number, institutions: number, games: number, turns: number) => `${users} usuarios, ${institutions} instituciones, ${games} partidas, ${turns} turnos.`,
            citySummary: (city: string, users: number, turns: number) => `${city} · ${users} usuarios · ${turns} turnos`,
            activitySummary: (users: number, games: number, turns: number) => `${users} usuarios, ${games} partidas, ${turns} turnos.`,
            topTerritorySummary: (users: number, institutions: number, games: number, turns: number) => `${users} usuarios, ${institutions} instituciones, ${games} partidas y ${turns} turnos.`,
            institutionSummary: (users: number, games: number, turns: number) => `${users} usuarios, ${games} partidas, ${turns} turnos.`,
            usersGroups: (users: number, groups: number) => `${users} usuarios · ${groups} grupos`,
            rawAvailable: (count: number) => `${count} con raw disponible`,
            rawRecords: (count: number) => `${count} raw records`,
          },
        };
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const territorialPresetsSnapshot = useSyncExternalStore(subscribeToTerritorialPresets, readStoredTerritorialPresetsSnapshot, () => "[]");
  const territorialPresets = useMemo<TerritorialPreset[]>(() => {
    try {
      const parsed = JSON.parse(territorialPresetsSnapshot);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [territorialPresetsSnapshot]);
  const [shareLinkState, setShareLinkState] = useState<"idle" | "copied" | "error">("idle");
  const [selectedDetail, setSelectedDetail] = useState<{ kind: string; label: string } | null>(null);
  const { getRange: getModuleRange, setRange: setModuleRange } = useDashboardModuleControls();
  const { tokens, user } = useAuth();
  const isAdmin = user?.roles.includes("admin") || false;
  const isGovernmentViewer = user?.roles.includes("government-viewer") || false;
  const isInstitutionAdmin = user?.roles.includes("institution-admin") || false;
  const isDirector = user?.roles.includes("director") || false;
  const usesSystemSummary = isAdmin || isGovernmentViewer;
  const canSeeHealthModule = isAdmin;
  const selectedRange = searchParams.get("range") || "30d";
  const selectedInstitutionId = searchParams.get("institution_id");
  const selectedCountryCode = searchParams.get("country_code");
  const selectedState = searchParams.get("state");
  const selectedCity = searchParams.get("city");
  const selectedUserType = searchParams.get("user_type");
  const selectedRoleCode = searchParams.get("role_code");
  const activeSmartPreset = searchParams.get("smart_preset") || "all";
  const summaryFilters = {
    range: selectedRange,
    institutionId: selectedInstitutionId,
    countryCode: selectedCountryCode,
    state: selectedState,
    city: selectedCity,
    userType: selectedUserType,
    roleCode: selectedRoleCode,
  };

  const summaryQuery = useSystemDashboardSummary(tokens?.accessToken, summaryFilters, usesSystemSummary);
  const usersQuery = useUsers(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);
  const devicesQuery = useDevices(tokens?.accessToken);
  const syncsQuery = useSyncSessions(!usesSystemSummary ? tokens?.accessToken : undefined);
  const gamesQuery = useGames(!usesSystemSummary ? tokens?.accessToken : undefined);
  const profilesQuery = useProfilesOverview(!usesSystemSummary ? tokens?.accessToken : undefined);
  const healthQuery = useBasicHealth({ enabled: canSeeHealthModule });
  const readinessQuery = useReadinessHealth({ enabled: canSeeHealthModule });

  const users = usersQuery.data?.data ?? EMPTY_LIST;
  const institutions = institutionsQuery.data?.data ?? EMPTY_LIST;
  const devices = devicesQuery.data?.data ?? EMPTY_LIST;
  const syncs = syncsQuery.data?.data ?? EMPTY_LIST;
  const games = gamesQuery.data?.data ?? EMPTY_LIST;
  const profiles = profilesQuery.data ?? EMPTY_LIST;
  const readinessChecks = readinessQuery.data?.checks ?? EMPTY_HEALTH_CHECKS;

  const visibleQueryStates = usesSystemSummary
    ? [summaryQuery, ...(canSeeHealthModule ? [healthQuery, readinessQuery] : [])]
    : [
        usersQuery,
        institutionsQuery,
        devicesQuery,
        syncsQuery,
        gamesQuery,
        profilesQuery,
        ...(canSeeHealthModule ? [healthQuery, readinessQuery] : []),
      ];

  const loadedSources = visibleQueryStates.filter((query) => query.data).length;
  const failedSources = visibleQueryStates.filter((query) => query.error).length;
  const hasAnyData = usesSystemSummary
    ? Boolean(summaryQuery.data)
    : [users.length, institutions.length, devices.length, syncs.length, games.length, profiles.length].some(
        (count) => count > 0,
      );
  const showInitialLoading = !hasAnyData && visibleQueryStates.some((query) => query.isLoading);
  const errors = visibleQueryStates
    .map((query) => query.error)
    .filter(Boolean)
    .map((error) => getErrorMessage(error));
  const error = errors[0] || null;

  const trendRangeLabel = summaryQuery.data?.filters.trend_range || selectedRange;
  const trends = summaryQuery.data?.trends ?? EMPTY_LIST;
  const comparisonMetrics = summaryQuery.data?.comparisons.metrics ?? EMPTY_LIST;
  const comparisonWindowLabel = summaryQuery.data?.comparisons.window_label || trendRangeLabel;
  const summaryAlerts = summaryQuery.data?.alerts ?? EMPTY_LIST;
  const roleMix = summaryQuery.data?.segments.role_mix ?? EMPTY_LIST;
  const userTypeMix = summaryQuery.data?.segments.user_type_mix ?? EMPTY_LIST;
  const topInstitutions = summaryQuery.data?.segments.top_institutions ?? EMPTY_LIST;
  const topTerritories = summaryQuery.data?.segments.top_territories ?? EMPTY_LIST;
  const territorialHierarchy = summaryQuery.data?.segments.territorial_hierarchy ?? EMPTY_LIST;
  const territoryAlerts = summaryQuery.data?.segments.territory_alerts ?? EMPTY_LIST;
  const territoryScores = summaryQuery.data?.segments.territory_scores ?? EMPTY_LIST;
  const locationSeeds = useMemo(
    () => buildDashboardLocationSeeds(institutions, devices, users),
    [devices, institutions, users],
  );

  const smartPresets = useMemo(
    () => [
      { key: "all", label: localText.smartPreset.all, count: territoryScores.length },
      {
        key: "critical",
        label: localText.smartPreset.critical,
        count: territoryScores.filter((item) => item.status === "warning" || territoryAlerts.some((alert) => alert.label.includes(item.label))).length,
      },
      {
        key: "score_lt_60",
        label: localText.smartPreset.scoreLt60,
        count: territoryScores.filter((item) => item.score < 60).length,
      },
      {
        key: "no_turns",
        label: localText.smartPreset.noTurns,
        count: territoryScores.filter((item) => item.users > 0 && item.turns === 0).length,
      },
      {
        key: "high_population_low_activity",
        label: localText.smartPreset.highPopulationLowActivity,
        count: territoryScores.filter((item) => item.users >= 10 && item.turns / Math.max(item.users, 1) < 0.25).length,
      },
    ],
    [territoryAlerts, territoryScores],
  );
  const filteredTerritoryScores = useMemo(() => {
    switch (activeSmartPreset) {
      case "critical":
        return territoryScores.filter((item) => item.status === "warning" || territoryAlerts.some((alert) => alert.label.includes(item.label)));
      case "score_lt_60":
        return territoryScores.filter((item) => item.score < 60);
      case "no_turns":
        return territoryScores.filter((item) => item.users > 0 && item.turns === 0);
      case "high_population_low_activity":
        return territoryScores.filter((item) => item.users >= 10 && item.turns / Math.max(item.users, 1) < 0.25);
      default:
        return territoryScores;
    }
  }, [activeSmartPreset, territoryAlerts, territoryScores]);

  const filteredTopTerritories = useMemo(() => {
    if (activeSmartPreset === "all") return topTerritories;
    const allowed = new Set(filteredTerritoryScores.map((item) => item.label));
    return topTerritories.filter((item) => allowed.has(item.key));
  }, [activeSmartPreset, filteredTerritoryScores, topTerritories]);

  const filteredTerritoryAlerts = useMemo(() => {
    if (activeSmartPreset === "all") return territoryAlerts;
    const allowed = new Set(filteredTerritoryScores.map((item) => item.label));
    return territoryAlerts.filter((item) => [...allowed].some((label) => item.label.includes(label)));
  }, [activeSmartPreset, filteredTerritoryScores, territoryAlerts]);

  function updateFilter(
    key: "range" | "institution_id" | "country_code" | "state" | "city" | "user_type" | "role_code" | "smart_preset",
    value: string,
  ) {
    updateFilters({ [key]: value });
  }

  function updateFilters(
    entries: Partial<Record<"range" | "institution_id" | "country_code" | "state" | "city" | "user_type" | "role_code" | "smart_preset", string>>,
  ) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(entries)) {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  function updateSmartPreset(value: string) {
    updateFilter("smart_preset", value === "all" ? "" : value);
  }

  function buildSharableSearchParams() {
    const params = new URLSearchParams();
    const entries = {
      range: selectedRange,
      institution_id: selectedInstitutionId || "",
      country_code: selectedCountryCode || "",
      state: selectedState || "",
      city: selectedCity || "",
      user_type: selectedUserType || "",
      role_code: selectedRoleCode || "",
      smart_preset: activeSmartPreset === "all" ? "" : activeSmartPreset,
    } as const;

    for (const [key, value] of Object.entries(entries)) {
      if (value) {
        params.set(key, value);
      }
    }

    return params;
  }

  async function copyCurrentViewLink() {
    if (typeof window === "undefined") return;

    const params = buildSharableSearchParams();
    const relativeUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    const shareUrl = window.location.origin ? `${window.location.origin}${relativeUrl}` : relativeUrl;

    try {
      await window.navigator.clipboard.writeText(shareUrl);
      setShareLinkState("copied");
    } catch {
      setShareLinkState("error");
    }

    window.setTimeout(() => {
      setShareLinkState("idle");
    }, 2200);
  }

  function downloadTerritorialReport() {
    const browserWindow = typeof globalThis !== "undefined" ? (globalThis as typeof window) : undefined;
    if (!summaryQuery.data || !browserWindow?.document || !browserWindow.URL) return;

    const lines = [
      ["section", "label", "status", "score", "users", "games", "turns", "message"].join(","),
      ...territoryScores.map((item) => [
        "territory_score",
        item.label,
        item.status,
        String(item.score),
        String(item.users),
        String(item.games),
        String(item.turns),
        item.reasons.join(" | "),
      ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")),
      ...territoryAlerts.map((item) => [
        "territory_alert",
        item.label,
        item.severity,
        "",
        "",
        "",
        "",
        item.message,
      ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")),
      ...topInstitutions.map((item) => [
        "top_institution",
        item.name,
        "",
        "",
        String(item.users),
        String(item.games),
        String(item.turns),
        [item.state, item.city].filter(Boolean).join(" / "),
      ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = browserWindow.URL.createObjectURL(blob);
    const anchor = browserWindow.document.createElement("a");
    anchor.href = url;
    anchor.download = `territorial-report-${selectedRange}.csv`;
    anchor.click();
    browserWindow.URL.revokeObjectURL(url);
  }

  function persistPresets(nextPresets: TerritorialPreset[]) {
    if (typeof window !== "undefined" && typeof window.localStorage?.setItem === "function") {
      window.localStorage.setItem(TERRITORIAL_PRESETS_STORAGE_KEY, JSON.stringify(nextPresets));
      emitTerritorialPresetChange();
    }
  }

  function saveCurrentPreset() {
    if (typeof window === "undefined") return;
    const suggestedName = [selectedCountryCode, selectedState, selectedCity, selectedRange].filter(Boolean).join(" · ") || "Vista territorial";
    const name = window.prompt(t.territorial.promptName, suggestedName)?.trim();
    if (!name) return;

    const nextPreset: TerritorialPreset = {
      id: `${Date.now()}`,
      name,
      filters: {
        range: selectedRange,
        institution_id: selectedInstitutionId || "",
        country_code: selectedCountryCode || "",
        state: selectedState || "",
        city: selectedCity || "",
        user_type: selectedUserType || "",
        role_code: selectedRoleCode || "",
        smart_preset: activeSmartPreset === "all" ? "" : activeSmartPreset,
      },
    };
    persistPresets([nextPreset, ...territorialPresets].slice(0, 8));
  }

  function applyPreset(preset: TerritorialPreset) {
    updateFilters(preset.filters);
  }

  function deletePreset(id: string) {
    persistPresets(territorialPresets.filter((preset) => preset.id !== id));
  }

  const metrics = useMemo(() => {
    if (usesSystemSummary && summaryQuery.data) {
      return {
        totalUsers: summaryQuery.data.totals.users,
        totalInstitutions: summaryQuery.data.totals.institutions,
        totalDevices: summaryQuery.data.totals.devices,
        totalSyncs: summaryQuery.data.totals.syncs,
        totalGames: summaryQuery.data.totals.games,
        totalProfiles: summaryQuery.data.totals.profiles,
        institutionsNeedingReview: summaryQuery.data.stats.institutions_needing_review,
        devicesWithoutStatus: summaryQuery.data.stats.devices_without_status,
        syncsWithoutRaw: Math.max(summaryQuery.data.totals.syncs - summaryQuery.data.stats.syncs_with_raw, 0),
        profilesWithoutBindings: Math.max(summaryQuery.data.totals.profiles - summaryQuery.data.stats.profiles_with_bindings, 0),
        homeDevices: summaryQuery.data.stats.home_devices,
        institutionDevices: summaryQuery.data.stats.institution_devices,
        devicesWithOwner: summaryQuery.data.stats.devices_with_owner,
        devicesWithFirmware: summaryQuery.data.stats.devices_with_firmware,
        syncsWithRaw: summaryQuery.data.stats.syncs_with_raw,
        activeProfiles: summaryQuery.data.stats.active_profiles,
        profilesWithBindings: summaryQuery.data.stats.profiles_with_bindings,
        profilesWithSessions: summaryQuery.data.stats.profiles_with_sessions,
        totalTurns: summaryQuery.data.totals.turns,
        successfulTurns: summaryQuery.data.stats.successful_turns,
        totalPlayers: summaryQuery.data.stats.total_players,
        gamesWithTurns: summaryQuery.data.stats.games_with_turns,
        degradedChecks: Object.values(readinessChecks).filter((check) => check?.status !== "healthy").length,
        environment: canSeeHealthModule ? healthQuery.data?.environment || "-" : "sin detalle",
        version: canSeeHealthModule ? healthQuery.data?.version || "-" : "no disponible",
        readiness: canSeeHealthModule ? readinessQuery.data?.status || "unknown" : "no disponible",
      };
    }

    const gamesWithTurns = games.filter((game) => (game.turns?.length || 0) > 0);
    const totalTurns = games.reduce((sum, game) => sum + (game.turns?.length || 0), 0);
    const successfulTurns = games.reduce(
      (sum, game) => sum + (game.turns?.filter((turn) => turn.success).length || 0),
      0,
    );
    const totalPlayers = games.reduce((sum, game) => sum + (game.totalPlayers || game.players?.length || 0), 0);
    const homeDevices = devices.filter((device) => device.assignmentScope === "home").length;
    const institutionDevices = devices.filter((device) => device.assignmentScope === "institution").length;
    const devicesWithOwner = devices.filter((device) => device.ownerUserId || device.ownerUserEmail).length;
    const devicesWithFirmware = devices.filter((device) => device.firmwareVersion).length;
    const syncsWithRaw = syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) > 0).length;
    const profilesWithBindings = profiles.filter((profile) => profile.activeBindingCount > 0).length;
    const activeProfiles = profiles.filter((profile) => profile.isActive).length;
    const profilesWithSessions = profiles.filter((profile) => profile.sessionCount > 0).length;

    return {
      totalUsers: usersQuery.data?.total || users.length,
      totalInstitutions: institutionsQuery.data?.total || institutions.length,
      totalDevices: devicesQuery.data?.total || devices.length,
      totalSyncs: syncsQuery.data?.total || syncs.length,
      totalGames: gamesQuery.data?.total || games.length,
      totalProfiles: profiles.length,
      institutionsNeedingReview: institutions.filter((institution) => institution.operationalSummary?.needsReview).length,
      devicesWithoutStatus: devices.filter((device) => !device.status).length,
      syncsWithoutRaw: syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) === 0).length,
      profilesWithoutBindings: profiles.filter((profile) => profile.activeBindingCount === 0).length,
      homeDevices,
      institutionDevices,
      devicesWithOwner,
      devicesWithFirmware,
      syncsWithRaw,
      activeProfiles,
      profilesWithBindings,
      profilesWithSessions,
      totalTurns,
      successfulTurns,
      totalPlayers,
      gamesWithTurns: gamesWithTurns.length,
      degradedChecks: Object.values(readinessChecks).filter((check) => check?.status !== "healthy").length,
      environment: canSeeHealthModule ? healthQuery.data?.environment || "-" : "sin detalle",
      version: canSeeHealthModule ? healthQuery.data?.version || "-" : "no disponible",
      readiness: canSeeHealthModule ? readinessQuery.data?.status || "unknown" : "no disponible",
    };
  }, [canSeeHealthModule, devices, devicesQuery.data, games, gamesQuery.data, healthQuery.data, institutions, institutionsQuery.data, profiles, readinessChecks, readinessQuery.data, summaryQuery.data, syncs, syncsQuery.data, usesSystemSummary, users, usersQuery.data]);

  const scopeLabel = isAdmin
    ? t.scope.admin
    : isGovernmentViewer
      ? t.scope.government
      : isInstitutionAdmin
        ? t.scope.institutionAdmin
        : isDirector
          ? t.scope.director
        : t.scope.operation;

  const trendRange = getModuleRange("trend-series");
  const profileCoverageRange = getModuleRange("profile-coverage");
  const roleRange = getModuleRange("role-series");
  const userTypeRange = getModuleRange("user-type-series");
  const institutionLoadRange = getModuleRange("institution-load");

  const filteredTrendGames = useMemo(
    () => filterDashboardItemsByRange(games, trendRange, (game) => getDashboardDateValue(game.startDate, game.createdAt, game.updatedAt)),
    [games, trendRange],
  );
  const filteredTrendSyncs = useMemo(
    () => filterDashboardItemsByRange(syncs, trendRange, (sync) => getDashboardDateValue(sync.startedAt, sync.createdAt, sync.updatedAt, sync.receivedAt, sync.capturedAt)),
    [syncs, trendRange],
  );
  const filteredRoleUsers = useMemo(
    () => filterDashboardItemsByRange(users, roleRange, (entry) => getDashboardDateValue(entry.lastLoginAt, entry.createdAt, entry.updatedAt)),
    [roleRange, users],
  );
  const filteredUserTypeUsers = useMemo(
    () => filterDashboardItemsByRange(users, userTypeRange, (entry) => getDashboardDateValue(entry.lastLoginAt, entry.createdAt, entry.updatedAt)),
    [userTypeRange, users],
  );
  const filteredProfilesForCoverage = useMemo(
    () => filterDashboardItemsByRange(profiles, profileCoverageRange, (profile) => getDashboardDateValue(profile.lastSessionAt, profile.createdAt, profile.updatedAt)),
    [profileCoverageRange, profiles],
  );
  const filteredInstitutionUsers = useMemo(
    () => filterDashboardItemsByRange(users, institutionLoadRange, (entry) => getDashboardDateValue(entry.lastLoginAt, entry.createdAt, entry.updatedAt)),
    [institutionLoadRange, users],
  );
  const filteredInstitutionGames = useMemo(
    () => filterDashboardItemsByRange(games, institutionLoadRange, (game) => getDashboardDateValue(game.startDate, game.createdAt, game.updatedAt)),
    [games, institutionLoadRange],
  );

  const trendSeries = useMemo(() => {
    if (usesSystemSummary) {
      return trends.filter((item) => filterDashboardItemsByRange([item], trendRange, (entry) => entry.date).length > 0 || trendRange === "all");
    }
    return buildExecutiveTrendSeries(filteredTrendGames, filteredTrendSyncs);
  }, [filteredTrendGames, filteredTrendSyncs, trendRange, trends, usesSystemSummary]);

  const executiveInstitutionLoad = useMemo(
    () => buildInstitutionLoadSeriesFromActivity(institutions, filteredInstitutionUsers, filteredInstitutionGames),
    [filteredInstitutionGames, filteredInstitutionUsers, institutions],
  );
  const executiveRoleSeries = useMemo(() => buildUserRoleSeries(filteredRoleUsers), [filteredRoleUsers]);
  const executiveUserTypeSeries = useMemo(() => buildUserTypeSeries(filteredUserTypeUsers), [filteredUserTypeUsers]);
  const executiveProfileCoverage = useMemo(
    () => buildProfileCoverageBreakdown({
      totalProfiles: filteredProfilesForCoverage.length,
      activeProfiles: filteredProfilesForCoverage.filter((profile) => profile.isActive).length,
      profilesWithBindings: filteredProfilesForCoverage.filter((profile) => profile.activeBindingCount > 0).length,
      profilesWithSessions: filteredProfilesForCoverage.filter((profile) => profile.sessionCount > 0).length,
    }).filter((item) => item.value > 0),
    [filteredProfilesForCoverage],
  );

  const detailPanel = (() => {
    if (!selectedDetail) return null;

    const metricRowsByType: Record<string, DashboardDetailRow[]> = {
      users: usesSystemSummary
        ? [
            { label: localText.detail.total, value: String(metrics.totalUsers), hint: `${roleMix.length} ${localText.detail.role.toLowerCase()} segmentos · ${userTypeMix.length} ${localText.detail.type.toLowerCase()} segmentos` },
            ...roleMix.slice(0, 6).map((item) => ({ label: `${localText.detail.role} · ${item.key}`, value: String(item.count), hint: localText.detail.roleMix })),
            ...userTypeMix.slice(0, 6).map((item) => ({ label: `${localText.detail.type} · ${item.key}`, value: String(item.count), hint: localText.detail.typeMix })),
          ]
        : users.map((entry) => ({
            label: entry.fullName || entry.email || `${localText.detail.user} ${entry.id}`,
            value: entry.roles.join(", ") || localText.detail.noRole,
            hint: entry.email || entry.userType || t.detail.noDetail,
            badge: entry.lastLoginAt ? `Login ${entry.lastLoginAt}` : undefined,
          })),
      institutions: usesSystemSummary
        ? topInstitutions.map((institution) => ({
            label: institution.name,
            value: `${institution.users}`,
            hint: localText.detail.institutionSummary(institution.users, institution.games, institution.turns),
            badge: [institution.state, institution.city].filter(Boolean).join(" / ") || undefined,
          }))
        : institutions.map((institution) => ({
            label: institution.name,
            value: String(institution.operationalSummary?.studentCount ?? 0),
            hint: localText.detail.usersGroups(institution.operationalSummary?.userCount ?? 0, institution.operationalSummary?.classGroupCount ?? 0),
            badge: institution.status || institution.city || undefined,
          })),
      devices: usesSystemSummary
        ? [
            { label: localText.detail.homeDevices, value: String(metrics.homeDevices), hint: localText.detail.homeFleet },
            { label: localText.detail.institutionDevices, value: String(metrics.institutionDevices), hint: localText.detail.institutionFleet },
            { label: localText.detail.withOwner, value: String(metrics.devicesWithOwner), hint: localText.detail.withOwnerHint },
            { label: localText.detail.withFirmware, value: String(metrics.devicesWithFirmware), hint: localText.detail.withFirmwareHint },
            { label: localText.detail.withoutStatus, value: String(metrics.devicesWithoutStatus), hint: localText.detail.withoutStatusHint },
          ]
        : devices.map((device) => ({
            label: device.name || device.deviceId || `${t.metrics.devices} ${device.id}`,
            value: device.status || localText.detail.noStatus,
            hint: device.ownerUserName || device.ownerUserEmail || device.educationalCenterName || localText.detail.noReference,
            badge: device.assignmentScope || undefined,
          })),
      syncs: usesSystemSummary
        ? [
            { label: t.detail.trendSyncs, value: String(metrics.totalSyncs), hint: localText.detail.rawAvailable(metrics.syncsWithRaw) },
            { label: localText.detail.withoutRaw, value: String(metrics.syncsWithoutRaw), hint: localText.detail.traceabilityGap },
            ...trends.slice(-5).map((item) => ({ label: item.date, value: `${item.syncs} ${t.detail.trendSyncs.toLowerCase()}`, hint: `${item.games} ${t.metrics.games.toLowerCase()} · ${localText.detail.turns(item.turns)}` })),
          ]
        : syncs.map((sync) => ({
            label: sync.deckName || `Sync ${sync.id}`,
            value: sync.status || localText.detail.noStatus,
            hint: localText.detail.rawRecords(sync.rawRecordCount || sync.rawRecordIds.length || 0),
            badge: sync.source || sync.sourceType || undefined,
          })),
      games: usesSystemSummary
        ? [
            { label: t.metrics.games, value: String(metrics.totalGames), hint: localText.detail.totalTurns(metrics.totalTurns) },
            ...trends.slice(-5).map((item) => ({ label: item.date, value: `${item.games} ${t.metrics.games.toLowerCase()}`, hint: `${localText.detail.turns(item.turns)} · ${localText.detail.success(item.success_rate || 0)}` })),
          ]
        : games.map((game) => ({
            label: game.deckName || `${t.metrics.games.slice(0, -1)} ${game.id}`,
            value: localText.detail.turns(game.turns.length),
            hint: localText.detail.players(game.totalPlayers || game.players?.length || 0),
            badge: game.educationalCenterId || undefined,
          })),
      profiles: [
        { label: t.metrics.profiles, value: String(metrics.totalProfiles), hint: localText.detail.active(metrics.activeProfiles) },
        { label: t.detail.boundProfiles, value: String(metrics.profilesWithBindings), hint: t.detail.boundProfilesHint },
        { label: t.detail.sessionProfiles, value: String(metrics.profilesWithSessions), hint: t.detail.sessionProfilesHint },
      ],
      health: canSeeHealthModule
        ? [
            { label: t.detail.readiness, value: metrics.readiness, hint: t.detail.backend(metrics.version) },
            { label: t.detail.degradedChecks, value: String(metrics.degradedChecks), hint: metrics.environment },
            ...Object.entries(readinessChecks).map(([key, check], index) => ({ label: key || t.detail.check(index + 1), value: check?.status || "unknown", hint: check?.message || t.detail.noDetail })),
          ]
        : [],
    };

    switch (selectedDetail.kind) {
      case "metric-users":
        return { title: t.detail.users, description: t.detail.usersHint, filterLabel: selectedDetail.label, rows: metricRowsByType.users };
      case "metric-institutions":
        return { title: t.detail.institutions, description: t.detail.institutionsHint, filterLabel: selectedDetail.label, rows: metricRowsByType.institutions };
      case "metric-devices":
        return { title: t.detail.devices, description: t.detail.devicesHint, filterLabel: selectedDetail.label, rows: metricRowsByType.devices };
      case "metric-syncs":
        return { title: t.detail.syncs, description: t.detail.syncsHint, filterLabel: selectedDetail.label, rows: metricRowsByType.syncs };
      case "metric-games":
        return { title: t.detail.games, description: t.detail.gamesHint, filterLabel: selectedDetail.label, rows: metricRowsByType.games };
      case "metric-profiles":
        return { title: t.detail.profiles, description: t.detail.profilesHint, filterLabel: selectedDetail.label, rows: metricRowsByType.profiles };
      case "metric-health":
        return { title: t.detail.health, description: t.detail.healthHint, filterLabel: selectedDetail.label, rows: metricRowsByType.health };
      case "trend-date": {
        const selectedTrend = trendSeries.find((item) => item.date === selectedDetail.label);
        return {
          title: t.detail.trendTitle(selectedDetail.label),
          description: t.detail.trendHint,
          filterLabel: selectedDetail.label,
          rows: selectedTrend ? [
            { label: t.detail.trendSyncs, value: String(selectedTrend.syncs), hint: t.detail.trendSyncsHint },
            { label: t.detail.trendGames, value: String(selectedTrend.games), hint: t.detail.trendGamesHint },
            { label: t.detail.trendTurns, value: String(selectedTrend.turns), hint: t.detail.trendTurnsHint(selectedTrend.success_rate || 0) },
          ] : [],
        };
      }
      case "profile-coverage": {
        const normalized = normalizeLabel(selectedDetail.label);
        const rows = [
          { label: t.detail.activeProfiles, value: String(filteredProfilesForCoverage.filter((profile) => profile.isActive).length), hint: t.detail.activeProfilesHint(filteredProfilesForCoverage.length) },
          { label: t.detail.boundProfiles, value: String(filteredProfilesForCoverage.filter((profile) => profile.activeBindingCount > 0).length), hint: t.detail.boundProfilesHint },
          { label: t.detail.sessionProfiles, value: String(filteredProfilesForCoverage.filter((profile) => profile.sessionCount > 0).length), hint: t.detail.sessionProfilesHint },
          { label: t.detail.unboundProfiles, value: String(Math.max(filteredProfilesForCoverage.length - filteredProfilesForCoverage.filter((profile) => profile.activeBindingCount > 0).length, 0)), hint: t.detail.unboundProfilesHint },
        ];
        return { title: t.detail.coverageTitle(selectedDetail.label), description: t.detail.coverageHint, filterLabel: selectedDetail.label, rows: rows.filter((row) => normalizeLabel(row.label) === normalized) };
      }
      case "role":
        return { title: t.detail.usersByRoleTitle(selectedDetail.label), description: t.detail.usersByRoleHint, filterLabel: selectedDetail.label, rows: executiveRoleSeries.filter((item) => item.label === selectedDetail.label).map((item) => ({ label: item.label, value: String(item.value), hint: t.detail.usersInRole })) };
      case "user-type":
        return { title: t.detail.usersByTypeTitle(selectedDetail.label), description: t.detail.usersByTypeHint, filterLabel: selectedDetail.label, rows: executiveUserTypeSeries.filter((item) => item.label === selectedDetail.label).map((item) => ({ label: item.label, value: String(item.value), hint: t.detail.usersInType })) };
      case "institution-load":
        return { title: t.detail.institutionTitle(selectedDetail.label), description: t.detail.institutionHint, filterLabel: selectedDetail.label, rows: metricRowsByType.institutions.filter((row) => row.label === selectedDetail.label) };
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={scopeLabel}
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

      <div>
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.quickLook.title}</CardTitle>
            <CardDescription>
              {t.quickLook.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/institutions" className="block rounded-2xl border border-border/70 bg-white/80 p-4 transition hover:border-primary/20 hover:bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.quickLook.institutions}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{t.quickLook.institutionsHint(metrics.institutionsNeedingReview)}</p>
                </div>
                <Badge variant={metrics.institutionsNeedingReview > 0 ? "warning" : "success"}>{metrics.institutionsNeedingReview > 0 ? t.quickLook.review : t.quickLook.ok}</Badge>
              </div>
            </Link>
            <Link href="/devices" className="block rounded-2xl border border-border/70 bg-white/80 p-4 transition hover:border-primary/20 hover:bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.quickLook.devices}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{t.quickLook.devicesHint(metrics.devicesWithoutStatus, metrics.totalDevices - metrics.devicesWithOwner)}</p>
                </div>
                <Badge variant={metrics.devicesWithoutStatus > 0 ? "warning" : "success"}>{metrics.devicesWithoutStatus > 0 ? t.quickLook.attention : t.quickLook.ok}</Badge>
              </div>
            </Link>
            <Link href="/syncs" className="block rounded-2xl border border-border/70 bg-white/80 p-4 transition hover:border-primary/20 hover:bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.quickLook.syncs}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{t.quickLook.syncsHint(formatPercentLocalized(metrics.syncsWithRaw, metrics.totalSyncs), formatPercentLocalized(metrics.profilesWithBindings, metrics.totalProfiles))}</p>
                </div>
                <Badge variant="outline">{t.quickLook.follow}</Badge>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {showInitialLoading ? (
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)
        ) : (
          <>
            <DashboardMetricCard label={t.metrics.users} value={String(metrics.totalUsers)} hint={t.metrics.usersHint} icon={Users} isLoading={(usesSystemSummary ? summaryQuery.isLoading : usersQuery.isLoading) && users.length === 0} onSelect={() => setSelectedDetail({ kind: "metric-users", label: t.metrics.users })} isActive={selectedDetail?.kind === "metric-users"} />
            <DashboardMetricCard label={t.metrics.institutions} value={String(metrics.totalInstitutions)} hint={t.metrics.institutionsHint} icon={Building2} isLoading={(usesSystemSummary ? summaryQuery.isLoading : institutionsQuery.isLoading) && institutions.length === 0} onSelect={() => setSelectedDetail({ kind: "metric-institutions", label: t.metrics.institutions })} isActive={selectedDetail?.kind === "metric-institutions"} />
            <DashboardMetricCard label={t.metrics.devices} value={String(metrics.totalDevices)} hint={t.metrics.devicesHint(metrics.homeDevices, metrics.institutionDevices)} icon={Smartphone} isLoading={(usesSystemSummary ? summaryQuery.isLoading : devicesQuery.isLoading) && devices.length === 0} onSelect={() => setSelectedDetail({ kind: "metric-devices", label: t.metrics.devices })} isActive={selectedDetail?.kind === "metric-devices"} />
            <DashboardMetricCard label={t.metrics.syncs} value={String(metrics.totalSyncs)} hint={t.metrics.syncsHint(formatPercentLocalized(metrics.syncsWithRaw, metrics.totalSyncs))} icon={Layers3} tone="accent" isLoading={(usesSystemSummary ? summaryQuery.isLoading : syncsQuery.isLoading) && syncs.length === 0} onSelect={() => setSelectedDetail({ kind: "metric-syncs", label: t.metrics.syncs })} isActive={selectedDetail?.kind === "metric-syncs"} />
            <DashboardMetricCard label={t.metrics.games} value={String(metrics.totalGames)} hint={t.metrics.gamesHint(formatAverageLocalized(metrics.totalPlayers, metrics.totalGames))} icon={Database} tone="accent" isLoading={(usesSystemSummary ? summaryQuery.isLoading : gamesQuery.isLoading) && games.length === 0} onSelect={() => setSelectedDetail({ kind: "metric-games", label: t.metrics.games })} isActive={selectedDetail?.kind === "metric-games"} />
            {canSeeHealthModule ? (
              <DashboardMetricCard label={t.metrics.health} value={metrics.readiness} hint={t.metrics.healthHint(metrics.version)} icon={HeartPulse} tone={metrics.degradedChecks === 0 ? "accent" : "warning"} isLoading={canSeeHealthModule && healthQuery.isLoading && !healthQuery.data} onSelect={() => setSelectedDetail({ kind: "metric-health", label: t.metrics.health })} isActive={selectedDetail?.kind === "metric-health"} />
            ) : (
              <DashboardMetricCard label={t.metrics.profiles} value={String(metrics.totalProfiles)} hint={t.metrics.profilesHint(metrics.activeProfiles, metrics.profilesWithSessions)} icon={UserSquare2} tone="accent" isLoading={(usesSystemSummary ? summaryQuery.isLoading : profilesQuery.isLoading) && profiles.length === 0} onSelect={() => setSelectedDetail({ kind: "metric-profiles", label: t.metrics.profiles })} isActive={selectedDetail?.kind === "metric-profiles"} />
            )}
          </>
        )}
      </div>

      {usesSystemSummary ? (
        <DashboardLocationMapCard
          locations={locationSeeds}
          isLoading={institutionsQuery.isLoading || usersQuery.isLoading || devicesQuery.isLoading}
        />
      ) : null}

      {usesSystemSummary ? (
        <DashboardMultiLineChartCard
          title={t.executive.miniTrends}
          description={t.executive.miniTrendsDesc(trendRangeLabel)}
          data={trendSeries.map((item) => ({
            label: item.date,
            date: item.date,
            syncs: item.syncs,
            games: item.games,
            turns: item.turns,
          }))}
          xAxisDataKey="date"
          series={[
            { key: "syncs", label: "Syncs", color: "#2563eb" },
            { key: "games", label: "Partidas", color: "#7c3aed" },
            { key: "turns", label: "Turnos", color: "#0f766e" },
          ]}
          range={trendRange}
          onRangeChange={(range) => setModuleRange("trend-series", range)}
          csvFileName={`dashboard-mini-tendencias-${trendRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "trend-date", label })}
          activeDatumLabel={selectedDetail?.kind === "trend-date" ? selectedDetail.label : null}
          footer={
            trendSeries.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{t.executive.trendSyncsPeriod}</p>
                  <p className="mt-1">{t.executive.trendSyncsPeriodHint(trendSeries.reduce((sum, item) => sum + item.syncs, 0))}</p>
                </div>
                <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{t.executive.trendGamesPeriod}</p>
                  <p className="mt-1">{t.executive.trendGamesPeriodHint(trendSeries.reduce((sum, item) => sum + item.games, 0))}</p>
                </div>
                <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{t.executive.recentSuccess}</p>
                  <p className="mt-1">{t.executive.recentSuccessHint(trendSeries[trendSeries.length - 1]?.success_rate || 0)}</p>
                </div>
              </div>
            ) : null
          }
        />
      ) : null}

      {usesSystemSummary ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.executive.comparison}</CardTitle>
            <CardDescription>
              {t.executive.comparisonDesc(comparisonWindowLabel)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            {comparisonMetrics.map((metric) => {
              const delta = metric.delta_percent ?? 0;
              const deltaTone = delta > 0 ? "success" : delta < 0 ? "warning" : "secondary";
              const deltaLabel = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
              return (
                <div key={metric.key} className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{metric.label}</p>
                      <p className="mt-1 text-2xl font-semibold text-foreground">{metric.current}</p>
                    </div>
                    <Badge variant={deltaTone}>{deltaLabel}</Badge>
                  </div>
                  <p className="mt-2">{t.executive.previousPeriod(metric.previous)}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {usesSystemSummary ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.executive.semaphores}</CardTitle>
            <CardDescription>
              {t.executive.semaphoresDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {summaryAlerts.map((alert) => (
              <div key={`${alert.severity}-${alert.title}`} className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-foreground">{alert.title}</p>
                  <Badge variant={alert.severity}>{alert.severity}</Badge>
                </div>
                <p className="mt-2">{alert.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {isGovernmentViewer ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.territorial.smartPresets}</CardTitle>
            <CardDescription>{t.territorial.smartPresetsDesc}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {smartPresets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-medium ${activeSmartPreset === preset.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                onClick={() => updateSmartPreset(preset.key)}
              >
                {preset.label} ({preset.count})
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {isGovernmentViewer ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>{t.territorial.savedViews}</CardTitle>
                <CardDescription>{t.territorial.savedViewsDesc}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={copyCurrentViewLink}>
                  {shareLinkState === "copied" ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {shareLinkState === "copied"
                    ? t.territorial.linkCopied
                    : shareLinkState === "error"
                      ? t.territorial.linkError
                      : t.territorial.copyLink}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={saveCurrentPreset}>
                  {t.territorial.saveView}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {territorialPresets.length > 0 ? (
              territorialPresets.map((preset) => (
                <div key={preset.id} className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-foreground">{preset.name}</p>
                    <button
                      type="button"
                      className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                      onClick={() => deletePreset(preset.id)}
                    >
                      {t.territorial.delete}
                    </button>
                  </div>
                  <p className="mt-2">{Object.values(preset.filters).filter(Boolean).join(" · ") || t.territorial.generalView}</p>
                  <button
                    type="button"
                    className="mt-3 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-foreground"
                    onClick={() => applyPreset(preset)}
                  >
                    {t.territorial.applyPreset}
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">{t.territorial.noPresets}</div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {isGovernmentViewer ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>{t.territorial.drilldown}</CardTitle>
                <CardDescription>{t.territorial.drilldownDesc}</CardDescription>
              </div>
              <button
                type="button"
                className="rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
                onClick={downloadTerritorialReport}
              >
                {t.territorial.exportCsv}
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {territorialHierarchy.length > 0 ? (
              territorialHierarchy.map((country) => (
                <div key={country.key} className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{country.key}</p>
                      <p className="mt-1">{localText.detail.territorySummary(country.users, country.institutions, country.games, country.turns)}</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                      onClick={() => updateFilter("country_code", country.key)}
                    >
                      {t.territorial.filterCountry}
                    </button>
                  </div>

                  <div className="mt-4 space-y-3 border-l border-border/60 pl-4">
                    {country.states.slice(0, 4).map((stateEntry) => (
                      <div key={`${country.key}-${stateEntry.key}`} className="rounded-xl bg-background/70 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{stateEntry.key}</p>
                            <p className="mt-1">{localText.detail.territorySummary(stateEntry.users, stateEntry.institutions, stateEntry.games, stateEntry.turns)}</p>
                          </div>
                          <button
                            type="button"
                            className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                            onClick={() => updateFilters({ country_code: country.key, state: stateEntry.key, city: "" })}
                          >
                            {t.territorial.filterState}
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {stateEntry.cities.slice(0, 5).map((cityEntry) => (
                            <button
                              key={`${stateEntry.key}-${cityEntry.key}`}
                              type="button"
                              className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-foreground"
                              onClick={() => updateFilters({ country_code: country.key, state: stateEntry.key, city: cityEntry.key })}
                            >
                              {localText.detail.citySummary(cityEntry.key, cityEntry.users, cityEntry.turns)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">{t.territorial.noDrilldown}</div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {isGovernmentViewer ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.territorial.territoryAlerts}</CardTitle>
            <CardDescription>{t.territorial.territoryAlertsDesc}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {filteredTerritoryAlerts.length > 0 ? (
              filteredTerritoryAlerts.map((alert) => (
                <div key={`${alert.scope}-${alert.label}`} className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{alert.label}</p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{alert.scope}</p>
                    </div>
                    <Badge variant={alert.severity}>{alert.severity}</Badge>
                  </div>
                  <p className="mt-2">{alert.message}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">{t.territorial.noTerritoryAlerts}</div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {isGovernmentViewer ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.territorial.territoryIndex}</CardTitle>
            <CardDescription>{t.territorial.territoryIndexDesc}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {filteredTerritoryScores.length > 0 ? (
              filteredTerritoryScores.map((territory) => (
                <div key={territory.label} className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{territory.label}</p>
                      <p className="mt-1 text-2xl font-semibold text-foreground">{territory.score}/100</p>
                    </div>
                    <Badge variant={territory.status}>{territory.status}</Badge>
                  </div>
                  <p className="mt-2">{localText.detail.activitySummary(territory.users, territory.games, territory.turns)}</p>
                  <ul className="mt-3 list-disc space-y-1 pl-4 text-xs">
                    {territory.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">{t.territorial.noTerritoryIndex}</div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {isGovernmentViewer ? (
        <div className="grid gap-5 2xl:grid-cols-3">
          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)] xl:col-span-2">
            <CardHeader>
              <CardTitle>{t.territorial.topTerritories}</CardTitle>
              <CardDescription>{t.territorial.topTerritoriesDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
            {filteredTopTerritories.length > 0 ? (
                filteredTopTerritories.map((territory, index) => (
                  <div key={territory.key} className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">{index + 1}. {territory.key}</p>
                        <p className="mt-1">{localText.detail.topTerritorySummary(territory.users, territory.institutions, territory.games, territory.turns)}</p>
                      </div>
                      <Badge variant="secondary">{t.territorial.topTerritory}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">{t.territorial.noTopTerritories}</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader>
              <CardTitle>{t.territorial.cohorts}</CardTitle>
              <CardDescription>{t.territorial.cohortsDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-2xl bg-white/80 p-4">
                <p className="font-medium text-foreground">{t.territorial.roles}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {roleMix.length > 0 ? roleMix.slice(0, 5).map((item) => <Badge key={item.key} variant="secondary">{item.key}: {item.count}</Badge>) : <span>{t.territorial.noData}</span>}
                </div>
              </div>
              <div className="rounded-2xl bg-white/80 p-4">
                <p className="font-medium text-foreground">{t.territorial.userTypes}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {userTypeMix.length > 0 ? userTypeMix.slice(0, 5).map((item) => <Badge key={item.key} variant="secondary">{item.key}: {item.count}</Badge>) : <span>{t.territorial.noData}</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-5 2xl:grid-cols-3">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.summaries.usage}</CardTitle>
            <CardDescription>{t.summaries.usageDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">{t.summaries.turnsGames}</p>
              <p className="mt-1">{t.summaries.turnsGamesHint(metrics.totalTurns, formatAverageLocalized(metrics.totalTurns, metrics.gamesWithTurns || metrics.totalGames))}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">{t.summaries.turnsSuccess}</p>
              <p className="mt-1">{t.summaries.turnsSuccessHint(formatPercentLocalized(metrics.successfulTurns, metrics.totalTurns))}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.summaries.dataQuality}</CardTitle>
            <CardDescription>{t.summaries.dataQualityDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">{t.summaries.identifiedDevices}</p>
              <p className="mt-1">{t.summaries.identifiedDevicesHint(formatPercentLocalized(metrics.devicesWithFirmware, metrics.totalDevices), formatPercentLocalized(metrics.devicesWithOwner, metrics.totalDevices))}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">{t.summaries.usefulProfiles}</p>
              <p className="mt-1">{t.summaries.usefulProfilesHint(formatPercentLocalized(metrics.profilesWithSessions, metrics.totalProfiles), formatPercentLocalized(metrics.profilesWithBindings, metrics.totalProfiles))}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.summaries.distribution}</CardTitle>
            <CardDescription>{t.summaries.distributionDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">{t.summaries.homeVsInstitution}</p>
              <p className="mt-1">{t.summaries.homeVsInstitutionHint(metrics.homeDevices, metrics.institutionDevices)}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">{t.summaries.sourceCoverage}</p>
              <p className="mt-1">{t.summaries.sourceCoverageHint(loadedSources, failedSources)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title={t.charts.profileCoverage}
          description={t.charts.profileCoverageDesc}
          data={executiveProfileCoverage}
          range={profileCoverageRange}
          onRangeChange={(range) => setModuleRange("profile-coverage", range)}
          csvFileName={`dashboard-cobertura-perfiles-${profileCoverageRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "profile-coverage", label })}
          activeDatumLabel={selectedDetail?.kind === "profile-coverage" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title={t.charts.usersByRole}
          description={t.charts.usersByRoleDesc}
          data={executiveRoleSeries}
          range={roleRange}
          onRangeChange={(range) => setModuleRange("role-series", range)}
          csvFileName={`dashboard-usuarios-por-rol-${roleRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "role", label })}
          activeDatumLabel={selectedDetail?.kind === "role" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title={t.charts.usersByType}
          description={t.charts.usersByTypeDesc}
          data={executiveUserTypeSeries}
          range={userTypeRange}
          onRangeChange={(range) => setModuleRange("user-type-series", range)}
          csvFileName={`dashboard-usuarios-por-tipo-${userTypeRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "user-type", label })}
          activeDatumLabel={selectedDetail?.kind === "user-type" ? selectedDetail.label : null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title={t.charts.institutionLoad}
          description={usesSystemSummary ? t.charts.institutionLoadDescSystem : t.charts.institutionLoadDescLocal}
          data={executiveInstitutionLoad}
          secondaryDataKey="secondaryValue"
          secondaryLabel={t.charts.turns}
          range={institutionLoadRange}
          onRangeChange={(range) => setModuleRange("institution-load", range)}
          csvFileName={`dashboard-instituciones-con-carga-${institutionLoadRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "institution-load", label })}
          activeDatumLabel={selectedDetail?.kind === "institution-load" ? selectedDetail.label : null}
        />
      </div>

      {isGovernmentViewer ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.territorial.featuredInstitutions}</CardTitle>
            <CardDescription>{t.territorial.featuredInstitutionsDesc}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {topInstitutions.length > 0 ? (
              topInstitutions.map((institution) => (
                <div key={institution.id} className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{institution.name}</p>
                  <p className="mt-1">{institution.city || institution.state || t.territorial.noTerritoryDetail}</p>
                  <p className="mt-2">{localText.detail.institutionSummary(institution.users, institution.games, institution.turns)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">{t.territorial.noFeaturedInstitutions}</div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-destructive/20 bg-white/85">
          <CardContent className="p-6 text-sm text-destructive">
            {t.error(error)}
          </CardContent>
        </Card>
      ) : null}

    </div>
  );
}
