"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import type { Role } from "@/lib/types";

const ALL_LINKS: { href: string; label: string; perm: string }[] = [
  { href: "/jobs", label: "งานทั้งหมด", perm: "jobs:view" },
  { href: "/jobs/new", label: "เปิดงาน", perm: "jobs:create" },
  { href: "/calendar", label: "ปฏิทิน", perm: "calendar:view" },
  { href: "/equipment", label: "คลังเครื่อง", perm: "equipment:view" },
  { href: "/map", label: "แผนที่", perm: "map:view" },
  { href: "/contracts", label: "สัญญา", perm: "contracts:view" },
  { href: "/quotations", label: "ใบเสนอราคา", perm: "quotations:view" },
  { href: "/inventory", label: "สต็อกรวม", perm: "inventory:view" },
  { href: "/partners", label: "คู่ค้า", perm: "partners:view" },
  { href: "/master", label: "ข้อมูลพื้นฐาน", perm: "master:manage" },
  { href: "/users", label: "ผู้ใช้", perm: "users:manage" },
];

const ROLE_LABEL: Record<Role, string> = {
  admin: "ผู้ดูแล",
  manager: "ผู้จัดการ",
  tech: "ช่าง",
  sales: "ฝ่ายขาย",
  viewer: "ผู้ดู",
};

export default function Nav() {
  const path = usePathname();
  const { status, user, has, logout } = useAuth();
  const [open, setOpen] = useState(false);

  // close the mobile drawer whenever the route changes
  useEffect(() => {
    setOpen(false);
  }, [path]);

  if (status !== "authed" || !user) return null;

  const links = ALL_LINKS.filter((l) => has(l.perm));
  const isActive = (href: string) => (href === "/jobs" ? path === "/jobs" : path.startsWith(href));

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="nav-toggle" aria-label="เมนู" onClick={() => setOpen((o) => !o)}>
          ☰
        </button>
        <Link href="/jobs" className="brand" style={{ color: "#fff" }}>
          WOMS<span className="dot">.</span>
        </Link>
        <nav className="topnav">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={isActive(l.href) ? "active" : ""}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="nav-user">
          <span className="nav-username">{user.name} · {ROLE_LABEL[user.role]}</span>
          <button className="btn nav-logout" onClick={logout}>ออกจากระบบ</button>
        </div>
      </div>

      {/* mobile drawer */}
      <div className={`nav-backdrop ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <nav className={`nav-drawer ${open ? "open" : ""}`}>
        <div className="nav-drawer-user">{user.name} · {ROLE_LABEL[user.role]}</div>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={isActive(l.href) ? "active" : ""}>
            {l.label}
          </Link>
        ))}
        <button className="btn" style={{ margin: "10px 14px" }} onClick={logout}>ออกจากระบบ</button>
      </nav>
    </header>
  );
}
