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
import { navGroups, visibleGroups } from "@/lib/navMenu";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Collapse from "@mui/material/Collapse";
import ListSubheaderButton from "@mui/material/ListItemButton";

// เมนูและกติกาการแสดงอยู่ที่ lib/navMenu.ts (NAV-01 / NAV-02 v2)
const GROUPS = navGroups(FEATURES);
const COLLAPSE_KEY = "woms:nav-collapsed";

/** ความกว้างแถบนำทาง — AppShell ใช้ค่าเดียวกันเว้นระยะเนื้อหา */
export const NAV_WIDTH = 240;

export default function Nav() {
  const path = usePathname();
  const { status, has, user } = useAuth();
  // NAV-01 v2: หมวดเมนูยุบ–ขยายได้ (จำค่าเฉพาะเครื่องนี้ — อ่าน/เขียนไม่ได้ = แสดงทุกหมวด)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLAPSE_KEY);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {
      /* ไม่มี storage */
    }
  }, []);
  const toggleGroup = (title: string) =>
    setCollapsed((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      try {
        window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      } catch {
        /* ไม่มี storage */
      }
      return next;
    });
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
            // FB-16: Admin = รอจัดช่าง + ช่างตอบคิวแล้ว (รอรับคิว) + เปิดงานไม่สำเร็จ
            setQueueTodo(has("svcqueue:admin") ? s.waitAssign + (s.techReplied ?? 0) + s.readyToOpen : s.myResponse + s.myToConfirm);
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

  const groups = visibleGroups(GROUPS, has, user?.role);

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
            <ListSubheader disableSticky disableGutters sx={{ bgcolor: "transparent", lineHeight: "28px" }}>
              <ListSubheaderButton
                onClick={() => toggleGroup(g.title)}
                aria-expanded={!collapsed[g.title]}
                aria-controls={`nav-group-${groups.indexOf(g)}`}
                data-testid="nav-group-toggle"
                sx={{ borderRadius: 1, py: 0.25, px: 1.5, color: "#8da0ad", "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.05)" } }}
              >
                <Typography component="span" sx={{ flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>
                  {g.title}
                </Typography>
                {collapsed[g.title] && !g.links.some((l) => isActive(l.href)) ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
              </ListSubheaderButton>
            </ListSubheader>
          }
        >
          <Collapse in={!collapsed[g.title] || g.links.some((l) => isActive(l.href))} id={`nav-group-${groups.indexOf(g)}`} timeout="auto">
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
          </Collapse>
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
