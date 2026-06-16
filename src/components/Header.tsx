"use client";

import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useUi } from "@/lib/UiContext";
import Notifications from "@/components/Notifications";
import type { Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = {
  admin: "ผู้ดูแล",
  manager: "ผู้จัดการ",
  tech: "ช่าง",
  sales: "ฝ่ายขาย",
  viewer: "ผู้ดู",
};

export default function Header() {
  const { status, user, logout } = useAuth();
  const { setOpen } = useUi();

  if (status !== "authed" || !user) return null;

  return (
    <header className="topheader">
      <button className="nav-toggle" aria-label="เมนู" onClick={() => setOpen(true)}>
        ☰
      </button>
      <Link href="/dashboard" className="brand">
        WOMS<span className="dot">.</span>
      </Link>
      <div className="header-spacer" />
      <Notifications />
      <div className="header-user">
        <span className="name">{user.name}</span>
        <span className="role">{ROLE_LABEL[user.role]}</span>
      </div>
      <button className="btn header-logout" onClick={logout}>
        ออกจากระบบ
      </button>
    </header>
  );
}
