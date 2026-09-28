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

const POLL_MS = 60_000;

export default function NotificationBell() {
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
  }, [load]);

  const label = count ? `การแจ้งเตือน ${count} รายการที่ยังไม่อ่าน` : "การแจ้งเตือน";
  return (
    <Tooltip title={label}>
      <IconButton component={Link} href="/notifications" aria-label={label}>
        <Badge color="error" badgeContent={count > 99 ? "99+" : count} invisible={count === 0}>
          <NotificationsNoneIcon />
        </Badge>
      </IconButton>
    </Tooltip>
  );
}
