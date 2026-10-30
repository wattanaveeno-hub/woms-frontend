"use client";

import { landingPath } from "./financeRules";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, getToken, setToken, clearToken } from "@/lib/api";
import type { AuthUser } from "@/lib/types";
import { CHANGE_PASSWORD_PATH, needsPasswordRedirect } from "@/lib/passwordRules";

type Status = "loading" | "authed" | "anon";

interface AuthCtx {
  user: AuthUser | null;
  permissions: string[];
  status: Status;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  has: (perm: string) => boolean;
  /** D-04: ใช้ token + ผู้ใช้ชุดใหม่หลังเปลี่ยนรหัสผ่าน (เก็บแบบเดียวกับ login) */
  applySession: (r: { token: string; user: AuthUser; permissions: string[] }) => void;
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

  // D-04: ต้องเปลี่ยนรหัสผ่านก่อนใช้งาน (จาก login หรือ /me)
  const mustChange = status === "authed" && user?.mustChangePassword === true;

  // route guard
  useEffect(() => {
    if (status === "anon" && !isPublic(path)) router.replace("/login");
    // D-04: ทุกหน้า (รวม /login) พาไปหน้าเปลี่ยนรหัสผ่านจนกว่าจะเปลี่ยนเสร็จ
    else if (mustChange && needsPasswordRedirect(true, path)) router.replace(`${CHANGE_PASSWORD_PATH}?required=1`);
    else if (status === "authed" && path === "/login") router.replace(landingPath((p) => permissions.includes(p)));
    // D-11: ACC ไม่มีสิทธิ์ใบงาน/แดชบอร์ด — หน้าแรก (/ → /jobs, /dashboard) พาไปหน้าการเงินแทนหน้า 403
    else if (status === "authed" && (path === "/dashboard" || path === "/jobs") && !permissions.includes("jobs:view") && permissions.includes("finance:view"))
      router.replace(landingPath((p) => permissions.includes(p)));
  }, [status, path, router, mustChange, permissions]);

  const applySession = useCallback((r: { token: string; user: AuthUser; permissions: string[] }) => {
    setToken(r.token);
    setUser(r.user);
    setPermissions(r.permissions);
    setStatus("authed");
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      applySession(await api.login(email, password));
    },
    [applySession]
  );

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
  } else if (mustChange && needsPasswordRedirect(true, path)) {
    // D-04: ไม่แสดงหน้าอื่นระหว่างรอ redirect (หน้าอื่นจะได้ 403 จาก API อยู่แล้ว)
    content = <div className="state">ต้องเปลี่ยนรหัสผ่านก่อนเริ่มใช้งาน — กำลังไปหน้าเปลี่ยนรหัสผ่าน…</div>;
  }

  return (
    <Ctx.Provider value={{ user, permissions, status, login, logout, has, applySession }}>{content}</Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within <AuthProvider>");
  return c;
}
