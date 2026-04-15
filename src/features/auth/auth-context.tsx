"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { apiEndpoints } from "@/lib/api/endpoints";
import { apiRequest, ApiError } from "@/lib/api/fetcher";
import type { JsonObject } from "@/lib/api/types";
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from "@/features/auth/storage";
import {
  resolvePermissions,
  resolveRoles,
} from "@/features/auth/role-resolver";
import type { AuthTokens, AuthUser, LoginPayload } from "@/features/auth/types";

interface AuthContextValue {
  status: "loading" | "authenticated" | "unauthenticated";
  user: AuthUser | null;
  tokens: AuthTokens | null;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

interface AuthState {
  status: AuthContextValue["status"];
  user: AuthUser | null;
  tokens: AuthTokens | null;
}

type AuthAction =
  | {
      type: "restore";
      payload: { user: AuthUser; tokens: AuthTokens } | null;
    }
  | {
      type: "set-session";
      payload: { user: AuthUser; tokens: AuthTokens };
    }
  | { type: "clear-session" };

const AuthContext = createContext<AuthContextValue | null>(null);

const initialState: AuthState = {
  status: "loading",
  user: null,
  tokens: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "restore":
      if (!action.payload) {
        return {
          status: "unauthenticated",
          user: null,
          tokens: null,
        };
      }
      return {
        status: "authenticated",
        user: action.payload.user,
        tokens: action.payload.tokens,
      };
    case "set-session":
      return {
        status: "authenticated",
        user: action.payload.user,
        tokens: action.payload.tokens,
      };
    case "clear-session":
      return {
        status: "unauthenticated",
        user: null,
        tokens: null,
      };
    default:
      return state;
  }
}

function asRecord(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

function readString(record: JsonObject, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return "";
}

function normalizeUser(input: unknown): AuthUser {
  const record = asRecord(input);
  const firstName = readString(record, "first_name", "firstName");
  const lastName = readString(record, "last_name", "lastName");
  const fullName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    readString(record, "name", "display_name");

  return {
    id: readString(record, "user_id", "id"),
    identityId: readString(record, "identity_id") || null,
    email: readString(record, "email"),
    firstName,
    lastName,
    fullName,
    imageUrl: readString(record, "image_url", "imageUrl") || null,
    userType: readString(record, "user_type", "userType") || null,
    educationalCenterId:
      readString(record, "educational_center_id", "educationalCenterId") || null,
    roles: resolveRoles(record),
    permissions: resolvePermissions(record),
    raw: record,
  };
}

async function fetchProfile(accessToken: string) {
  const payload = await apiRequest<{ identity?: unknown; user?: unknown }>(
    apiEndpoints.auth.me,
    {
      token: accessToken,
    },
  );
  return payload?.user ? normalizeUser(payload.user) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    dispatch({ type: "restore", payload: readStoredSession() });
  }, []);

  function persist(nextTokens: AuthTokens, nextUser: AuthUser) {
    writeStoredSession({ tokens: nextTokens, user: nextUser });
    dispatch({
      type: "set-session",
      payload: { tokens: nextTokens, user: nextUser },
    });
  }

  async function login(payload: LoginPayload) {
    const response = await apiRequest<{
      access_token: string;
      refresh_token: string;
      user?: unknown;
    }>(apiEndpoints.auth.login, {
      method: "POST",
      body: payload,
    });

    const nextTokens: AuthTokens = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
    };

    let nextUser = response.user ? normalizeUser(response.user) : null;
    try {
      const profile = await fetchProfile(nextTokens.accessToken);
      if (profile) nextUser = profile;
    } catch {
      // noop, dejamos el payload del login si `/auth/me` falla.
    }

    if (!nextUser) {
      throw new ApiError("No se pudo resolver el perfil autenticado", 500);
    }

    persist(nextTokens, nextUser);
  }

  async function logout() {
    if (state.tokens?.refreshToken) {
      try {
        await apiRequest(apiEndpoints.auth.logout, {
          method: "POST",
          body: { refresh_token: state.tokens.refreshToken },
        });
      } catch {
        // noop
      }
    }
    clearStoredSession();
    dispatch({ type: "clear-session" });
  }

  async function refreshProfile() {
    if (!state.tokens?.accessToken) return;
    const profile = await fetchProfile(state.tokens.accessToken);
    if (profile) {
      persist(state.tokens, profile);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        status: state.status,
        user: state.user,
        tokens: state.tokens,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
