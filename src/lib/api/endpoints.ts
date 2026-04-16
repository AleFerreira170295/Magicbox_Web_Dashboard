export const apiEndpoints = {
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
    list: "/institutions",
    byId: (id: string) => `/institutions/${id}`,
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
