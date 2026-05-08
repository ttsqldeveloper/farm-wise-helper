import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { api } from "@/lib/api";

export interface FarmUser {
  id: string;
  email: string;
  fullName?: string;
  full_name?: string;
  location?: string;
  cropTypes?: string[];
  crop_types?: string[];
}

interface AuthCtx {
  user: FarmUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Parameters<typeof api.register>[0]) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FarmUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const u = await api.me();
      setUser(u as FarmUser | null);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        return;
      }
      // Defer profile fetch to avoid deadlock inside the callback
      setTimeout(() => {
        refresh();
      }, 0);
    });

    // Then check existing session
    refresh().finally(() => setLoading(false));

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    await api.login({ email, password });
    await refresh();
  };

  const register = async (data: Parameters<typeof api.register>[0]) => {
    await api.register(data);
    await refresh();
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
