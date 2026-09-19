"use client";

// กระดิ่งแจ้งเตือนของระบบ — จำนวนที่ยังไม่อ่าน + ลิงก์ไปหน้ารายการ
// แยกจาก <Notifications /> ที่เป็นการตั้งค่า Web Push ของเบราว์เซอร์
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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

  return (
    <Link
      href="/notifications"
      className="btn btn-sm"
      aria-label={count ? `การแจ้งเตือน ${count} รายการที่ยังไม่อ่าน` : "การแจ้งเตือน"}
      style={{ position: "relative" }}
    >
      🔔
      {count > 0 && (
        <span
          className="badge badge-wexp"
          style={{ marginLeft: 6, padding: "0 6px" }}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
