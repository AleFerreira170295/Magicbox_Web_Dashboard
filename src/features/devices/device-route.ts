export type DeviceScopeFilter = "all" | "home" | "institution";
export type DeviceAccessFilter = "all" | "owned" | "institution" | "shared" | "unresolved";
export type DeviceFocusFilter = "all" | "review" | "no_owner" | "with_owner" | "no_status" | "no_metadata" | "with_metadata" | "online" | "with_activity" | "without_sync";

export type DevicesOverviewRouteState = {
  q?: string | null;
  institutionId?: string | null;
  scope?: DeviceScopeFilter | null;
  access?: DeviceAccessFilter | null;
  focus?: DeviceFocusFilter | null;
  ownerUserId?: string | null;
  ownerUserName?: string | null;
  page?: number | string | null;
  pageSize?: number | string | null;
};

function appendOverviewParams(params: URLSearchParams, state: DevicesOverviewRouteState) {
  if (state.q) params.set("q", state.q);
  if (state.institutionId) params.set("institutionId", state.institutionId);
  if (state.scope && state.scope !== "all") params.set("scope", state.scope);
  if (state.access && state.access !== "all") params.set("access", state.access);
  if (state.focus && state.focus !== "all") params.set("focus", state.focus);
  if (state.ownerUserId) params.set("ownerUserId", state.ownerUserId);
  if (state.ownerUserName) params.set("ownerUserName", state.ownerUserName);
  if (state.page && Number(state.page) > 1) params.set("page", String(state.page));
  if (state.pageSize && Number(state.pageSize) !== 10) params.set("pageSize", String(state.pageSize));
}

export function buildDevicesOverviewHref(state: DevicesOverviewRouteState = {}) {
  const params = new URLSearchParams();
  appendOverviewParams(params, state);
  const query = params.toString();
  return query ? `/devices?${query}` : "/devices";
}

export function buildDeviceDetailHref({
  deviceRecordId,
  ...state
}: DevicesOverviewRouteState & { deviceRecordId: string }) {
  const params = new URLSearchParams({ deviceRecordId });
  appendOverviewParams(params, state);
  return `/devices/detail?${params.toString()}`;
}
