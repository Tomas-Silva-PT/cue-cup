"use client";

import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { api, ApiError } from "./api";

// =============================================================================
// AUTH CONTEXT
// =============================================================================
// Provides the current player's profile and auth actions (login, register,
// logout) to the entire app via React context.
//
// Uses SWR to fetch and cache the current player — this means:
//   - On first load, it fetches GET /players/me to check if the user is
//     logged in (valid cookie = logged in, 401 = not logged in)
//   - After login/register, it mutates the SWR cache so the player data
//     is immediately available without a refetch
//   - After logout, it clears the cache
//
// The `isLoading` state is true only on the initial fetch — after that,
// `player` is either a Player object (logged in) or null (not logged in).
// =============================================================================

interface Player {
  id: string;
  nickname: string;
  bio: string | null;
  created_at: string;
}

interface AuthContextValue {
  player: Player | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    nickname: string,
    name: string
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ME_KEY = "/players/me";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { mutate } = useSWRConfig();

  // SWR fetches /players/me on mount
  // If the cookie is valid → returns the player
  // If not logged in (401) → returns null without throwing
  const { data: player, isLoading } = useSWR<Player | null>(
    ME_KEY,
    async () => {
      try {
        return await api.get<Player>(ME_KEY);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }
        throw error;
      }
    },
    {
      revalidateOnFocus: false,    // don't refetch when tab regains focus
      shouldRetryOnError: false,   // don't retry on 401
    }
  );

  const login = useCallback(
    async (email: string, password: string) => {
      await api.post("/auth/login", { email, password });
      // After login, fetch the player profile and update the cache
      const player = await api.get<Player>(ME_KEY);
      await mutate(ME_KEY, player, false);
    },
    [mutate]
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      nickname: string,
      name: string
    ) => {
      await api.post("/auth/register", { email, password, nickname, name });
      // After register, fetch the player profile and update the cache
      const player = await api.get<Player>(ME_KEY);
      await mutate(ME_KEY, player, false);
    },
    [mutate]
  );

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    // Clear the player from the cache
    await mutate(ME_KEY, null, false);
  }, [mutate]);

  return (
    <AuthContext.Provider
      value={{
        player: player ?? null,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook for consuming the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
