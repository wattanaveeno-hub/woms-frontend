"use client";

// กระดิ่งแจ้งเตือนของระบบ — จำนวนที่ยังไม่อ่าน + ลิงก์ไปหน้ารายการ
// แยกจาก <Notifications /> ที่เป็นการตั้งค่า Web Push ของเบราว์เซอร์
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Badge from "@mui/material/Badge";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { showNotificationBell } from "@/lib/fetchGuards";

const POLL_MS = 60_000;

export default function NotificationBell() {
  const { status, has } = useAuth();
  // FE-02 (O-01) / D-FE-01 A: บทบาทที่ไม่มี jobs:view (เช่น ACC) ไม่เห็นกระดิ่งและไม่ poll
  //   (unread-count และหน้ารายการแจ้งเตือนต้องใช้ jobs:view ที่ backend) — เดิมได้ 403 ทุก 60 วินาที
  const enabled = status === "authed" && showNotificationBell(has);
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await api.notificationsUnreadCount();
      setCount(r.count);
    } catch {
      /* ไม่ให้กระดิ่งทำให้หน้าเว็บพัง */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load();
    const t = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("woms:notifications-read", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("woms:notifications-read", onFocus);
    };
  }, [load, enabled]);

  if (!enabled) return null;

  const label = count ? `การแจ้งเตือน ${count} รายการที่ยังไม่อ่าน` : "การแจ้งเตือน";
  return (
    <Tooltip title={label}>
      {/* R3-N2: เปิดมุมมอง "ยังไม่อ่าน" ให้ตรงกับตัวเลขบนกระดิ่ง (รวมการถูกแท็กในแชท D-13) */}
      <IconButton component={Link} href="/notifications?view=unread" aria-label={label}>
        <Badge color="error" badgeContent={count > 99 ? "99+" : count} invisible={count === 0}>
          <NotificationsNoneIcon />
        </Badge>
      </IconButton>
    </Tooltip>
  );
}
