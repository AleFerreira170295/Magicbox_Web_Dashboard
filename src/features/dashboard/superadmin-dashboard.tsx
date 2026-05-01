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
import { useUsers } from "@/features/users/api";
import type { UserRecord } from "@/features/users/types";
import { getErrorMessage } from "@/lib/utils";

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

  const totalSources = visibleQueryStates.length;
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

  const rangeOptions = summaryQuery.data?.filters.range_options ?? EMPTY_LIST;
  const institutionOptions = summaryQuery.data?.filters.institutions ?? EMPTY_LIST;
  const countryOptions = summaryQuery.data?.filters.countries ?? EMPTY_LIST;
  const stateOptions = summaryQuery.data?.filters.states ?? EMPTY_LIST;
  const cityOptions = summaryQuery.data?.filters.cities ?? EMPTY_LIST;
  const userTypeOptions = summaryQuery.data?.filters.user_types ?? EMPTY_LIST;
  const roleCodeOptions = summaryQuery.data?.filters.role_codes ?? EMPTY_LIST;
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
      { key: "all", label: "Vista general", count: territoryScores.length },
      {
        key: "critical",
        label: "Territorios críticos",
        count: territoryScores.filter((item) => item.status === "warning" || territoryAlerts.some((alert) => alert.label.includes(item.label))).length,
      },
      {
        key: "score_lt_60",
        label: "Score < 60",
        count: territoryScores.filter((item) => item.score < 60).length,
      },
      {
        key: "no_turns",
        label: "Sin turnos",
        count: territoryScores.filter((item) => item.users > 0 && item.turns === 0).length,
      },
      {
        key: "high_population_low_activity",
        label: "Alta población, baja actividad",
        count: territoryScores.filter((item) => item.users >= 10 && item.turns / Math.max(item.users, 1) < 0.25).length,
      },
    ],
    [territoryAlerts, territoryScores],
  );
  const activeSmartPresetMeta = activeSmartPreset === "all"
    ? null
    : smartPresets.find((preset) => preset.key === activeSmartPreset) || null;

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

  const activeExecutiveFilters = useMemo(
    () => [
      selectedRange !== "30d"
        ? `Rango · ${rangeOptions.find((option) => option.value === selectedRange)?.label || selectedRange}`
        : null,
      selectedInstitutionId
        ? `Institución · ${institutionOptions.find((institution) => institution.id === selectedInstitutionId)?.name || selectedInstitutionId}`
        : null,
      selectedCountryCode ? `País · ${selectedCountryCode}` : null,
      selectedState ? `Estado · ${selectedState}` : null,
      selectedCity ? `Ciudad · ${selectedCity}` : null,
      selectedUserType ? `Tipo · ${selectedUserType}` : null,
      selectedRoleCode ? `Rol · ${selectedRoleCode}` : null,
    ].filter((value): value is string => Boolean(value)),
    [institutionOptions, rangeOptions, selectedCity, selectedCountryCode, selectedInstitutionId, selectedRange, selectedRoleCode, selectedState, selectedUserType],
  );

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

  function resetExecutiveView() {
    updateFilters({
      range: "30d",
      institution_id: "",
      country_code: "",
      state: "",
      city: "",
      user_type: "",
      role_code: "",
      smart_preset: "",
    });
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
    const name = window.prompt("Nombre de la vista", suggestedName)?.trim();
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
    ? "Superadmin"
    : isGovernmentViewer
      ? "Gobierno"
      : isInstitutionAdmin
        ? "Admin institucional"
        : isDirector
          ? "Dirección"
        : "Operación";

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
            { label: "Total", value: String(metrics.totalUsers), hint: `${roleMix.length} segmentos de rol · ${userTypeMix.length} segmentos de tipo` },
            ...roleMix.slice(0, 6).map((item) => ({ label: `Rol · ${item.key}`, value: String(item.count), hint: "Mix agregado del recorte actual" })),
            ...userTypeMix.slice(0, 6).map((item) => ({ label: `Tipo · ${item.key}`, value: String(item.count), hint: "Composición por tipo de usuario" })),
          ]
        : users.map((entry) => ({
            label: entry.fullName || entry.email || `Usuario ${entry.id}`,
            value: entry.roles.join(", ") || "Sin rol",
            hint: entry.email || entry.userType || "Sin detalle",
            badge: entry.lastLoginAt ? `Login ${entry.lastLoginAt}` : undefined,
          })),
      institutions: usesSystemSummary
        ? topInstitutions.map((institution) => ({
            label: institution.name,
            value: `${institution.users} usuarios`,
            hint: `${institution.games} partidas · ${institution.turns} turnos`,
            badge: [institution.state, institution.city].filter(Boolean).join(" / ") || undefined,
          }))
        : institutions.map((institution) => ({
            label: institution.name,
            value: String(institution.operationalSummary?.studentCount ?? 0),
            hint: `${institution.operationalSummary?.userCount ?? 0} usuarios · ${institution.operationalSummary?.classGroupCount ?? 0} grupos`,
            badge: institution.status || institution.city || undefined,
          })),
      devices: usesSystemSummary
        ? [
            { label: "Dispositivos Home", value: String(metrics.homeDevices), hint: "Parque doméstico" },
            { label: "Dispositivos institucionales", value: String(metrics.institutionDevices), hint: "Parque institucional" },
            { label: "Con owner", value: String(metrics.devicesWithOwner), hint: "Dispositivos asociados a persona" },
            { label: "Con firmware", value: String(metrics.devicesWithFirmware), hint: "Dispositivos con versión registrada" },
            { label: "Sin estado", value: String(metrics.devicesWithoutStatus), hint: "Equipos a revisar" },
          ]
        : devices.map((device) => ({
            label: device.name || device.deviceId || `Dispositivo ${device.id}`,
            value: device.status || "Sin status",
            hint: device.ownerUserName || device.ownerUserEmail || device.educationalCenterName || "Sin referencia registrada",
            badge: device.assignmentScope || undefined,
          })),
      syncs: usesSystemSummary
        ? [
            { label: "Syncs", value: String(metrics.totalSyncs), hint: `${metrics.syncsWithRaw} con raw disponible` },
            { label: "Sin raw", value: String(metrics.syncsWithoutRaw), hint: "Brecha de trazabilidad" },
            ...trends.slice(-5).map((item) => ({ label: item.date, value: `${item.syncs} syncs`, hint: `${item.games} partidas · ${item.turns} turnos` })),
          ]
        : syncs.map((sync) => ({
            label: sync.deckName || `Sync ${sync.id}`,
            value: sync.status || "Sin status",
            hint: `${sync.rawRecordCount || sync.rawRecordIds.length || 0} raw records`,
            badge: sync.source || sync.sourceType || undefined,
          })),
      games: usesSystemSummary
        ? [
            { label: "Partidas", value: String(metrics.totalGames), hint: `${metrics.totalTurns} turnos totales` },
            ...trends.slice(-5).map((item) => ({ label: item.date, value: `${item.games} partidas`, hint: `${item.turns} turnos · ${item.success_rate || 0}% éxito` })),
          ]
        : games.map((game) => ({
            label: game.deckName || `Partida ${game.id}`,
            value: `${game.turns.length} turnos`,
            hint: `${game.totalPlayers || game.players?.length || 0} jugadores`,
            badge: game.educationalCenterId || undefined,
          })),
      profiles: [
        { label: "Perfiles", value: String(metrics.totalProfiles), hint: `${metrics.activeProfiles} activos` },
        { label: "Con binding", value: String(metrics.profilesWithBindings), hint: "Cobertura activa" },
        { label: "Con sesiones", value: String(metrics.profilesWithSessions), hint: "Uso observable" },
      ],
      health: canSeeHealthModule
        ? [
            { label: "Readiness", value: metrics.readiness, hint: `Backend ${metrics.version}` },
            { label: "Checks degradados", value: String(metrics.degradedChecks), hint: metrics.environment },
            ...Object.entries(readinessChecks).map(([key, check], index) => ({ label: key || `Check ${index + 1}`, value: check?.status || "unknown", hint: check?.message || "Sin detalle" })),
          ]
        : [],
    };

    switch (selectedDetail.kind) {
      case "metric-users":
        return { title: "Detalle de usuarios", description: "Padrón actual de usuarios.", filterLabel: selectedDetail.label, rows: metricRowsByType.users };
      case "metric-institutions":
        return { title: "Detalle de instituciones", description: "Instituciones incluidas en la vista principal.", filterLabel: selectedDetail.label, rows: metricRowsByType.institutions };
      case "metric-devices":
        return { title: "Detalle de dispositivos", description: "Cobertura del parque y su estado.", filterLabel: selectedDetail.label, rows: metricRowsByType.devices };
      case "metric-syncs":
        return { title: "Detalle de sincronizaciones", description: "Lectura ampliada de cobertura y trazabilidad.", filterLabel: selectedDetail.label, rows: metricRowsByType.syncs };
      case "metric-games":
        return { title: "Detalle de partidas", description: "Movimiento real del sistema.", filterLabel: selectedDetail.label, rows: metricRowsByType.games };
      case "metric-profiles":
        return { title: "Detalle de perfiles", description: "Madurez real a nivel perfil.", filterLabel: selectedDetail.label, rows: metricRowsByType.profiles };
      case "metric-health":
        return { title: "Detalle de salud", description: "Estado de readiness y checks disponibles en la home.", filterLabel: selectedDetail.label, rows: metricRowsByType.health };
      case "trend-date": {
        const selectedTrend = trendSeries.find((item) => item.date === selectedDetail.label);
        return {
          title: `Mini tendencias · ${selectedDetail.label}`,
          description: "Detalle del bucket temporal seleccionado en la serie comparada.",
          filterLabel: selectedDetail.label,
          rows: selectedTrend ? [
            { label: "Syncs", value: String(selectedTrend.syncs), hint: "Volumen del día/bucket" },
            { label: "Partidas", value: String(selectedTrend.games), hint: "Actividad de sesiones" },
            { label: "Turnos", value: String(selectedTrend.turns), hint: `${selectedTrend.success_rate || 0}% de éxito` },
          ] : [],
        };
      }
      case "profile-coverage": {
        const normalized = normalizeLabel(selectedDetail.label);
        const rows = [
          { label: "Activos", value: String(filteredProfilesForCoverage.filter((profile) => profile.isActive).length), hint: `${filteredProfilesForCoverage.length} perfiles en el recorte` },
          { label: "Con binding", value: String(filteredProfilesForCoverage.filter((profile) => profile.activeBindingCount > 0).length), hint: "Cobertura activa" },
          { label: "Con sesiones", value: String(filteredProfilesForCoverage.filter((profile) => profile.sessionCount > 0).length), hint: "Uso observable" },
          { label: "Sin binding", value: String(Math.max(filteredProfilesForCoverage.length - filteredProfilesForCoverage.filter((profile) => profile.activeBindingCount > 0).length, 0)), hint: "Brecha por cerrar" },
        ];
        return { title: `Cobertura de perfiles · ${selectedDetail.label}`, description: "Desglose del indicador seleccionado.", filterLabel: selectedDetail.label, rows: rows.filter((row) => normalizeLabel(row.label) === normalized) };
      }
      case "role":
        return { title: `Usuarios por rol · ${selectedDetail.label}`, description: "Rol seleccionado dentro de la distribución actual.", filterLabel: selectedDetail.label, rows: executiveRoleSeries.filter((item) => item.label === selectedDetail.label).map((item) => ({ label: item.label, value: String(item.value), hint: "Usuarios en este rol" })) };
      case "user-type":
        return { title: `Usuarios por tipo · ${selectedDetail.label}`, description: "Tipo de usuario seleccionado dentro de la distribución actual.", filterLabel: selectedDetail.label, rows: executiveUserTypeSeries.filter((item) => item.label === selectedDetail.label).map((item) => ({ label: item.label, value: String(item.value), hint: "Usuarios en este tipo" })) };
      case "institution-load":
        return { title: `Institución · ${selectedDetail.label}`, description: "Detalle ampliado de la institución seleccionada.", filterLabel: selectedDetail.label, rows: metricRowsByType.institutions.filter((row) => row.label === selectedDetail.label) };
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={scopeLabel}
        title="Centro de control MagicBox"
        description="Panel principal para leer estado, riesgos y próximos focos sin perderte entre módulos."
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

      <div className="grid gap-6 2xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="overflow-hidden border-none bg-[linear-gradient(135deg,#1f2a37_0%,#2c4156_55%,#39546f_100%)] text-white shadow-[0_20px_60px_rgba(31,42,55,0.22)]">
          <CardContent className="p-8 sm:p-10">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/14 text-white hover:bg-white/14">Producción</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Panel principal</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">MagicBox plataforma</Badge>
            </div>

            {usesSystemSummary ? (
              <>
                <div className="mt-6 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  <label className="rounded-2xl bg-white/10 p-4 text-sm text-white/85 backdrop-blur-sm">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-white/65">Ventana temporal</span>
                    <select
                      className="w-full rounded-xl border border-white/15 bg-slate-950/20 px-3 py-2 text-sm text-white outline-none"
                      value={selectedRange}
                      onChange={(event) => updateFilter("range", event.target.value)}
                    >
                      {rangeOptions.map((option) => (
                        <option key={option.value} value={option.value} className="text-slate-950">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="rounded-2xl bg-white/10 p-4 text-sm text-white/85 backdrop-blur-sm">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-white/65">Institución</span>
                    <select
                      className="w-full rounded-xl border border-white/15 bg-slate-950/20 px-3 py-2 text-sm text-white outline-none"
                      value={selectedInstitutionId || ""}
                      onChange={(event) => updateFilter("institution_id", event.target.value)}
                    >
                      <option value="" className="text-slate-950">Todas</option>
                      {institutionOptions.map((institution) => (
                        <option key={institution.id} value={institution.id} className="text-slate-950">
                          {institution.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="rounded-2xl bg-white/10 p-4 text-sm text-white/85 backdrop-blur-sm">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-white/65">País</span>
                    <select
                      className="w-full rounded-xl border border-white/15 bg-slate-950/20 px-3 py-2 text-sm text-white outline-none"
                      value={selectedCountryCode || ""}
                      onChange={(event) => updateFilter("country_code", event.target.value)}
                    >
                      <option value="" className="text-slate-950">Todos</option>
                      {countryOptions.map((option) => (
                        <option key={option} value={option} className="text-slate-950">
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="rounded-2xl bg-white/10 p-4 text-sm text-white/85 backdrop-blur-sm">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-white/65">Estado / territorio</span>
                    <select
                      className="w-full rounded-xl border border-white/15 bg-slate-950/20 px-3 py-2 text-sm text-white outline-none"
                      value={selectedState || ""}
                      onChange={(event) => updateFilter("state", event.target.value)}
                    >
                      <option value="" className="text-slate-950">Todos</option>
                      {stateOptions.map((option) => (
                        <option key={option} value={option} className="text-slate-950">
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="rounded-2xl bg-white/10 p-4 text-sm text-white/85 backdrop-blur-sm">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-white/65">Ciudad</span>
                    <select
                      className="w-full rounded-xl border border-white/15 bg-slate-950/20 px-3 py-2 text-sm text-white outline-none"
                      value={selectedCity || ""}
                      onChange={(event) => updateFilter("city", event.target.value)}
                    >
                      <option value="" className="text-slate-950">Todas</option>
                      {cityOptions.map((option) => (
                        <option key={option} value={option} className="text-slate-950">
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="rounded-2xl bg-white/10 p-4 text-sm text-white/85 backdrop-blur-sm">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-white/65">Tipo de usuario</span>
                    <select
                      className="w-full rounded-xl border border-white/15 bg-slate-950/20 px-3 py-2 text-sm text-white outline-none"
                      value={selectedUserType || ""}
                      onChange={(event) => updateFilter("user_type", event.target.value)}
                    >
                      <option value="" className="text-slate-950">Todos</option>
                      {userTypeOptions.map((option) => (
                        <option key={option} value={option} className="text-slate-950">
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="rounded-2xl bg-white/10 p-4 text-sm text-white/85 backdrop-blur-sm">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-white/65">Rol agrupado</span>
                    <select
                      className="w-full rounded-xl border border-white/15 bg-slate-950/20 px-3 py-2 text-sm text-white outline-none"
                      value={selectedRoleCode || ""}
                      onChange={(event) => updateFilter("role_code", event.target.value)}
                    >
                      <option value="" className="text-slate-950">Todos</option>
                      {roleCodeOptions.map((option) => (
                        <option key={option} value={option} className="text-slate-950">
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {activeExecutiveFilters.length > 0 || activeSmartPresetMeta ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/10 px-4 py-4 text-sm text-white/85 backdrop-blur-sm">
                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">Contexto activo</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {activeSmartPresetMeta ? (
                          <Badge className="border-transparent bg-white text-slate-950">
                            Preset activo · {activeSmartPresetMeta.label}
                          </Badge>
                        ) : null}
                        {activeExecutiveFilters.map((filterLabel) => (
                          <Badge key={filterLabel} variant="outline" className="border-white/20 bg-white/10 text-white">
                            {filterLabel}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-3 text-sm text-white/72">
                        La vista queda etiquetada para revisar o compartir sin tener que releer todos los selectores.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white" onClick={resetExecutiveView}>
                      Volver a vista general
                    </Button>
                  </div>
                ) : null}
              </>
            ) : null}

            <div className="mt-6 max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Entrá, mirá lo crítico primero y saltá directo al módulo correcto.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/78">
                Esta portada prioriza estado general, filtros activos y accesos directos para revisar datos, hardware, personas y salud técnica.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Cobertura</p>
                <p className="mt-2 text-lg font-medium">{metrics.totalUsers} usuarios, {metrics.totalInstitutions} instituciones y {metrics.totalDevices} dispositivos.</p>
                <p className="mt-2 text-sm text-white/70">{loadedSources}/{totalSources} fuentes cargadas, {failedSources} con error.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Actividad</p>
                <p className="mt-2 text-lg font-medium">{metrics.totalSyncs} syncs, {metrics.totalGames} partidas, {metrics.totalTurns} turnos y {metrics.totalProfiles} profiles.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">{canSeeHealthModule ? "Salud" : "Resumen"}</p>
                <p className="mt-2 text-lg font-medium">
                  {canSeeHealthModule
                    ? `${metrics.readiness} · ${metrics.degradedChecks} checks degradados · ${metrics.environment}.`
                    : `${scopeLabel.toLowerCase()} · ${metrics.totalInstitutions} instituciones · ${metrics.totalDevices} dispositivos.`}
                </p>
              </div>
              {usesSystemSummary ? (
                <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm md:col-span-3">
                  <p className="text-sm text-white/70">Territorio y cohortes</p>
                  <p className="mt-2 text-lg font-medium">
                    {selectedCountryCode || "Todos los países"} · {selectedState || "todos los territorios"} · {selectedCity || "todas las ciudades"}
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    Cohortes activas: {selectedUserType || "todos los tipos de usuario"} y {selectedRoleCode || "todos los roles"}. Esta base sirve para una vista territorial de gobierno con permisos de solo lectura.
                  </p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Qué mirar primero</CardTitle>
            <CardDescription>
              Tres atajos para arrancar por riesgo y no por intuición.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/institutions" className="block rounded-2xl border border-border/70 bg-white/80 p-4 transition hover:border-primary/20 hover:bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Instituciones con review pendiente</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{metrics.institutionsNeedingReview} instituciones marcan `needs_review` en el resumen institucional.</p>
                </div>
                <Badge variant={metrics.institutionsNeedingReview > 0 ? "warning" : "success"}>{metrics.institutionsNeedingReview > 0 ? "Revisar" : "OK"}</Badge>
              </div>
            </Link>
            <Link href="/devices" className="block rounded-2xl border border-border/70 bg-white/80 p-4 transition hover:border-primary/20 hover:bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Dispositivos sin estado u owner</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{metrics.devicesWithoutStatus} sin estado explícito y {metrics.totalDevices - metrics.devicesWithOwner} sin owner asociado.</p>
                </div>
                <Badge variant={metrics.devicesWithoutStatus > 0 ? "warning" : "success"}>{metrics.devicesWithoutStatus > 0 ? "Atención" : "OK"}</Badge>
              </div>
            </Link>
            <Link href="/syncs" className="block rounded-2xl border border-border/70 bg-white/80 p-4 transition hover:border-primary/20 hover:bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Cobertura de sync y perfiles</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{formatPercent(metrics.syncsWithRaw, metrics.totalSyncs)} de syncs tienen raw disponible y {formatPercent(metrics.profilesWithBindings, metrics.totalProfiles)} de perfiles tienen binding activo.</p>
                </div>
                <Badge variant="outline">Seguir</Badge>
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
            <DashboardMetricCard label="Usuarios" value={String(metrics.totalUsers)} hint="Padrón actual de usuarios." icon={Users} isLoading={(usesSystemSummary ? summaryQuery.isLoading : usersQuery.isLoading) && users.length === 0} onSelect={() => setSelectedDetail({ kind: "metric-users", label: "Usuarios" })} isActive={selectedDetail?.kind === "metric-users"} />
            <DashboardMetricCard label="Instituciones" value={String(metrics.totalInstitutions)} hint="Instituciones incluidas en la vista principal." icon={Building2} isLoading={(usesSystemSummary ? summaryQuery.isLoading : institutionsQuery.isLoading) && institutions.length === 0} onSelect={() => setSelectedDetail({ kind: "metric-institutions", label: "Instituciones" })} isActive={selectedDetail?.kind === "metric-institutions"} />
            <DashboardMetricCard label="Dispositivos" value={String(metrics.totalDevices)} hint={`${metrics.homeDevices} Home y ${metrics.institutionDevices} institucionales.`} icon={Smartphone} isLoading={(usesSystemSummary ? summaryQuery.isLoading : devicesQuery.isLoading) && devices.length === 0} onSelect={() => setSelectedDetail({ kind: "metric-devices", label: "Dispositivos" })} isActive={selectedDetail?.kind === "metric-devices"} />
            <DashboardMetricCard label="Sincronizaciones" value={String(metrics.totalSyncs)} hint={`${formatPercent(metrics.syncsWithRaw, metrics.totalSyncs)} con raw disponible.`} icon={Layers3} tone="accent" isLoading={(usesSystemSummary ? summaryQuery.isLoading : syncsQuery.isLoading) && syncs.length === 0} onSelect={() => setSelectedDetail({ kind: "metric-syncs", label: "Sincronizaciones" })} isActive={selectedDetail?.kind === "metric-syncs"} />
            <DashboardMetricCard label="Partidas" value={String(metrics.totalGames)} hint={`${formatAverage(metrics.totalPlayers, metrics.totalGames)} jugadores por partida.`} icon={Database} tone="accent" isLoading={(usesSystemSummary ? summaryQuery.isLoading : gamesQuery.isLoading) && games.length === 0} onSelect={() => setSelectedDetail({ kind: "metric-games", label: "Partidas" })} isActive={selectedDetail?.kind === "metric-games"} />
            {canSeeHealthModule ? (
              <DashboardMetricCard label="Salud" value={metrics.readiness} hint={`Backend ${metrics.version}.`} icon={HeartPulse} tone={metrics.degradedChecks === 0 ? "accent" : "warning"} isLoading={canSeeHealthModule && healthQuery.isLoading && !healthQuery.data} onSelect={() => setSelectedDetail({ kind: "metric-health", label: "Salud" })} isActive={selectedDetail?.kind === "metric-health"} />
            ) : (
              <DashboardMetricCard label="Perfiles" value={String(metrics.totalProfiles)} hint={`${metrics.activeProfiles} activos y ${metrics.profilesWithSessions} con sesiones.`} icon={UserSquare2} tone="accent" isLoading={(usesSystemSummary ? summaryQuery.isLoading : profilesQuery.isLoading) && profiles.length === 0} onSelect={() => setSelectedDetail({ kind: "metric-profiles", label: "Perfiles" })} isActive={selectedDetail?.kind === "metric-profiles"} />
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
          title="Mini tendencias"
          description={`Evolución diaria de syncs, partidas y turnos para el recorte actual (${trendRangeLabel}). Ideal para la futura vista territorial de gobiernos.`}
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
                  <p className="font-medium text-foreground">Syncs del período</p>
                  <p className="mt-1">{trendSeries.reduce((sum, item) => sum + item.syncs, 0)} acumulados en la serie.</p>
                </div>
                <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Partidas del período</p>
                  <p className="mt-1">{trendSeries.reduce((sum, item) => sum + item.games, 0)} registradas en la serie.</p>
                </div>
                <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Tasa de éxito reciente</p>
                  <p className="mt-1">{trendSeries[trendSeries.length - 1]?.success_rate || 0}% en el último período de la serie.</p>
                </div>
              </div>
            ) : null
          }
        />
      ) : null}

      {usesSystemSummary ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Comparativa entre períodos</CardTitle>
            <CardDescription>
              Contraste del período actual contra el bloque inmediatamente anterior ({comparisonWindowLabel}).
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
                  <p className="mt-2">Período anterior: {metric.previous}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {usesSystemSummary ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Semáforos de seguimiento</CardTitle>
            <CardDescription>
              Alertas rápidas construidas sobre la comparación entre períodos y el estado del recorte actual.
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
            <CardTitle>Presets inteligentes del sistema</CardTitle>
            <CardDescription>Vistas ejecutivas de fábrica para priorizar territorios sin tener que construir filtros manuales.</CardDescription>
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
                <CardTitle>Vistas ejecutivas guardadas</CardTitle>
                <CardDescription>Presets locales para recuperar rápido combinaciones territoriales que revisas seguido.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={copyCurrentViewLink}>
                  {shareLinkState === "copied" ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {shareLinkState === "copied"
                    ? "Link copiado"
                    : shareLinkState === "error"
                      ? "No pude copiar"
                      : "Copiar link"}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={saveCurrentPreset}>
                  Guardar vista actual
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
                      Borrar
                    </button>
                  </div>
                  <p className="mt-2">{Object.values(preset.filters).filter(Boolean).join(" · ") || "Vista general"}</p>
                  <button
                    type="button"
                    className="mt-3 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-foreground"
                    onClick={() => applyPreset(preset)}
                  >
                    Aplicar preset
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">Todavía no hay presets guardados. Puedes guardar la combinación actual de filtros y reutilizarla después.</div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {isGovernmentViewer ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>Drilldown territorial</CardTitle>
                <CardDescription>Jerarquía país → estado → ciudad para bajar de nivel sin salir de la home.</CardDescription>
              </div>
              <button
                type="button"
                className="rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
                onClick={downloadTerritorialReport}
              >
                Exportar CSV ejecutivo
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
                      <p className="mt-1">{country.users} usuarios, {country.institutions} instituciones, {country.games} partidas, {country.turns} turnos.</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                      onClick={() => updateFilter("country_code", country.key)}
                    >
                      Filtrar país
                    </button>
                  </div>

                  <div className="mt-4 space-y-3 border-l border-border/60 pl-4">
                    {country.states.slice(0, 4).map((stateEntry) => (
                      <div key={`${country.key}-${stateEntry.key}`} className="rounded-xl bg-background/70 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{stateEntry.key}</p>
                            <p className="mt-1">{stateEntry.users} usuarios, {stateEntry.institutions} instituciones, {stateEntry.games} partidas, {stateEntry.turns} turnos.</p>
                          </div>
                          <button
                            type="button"
                            className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                            onClick={() => updateFilters({ country_code: country.key, state: stateEntry.key, city: "" })}
                          >
                            Filtrar estado
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
                              {cityEntry.key} · {cityEntry.users} usuarios · {cityEntry.turns} turnos
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">No hay estructura territorial suficiente para mostrar drilldown en el recorte actual.</div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {isGovernmentViewer ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Alertas por territorio</CardTitle>
            <CardDescription>Focos subterritoriales que pueden quedar ocultos cuando el agregado país todavía se ve sano.</CardDescription>
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
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">No hay alertas territoriales activas con el recorte actual.</div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {isGovernmentViewer ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Índice territorial compuesto</CardTitle>
            <CardDescription>Score ejecutivo para ordenar prioridades por territorio combinando actividad, cobertura y señales de riesgo.</CardDescription>
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
                  <p className="mt-2">{territory.users} usuarios, {territory.games} partidas, {territory.turns} turnos.</p>
                  <ul className="mt-3 list-disc space-y-1 pl-4 text-xs">
                    {territory.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">Todavía no hay suficiente señal para calcular un índice territorial útil.</div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {isGovernmentViewer ? (
        <div className="grid gap-5 2xl:grid-cols-3">
          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)] xl:col-span-2">
            <CardHeader>
              <CardTitle>Territorios con mayor actividad</CardTitle>
              <CardDescription>Lectura rápida de dónde se concentra hoy la población activa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
            {filteredTopTerritories.length > 0 ? (
                filteredTopTerritories.map((territory, index) => (
                  <div key={territory.key} className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">{index + 1}. {territory.key}</p>
                        <p className="mt-1">{territory.users} usuarios, {territory.institutions} instituciones, {territory.games} partidas y {territory.turns} turnos.</p>
                      </div>
                      <Badge variant="secondary">Top territorio</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">Todavía no hay suficiente señal para rankear territorios con el recorte actual.</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader>
              <CardTitle>Cohortes</CardTitle>
              <CardDescription>Mix resumido de roles y tipos de usuario dentro del territorio.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-2xl bg-white/80 p-4">
                <p className="font-medium text-foreground">Roles</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {roleMix.length > 0 ? roleMix.slice(0, 5).map((item) => <Badge key={item.key} variant="secondary">{item.key}: {item.count}</Badge>) : <span>Sin datos</span>}
                </div>
              </div>
              <div className="rounded-2xl bg-white/80 p-4">
                <p className="font-medium text-foreground">Tipos de usuario</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {userTypeMix.length > 0 ? userTypeMix.slice(0, 5).map((item) => <Badge key={item.key} variant="secondary">{item.key}: {item.count}</Badge>) : <span>Sin datos</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-5 2xl:grid-cols-3">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Uso y actividad</CardTitle>
            <CardDescription>Estadísticas rápidas para leer el movimiento real del sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">Turnos y partidas</p>
              <p className="mt-1">{metrics.totalTurns} turnos, {formatAverage(metrics.totalTurns, metrics.gamesWithTurns || metrics.totalGames)} turnos por partida con actividad.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">Éxito de turnos</p>
              <p className="mt-1">{formatPercent(metrics.successfulTurns, metrics.totalTurns)} de los turnos terminaron en éxito.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Calidad del dato</CardTitle>
            <CardDescription>Cobertura útil para detectar dónde falta trazabilidad o vínculo entre datos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">Dispositivos identificados</p>
              <p className="mt-1">{formatPercent(metrics.devicesWithFirmware, metrics.totalDevices)} tienen firmware registrado y {formatPercent(metrics.devicesWithOwner, metrics.totalDevices)} tienen owner asociado.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">Profiles útiles</p>
              <p className="mt-1">{formatPercent(metrics.profilesWithSessions, metrics.totalProfiles)} tienen sesiones y {formatPercent(metrics.profilesWithBindings, metrics.totalProfiles)} tienen binding activo.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Distribución general</CardTitle>
            <CardDescription>Cómo está repartido hoy el parque disponible.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">Devices Home vs institución</p>
              <p className="mt-1">{metrics.homeDevices} Home, {metrics.institutionDevices} institucionales.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">Cobertura de fuentes</p>
              <p className="mt-1">{loadedSources} fuentes respondieron correctamente y {failedSources} fallaron; la home sigue disponible con degradación parcial.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardBarChartCard
          title="Cobertura de perfiles"
          description="Perfiles activos, con binding y con sesiones para medir madurez real del uso."
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
          title="Usuarios por rol"
          description="Distribución del padrón por rol para entender de un vistazo quién sostiene la operación observada."
          data={executiveRoleSeries}
          range={roleRange}
          onRangeChange={(range) => setModuleRange("role-series", range)}
          csvFileName={`dashboard-usuarios-por-rol-${roleRange}`}
          onDatumSelect={(label) => setSelectedDetail({ kind: "role", label })}
          activeDatumLabel={selectedDetail?.kind === "role" ? selectedDetail.label : null}
        />
        <DashboardBarChartCard
          title="Usuarios por tipo"
          description="Composición por tipos de usuario para detectar sesgos de adopción o cobertura."
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
          title="Instituciones con mayor carga"
          description={usesSystemSummary ? "Comparativa de instituciones por usuarios y referencia secundaria de turnos o actividad observada." : "Comparativa local por estudiantes con referencia secundaria de usuarios."}
          data={executiveInstitutionLoad}
          secondaryDataKey="secondaryValue"
          secondaryLabel="Turnos"
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
            <CardTitle>Instituciones destacadas en el territorio</CardTitle>
            <CardDescription>Comparativa compacta para detectar dónde hay mayor actividad o cobertura.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {topInstitutions.length > 0 ? (
              topInstitutions.map((institution) => (
                <div key={institution.id} className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{institution.name}</p>
                  <p className="mt-1">{institution.city || institution.state || "Sin territorio detallado"}</p>
                  <p className="mt-2">{institution.users} usuarios, {institution.games} partidas, {institution.turns} turnos.</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">El recorte actual todavía no muestra instituciones con actividad suficiente para destacarlas.</div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-destructive/20 bg-white/85">
          <CardContent className="p-6 text-sm text-destructive">
            No pude cargar una parte del dashboard: {error}. La home sigue mostrando las fuentes que sí respondieron.
          </CardContent>
        </Card>
      ) : null}

    </div>
  );
}
