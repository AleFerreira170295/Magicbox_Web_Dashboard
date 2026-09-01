import { appConfig } from "@/lib/api/config";
import type { JsonObject } from "@/lib/api/types";
import type { AppRole } from "@/features/auth/types";

const knownRoles: AppRole[] = ["teacher", "director", "family", "researcher", "admin", "institution-admin", "government-viewer"];

const roleAliases: Record<string, AppRole> = {
  administrator: "admin",
  "global-admin": "admin",
  global_admin: "admin",
  platform_admin: "admin",
  "platform-admin": "admin",
  super_admin: "admin",
  "super-admin": "admin",
  institution_admin: "institution-admin",
  institutional_admin: "institution-admin",
  "institutional-admin": "institution-admin",
  school_admin: "institution-admin",
  "school-admin": "institution-admin",
  government: "government-viewer",
  government_viewer: "government-viewer",
  "government-view": "government-viewer",
  tutor: "family",
  parent: "family",
};

function normalizeRole(value: unknown): AppRole | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim().toLowerCase().replace(/\s+/g, "-");
  return knownRoles.includes(candidate as AppRole) ? (candidate as AppRole) : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function resolveRoles(raw: JsonObject): AppRole[] {
  const explicitCandidates = [
    raw.role,
    ...(Array.isArray(raw.roles) ? raw.roles : []),
  ]
    .map((candidate) => normalizeRole(candidate) || roleAliases[readString(candidate).trim().toLowerCase()])
    .filter(Boolean) as AppRole[];

  if (explicitCandidates.length > 0) {
    return [...new Set(explicitCandidates)];
  }

  const userType = readString(raw.user_type || raw.userType).toUpperCase();
  if (userType.includes("WEB")) return ["teacher"];
  if (userType.includes("MOBILE")) return ["family"];

  if (process.env.NODE_ENV !== "production") {
    const envRole = normalizeRole(appConfig.defaultRole);
    if (envRole) return [envRole];
  }

  return ["researcher"];
}

export function resolvePermissions(raw: JsonObject): string[] {
  const direct = raw.permissions;
  if (Array.isArray(direct)) {
    return direct.filter((item): item is string => typeof item === "string");
  }
  return [];
}
