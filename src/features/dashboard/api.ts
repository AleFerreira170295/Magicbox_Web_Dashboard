import { useQuery } from "@tanstack/react-query";
import { apiEndpoints } from "@/lib/api/endpoints";
import { apiRequest } from "@/lib/api/fetcher";

export type SystemDashboardSummary = {
  totals: {
    users: number;
    institutions: number;
    devices: number;
    syncs: number;
    games: number;
    profiles: number;
    turns: number;
  };
  stats: {
    institutions_needing_review: number;
    devices_without_status: number;
    devices_with_owner: number;
    devices_with_firmware: number;
    home_devices: number;
    institution_devices: number;
    syncs_with_raw: number;
    total_players: number;
    successful_turns: number;
    games_with_turns: number;
    active_profiles: number;
    profiles_with_bindings: number;
    profiles_with_sessions: number;
  };
};

export async function getSystemDashboardSummary(token: string) {
  return apiRequest<SystemDashboardSummary>(apiEndpoints.dashboard.systemSummary, {
    token,
  });
}

export function useSystemDashboardSummary(token?: string, enabled = true) {
  return useQuery({
    queryKey: ["dashboard", "system-summary", token],
    queryFn: () => getSystemDashboardSummary(token as string),
    enabled: Boolean(token && enabled),
  });
}
