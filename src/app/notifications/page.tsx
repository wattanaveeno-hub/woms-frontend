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
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import { WomsDataTable, WomsPageHeader, WomsStatusChip, type StatusTone, type WomsColumn } from "@/components/woms";

const SEVERITY_TONE: Record<string, StatusTone> = {
  INFO: "info",
  WARNING: "warning",
  URGENT: "error",
};

export default function NotificationsPage() {
  const { has, user } = useAuth();
  // ช่างเปิดใบงานจากการแจ้งเตือน → หน้ามือถือของช่าง (/m/job/:id) แทนหน้าใบงานของ Admin
  const hrefOf = (url: string) => (user?.role === "tech" && /^\/jobs\/[^/]+$/.test(url) ? url.replace(/^\/jobs\//, "/m/job/") : url);
  const toast = useToast();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  // FB-16: แยก "ต้องดำเนินการ" กับ "ยังไม่อ่าน"
  const [view, setView] = useState<"action" | "unread" | "all">("action");
  // R3-N2 (Round 3): กระดิ่ง (ทางเข้าเดียวหลัง D-20 ซ่อนเมนู) เปิดด้วย ?view=unread — ตัวเลขบนกระดิ่งนับ "ยังไม่อ่าน"
  //   รวมแจ้งเตือนเพื่อทราบ เช่น ถูกแท็กในแชท (D-13) ซึ่งมุมมอง "ต้องดำเนินการ" ไม่แสดง
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("view");
    if (v === "unread" || v === "all" || v === "action") setView(v);
  }, []);
  const unreadOnly = view === "unread";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.listNotifications({ unreadOnly, actionOnly: view === "action", limit: 300 });
      setItems(r.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดการแจ้งเตือนไม่สำเร็จ");
      setItems([]);
    }
  }, [unreadOnly, view]);

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
    } catch (e) {
      // เดิมไม่มี catch — ล้มเหลวแล้วเงียบ (unhandled promise)
      toast.error(e instanceof ApiError ? e.message : "ทำเครื่องหมายไม่สำเร็จ");
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

  const stateChip = (n: AppNotification) =>
    n.resolvedAt ? (
      <WomsStatusChip label="ดำเนินการแล้ว" tone="neutral" title={n.resolvedReason || undefined} />
    ) : n.actionRequired === false ? (
      <WomsStatusChip label="เพื่อทราบ" tone="info" />
    ) : (
      <WomsStatusChip label="ต้องดำเนินการ" tone="warning" />
    );
  const kindChip = (n: AppNotification) => <WomsStatusChip label={n.kindLabel} tone={SEVERITY_TONE[n.severity] ?? "neutral"} />;
  const actions = (n: AppNotification) => (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {n.url ? (
        <Button size="small" variant="outlined" component={Link} href={hrefOf(n.url)} onClick={() => markRead(n)}>
          เปิด
        </Button>
      ) : null}
      {!n.read ? (
        <Button size="small" onClick={() => markRead(n)}>
          อ่านแล้ว
        </Button>
      ) : null}
    </Stack>
  );
  const columns: WomsColumn<AppNotification>[] = [
    { key: "at", label: "เวลา", sortValue: (n) => n.createdAt, render: (n) => <span className="mono">{bangkokDateTime(n.createdAt)}</span> },
    { key: "kind", label: "ประเภท", sortValue: (n) => n.kindLabel, render: kindChip },
    {
      key: "title",
      label: "เรื่อง",
      render: (n) => (
        <Box sx={{ fontWeight: n.read ? 400 : 700 }}>
          {n.title}
          {!n.read ? <WomsStatusChip label="ใหม่" tone="primary" /> : null}
          {stateChip(n)}
        </Box>
      ),
    },
    { key: "body", label: "รายละเอียด", hideBelowLg: true, render: (n) => n.body },
    { key: "act", label: "", render: actions },
  ];

  return (
    <>
      <WomsPageHeader
        title="การแจ้งเตือน"
        subtitle="สร้างอัตโนมัติจากสถานะปัจจุบันของข้อมูล — เลื่อนนัด ยกเลิก หรือปิดงานแล้วจะไม่มีการเตือนจากกำหนดเดิมอีก"
        actions={
          <>
            <TextField select size="small" label="แสดง" value={view} onChange={(e) => setView(e.target.value as "action" | "unread" | "all")} sx={{ minWidth: 190 }} inputProps={{ "data-testid": "notif-view" }}>
              <MenuItem value="action">ต้องดำเนินการ</MenuItem>
              <MenuItem value="unread">ยังไม่อ่าน</MenuItem>
              <MenuItem value="all">ทั้งหมด (รวมที่ดำเนินการแล้ว)</MenuItem>
            </TextField>
            <Button variant="outlined" startIcon={<DoneAllIcon />} disabled={busy} onClick={readAll}>
              อ่านทั้งหมด
            </Button>
            {has("users:manage") ? (
              <Button disabled={busy} onClick={runNow}>
                ตรวจเดี๋ยวนี้
              </Button>
            ) : null}
          </>
        }
      />

      <WomsDataTable
        caption="การแจ้งเตือน"
        rows={items ?? []}
        loading={items === null}
        error={error}
        onRetry={load}
        columns={columns}
        rowKey={(n) => n.id}
        pageSize={25}
        emptyTitle={view === "action" ? "ไม่มีเรื่องที่ต้องดำเนินการ" : unreadOnly ? "ไม่มีการแจ้งเตือนที่ยังไม่อ่าน" : "ไม่มีการแจ้งเตือน"}
        renderCard={(n) => (
          <Box sx={{ border: 1, borderColor: n.read ? "divider" : "primary.main", borderRadius: 1, p: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
              {kindChip(n)}
              <Typography variant="body2" className="mono">
                {bangkokDateTime(n.createdAt)}
              </Typography>
            </Stack>
            <Typography sx={{ color: "text.primary", fontWeight: n.read ? 400 : 700, mt: 0.5 }}>
              {n.title} {stateChip(n)}
            </Typography>
            <Typography variant="body2">{n.body}</Typography>
            <Box sx={{ mt: 1 }}>{actions(n)}</Box>
          </Box>
        )}
      />
    </>
  );
}
