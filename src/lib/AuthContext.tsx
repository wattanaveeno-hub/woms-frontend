"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, getToken, setToken, clearToken } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

type Status = "loading" | "authed" | "anon";

interface AuthCtx {
  user: AuthUser | null;
  permissions: string[];
  status: Status;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  has: (perm: string) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

const PUBLIC_PATHS = ["/login"];
const isPublic = (p: string) => PUBLIC_PATHS.some((x) => p === x || p.startsWith(x + "/"));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  // validate any existing token on first load
  useEffect(() => {
    let active = true;
    (async () => {
      if (!getToken()) {
        if (active) setStatus("anon");
        return;
      }
      try {
        const r = await api.me();
        if (!active) return;
        setUser(r.user);
        setPermissions(r.permissions);
        setStatus("authed");
      } catch {
        if (!active) return;
        clearToken();
        setStatus("anon");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // route guard
  useEffect(() => {
    if (status === "anon" && !isPublic(path)) router.replace("/login");
    if (status === "authed" && path === "/login") router.replace("/dashboard");
  }, [status, path, router]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.login(email, password);
    setToken(r.token);
    setUser(r.user);
    setPermissions(r.permissions);
    setStatus("authed");
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setPermissions([]);
    setStatus("anon");
    router.replace("/login");
  }, [router]);

  const has = useCallback((perm: string) => permissions.includes(perm), [permissions]);

  let content: React.ReactNode = children;
  if (status === "loading") {
    content = <div className="state">กำลังตรวจสอบสิทธิ์…</div>;
  } else if (status === "anon" && !isPublic(path)) {
    content = <div className="state">กำลังไปหน้าเข้าสู่ระบบ…</div>;
  }

  return (
    <Ctx.Provider value={{ user, permissions, status, login, logout, has }}>{content}</Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within <AuthProvider>");
  return c;
}
