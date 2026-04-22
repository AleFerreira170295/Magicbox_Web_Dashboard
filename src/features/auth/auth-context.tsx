"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { clearStoredSession, readStoredSession, writeStoredSession } from "@/features/auth/storage";
import {
  getMe,
  login as loginRequest,
  logout as logoutRequest,
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
