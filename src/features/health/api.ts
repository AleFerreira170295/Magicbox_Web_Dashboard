import { useQuery } from "@tanstack/react-query";
import { appConfig } from "@/lib/api/config";
import type { BasicHealthRecord, LivenessHealthRecord, ReadinessHealthRecord } from "@/features/health/types";

function buildHealthUrl(path: string) {
  const base = new URL(appConfig.apiBaseUrl);
  base.pathname = path;
  base.search = "";
  return base.toString();
}

async function fetchHealth<T>(path: string): Promise<T> {
  const response = await fetch(buildHealthUrl(path), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function useBasicHealth() {
  return useQuery({
    queryKey: ["system-health", "basic"],
    queryFn: () => fetchHealth<BasicHealthRecord>("/health"),
    refetchInterval: 30000,
  });
}

export function useReadinessHealth() {
  return useQuery({
    queryKey: ["system-health", "readiness"],
    queryFn: () => fetchHealth<ReadinessHealthRecord>("/health/ready"),
    refetchInterval: 30000,
  });
}

export function useLivenessHealth() {
  return useQuery({
    queryKey: ["system-health", "liveness"],
    queryFn: () => fetchHealth<LivenessHealthRecord>("/health/live"),
    refetchInterval: 30000,
  });
}
