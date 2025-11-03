"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Profile = Database['public']['Tables']['profiles']['Row'];

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[useAuth] profile updated', profile?.current_list_id)
  }, [profile?.current_list_id])

  useEffect(() => {
    console.log("[useAuth] Initializing...");
    async function load() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) console.error("[useAuth] Session error:", error);

        // ❌ Fix corrupted cookies (base64 parse error)
        if (!session) {
          console.warn("[useAuth] No session — clearing Supabase cookies");
          for (const cookie of document.cookie.split(";")) {
            if (cookie.trim().startsWith("sb-")) {
              const [name] = cookie.split("=");
              document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            }
          }
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        const currentUser = session.user;
        setUser(currentUser);
        console.log("[useAuth] Signed in as:", currentUser.email);

        const { data: p } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", currentUser.id)
          .maybeSingle();

        setProfile(p ?? null);
      } catch (e) {
        console.error("[useAuth] Error:", e);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, profile, loading } as const;
}