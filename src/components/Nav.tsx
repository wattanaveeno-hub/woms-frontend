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
import { chatApi, sqApi } from "@/lib/serviceQueueApi";
import { activeHref, isTechModePath } from "@/lib/navRules";

// perm = สิทธิ์หลัก · anyPerm = แสดงเมื่อมีสิทธิ์ใดสิทธิ์หนึ่ง (เช่น ดูอย่างเดียว หรือ จัดการ)
// roles = บทบาทที่เห็นเมนูนี้เพิ่มเติม (Admin เห็น "คำขออนุมัติ" เพื่อติดตามคำขอของตัวเอง)
type NavLink = { href: string; label: string; perm: string; anyPerm?: string[]; roles?: string[]; hidden?: boolean };
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
      // Chat & Queue v1 — คิวช่างและแชทกลุ่ม (กลุ่มเช็คคิว / กลุ่มงานช่าง)
      { href: "/service-queue", label: "คิวช่าง", perm: "svcqueue:view", hidden: !FEATURES.serviceQueue },
      { href: "/group-chat", label: "แชทกลุ่ม", perm: "chat:check_queue", anyPerm: ["chat:tech_groups", "chat:own_tech_group"], hidden: !FEATURES.serviceQueue },
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
      { href: "/parts", label: "ข้อมูลอะไหล่", perm: "stock:view" },
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
      // VFB แถว 21: CEO ดูข้อมูลพื้นฐาน/ผู้ใช้ได้ (สิทธิ์ดู) แต่แก้ไม่ได้
      { href: "/master", label: "ข้อมูลพื้นฐาน", perm: "master:manage", anyPerm: ["master:view"] },
      { href: "/settings/company", label: "หัวเอกสารบริษัท", perm: "master:manage", anyPerm: ["master:view"] },
      { href: "/settings/stock", label: "วิธีคิดมูลค่าสต๊อก", perm: "stock:manage" },
      { href: "/users", label: "ผู้ใช้", perm: "users:manage", anyPerm: ["users:view"] },
      { href: "/audit", label: "ประวัติการใช้งาน", perm: "audit:view" },
      // VFB แถว 21: คำขอแก้ไข/ลบของ Admin รออนุมัติจาก Manager / CEO
      { href: "/approvals", label: "คำขออนุมัติ", perm: "changes:approve", roles: ["admin"] },
    ],
  },
];

/** ความกว้างแถบนำทาง — AppShell ใช้ค่าเดียวกันเว้นระยะเนื้อหา */
export const NAV_WIDTH = 240;

export default function Nav() {
  const path = usePathname();
  const { status, has, user } = useAuth();
  const visible = (l: NavLink) =>
    has(l.perm) || (l.anyPerm ?? []).some((p) => has(p)) || (!!user && (l.roles ?? []).includes(user.role));
  const { open, setOpen } = useUi();
  const [unreadRooms, setUnreadRooms] = useState(0);
  const [groupUnread, setGroupUnread] = useState(0);
  const [queueTodo, setQueueTodo] = useState(0);
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

  // ป้าย "แชทกลุ่ม" ที่ยังไม่อ่าน + "คิวช่าง" ที่รอผู้ใช้คนนี้ดำเนินการ (Chat & Queue v1)
  useEffect(() => {
    if (status !== "authed" || !FEATURES.serviceQueue) return;
    let active = true;
    const load = () => {
      if (has("chat:check_queue") || has("chat:tech_groups") || has("chat:own_tech_group")) {
        chatApi
          .groups()
          .then((r) => active && setGroupUnread(r.items.reduce((n, g) => n + g.unread, 0)))
          .catch(() => {});
      }
      if (has("svcqueue:view")) {
        sqApi
          .summary()
          .then((s) => {
            if (!active) return;
            // ช่าง: คิวที่ต้องตอบ · เซลล์: คิวของตนรอคอนเฟิร์ม · Admin: รอจัดช่าง + รอเปิดงาน
            setQueueTodo(has("svcqueue:admin") ? s.waitAssign + s.readyToOpen : s.myResponse + s.myToConfirm);
          })
          .catch(() => {});
      }
    };
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener("woms:group-chat-read", load);
    window.addEventListener("woms:queue-changed", load);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearInterval(t);
      window.removeEventListener("woms:group-chat-read", load);
      window.removeEventListener("woms:queue-changed", load);
      window.removeEventListener("focus", load);
    };
  }, [status, has]);

  // หน้ามือถือช่าง (/m และ /m/...) ใช้เลย์เอาต์แบบแอป ไม่มีเมนูข้าง — ห้ามใช้ startsWith("/m")
  // เพราะจะจับ /map และ /master ไปด้วย (บั๊กเมนูข้างหาย)
  if (isTechModePath(path)) return null;
  if (status !== "authed") return null;

  const groups = GROUPS.map((g) => ({
    title: g.title,
    links: g.links.filter((l) => !l.hidden && visible(l)),
  })).filter((g) => g.links.length > 0);

  // Active ได้รายการเดียว: เมนูที่ href ยาวที่สุดที่ครอบหน้านี้ (จับหน้าลูก /x/[id], /x/[id]/edit ได้)
  const current = activeHref(path, groups.flatMap((g) => g.links.map((l) => l.href)));
  const isActive = (href: string) => href === current;

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
                {l.href === "/group-chat" && groupUnread > 0 ? (
                  <Badge color="error" badgeContent={groupUnread > 99 ? "99+" : groupUnread} sx={{ mr: 1 }} />
                ) : null}
                {l.href === "/service-queue" && queueTodo > 0 ? (
                  <Badge color="warning" badgeContent={queueTodo > 99 ? "99+" : queueTodo} sx={{ mr: 1 }} />
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
