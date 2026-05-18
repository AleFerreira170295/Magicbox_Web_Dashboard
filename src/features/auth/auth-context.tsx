"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from "react";
import { clearStoredSession, readStoredSession, writeStoredSession } from "@/features/auth/storage";
import { AUTH_SESSION_EXPIRED_EVENT } from "@/lib/api/fetcher";
import {
  getMe,
  login as loginRequest,
  logout as logoutRequest,
  refreshAuthTokens,
} from "@/features/auth/auth-api";
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const refreshInFlight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    dispatch({ type: "restore", payload: readStoredSession() });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleExpiredSession = () => {
      const currentTokens = state.tokens;
      const currentUser = state.user;

      if (!currentTokens?.refreshToken || !currentUser) {
        clearStoredSession();
        dispatch({ type: "clear-session" });
        return;
      }

      if (refreshInFlight.current) return;

      refreshInFlight.current = (async () => {
        try {
          const nextTokens = await refreshAuthTokens(currentTokens.refreshToken);
          if (!nextTokens.accessToken) throw new Error("No access token returned");

          let nextUser = currentUser;
          try {
            const profile = await getMe(nextTokens.accessToken);
            if (profile) nextUser = profile;
          } catch {
            // La renovación de tokens es suficiente para mantener la sesión; el perfil se puede refrescar luego.
          }

          persist(nextTokens, nextUser);
        } catch {
          clearStoredSession();
          dispatch({ type: "clear-session" });
        } finally {
          refreshInFlight.current = null;
        }
      })();
    };

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleExpiredSession);
  }, [state.tokens, state.user]);

  function persist(nextTokens: AuthTokens, nextUser: AuthUser) {
    writeStoredSession({ tokens: nextTokens, user: nextUser });
    dispatch({
      type: "set-session",
      payload: { tokens: nextTokens, user: nextUser },
    });
  }

  async function login(payload: LoginPayload) {
    const result = await loginRequest(payload);
    persist(result.tokens, result.user);
  }

  async function logout() {
    if (state.tokens?.refreshToken) {
      try {
        await logoutRequest(state.tokens.refreshToken);
      } catch {
        // noop
      }
    }
    clearStoredSession();
    dispatch({ type: "clear-session" });
  }

  async function refreshProfile() {
    if (!state.tokens?.accessToken) return;
    try {
      const profile = await getMe(state.tokens.accessToken);
      if (profile) {
        persist(state.tokens, profile);
      }
    } catch {
      // noop
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
