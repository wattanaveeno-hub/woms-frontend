"use client";

/**
 * แถบนำทางซ้าย — Redesign 13 พ.ย. 69 ตาม Nav.dc.html
 *   โลโก้ · หน้าหลัก · หมวด (ป้ายเล็กยุบได้) + เมนูมีไอคอน/ตัวนับ · "ตั้งค่า" ชิดล่าง
 *   รายการเมนูและสิทธิ์มาจาก lib/navMenu.ts (ชุดเดียวกับที่ทดสอบ) — ที่ sidebar:false อยู่ในหน้า /settings
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useUi } from "@/lib/UiContext";
import { FEATURES } from "@/lib/features";
import { chatApi, sqApi } from "@/lib/serviceQueueApi";
import { activeHref, isTechModePath } from "@/lib/navRules";
import { navGroups, visibleGroups, SETTINGS_HREFS, type NavLink } from "@/lib/navMenu";

const GROUPS = navGroups(FEATURES);
const COLLAPSE_KEY = "woms:nav-collapsed";

/** ความกว้างแถบนำทาง */
export const NAV_WIDTH = 232;

const C = { bg: "#16202b", text: "#c5d0d8", label: "#9fb0bc", on: "#1b5e37", badge: "#2e3f4f", red: "#b3261e" };

/** ไอคอนเส้น (stroke) ชุดเดียวกับ design */
const ICON: Record<string, React.ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  "/jobs": <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9zM9 12h6M9 16h4" /></>,
  "/calendar": <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  "/service-queue": <path d="M4 6h16M4 12h10M4 18h7" />,
  "/queue": <><path d="M3 7h13v10H3zM16 10h3l2 3v4h-5" /><circle cx="7" cy="18" r="1.6" /><circle cx="17.5" cy="18" r="1.6" /></>,
  "/pm": <><circle cx="12" cy="12" r="4" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></>,
  "/chats": <path d="M4 5h16v11H9l-5 4z" />,
  "/group-chat": <><path d="M3 6h12v8H7l-4 3z" /><path d="M9 17h7l5 3V10h-3" /></>,
  "/follow-ups": <path d="M5 4v17M5 5h11l-2 4 2 4H5" />,
  "/customers": <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5" /></>,
  "/equipment": <path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z" />,
  "/map": <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  "/stock": <path d="M4 8l8-4 8 4-8 4zM4 8v8l8 4 8-4V8M12 12v8" />,
  "/quotations": <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  "/contracts": <><path d="M6 3h9l4 4v14H6z" /><path d="M9 12h7M9 16h5" /></>,
  "/documents": <><path d="M7 3h10v18H7z" /><path d="M10 8h4M10 12h4M10 16h2" /></>,
  "/bills": <path d="M5 4h14v16H5zM8 9h8M8 13h5" />,
  "/finance": <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>,
  "/finance/queue": <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M8 13l3 3 5-6" /></>,
  "/m": <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" /></>,
};

function Svg({ k, size = 18 }: { k: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden style={{ flex: "none" }}>
      {ICON[k] ?? ICON["/jobs"]}
    </svg>
  );
}

function Count({ n, red }: { n: number; red?: boolean }) {
  if (!n) return null;
  return (
    <Box
      component="span"
      sx={{
        ml: "auto",
        minWidth: 22,
        height: 20,
        px: "6px",
        borderRadius: 999,
        bgcolor: red ? C.red : C.badge,
        color: "#fff",
        fontSize: 12,
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {n > 99 ? "99+" : n}
    </Box>
  );
}

const itemSx = (on: boolean) => ({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minHeight: 38,
  px: 1.5,
  borderRadius: "8px",
  fontSize: 15,
  lineHeight: 1.3,
  textDecoration: "none",
  color: on ? "#fff" : C.text,
  bgcolor: on ? C.on : "transparent",
  fontWeight: on ? 600 : 400,
  "&:hover": { bgcolor: on ? C.on : "rgba(255,255,255,.07)", color: "#fff", textDecoration: "none" },
  "&:focus-visible": { outline: "2px solid #fff", outlineOffset: -2 },
});

export default function Nav() {
  const path = usePathname();
  const { status, has, user } = useAuth();
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
  const desktop = useMediaQuery(theme.breakpoints.up("md"));

  useEffect(() => {
    setOpen(false);
  }, [path, setOpen]);

  // ตัวนับห้องแชทที่ยังไม่อ่าน
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

  // ตัวนับแชทกลุ่ม + คิวช่างที่รอผู้ใช้คนนี้ (Chat & Queue v1)
  useEffect(() => {
    if (status !== "authed" || !FEATURES.serviceQueue) return;
    let active = true;
    const load = () => {
      if (has("chat:check_queue") || has("chat:tech_groups") || has("chat:own_tech_group") || has("chat:read_all")) {
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

  // หน้ามือถือช่าง (/m) ไม่มีเมนูข้างถาวร — เปิดเป็น Drawer จากปุ่มเมนูในแถบบน (WS-02)
  const techMode = isTechModePath(path);
  if (status !== "authed") return null;

  const groups = visibleGroups(GROUPS, has, user?.role);
  const allHrefs = groups.flatMap((g) => g.links.map((l) => l.href));
  const settingsLinks = groups.find((g) => g.icon === "settings")?.links ?? [];
  const homeLinks = (groups.find((g) => g.icon === "dashboard")?.links ?? []).filter((l) => l.sidebar !== false);
  const sections = groups.filter((g) => g.icon !== "settings" && g.icon !== "dashboard");

  const current = activeHref(path, [...allHrefs, "/settings"]);
  const settingsOn = !!current && (SETTINGS_HREFS.includes(current) || settingsLinks.some((l) => l.href === current) || current.startsWith("/settings"));
  const isActive = (href: string) => href === current && !settingsOn;

  const count = (l: NavLink) =>
    l.href === "/chats" ? <Count n={unreadRooms} red /> : l.href === "/group-chat" ? <Count n={groupUnread} red /> : l.href === "/service-queue" ? <Count n={queueTodo} red /> : null;

  const item = (l: NavLink, iconKey: string, label = l.label) => {
    const on = isActive(l.href);
    return (
      <Box key={l.href} component={Link} href={l.href} aria-current={on ? "page" : undefined} sx={itemSx(on)}>
        <Svg k={iconKey} />
        <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
          {label}
        </Box>
        {count(l)}
      </Box>
    );
  };

  const content = (
    <Box
      component="nav"
      aria-label="เมนูหลัก"
      sx={{ height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px", p: "20px 12px 16px", bgcolor: C.bg, fontFamily: "inherit" }}
    >
      <Box sx={{ px: 1.5, pb: 2 }}>
        <Link href={homeLinks[0]?.href ?? "/dashboard"} aria-label="ENTECH หน้าหลัก">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/entech-logo-reverse.png" alt="ENTECH" style={{ display: "block", height: 32, width: "auto" }} />
        </Link>
      </Box>
      {homeLinks.map((l) => item(l, l.href === "/m" ? "/m" : "home"))}
      {sections.map((g, gi) => {
        const links = g.links.filter((l) => l.sidebar !== false);
        if (!links.length) return null;
        const hasActive = links.some((l) => isActive(l.href));
        const isOpen = !collapsed[g.title] || hasActive;
        return (
          <Box key={g.title} sx={{ display: "contents" }}>
            <Box
              component="button"
              type="button"
              onClick={() => toggleGroup(g.title)}
              aria-expanded={isOpen}
              aria-controls={`nav-group-${gi}`}
              data-testid="nav-group-toggle"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                border: 0,
                bgcolor: "transparent",
                font: "inherit",
                fontSize: 12,
                fontWeight: 600,
                color: C.label,
                p: "16px 12px 4px",
                cursor: "pointer",
                textAlign: "left",
                "&:hover": { color: "#fff" },
              }}
            >
              {g.title}
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d={isOpen ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
              </svg>
            </Box>
            <Box id={`nav-group-${gi}`} sx={{ display: isOpen ? "flex" : "none", flexDirection: "column", gap: "2px" }}>
              {links.map((l) => item(l, l.href))}
            </Box>
          </Box>
        );
      })}
      <Box sx={{ flexGrow: 1, minHeight: 24 }} />
      {settingsLinks.length ? (
        <Box component={Link} href="/settings" aria-current={settingsOn ? "page" : undefined} sx={itemSx(settingsOn)}>
          <Svg k="settings" />
          ตั้งค่า
        </Box>
      ) : null}
    </Box>
  );

  const paper = { width: NAV_WIDTH, bgcolor: C.bg, color: "#fff", borderRight: 0 };
  return desktop && !techMode ? (
    <Drawer className="no-print" variant="permanent" open PaperProps={{ sx: paper }} sx={{ width: NAV_WIDTH, flexShrink: 0 }}>
      {content}
    </Drawer>
  ) : (
    <Drawer className="no-print" variant="temporary" open={open} onClose={() => setOpen(false)} ModalProps={{ keepMounted: true }} PaperProps={{ sx: paper }}>
      {content}
    </Drawer>
  );
}
