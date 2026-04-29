import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, auth } from "@/lib/api";

export interface FarmUser {
  id?: string;
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
    if (!auth.getToken()) {
      setUser(null);
      return;
    }
    try {
      const res: any = await api.me();
      setUser(res.user || res);
    } catch {
      auth.clear();
      setUser(null);
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res: any = await api.login({ email, password });
    auth.setToken(res.token);
    setUser(res.user);
  };

  const register = async (data: Parameters<typeof api.register>[0]) => {
    const res: any = await api.register(data);
    auth.setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    auth.clear();
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
