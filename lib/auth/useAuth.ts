"use client";
import { logger } from '@/lib/utils/logger'
import { useState, useEffect, useCallback, createContext, useContext, createElement } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { useSWRConfig } from 'swr';
import { useAuthTransition } from '@/components/ui/AuthTransition';

type Profile = Database['public']['Tables']['profiles']['Row'];

function useAuthInternal() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<Error | null>(null);
  const { mutate: globalMutate } = useSWRConfig();
  const { startTransition, endTransition } = useAuthTransition();

  // ✅ Log only on mount (no repeated console spam)
  useEffect(() => {
    logger.info('[useAuth] Hook mounted')
  }, [])

  useEffect(() => {
    logger.log('[useAuth] profile updated', profile?.current_list_id)
  }, [profile?.current_list_id])

  useEffect(() => {
    logger.info("[useAuth] Initializing...");
    async function load() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) logger.error("[useAuth] Session error:", error);

        // ❌ Fix corrupted cookies (base64 parse error)
        if (!session) {
          logger.warn("[useAuth] No session — clearing Supabase cookies");
          for (const cookie of document.cookie.split(";")) {
            if (cookie.trim().startsWith("sb-")) {
              const [name] = cookie.split("=");
              document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            }
          }
          setUser(null);
          setProfile(null);
          setAuthError(null);
          // Clear all SWR caches when no session
          globalMutate(() => true, undefined, { revalidate: false });
          setLoading(false);
          return;
        }

        const currentUser = session.user;
        logger.info('[useAuth] user data:', currentUser)
        setUser(currentUser);
        logger.log("[useAuth] Signed in as:", currentUser.email);

        // Add timeout for profile fetch to prevent blocking entire app
        const profilePromise = supabase
          .from("profiles")
          .select("*")
          .eq("id", currentUser.id)
          .maybeSingle();

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Profile fetch timeout")), 5000)
        );

        try {
          const { data: p } = (await Promise.race([
            profilePromise,
            timeoutPromise,
          ])) as any;
          logger.info('[useAuth] profile data:', p)
          setProfile(p ?? null);
          setAuthError(null);
        } catch (err) {
          logger.error("[useAuth] Profile fetch failed or timed out:", err);
          setProfile(null);
          setAuthError(err instanceof Error ? err : new Error(String(err)));
        }
      } catch (e) {
        logger.error("[useAuth] Error:", e);
        setUser(null);
        setProfile(null);
        setAuthError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setLoading(false);
      }
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.debug('[useAuth] Auth state change:', { event, hasSession: !!session, hasUser: !!session?.user });

      // Handle events by type
      switch (event) {
        case 'SIGNED_IN': {
          // Real login - start transition for UX
          startTransition();
          setUser(session?.user ?? null);
          
          // Fetch profile on login
          if (session?.user) {
            try {
              const { data: p } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", session.user.id)
                .maybeSingle();
              setProfile(p ?? null);
              setAuthError(null);
            } catch (e) {
              logger.error("[useAuth] Error fetching profile on SIGNED_IN:", e);
              setProfile(null);
              setAuthError(e instanceof Error ? e : new Error(String(e)));
            } finally {
              // End transition after profile fetch completes (or fails)
              endTransition();
            }
          } else {
            // No user - end transition immediately
            endTransition();
          }
          break;
        }

        case 'SIGNED_OUT': {
          // Real logout - start transition for UX
          startTransition();
          setUser(null);
          setProfile(null);
          // Clear all SWR caches on logout to prevent showing previous user's data
          globalMutate(() => true, undefined, { revalidate: false });
          
          // End transition immediately (logout is fast)
          endTransition();
          break;
        }

        case 'TOKEN_REFRESHED': {
          // Background token refresh - silent update, no transition
          if (session?.user) {
            setUser(session.user);
            // Do NOT refetch profile on token refresh - it hasn't changed
            // Do NOT start/end transitions
          }
          break;
        }

        case 'USER_UPDATED': {
          // User metadata changed - update silently, may refetch profile
          if (session?.user) {
            setUser(session.user);
            // Optionally refetch profile if user metadata changed
            try {
              const { data: p } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", session.user.id)
                .maybeSingle();
              setProfile(p ?? null);
            } catch (e) {
              logger.error("[useAuth] Error fetching profile on USER_UPDATED:", e);
              setAuthError(e instanceof Error ? e : new Error(String(e)));
            }
            // Do NOT start/end transitions
          }
          break;
        }

        case 'INITIAL_SESSION': {
          // Initial session on mount - already handled by load() above
          // Just sync state if needed, no transition
          if (session?.user) {
            setUser(session.user);
            // Profile already loaded in initial load(), no need to refetch
          }
          break;
        }

        default: {
          // Other events - log but don't trigger transitions
          logger.debug('[useAuth] Unhandled auth event:', event);
          if (session?.user) {
            setUser(session.user);
          } else {
            setUser(null);
            setProfile(null);
          }
          break;
        }
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [startTransition, endTransition]);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        logger.error("[useAuth] Error refreshing profile:", error);
        return;
      }

      if (data) {
        setProfile(data);
        logger.log("[useAuth] Profile refreshed");
      }
    } catch (e) {
      logger.error("[useAuth] Error refreshing profile:", e);
    }
  }, [user?.id]);

  type AuthStatus = 'bootstrapping' | 'unauthenticated' | 'authenticated' | 'error'
  let status: AuthStatus
  if (loading) {
    status = 'bootstrapping'
  } else if (authError) {
    status = 'error'
  } else if (user) {
    status = 'authenticated'
  } else {
    status = 'unauthenticated'
  }

  return { user, profile, loading, status, authError, refreshProfile } as const;
}

type AuthValue = ReturnType<typeof useAuthInternal>

const AuthContext = createContext<AuthValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useAuthInternal()
  return createElement(AuthContext.Provider, { value }, children)
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return ctx
}