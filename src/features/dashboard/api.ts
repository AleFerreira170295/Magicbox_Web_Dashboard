import { useQuery } from "@tanstack/react-query";
import { apiEndpoints } from "@/lib/api/endpoints";
import { apiRequest } from "@/lib/api/fetcher";

export type SystemDashboardSummary = {
  filters: {
    selected_range: string;
    selected_institution_id: string | null;
    range_options: Array<{ value: string; label: string }>;
    institutions: Array<{ id: string; name: string }>;
    window_start: string | null;
  };
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

export async function getSystemDashboardSummary(
  token: string,
  filters?: { range?: string; institutionId?: string | null },
) {
  return apiRequest<SystemDashboardSummary>(apiEndpoints.dashboard.systemSummary, {
    token,
    searchParams: {
      ...(filters?.range ? { range: filters.range } : {}),
      ...(filters?.institutionId ? { institution_id: filters.institutionId } : {}),
    },
  });
}

export function useSystemDashboardSummary(
  token?: string,
  filters?: { range?: string; institutionId?: string | null },
  enabled = true,
) {
  return useQuery({
    queryKey: ["dashboard", "system-summary", token, filters?.range || "30d", filters?.institutionId || "all"],
    queryFn: () => getSystemDashboardSummary(token as string, filters),
    enabled: Boolean(token && enabled),
  });
}
