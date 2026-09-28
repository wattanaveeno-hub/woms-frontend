"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { tokens } from "@/theme/tokens";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useUi } from "@/lib/UiContext";
import { FEATURES } from "@/lib/features";

type NavLink = { href: string; label: string; perm: string; hidden?: boolean };
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
      { href: "/chats", label: "แชท", perm: "jobs:view", hidden: !FEATURES.chat },
      { href: "/calendar", label: "ปฏิทิน", perm: "calendar:view" },
      { href: "/queue", label: "คิวจัดส่ง/ซ่อม", perm: "queue:view", hidden: !FEATURES.techQueue },
      { href: "/queue/slots", label: "ตาราง slot ช่าง", perm: "queue:view", hidden: !FEATURES.techQueue },
      { href: "/pm", label: "ตาราง PM", perm: "pm:view" },
      { href: "/notifications", label: "การแจ้งเตือน", perm: "jobs:view" },
      { href: "/tracking", label: "ติดตามช่าง", perm: "tracking:view" },
      { href: "/m", label: "โหมดมือถือช่าง", perm: "queue:view" },
    ],
  },
  {
    title: "เครื่อง & ประกัน",
    links: [
      { href: "/equipment", label: "คลังเครื่อง", perm: "equipment:view" },
      { href: "/customers", label: "ฐานข้อมูลลูกค้า", perm: "partners:view" },
      { href: "/map", label: "แผนที่", perm: "map:view" },
      { href: "/inventory", label: "สต็อกรวม", perm: "inventory:view" },
      { href: "/stock", label: "สต๊อกอะไหล่", perm: "stock:view" },
    ],
  },
  {
    title: "ขาย & สัญญา",
    links: [
      { href: "/contracts", label: "สัญญา", perm: "contracts:view" },
      { href: "/quotations", label: "ใบเสนอราคา", perm: "quotations:view" },
      { href: "/documents", label: "เอกสารการขาย", perm: "documents:view" },
      { href: "/documents/new", label: "ออกเอกสาร", perm: "documents:create" },
      { href: "/partners", label: "คู่ค้า", perm: "partners:view" },
      { href: "/bills", label: "วางบิลช่าง", perm: "bill:view" },
    ],
  },
  {
    title: "ตั้งค่าระบบ",
    links: [
      { href: "/master", label: "ข้อมูลพื้นฐาน", perm: "master:manage" },
      { href: "/settings/company", label: "หัวเอกสารบริษัท", perm: "master:manage" },
      { href: "/settings/stock", label: "วิธีคิดมูลค่าสต๊อก", perm: "stock:manage" },
      { href: "/users", label: "ผู้ใช้", perm: "users:manage" },
      { href: "/audit", label: "ประวัติการใช้งาน", perm: "users:manage" },
    ],
  },
];

/** ความกว้างแถบนำทาง — AppShell ใช้ค่าเดียวกันเว้นระยะเนื้อหา */
export const NAV_WIDTH = 240;

export default function Nav() {
  const path = usePathname();
  const { status, has } = useAuth();
  const { open, setOpen } = useUi();
  const [unreadRooms, setUnreadRooms] = useState(0);
  const theme = useTheme();
  // จอใหญ่: แถบนำทางถาวร · แท็บเล็ต/มือถือ: เปิดจากปุ่มเมนูบน AppBar
  const desktop = useMediaQuery(theme.breakpoints.up("md"));

  useEffect(() => {
    setOpen(false);
  }, [path, setOpen]);

  // ป้ายจำนวนห้องแชทที่ยังไม่อ่าน ข้างเมนู "แชท" (เมื่อเปิดฟังก์ชันแชท)
  useEffect(() => {
    if (status !== "authed" || !FEATURES.chat) return;
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

  // หน้ามือถือช่าง (/m) ใช้เลย์เอาต์แบบแอป ไม่มีเมนูข้าง
  if (path.startsWith("/m")) return null;
  if (status !== "authed") return null;

  const isActive = (href: string) => (href === "/jobs" ? path === "/jobs" : path.startsWith(href));

  const groups = GROUPS.map((g) => ({
    title: g.title,
    links: g.links.filter((l) => !l.hidden && has(l.perm)),
  })).filter((g) => g.links.length > 0);

  const content = (
    <Box component="nav" aria-label="เมนูหลัก" sx={{ height: "100%", overflowY: "auto" }}>
      <Box sx={{ px: 3, pt: 3, pb: 2 }}>
        <Link href="/dashboard" style={{ textDecoration: "none" }}>
          <Typography component="span" sx={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.04em", color: "#fff" }}>
            WOMS<Box component="span" sx={{ color: "primary.main" }}>.</Box>
          </Typography>
        </Link>
      </Box>
      {groups.map((g) => (
        <List
          key={g.title}
          dense
          sx={{ px: 1.25, py: 0.5 }}
          subheader={
            <ListSubheader
              disableSticky
              sx={{
                bgcolor: "transparent",
                color: "#8da0ad",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                lineHeight: "28px",
              }}
            >
              {g.title}
            </ListSubheader>
          }
        >
          {g.links.map((l) => {
            const active = isActive(l.href);
            return (
              <ListItemButton
                key={l.href}
                component={Link}
                href={l.href}
                selected={active}
                aria-current={active ? "page" : undefined}
                sx={{
                  borderRadius: 1,
                  minHeight: 40,
                  color: "#c5d0d8",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.07)", color: "#fff" },
                  "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "primary.main", color: "#fff" },
                  "&.Mui-focusVisible": { outline: "2px solid #fff", outlineOffset: -2 },
                }}
              >
                <ListItemText primary={l.label} primaryTypographyProps={{ fontSize: 14.5, color: "inherit" }} />
                {l.href === "/chats" && unreadRooms > 0 ? (
                  <Badge color="error" badgeContent={unreadRooms > 99 ? "99+" : unreadRooms} sx={{ mr: 1 }} />
                ) : null}
              </ListItemButton>
            );
          })}
        </List>
      ))}
    </Box>
  );

  const paper = { width: NAV_WIDTH, bgcolor: tokens.ink, color: "#fff", borderRight: 0 };
  return desktop ? (
    <Drawer className="no-print" variant="permanent" open PaperProps={{ sx: paper }} sx={{ width: NAV_WIDTH, flexShrink: 0 }}>
      {content}
    </Drawer>
  ) : (
    <Drawer
      className="no-print"
      variant="temporary"
      open={open}
      onClose={() => setOpen(false)}
      ModalProps={{ keepMounted: true }}
      PaperProps={{ sx: paper }}
    >
      {content}
    </Drawer>
  );
}
