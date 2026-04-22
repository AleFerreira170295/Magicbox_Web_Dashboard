export const apiEndpoints = {
  identity: {
    login: "/identity/login",
    register: "/identity/register",
    me: "/identity/me",
    logout: "/identity/logout",
    refresh: "/identity/refresh-token",
    forgotPassword: "/identity/forgot-password",
    verifyOtp: "/identity/verify-otp-code",
    resetPassword: "/identity/reset-password",
  },
  auth: {
    login: "/auth/login",
    me: "/auth/me",
    logout: "/auth/logout",
    refresh: "/auth/refresh-token",
  },
  users: {
    list: "/user",
    byId: (id: string) => `/user/${id}`,
  },
  institutions: {
    list: "/educational-center",
    byId: (id: string) => `/educational-center/${id}`,
  },
  features: {
    list: "/feature",
    byId: (id: string) => `/feature/${id}`,
  },
  accessControl: {
    actions: "/access-control/action",
    actionById: (id: string) => `/access-control/action/${id}`,
    permissions: "/access-control/permission",
    permissionById: (id: string) => `/access-control/permission/${id}`,
    auditEvents: "/access-control/audit-event",
  },
  devices: {
    list: "/ble-device",
    byId: (id: string) => `/ble-device/${id}`,
  },
  games: {
    list: "/game-data/",
    byId: (id: string) => `/game-data/${id}`,
  },
  profiles: {
    overview: "/home/profiles/overview",
  },
  settings: {
    otaRelease: "/system/ota/release",
    otaReleaseLegacy: "/home/ota/release",
  },
  dashboard: {
    systemSummary: "/system/dashboard/summary",
  },
  syncs: {
    list: "/sync-sessions",
    byId: (id: string) => `/sync-sessions/${id}`,
    rawById: (id: string) => `/sync-sessions/${id}/raw`,
    legacyList: "/home/sessions/history",
  },
  ingestion: {
    rawSyncs: "/ingestion/raw-syncs",
    rawSyncById: (id: string) => `/ingestion/raw-syncs/${id}`,
  },
  analytics: {
    teacherDashboard: "/analytics/teacher/dashboard",
  },
  exports: {
    rawSyncs: "/exports/raw-syncs",
    games: "/exports/games",
    analytics: "/exports/analytics",
  },
} as const;
