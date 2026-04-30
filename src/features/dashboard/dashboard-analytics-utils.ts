import type { DeviceRecord } from "@/features/devices/types";
import type { GameRecord } from "@/features/games/types";
import type { ProfileOverviewRecord } from "@/features/profiles/types";
import type { SyncSessionRecord } from "@/features/syncs/types";
import type { AuthUser } from "@/features/auth/types";
import type { UserRecord } from "@/features/users/types";
import type { AnalyticsDatum } from "@/features/dashboard/dashboard-analytics-shared";

type KeyCountItem = { key?: string | null; count: number };

function getRelativeDaysFromNow(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function normalizeAnalyticsLabel(value?: string | null, fallback = "Sin dato") {
  if (!value) return fallback;
  return value.replace(/[|]/g, " / ").replace(/[-_]/g, " ");
}

function getOptionalStringField(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : null;
}

export function getDateBucketLabel(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

export function buildGameActivitySeries(games: GameRecord[]): AnalyticsDatum[] {
  const map = new Map<string, { label: string; value: number; secondaryValue: number; sortValue: number }>();

  for (const game of games) {
    const source = game.startDate || game.createdAt || game.updatedAt || null;
    const date = source ? new Date(source) : null;
    const key = date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : game.id;
    const current = map.get(key) || {
      label: getDateBucketLabel(source),
      value: 0,
      secondaryValue: 0,
      sortValue: date && !Number.isNaN(date.getTime()) ? date.getTime() : 0,
    };
    current.value += 1;
    current.secondaryValue += game.turns.length;
    map.set(key, current);
  }

  return [...map.values()].sort((a, b) => a.sortValue - b.sortValue).slice(-10);
}

export function buildDeckUsageSeries(games: GameRecord[]): AnalyticsDatum[] {
  const totals = games.reduce<Record<string, number>>((acc, game) => {
    const key = game.deckName || "Sin mazo";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(totals)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

export function buildKeyCountSeries(items: KeyCountItem[], fallbackLabel = "Sin dato"): AnalyticsDatum[] {
  return items
    .map((item) => ({
      label: normalizeAnalyticsLabel(item.key, fallbackLabel),
      value: item.count,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

export function buildSyncSourceSeries(syncs: SyncSessionRecord[]): AnalyticsDatum[] {
  const totals = syncs.reduce<Record<string, number>>((acc, sync) => {
    const key = sync.source || sync.sourceType || "desconocido";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(totals)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

export function buildResourceBalanceSeries({
  users,
  institutions,
  devices,
  profiles,
}: {
  users?: number;
  institutions?: number;
  devices?: number;
  profiles?: number;
}): AnalyticsDatum[] {
  return [
    { label: "Usuarios", value: users || 0 },
    { label: "Instituciones", value: institutions || 0 },
    { label: "Dispositivos", value: devices || 0 },
    { label: "Perfiles", value: profiles || 0 },
  ].filter((item) => item.value > 0);
}

export function buildUserRoleSeries(users: Array<AuthUser | UserRecord | { roles?: string[] }>): AnalyticsDatum[] {
  const totals = users.reduce<Record<string, number>>((acc, user) => {
    const roles = user.roles?.length ? user.roles : ["sin rol"];
    for (const role of roles) {
      const key = role || "sin rol";
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {});

  return buildKeyCountSeries(
    Object.entries(totals).map(([key, count]) => ({ key, count })),
    "Sin rol",
  );
}

export function buildUserTypeSeries(users: Array<AuthUser | UserRecord | { userType?: string | null }>): AnalyticsDatum[] {
  const totals = users.reduce<Record<string, number>>((acc, user) => {
    const key = user.userType || "sin tipo";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return buildKeyCountSeries(
    Object.entries(totals).map(([key, count]) => ({ key, count })),
    "Sin tipo",
  );
}

export function buildUserRecencySeries(users: Array<AuthUser | UserRecord | { lastLoginAt?: string | null }>): AnalyticsDatum[] {
  const buckets = {
    active7d: 0,
    active30d: 0,
    active90d: 0,
    stale: 0,
    never: 0,
  };

  for (const user of users) {
    const diffDays = getRelativeDaysFromNow(getOptionalStringField(user, "lastLoginAt"));
    if (diffDays == null) {
      buckets.never += 1;
      continue;
    }
    if (diffDays <= 7) buckets.active7d += 1;
    else if (diffDays <= 30) buckets.active30d += 1;
    else if (diffDays <= 90) buckets.active90d += 1;
    else buckets.stale += 1;
  }

  return [
    { label: "Login ≤ 7 días", value: buckets.active7d },
    { label: "Login 8-30 días", value: buckets.active30d },
    { label: "Login 31-90 días", value: buckets.active90d },
    { label: "Login > 90 días", value: buckets.stale },
    { label: "Sin login registrado", value: buckets.never },
  ].filter((item) => item.value > 0);
}

export function buildUserCreationSeries(users: Array<AuthUser | UserRecord | { createdAt?: string | null; lastLoginAt?: string | null }>): AnalyticsDatum[] {
  const map = new Map<string, { label: string; value: number; secondaryValue: number; sortValue: number }>();

  for (const user of users) {
    const createdSource = getOptionalStringField(user, "createdAt");
    const lastLoginSource = getOptionalStringField(user, "lastLoginAt");
    const source = createdSource || lastLoginSource;
    const date = source ? new Date(source) : null;
    const key = date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : `user-${map.size}`;
    const current = map.get(key) || {
      label: getDateBucketLabel(source),
      value: 0,
      secondaryValue: 0,
      sortValue: date && !Number.isNaN(date.getTime()) ? date.getTime() : 0,
    };

    if (createdSource) current.value += 1;
    if (lastLoginSource) current.secondaryValue += 1;
    map.set(key, current);
  }

  return [...map.values()].sort((a, b) => a.sortValue - b.sortValue).slice(-10);
}

export function buildDeviceStatusSeries(devices: DeviceRecord[]): AnalyticsDatum[] {
  const withStatus = devices.filter((device) => Boolean(device.status)).length;
  const withoutStatus = devices.length - withStatus;
  const institution = devices.filter((device) => device.assignmentScope === "institution").length;
  const home = devices.filter((device) => device.assignmentScope === "home").length;

  return [
    { label: "Con status", value: withStatus },
    { label: "Sin status", value: withoutStatus },
    { label: "Institución", value: institution },
    { label: "Home", value: home },
  ].filter((item) => item.value > 0);
}

export function getSuccessRate(games: GameRecord[]) {
  const turns = games.flatMap((game) => game.turns);
  if (turns.length === 0) return 0;
  return Math.round((turns.filter((turn) => turn.success).length / turns.length) * 100);
}

export function getAverageTurnTime(games: GameRecord[]) {
  const turns = games.flatMap((game) => game.turns);
  if (turns.length === 0) return 0;
  const total = turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0);
  return total / turns.length;
}

export function getAverageGameTime(games: GameRecord[]) {
  const perGame = games
    .map((game) => game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0))
    .filter((value) => value > 0);
  if (perGame.length === 0) return 0;
  return perGame.reduce((sum, value) => sum + value, 0) / perGame.length;
}

export function buildProfileBindingSeries(profiles: ProfileOverviewRecord[]): AnalyticsDatum[] {
  const active = profiles.filter((profile) => profile.activeBindingCount > 0).length;
  const inactive = profiles.length - active;
  const withSessions = profiles.filter((profile) => profile.sessionCount > 0).length;

  return [
    { label: "Bindings activos", value: active },
    { label: "Sin binding", value: inactive },
    { label: "Con sesiones", value: withSessions },
  ].filter((item) => item.value > 0);
}

export function buildProfileCoverageBreakdown({
  totalProfiles,
  activeProfiles,
  profilesWithBindings,
  profilesWithSessions,
}: {
  totalProfiles: number;
  activeProfiles: number;
  profilesWithBindings: number;
  profilesWithSessions: number;
}): AnalyticsDatum[] {
  return [
    { label: "Activos", value: activeProfiles },
    { label: "Con binding", value: profilesWithBindings },
    { label: "Con sesiones", value: profilesWithSessions },
    { label: "Sin binding", value: Math.max(totalProfiles - profilesWithBindings, 0) },
  ];
}

export function buildProfileCoverageSeries(profiles: ProfileOverviewRecord[]): AnalyticsDatum[] {
  return buildProfileCoverageBreakdown({
    totalProfiles: profiles.length,
    activeProfiles: profiles.filter((profile) => profile.isActive).length,
    profilesWithBindings: profiles.filter((profile) => profile.activeBindingCount > 0).length,
    profilesWithSessions: profiles.filter((profile) => profile.sessionCount > 0).length,
  }).filter((item) => item.value > 0);
}

export function buildProfileAgeCategorySeries(profiles: ProfileOverviewRecord[]): AnalyticsDatum[] {
  const totals = profiles.reduce<Record<string, number>>((acc, profile) => {
    const key = profile.ageCategory || "sin categoría";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return buildKeyCountSeries(
    Object.entries(totals).map(([key, count]) => ({ key, count })),
    "Sin categoría",
  );
}

export function buildProfileSessionCohortSeries(profiles: ProfileOverviewRecord[]): AnalyticsDatum[] {
  const buckets = {
    noSessions: 0,
    low: 0,
    medium: 0,
    high: 0,
  };

  for (const profile of profiles) {
    const count = profile.sessionCount || 0;
    if (count <= 0) buckets.noSessions += 1;
    else if (count <= 3) buckets.low += 1;
    else if (count <= 10) buckets.medium += 1;
    else buckets.high += 1;
  }

  return [
    { label: "Sin sesiones", value: buckets.noSessions },
    { label: "1-3 sesiones", value: buckets.low },
    { label: "4-10 sesiones", value: buckets.medium },
    { label: "11+ sesiones", value: buckets.high },
  ].filter((item) => item.value > 0);
}

export function buildProfileRecencySeries(profiles: ProfileOverviewRecord[]): AnalyticsDatum[] {
  const buckets = {
    active7d: 0,
    active30d: 0,
    active90d: 0,
    stale: 0,
    never: 0,
  };

  for (const profile of profiles) {
    const diffDays = getRelativeDaysFromNow(profile.lastSessionAt);
    if (diffDays == null) {
      buckets.never += 1;
      continue;
    }
    if (diffDays <= 7) buckets.active7d += 1;
    else if (diffDays <= 30) buckets.active30d += 1;
    else if (diffDays <= 90) buckets.active90d += 1;
    else buckets.stale += 1;
  }

  return [
    { label: "Sesión ≤ 7 días", value: buckets.active7d },
    { label: "Sesión 8-30 días", value: buckets.active30d },
    { label: "Sesión 31-90 días", value: buckets.active90d },
    { label: "Sesión > 90 días", value: buckets.stale },
    { label: "Sin sesiones", value: buckets.never },
  ].filter((item) => item.value > 0);
}

export function buildProfileActivitySeries(profiles: ProfileOverviewRecord[]): AnalyticsDatum[] {
  const map = new Map<string, { label: string; value: number; secondaryValue: number; sortValue: number }>();

  for (const profile of profiles) {
    const primarySource = profile.lastSessionAt || profile.updatedAt || profile.createdAt || null;
    const secondarySource = profile.createdAt || null;
    const date = primarySource ? new Date(primarySource) : null;
    const key = date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : profile.id;
    const current = map.get(key) || {
      label: getDateBucketLabel(primarySource),
      value: 0,
      secondaryValue: 0,
      sortValue: date && !Number.isNaN(date.getTime()) ? date.getTime() : 0,
    };

    if (profile.lastSessionAt) {
      current.value += 1;
    }

    if (secondarySource) {
      current.secondaryValue += 1;
    }

    map.set(key, current);
  }

  return [...map.values()].sort((a, b) => a.sortValue - b.sortValue).slice(-10);
}

export function buildInstitutionCoverageSeries(
  institutions: Array<{
    id: string;
    name: string;
    operationalSummary?: { studentCount?: number; userCount?: number; classGroupCount?: number } | null;
    studentCount?: number;
    classGroupCount?: number;
  }>,
): AnalyticsDatum[] {
  return institutions
    .map((institution) => ({
      label: institution.name,
      value: institution.operationalSummary?.studentCount ?? institution.studentCount ?? 0,
      secondaryValue: institution.operationalSummary?.userCount ?? 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

export function buildTopInstitutionLoadSeries(
  institutions: Array<{ id: string; name: string; users?: number; games?: number; turns?: number }>,
): AnalyticsDatum[] {
  return institutions
    .map((institution) => ({
      label: institution.name,
      value: institution.users || 0,
      secondaryValue: institution.turns || institution.games || 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

export function buildTopInstitutionsList(institutions: Array<{ id: string; name: string; studentCount?: number; classGroupCount?: number; operationalSummary?: { studentCount?: number; classGroupCount?: number } | null }>) {
  return institutions
    .map((institution) => ({
      label: institution.name,
      value: String(institution.operationalSummary?.studentCount ?? institution.studentCount ?? 0),
      badge: `${institution.operationalSummary?.classGroupCount ?? institution.classGroupCount ?? 0} grupos`,
    }))
    .sort((a, b) => Number(b.value) - Number(a.value))
    .slice(0, 5);
}

export function buildTopUsersList(users: AuthUser[] | Array<{ fullName?: string | null; email?: string | null; roles?: string[] }>) {
  return users.slice(0, 5).map((user) => ({
    label: user.fullName || user.email || "Usuario sin nombre",
    value: String((user.roles || []).length),
    badge: (user.roles || []).join(", ") || "Sin roles asignados",
  }));
}
