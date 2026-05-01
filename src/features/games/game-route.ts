export type GamePlayerModeFilter = "all" | "manual" | "mixed" | "registered";
export type GameAccessFilter = "all" | "owned" | "institution" | "shared" | "unresolved";

export type GamesOverviewRouteState = {
  q?: string | null;
  institutionId?: string | null;
  playerMode?: GamePlayerModeFilter | null;
  access?: GameAccessFilter | null;
  ownerUserId?: string | null;
  ownerUserName?: string | null;
  bleDeviceId?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  page?: number | string | null;
  pageSize?: number | string | null;
};

function appendOverviewParams(params: URLSearchParams, state: GamesOverviewRouteState) {
  if (state.q) params.set("q", state.q);
  if (state.institutionId) params.set("institutionId", state.institutionId);
  if (state.playerMode && state.playerMode !== "all") params.set("playerMode", state.playerMode);
  if (state.access && state.access !== "all") params.set("access", state.access);
  if (state.ownerUserId) params.set("ownerUserId", state.ownerUserId);
  if (state.ownerUserName) params.set("ownerUserName", state.ownerUserName);
  if (state.bleDeviceId) params.set("bleDeviceId", state.bleDeviceId);
  if (state.deviceId) params.set("deviceId", state.deviceId);
  if (state.deviceName) params.set("deviceName", state.deviceName);
  if (state.page && Number(state.page) > 1) params.set("page", String(state.page));
  if (state.pageSize && Number(state.pageSize) !== 10) params.set("pageSize", String(state.pageSize));
}

export function buildGamesOverviewHref(state: GamesOverviewRouteState = {}) {
  const params = new URLSearchParams();
  appendOverviewParams(params, state);
  const query = params.toString();
  return query ? `/games?${query}` : "/games";
}

export function buildGameDetailHref({
  gameRecordId,
  ...state
}: GamesOverviewRouteState & { gameRecordId: string }) {
  const params = new URLSearchParams({ gameRecordId });
  appendOverviewParams(params, state);
  return `/games/detail?${params.toString()}`;
}
