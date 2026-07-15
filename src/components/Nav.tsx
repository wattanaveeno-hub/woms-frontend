"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useUi } from "@/lib/UiContext";

type NavLink = { href: string; label: string; perm: string };
type NavGroup = { title: string; links: NavLink[] };

const GROUPS: NavGroup[] = [
  {
    title: "ภาพรวม",
    links: [{ href: "/dashboard", label: "แดชบอร์ด", perm: "jobs:view" }],
  },
  {
    title: "งานบริการ",
    links: [
      { href: "/jobs", label: "งานทั้งหมด", perm: "jobs:view" },
      { href: "/jobs/new", label: "เปิดงาน", perm: "jobs:create" },
      { href: "/chats", label: "แชท", perm: "jobs:view" },
      { href: "/calendar", label: "ปฏิทิน", perm: "calendar:view" },
    ],
  },
  {
    title: "เครื่อง & ประกัน",
    links: [
      { href: "/equipment", label: "คลังเครื่อง", perm: "equipment:view" },
      { href: "/map", label: "แผนที่", perm: "map:view" },
      { href: "/inventory", label: "สต็อกรวม", perm: "inventory:view" },
    ],
  },
  {
    title: "ขาย & สัญญา",
    links: [
      { href: "/contracts", label: "สัญญา", perm: "contracts:view" },
      { href: "/quotations", label: "ใบเสนอราคา", perm: "quotations:view" },
      { href: "/partners", label: "คู่ค้า", perm: "partners:view" },
    ],
  },
  {
    title: "ตั้งค่าระบบ",
    links: [
      { href: "/master", label: "ข้อมูลพื้นฐาน", perm: "master:manage" },
      { href: "/users", label: "ผู้ใช้", perm: "users:manage" },
    ],
  },
];

export default function Nav() {
  const path = usePathname();
  const { status, user, has } = useAuth();
  const { open, setOpen } = useUi();
  const [unreadRooms, setUnreadRooms] = useState(0);

  useEffect(() => {
    setOpen(false);
  }, [path, setOpen]);

  // ป้ายจำนวนห้องแชทที่ยังไม่อ่าน ข้างเมนู "แชท"
  useEffect(() => {
    if (status !== "authed") return;
    let active = true;
    const loadUnread = () => {
      api
        .chatRooms()
        .then((r) => {
          if (active) setUnreadRooms(r.unreadRooms);
        })
        .catch(() => {});
    };
    loadUnread();
    const t = setInterval(loadUnread, 60_000);
    window.addEventListener("woms:chat-read", loadUnread);
    window.addEventListener("focus", loadUnread);
    return () => {
      active = false;
      clearInterval(t);
      window.removeEventListener("woms:chat-read", loadUnread);
      window.removeEventListener("focus", loadUnread);
    };
  }, [status]);

  if (status !== "authed" || !user) return null;

  const isActive = (href: string) =>
    href === "/jobs" ? path === "/jobs" : path.startsWith(href);

  const groups = GROUPS.map((g) => ({
    title: g.title,
    links: g.links.filter((l) => has(l.perm)),
  })).filter((g) => g.links.length > 0);

  return (
    <>
      <div className={`nav-backdrop ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-head">
          <Link href="/dashboard" className="brand">
            WOMS<span className="dot">.</span>
          </Link>
        </div>
        <nav className="sidebar-nav">
          {groups.map((g) => (
            <div key={g.title} className="sidebar-group">
              <div className="sidebar-group-label">{g.title}</div>
              {g.links.map((l) => (
                <Link key={l.href} href={l.href} className={isActive(l.href) ? "active" : ""}>
                  {l.label}
                  {l.href === "/chats" && unreadRooms > 0 ? (
                    <span className="nav-badge">{unreadRooms > 99 ? "99+" : unreadRooms}</span>
                  ) : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
