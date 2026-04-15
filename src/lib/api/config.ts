export const appConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "MagicBox Web Dashboard",
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:3000/api/v1.0",
  defaultRole: process.env.NEXT_PUBLIC_DEFAULT_ROLE || "teacher",
};
