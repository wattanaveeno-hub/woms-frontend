"use client";

// ---------------------------------------------------------------------------
// การแจ้งเตือนของระบบ
// ---------------------------------------------------------------------------
// รวมการแจ้งเตือนที่ requirement ระบุไว้: ใบงานเลยนัด +6 ชม., PM ใกล้/ถึง/เกินกำหนด,
// สัญญาใกล้หมดอายุ/ค้างชำระ — สร้างโดยตัวตั้งเวลาฝั่งเซิร์ฟเวอร์

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import type { AppNotification } from "@/lib/types";
import { bangkokDateTime } from "@/lib/date";

const SEVERITY_CLASS: Record<string, string> = {
  INFO: "badge",
  WARNING: "badge badge-wsoon",
  URGENT: "badge badge-wexp",
};

export default function NotificationsPage() {
  const { has } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.listNotifications({ unreadOnly, limit: 300 });
      setItems(r.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดการแจ้งเตือนไม่สำเร็จ");
      setItems([]);
    }
  }, [unreadOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (n: AppNotification) => {
    try {
      await api.markNotificationRead(n.id);
      setItems((prev) => (prev ?? []).map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      window.dispatchEvent(new Event("woms:notifications-read"));
    } catch {
      /* ไม่สำคัญพอจะรบกวนผู้ใช้ */
    }
  };

  const readAll = async () => {
    setBusy(true);
    try {
      const r = await api.markAllNotificationsRead();
      toast.success(`ทำเครื่องหมายว่าอ่านแล้ว ${r.updated} รายการ`);
      window.dispatchEvent(new Event("woms:notifications-read"));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    setBusy(true);
    try {
      const r = await api.runNotifications();
      toast.success(`ประมวลกติกาแล้ว — ใหม่ ${r.created} รายการ, ซ้ำ ${r.skipped} รายการ`);
      if (r.errors.length) toast.warning(`มีข้อผิดพลาดบางส่วน: ${r.errors[0]}`);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "สั่งประมวลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>การแจ้งเตือน</h1>
          <div className="detail-meta">
            สร้างอัตโนมัติจากสถานะปัจจุบันของข้อมูล — เลื่อนนัด ยกเลิก หรือปิดงานแล้วจะไม่มีการเตือนจากกำหนดเดิมอีก
          </div>
        </div>
        <div className="head-actions">
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            <span>เฉพาะที่ยังไม่อ่าน</span>
          </label>
          <button className="btn" disabled={busy} onClick={readAll}>
            อ่านทั้งหมด
          </button>
          {has("users:manage") && (
            <button className="btn" disabled={busy} onClick={runNow}>
              ตรวจเดี๋ยวนี้
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {items === null ? (
        <div className="state">กำลังโหลด…</div>
      ) : items.length === 0 ? (
        <div className="state">ไม่มีการแจ้งเตือน</div>
      ) : (
        <div className="card">
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>ประเภท</th>
                  <th>เรื่อง</th>
                  <th>รายละเอียด</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((n) => (
                  <tr key={n.id} style={n.read ? { opacity: 0.6 } : undefined}>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>
                      {bangkokDateTime(n.createdAt)}
                    </td>
                    <td>
                      <span className={SEVERITY_CLASS[n.severity] ?? "badge"}>{n.kindLabel}</span>
                    </td>
                    <td>{n.title}</td>
                    <td>{n.body}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {n.url && (
                        <Link className="btn btn-sm" href={n.url} onClick={() => markRead(n)}>
                          เปิด
                        </Link>
                      )}
                      {!n.read && (
                        <button className="btn btn-sm" style={{ marginLeft: 6 }} onClick={() => markRead(n)}>
                          อ่านแล้ว
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
