import { appConfig } from "@/lib/api/config";
import type { JsonObject } from "@/lib/api/types";
import type { AppRole } from "@/features/auth/types";

const knownRoles: AppRole[] = ["teacher", "director", "family", "researcher", "admin", "institution-admin"];

function normalizeRole(value: unknown): AppRole | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim().toLowerCase();
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
    .map(normalizeRole)
    .filter(Boolean) as AppRole[];

  if (explicitCandidates.length > 0) {
    return [...new Set(explicitCandidates)];
  }

  const envRole = normalizeRole(appConfig.defaultRole);
  if (envRole) return [envRole];

  const userType = readString(raw.user_type || raw.userType).toUpperCase();
  if (userType.includes("WEB")) return ["teacher"];
  if (userType.includes("MOBILE")) return ["family"];
  return ["researcher"];
}

export function resolvePermissions(raw: JsonObject): string[] {
  const direct = raw.permissions;
  if (Array.isArray(direct)) {
    return direct.filter((item): item is string => typeof item === "string");
  }
  return [];
}
