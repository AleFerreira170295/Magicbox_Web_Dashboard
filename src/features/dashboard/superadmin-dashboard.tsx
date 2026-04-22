"use client";

import Link from "next/link";
import { type ComponentType, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  Copy,
  Database,
  HeartPulse,
  KeyRound,
  Layers3,
  ShieldCheck,
  Smartphone,
  UserSquare2,
  UserPlus,
  Users,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSystemDashboardSummary } from "@/features/dashboard/api";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
import { useGames } from "@/features/games/api";
import { useBasicHealth, useReadinessHealth } from "@/features/health/api";
import type { HealthCheckItem } from "@/features/health/types";
import { useInstitutions } from "@/features/institutions/api";
import { useProfilesOverview } from "@/features/profiles/api";
import { useSyncSessions } from "@/features/syncs/api";
import { useUsers } from "@/features/users/api";
import { getErrorMessage } from "@/lib/utils";

function formatPercent(value: number, total: number) {
  if (total <= 0) return "Sin datos";
  return `${Math.round((value / total) * 100)}%`;
}

function formatAverage(total: number, count: number, digits = 1) {
  if (count <= 0) return "Sin datos";
  return (total / count).toFixed(digits);
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  isLoading = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "primary" | "accent" | "warning";
  isLoading?: boolean;
}) {
  const toneClass = {
    primary: "bg-primary/12 text-primary",
    accent: "bg-accent text-accent-foreground",
    warning: "bg-amber-100 text-amber-700",
  }[tone];

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            {isLoading ? (
              <>
                <Skeleton className="mt-3 h-8 w-20 rounded-xl" />
                <Skeleton className="mt-3 h-4 w-40 rounded-xl" />
              </>
            ) : (
              <>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p>
              </>
            )}
          </div>
          <div className={`rounded-2xl p-3 ${toneClass}`}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleCard({
  title,
  description,
  icon: Icon,
  href,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full border-border/80 bg-card/95 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(31,42,55,0.08)]">
        <CardContent className="flex h-full flex-col p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="rounded-2xl bg-primary/12 p-3 text-primary">
              <Icon className="size-5" />
            </div>
            <Badge variant="success">Disponible</Badge>
          </div>
          <div className="mt-5">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <div className="mt-auto pt-5 text-sm font-medium text-primary">Abrir módulo</div>
        </CardContent>
      </Card>
    </Link>
  );
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
  const { tokens, user } = useAuth();
  const isAdmin = user?.roles.includes("admin") || false;
  const isGovernmentViewer = user?.roles.includes("government-viewer") || false;
  const isInstitutionAdmin = user?.roles.includes("institution-admin") || false;
  const isDirector = user?.roles.includes("director") || false;
  const usesSystemSummary = isAdmin || isGovernmentViewer;
  const canSeeUsersModule = isAdmin || isInstitutionAdmin;
  const canSeePermissionsModule = Boolean(
    isAdmin ||
      (isInstitutionAdmin &&
        (user?.permissions.includes("access_control:read") ||
          user?.permissions.includes("access-control:read") ||
          user?.permissions.includes("feature:read") ||
          user?.permissions.includes("feature:read:any"))),
  );
  const canSeeHealthModule = isAdmin;
  const canSeeSettingsModule = isAdmin;
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
  const usersQuery = useUsers(!usesSystemSummary ? tokens?.accessToken : undefined);
  const institutionsQuery = useInstitutions(!usesSystemSummary ? tokens?.accessToken : undefined);
  const devicesQuery = useDevices(!usesSystemSummary ? tokens?.accessToken : undefined);
  const syncsQuery = useSyncSessions(!usesSystemSummary ? tokens?.accessToken : undefined);
  const gamesQuery = useGames(!usesSystemSummary ? tokens?.accessToken : undefined);
  const profilesQuery = useProfilesOverview(!usesSystemSummary ? tokens?.accessToken : undefined);
  const healthQuery = useBasicHealth({ enabled: canSeeHealthModule });
  const readinessQuery = useReadinessHealth({ enabled: canSeeHealthModule });

  const users = usesSystemSummary ? EMPTY_LIST : usersQuery.data?.data ?? EMPTY_LIST;
  const institutions = usesSystemSummary ? EMPTY_LIST : institutionsQuery.data?.data ?? EMPTY_LIST;
  const devices = usesSystemSummary ? EMPTY_LIST : devicesQuery.data?.data ?? EMPTY_LIST;
  const syncs = usesSystemSummary ? EMPTY_LIST : syncsQuery.data?.data ?? EMPTY_LIST;
  const games = usesSystemSummary ? EMPTY_LIST : gamesQuery.data?.data ?? EMPTY_LIST;
  const profiles = usesSystemSummary ? EMPTY_LIST : profilesQuery.data ?? EMPTY_LIST;
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
      selectedRange !== "30d" ? `Rango: ${selectedRange}` : null,
      selectedInstitutionId ? `Institución: ${selectedInstitutionId}` : null,
      selectedCountryCode ? `País: ${selectedCountryCode}` : null,
      selectedState ? `Estado: ${selectedState}` : null,
      selectedCity ? `Ciudad: ${selectedCity}` : null,
      selectedUserType ? `Tipo: ${selectedUserType}` : null,
      selectedRoleCode ? `Rol: ${selectedRoleCode}` : null,
      activeSmartPreset !== "all" ? `Preset: ${activeSmartPreset}` : null,
    ].filter((value): value is string => Boolean(value)),
    [activeSmartPreset, selectedCity, selectedCountryCode, selectedInstitutionId, selectedRange, selectedRoleCode, selectedState, selectedUserType],
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
        environment: canSeeHealthModule ? healthQuery.data?.environment || "-" : "scopeado",
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
      environment: canSeeHealthModule ? healthQuery.data?.environment || "-" : "scopeado",
      version: canSeeHealthModule ? healthQuery.data?.version || "-" : "no disponible",
      readiness: canSeeHealthModule ? readinessQuery.data?.status || "unknown" : "no disponible",
    };
  }, [canSeeHealthModule, devices, devicesQuery.data, games, gamesQuery.data, healthQuery.data, institutions, institutionsQuery.data, profiles, readinessChecks, readinessQuery.data, summaryQuery.data, syncs, syncsQuery.data, usesSystemSummary, users, usersQuery.data]);

  const scopeLabel = isAdmin
    ? "Superadmin"
    : isGovernmentViewer
      ? "Gobierno"
      : isInstitutionAdmin
        ? "Institution admin"
        : isDirector
          ? "Dirección"
          : "Operación";

  const moduleCards = [
    { title: "Usuarios", description: "Alta, edición, roles, ACL y revisión operativa del padrón.", icon: UserPlus, href: "/users", visible: canSeeUsersModule },
    { title: "Permisos", description: "Catálogo ACL, acciones y reglas activas de acceso.", icon: KeyRound, href: "/permissions", visible: canSeePermissionsModule },
    { title: "Instituciones", description: "Resumen operativo, previews y estado institucional.", icon: Building2, href: "/institutions", visible: isAdmin || isInstitutionAdmin || isDirector },
    { title: "Dispositivos", description: "Parque real con estado, owner y alcance Home/institución.", icon: Smartphone, href: "/devices", visible: true },
    { title: "Syncs", description: "Sesiones sincronizadas con detalle y raw reciente.", icon: ShieldCheck, href: "/syncs", visible: true },
    { title: "Games", description: "Partidas, jugadores, turnos y lectura operativa del juego.", icon: Database, href: "/games", visible: true },
    { title: "Profiles", description: "Perfiles Home reales con owner, bindings y sesiones.", icon: UserSquare2, href: "/profiles", visible: true },
    { title: "Health", description: "Health técnico real y señales operativas del sistema.", icon: HeartPulse, href: "/health", visible: canSeeHealthModule },
    { title: "Settings", description: "Runtime efectivo, OTA y catálogos ACL actuales.", icon: ShieldCheck, href: "/settings", visible: canSeeSettingsModule },
  ].filter((module) => module.visible);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={scopeLabel}
        title="Centro de control MagicBox"
        description="Home operativo real del dashboard. Resume usuarios, instituciones, devices, syncs, games, profiles y salud técnica sin depender de pantallas placeholder."
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="overflow-hidden border-none bg-[linear-gradient(135deg,#1f2a37_0%,#2c4156_55%,#39546f_100%)] text-white shadow-[0_20px_60px_rgba(31,42,55,0.22)]">
          <CardContent className="p-8 sm:p-10">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/14 text-white hover:bg-white/14">Operación real</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Dashboard home</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">MagicBox control plane</Badge>
            </div>

            {usesSystemSummary ? (
              <>
                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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

                {activeExecutiveFilters.length > 0 ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/85 backdrop-blur-sm">
                    <p>
                      Vista afinada con {activeExecutiveFilters.length} filtro{activeExecutiveFilters.length === 1 ? "" : "s"} activo{activeExecutiveFilters.length === 1 ? "" : "s"}.
                    </p>
                    <Button type="button" variant="outline" size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white" onClick={resetExecutiveView}>
                      Volver a vista general
                    </Button>
                  </div>
                ) : null}
              </>
            ) : null}

            <div className="mt-6 max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                La home ya puede resumir el estado del sistema completo en lugar de repetir promesas de módulos futuros.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/78">
                Desde acá ya se puede leer alcance operativo, focos de revisión y puertas de entrada a los módulos que aterrizamos en esta iteración.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Cobertura</p>
                <p className="mt-2 text-lg font-medium">{metrics.totalUsers} usuarios, {metrics.totalInstitutions} instituciones y {metrics.totalDevices} dispositivos visibles.</p>
                <p className="mt-2 text-sm text-white/70">{loadedSources}/{totalSources} fuentes cargadas, {failedSources} con error.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Actividad</p>
                <p className="mt-2 text-lg font-medium">{metrics.totalSyncs} syncs, {metrics.totalGames} partidas, {metrics.totalTurns} turnos y {metrics.totalProfiles} profiles.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">{canSeeHealthModule ? "Salud" : "Alcance"}</p>
                <p className="mt-2 text-lg font-medium">
                  {canSeeHealthModule
                    ? `${metrics.readiness} · ${metrics.degradedChecks} checks degradados · ${metrics.environment}.`
                    : `${scopeLabel.toLowerCase()} · ${metrics.totalInstitutions} instituciones visibles · ${metrics.totalDevices} devices.`}
                </p>
              </div>
              {usesSystemSummary ? (
                <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm md:col-span-3">
                  <p className="text-sm text-white/70">Scope territorial y cohortes</p>
                  <p className="mt-2 text-lg font-medium">
                    {selectedCountryCode || "Todos los países"} · {selectedState || "todos los territorios"} · {selectedCity || "todas las ciudades"}
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    Cohortes activas: {selectedUserType || "todos los tipos de usuario"} y {selectedRoleCode || "todos los roles"}. Esta base sirve para una vista territorial tipo gobierno con permisos de solo visualización.
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
              Señales blandas para ubicar rápido el próximo foco de revisión.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Instituciones con review pendiente</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{metrics.institutionsNeedingReview} instituciones marcan `needs_review` en el resumen operativo.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Dispositivos sin estado</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{metrics.devicesWithoutStatus} dispositivos visibles siguen sin `status` explícito, y {metrics.totalDevices - metrics.devicesWithOwner} no tienen owner asociado.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Cobertura de raw y bindings</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{formatPercent(metrics.syncsWithRaw, metrics.totalSyncs)} de syncs tienen raw visible y {formatPercent(metrics.profilesWithBindings, metrics.totalProfiles)} de profiles tienen binding activo.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {showInitialLoading ? (
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label="Usuarios" value={String(metrics.totalUsers)} hint="Padrón operativo visible." icon={Users} isLoading={(usesSystemSummary ? summaryQuery.isLoading : usersQuery.isLoading) && users.length === 0} />
            <SummaryCard label="Instituciones" value={String(metrics.totalInstitutions)} hint="Clientes y alcance actual." icon={Building2} isLoading={(usesSystemSummary ? summaryQuery.isLoading : institutionsQuery.isLoading) && institutions.length === 0} />
            <SummaryCard label="Devices" value={String(metrics.totalDevices)} hint={`${metrics.homeDevices} Home y ${metrics.institutionDevices} institucionales.`} icon={Smartphone} isLoading={(usesSystemSummary ? summaryQuery.isLoading : devicesQuery.isLoading) && devices.length === 0} />
            <SummaryCard label="Syncs" value={String(metrics.totalSyncs)} hint={`${formatPercent(metrics.syncsWithRaw, metrics.totalSyncs)} con raw visible.`} icon={Layers3} tone="accent" isLoading={(usesSystemSummary ? summaryQuery.isLoading : syncsQuery.isLoading) && syncs.length === 0} />
            <SummaryCard label="Games" value={String(metrics.totalGames)} hint={`${formatAverage(metrics.totalPlayers, metrics.totalGames)} jugadores por partida.`} icon={Database} tone="accent" isLoading={(usesSystemSummary ? summaryQuery.isLoading : gamesQuery.isLoading) && games.length === 0} />
            {canSeeHealthModule ? (
              <SummaryCard label="Health" value={metrics.readiness} hint={`Backend ${metrics.version}.`} icon={HeartPulse} tone={metrics.degradedChecks === 0 ? "accent" : "warning"} isLoading={canSeeHealthModule && healthQuery.isLoading && !healthQuery.data} />
            ) : (
              <SummaryCard label="Profiles" value={String(metrics.totalProfiles)} hint={`${metrics.activeProfiles} activos y ${metrics.profilesWithSessions} con sesiones.`} icon={UserSquare2} tone="accent" isLoading={(usesSystemSummary ? summaryQuery.isLoading : profilesQuery.isLoading) && profiles.length === 0} />
            )}
          </>
        )}
      </div>

      {usesSystemSummary ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Mini tendencias</CardTitle>
            <CardDescription>
              Evolución diaria de syncs, partidas y turnos para el recorte actual ({trendRangeLabel}). Ideal para la futura vista territorial de gobiernos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summaryQuery.isLoading && trends.length === 0 ? (
              <Skeleton className="h-72 rounded-2xl" />
            ) : trends.length > 0 ? (
              <div className="space-y-4">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} tickMargin={8} />
                      <Tooltip />
                      <Line type="monotone" dataKey="syncs" stroke="#2563eb" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="games" stroke="#7c3aed" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="turns" stroke="#0f766e" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Syncs del período</p>
                    <p className="mt-1">{trends.reduce((sum, item) => sum + item.syncs, 0)} acumulados en la serie.</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Partidas del período</p>
                    <p className="mt-1">{trends.reduce((sum, item) => sum + item.games, 0)} registradas en la serie.</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Tasa de éxito reciente</p>
                    <p className="mt-1">{trends.length ? trends[trends.length - 1]?.success_rate || 0 : 0}% en el último bucket visible.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                No hay actividad suficiente para dibujar tendencias con el recorte actual.
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {usesSystemSummary ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Comparativa entre períodos</CardTitle>
            <CardDescription>
              Contraste del período actual contra el bloque inmediatamente anterior ({comparisonWindowLabel}).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            <CardTitle>Semáforos operativos</CardTitle>
            <CardDescription>
              Alertas rápidas construidas sobre la comparación entre períodos y el estado del recorte actual.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
        <div className="grid gap-5 xl:grid-cols-3">
          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)] xl:col-span-2">
            <CardHeader>
              <CardTitle>Territorios con mayor actividad</CardTitle>
              <CardDescription>Lectura rápida de dónde se concentra hoy la población activa dentro del alcance visible.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
            {filteredTopTerritories.length > 0 ? (
                filteredTopTerritories.map((territory, index) => (
                  <div key={territory.key} className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">{index + 1}. {territory.key}</p>
                        <p className="mt-1">{territory.users} usuarios visibles, {territory.institutions} instituciones, {territory.games} partidas y {territory.turns} turnos.</p>
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
              <CardTitle>Cohortes visibles</CardTitle>
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

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Uso y actividad</CardTitle>
            <CardDescription>Estadísticas rápidas para leer el movimiento real del sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">Turnos y partidas</p>
              <p className="mt-1">{metrics.totalTurns} turnos visibles, {formatAverage(metrics.totalTurns, metrics.gamesWithTurns || metrics.totalGames)} turnos por partida con actividad.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">Éxito de turnos</p>
              <p className="mt-1">{formatPercent(metrics.successfulTurns, metrics.totalTurns)} de los turnos visibles terminaron en éxito.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Calidad del dato</CardTitle>
            <CardDescription>Cobertura útil para detectar dónde falta trazabilidad o vínculo operativo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">Dispositivos identificados</p>
              <p className="mt-1">{formatPercent(metrics.devicesWithFirmware, metrics.totalDevices)} tienen firmware visible y {formatPercent(metrics.devicesWithOwner, metrics.totalDevices)} tienen owner asociado.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">Profiles útiles</p>
              <p className="mt-1">{formatPercent(metrics.profilesWithSessions, metrics.totalProfiles)} tienen sesiones y {formatPercent(metrics.profilesWithBindings, metrics.totalProfiles)} tienen binding activo.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Distribución operativa</CardTitle>
            <CardDescription>Cómo está repartido hoy el parque y el alcance visible.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">Devices Home vs institución</p>
              <p className="mt-1">{metrics.homeDevices} Home, {metrics.institutionDevices} institucionales.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="font-medium text-foreground">Cobertura de fuentes</p>
              <p className="mt-1">{loadedSources} fuentes respondieron correctamente, {failedSources} fallaron y la home sigue operativa con degradación parcial.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isGovernmentViewer ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Instituciones destacadas en el territorio</CardTitle>
            <CardDescription>Comparativa compacta para detectar dónde hay mayor actividad o cobertura.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {topInstitutions.length > 0 ? (
              topInstitutions.map((institution) => (
                <div key={institution.id} className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{institution.name}</p>
                  <p className="mt-1">{institution.city || institution.state || "Sin territorio detallado"}</p>
                  <p className="mt-2">{institution.users} usuarios, {institution.games} partidas, {institution.turns} turnos.</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">No hay instituciones destacadas para el recorte actual.</div>
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

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {moduleCards.map((module) => (
          <ModuleCard key={module.href} title={module.title} description={module.description} icon={module.icon} href={module.href} />
        ))}
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Prioridad sugerida después de esta home</CardTitle>
              <CardDescription>
                {user?.fullName || "La cuenta autenticada"} ya tiene un home operativo. El próximo paso lógico es pulir coherencia transversal, tests y pequeños huecos de contrato, no abrir más placeholders.
              </CardDescription>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              Siguiente paso sugerido
              <ArrowRight className="size-4" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">1. Coherencia de navegación</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Ajustar accesos y copy para institution-admin/director donde ya aplique.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">2. Cobertura de tests UI</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Agregar pruebas mínimas a módulos nuevos fuera de Users.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">3. QA consolidado</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Usar esta home como punto de entrada y validar el flujo completo en local.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
