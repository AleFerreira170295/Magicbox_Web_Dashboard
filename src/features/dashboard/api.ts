import { useQuery } from "@tanstack/react-query";
import { apiEndpoints } from "@/lib/api/endpoints";
import { apiRequest } from "@/lib/api/fetcher";

export type DashboardSummaryFilters = {
  range?: string;
  institutionId?: string | null;
  countryCode?: string | null;
  state?: string | null;
  city?: string | null;
  userType?: string | null;
  roleCode?: string | null;
};

export type SystemDashboardSummary = {
  filters: {
    selected_range: string;
    selected_institution_id: string | null;
    selected_country_code: string | null;
    selected_state: string | null;
    selected_city: string | null;
    selected_user_type: string | null;
    selected_role_code: string | null;
    range_options: Array<{ value: string; label: string }>;
    institutions: Array<{ id: string; name: string }>;
    countries: string[];
    states: string[];
    cities: string[];
    user_types: string[];
    role_codes: string[];
    window_start: string | null;
    trend_range: string;
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
  trends: Array<{
    date: string;
    syncs: number;
    games: number;
    turns: number;
    successful_turns: number;
    success_rate: number;
  }>;
  comparisons: {
    window_label: string;
    current_start: string;
    current_end: string;
    previous_start: string;
    previous_end: string;
    metrics: Array<{
      key: string;
      label: string;
      current: number;
      previous: number;
      delta_percent: number | null;
    }>;
  };
  alerts: Array<{
    severity: "success" | "warning" | "secondary";
    title: string;
    message: string;
  }>;
  segments: {
    role_mix: Array<{ key: string; count: number }>;
    user_type_mix: Array<{ key: string; count: number }>;
    top_institutions: Array<{ id: string; name: string; users: number; games: number; turns: number; state?: string | null; city?: string | null }>;
    top_territories: Array<{ key: string; institutions: number; users: number; games: number; turns: number }>;
    territorial_hierarchy: Array<{
      key: string;
      institutions: number;
      users: number;
      games: number;
      turns: number;
      states: Array<{
        key: string;
        institutions: number;
        users: number;
        games: number;
        turns: number;
        cities: Array<{
          key: string;
          institutions: number;
          users: number;
          games: number;
          turns: number;
        }>;
      }>;
    }>;
    territory_alerts: Array<{
      severity: "warning" | "secondary" | "success";
      scope: string;
      label: string;
      message: string;
    }>;
    territory_scores: Array<{
      label: string;
      score: number;
      status: "warning" | "secondary" | "success";
      users: number;
      games: number;
      turns: number;
      reasons: string[];
    }>;
  };
};

export async function getSystemDashboardSummary(token: string, filters?: DashboardSummaryFilters) {
  return apiRequest<SystemDashboardSummary>(apiEndpoints.dashboard.systemSummary, {
    token,
    searchParams: {
      ...(filters?.range ? { range: filters.range } : {}),
      ...(filters?.institutionId ? { institution_id: filters.institutionId } : {}),
      ...(filters?.countryCode ? { country_code: filters.countryCode } : {}),
      ...(filters?.state ? { state: filters.state } : {}),
      ...(filters?.city ? { city: filters.city } : {}),
      ...(filters?.userType ? { user_type: filters.userType } : {}),
      ...(filters?.roleCode ? { role_code: filters.roleCode } : {}),
    },
  });
}

export function useSystemDashboardSummary(token?: string, filters?: DashboardSummaryFilters, enabled = true) {
  return useQuery({
    queryKey: [
      "dashboard",
      "system-summary",
      token,
      filters?.range || "30d",
      filters?.institutionId || "all",
      filters?.countryCode || "all",
      filters?.state || "all",
      filters?.city || "all",
      filters?.userType || "all",
      filters?.roleCode || "all",
    ],
    queryFn: () => getSystemDashboardSummary(token as string, filters),
    enabled: Boolean(token && enabled),
  });
}
