"use client";

// แถบเมนูล่างของช่าง (TECH-01 / มือถือ) — เข้าถึงงาน คิว PM วางบิล แชท ได้จากทุกหน้าที่ช่างใช้
// แสดงเมื่อผู้ใช้เป็นช่าง และ (อยู่ในโหมดมือถือ /m หรือจอแคบกว่า md)
// เมนูซ่อนตามสิทธิ์จริงของผู้ใช้ (has) และ feature flag เดียวกับเมนูข้าง — backend บังคับสิทธิ์อีกชั้นเสมอ
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Badge from "@mui/material/Badge";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Paper from "@mui/material/Paper";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import HomeIcon from "@mui/icons-material/Home";
import EventNoteIcon from "@mui/icons-material/EventNote";
import BuildCircleIcon from "@mui/icons-material/BuildCircle";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ForumIcon from "@mui/icons-material/Forum";
import { useAuth } from "@/lib/AuthContext";
import { FEATURES } from "@/lib/features";
import { isTechModePath, isUnder } from "@/lib/navRules";
import { chatApi, sqApi } from "@/lib/serviceQueueApi";

export const TECH_NAV_HEIGHT = 64;

export function useTechBottomNavVisible(): boolean {
  const { user, status } = useAuth();
  const path = usePathname() ?? "";
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down("md"));
  return status === "authed" && user?.role === "tech" && (isTechModePath(path) || narrow);
}

export default function TechBottomNav() {
  const { has, status } = useAuth();
  const path = usePathname() ?? "";
  const visible = useTechBottomNavVisible();
  const [queueTodo, setQueueTodo] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    if (!visible || status !== "authed" || !FEATURES.serviceQueue) return;
    let active = true;
    const load = () => {
      if (has("svcqueue:view")) {
        sqApi
          .summary()
          .then((s) => active && setQueueTodo(s.myResponse + s.myToConfirm))
          .catch(() => {});
      }
      if (has("chat:own_tech_group")) {
        chatApi
          .groups()
          .then((r) => active && setChatUnread(r.items.reduce((n, g) => n + g.unread, 0)))
          .catch(() => {});
      }
    };
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener("woms:queue-changed", load);
    window.addEventListener("woms:group-chat-read", load);
    return () => {
      active = false;
      clearInterval(t);
      window.removeEventListener("woms:queue-changed", load);
      window.removeEventListener("woms:group-chat-read", load);
    };
  }, [visible, status, has]);

  if (!visible) return null;

  const items = [
    { href: "/m", label: "งานของฉัน", icon: <HomeIcon />, show: true, badge: 0 },
    { href: "/service-queue", label: "คิว", icon: <EventNoteIcon />, show: FEATURES.serviceQueue && has("svcqueue:view"), badge: queueTodo },
    { href: "/pm", label: "PM", icon: <BuildCircleIcon />, show: has("pm:view"), badge: 0 },
    { href: "/bills", label: "วางบิล", icon: <ReceiptLongIcon />, show: has("bill:view"), badge: 0 },
    { href: "/group-chat", label: "แชท", icon: <ForumIcon />, show: FEATURES.serviceQueue && has("chat:own_tech_group"), badge: chatUnread },
  ].filter((i) => i.show);

  // /m/job/... เป็นงานของฉัน · หน้าอื่นเลือกเมนูที่ครอบ path ยาวที่สุด
  const current =
    items
      .filter((i) => (i.href === "/m" ? isTechModePath(path) : isUnder(path, i.href)))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? false;

  return (
    <Paper
      component="nav"
      aria-label="เมนูช่าง"
      elevation={8}
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (t) => t.zIndex.appBar,
        pb: "env(safe-area-inset-bottom)",
      }}
    >
      <BottomNavigation showLabels value={current} sx={{ height: TECH_NAV_HEIGHT }}>
        {items.map((i) => (
          <BottomNavigationAction
            key={i.href}
            value={i.href}
            label={i.label}
            component={Link}
            href={i.href}
            sx={{ minWidth: 0, px: 0.5 }}
            icon={
              i.badge > 0 ? (
                <Badge color="error" badgeContent={i.badge} max={99}>
                  {i.icon}
                </Badge>
              ) : (
                i.icon
              )
            }
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
