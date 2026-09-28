"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { Booking, BookingEta, TechnicianPosition } from "@/lib/types";
import { bookingStatusLabel } from "@/lib/options";
import { bangkokClock, bangkokTime, bangkokToday } from "@/lib/date";
import { FEATURES } from "@/lib/features";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiLink from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { WomsDataTable, WomsFormSection, WomsPageHeader, WomsStatusChip, type WomsColumn } from "@/components/woms";
import { WomsPermissionGate } from "@/components/woms/WomsPermissionGate";

function fmtTime(iso: string): string {
  return bangkokClock(iso) || "—";
}

// ตำแหน่งช่างแบบใกล้เวลาจริง + ETA ของคิวที่กำลังจะถึง
function TrackingPageInner() {
  const [items, setItems] = useState<TechnicianPosition[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [etas, setEtas] = useState<Record<string, BookingEta>>({});
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  /*
   * QA BUG-043 — ปุ่ม "ติดตาม" ใน /queue ชี้มาที่ /tracking?booking=<id>
   * แต่หน้านี้เคยไม่สนใจพารามิเตอร์เลย: query คิวของ "วันนี้" ตายตัว
   * คิวของพรุ่งนี้จึงตกหล่น ผู้ใช้เห็น "ไม่มีคิววันนี้" ทั้งที่คิวที่กดมามีอยู่จริง
   * และไม่เคยเรียก ETA ของคิวนั้นให้เลย
   * (อ่าน query จาก window แทน useSearchParams เพื่อไม่ต้องมี <Suspense> ตอน prerender)
   */
  const [focusId, setFocusId] = useState("");
  const [focusBooking, setFocusBooking] = useState<Booking | null>(null);
  const [focusMissing, setFocusMissing] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("booking") ?? "";
    setFocusId(id);
  }, []);

  const load = useCallback(async () => {
    try {
      const today = bangkokToday();
      // ถ้าถูกส่งมาพร้อมคิวที่ต้องการติดตาม ให้ดึงคิวนั้นมาด้วยเสมอ
      // แม้จะไม่ใช่คิวของวันนี้ (คิวพรุ่งนี้เป็นเคสที่ QA เจอจริง)
      const pinned = focusId ? api.getBooking(focusId).catch(() => null) : Promise.resolve(null);
      const [pos, bk, one] = await Promise.all([
        api.technicianPositions(12),
        api.listBookings({ from: today, to: today }),
        pinned,
      ]);
      setItems(pos.items);
      setFocusBooking(one);
      setFocusMissing(!!focusId && one === null);
      const merged = one && !bk.items.some((b) => b.id === one.id) ? [one, ...bk.items] : bk.items;
      setBookings(merged);
      setUpdatedAt(bangkokTime()); // เวลาไทย ไม่ใช่ UTC
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [focusId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000); // รีเฟรชทุก 30 วินาที
    return () => clearInterval(t);
  }, [load]);

  const loadEta = useCallback(async (b: Booking) => {
    try {
      const eta = await api.bookingEta(b.id);
      setEtas((prev) => ({ ...prev, [b.id]: eta }));
    } catch (e) {
      // เดิมกลืน error ทิ้งเงียบ ๆ — ผู้ใช้กด "คำนวณ ETA" แล้วไม่มีอะไรเกิดขึ้น
      setEtas((prev) => ({
        ...prev,
        [b.id]: {
          bookingNo: b.bookingNo,
          available: false,
          message: e instanceof ApiError ? e.message : "คำนวณ ETA ไม่สำเร็จ",
        },
      }));
    }
  }, []);

  // คิวที่ถูกส่งมาให้ติดตาม — คำนวณ ETA ให้เลยโดยไม่ต้องกด
  useEffect(() => {
    if (focusBooking && !etas[focusBooking.id]) loadEta(focusBooking);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusBooking?.id]);

  const active = bookings.filter((b) => b.status !== "CANCELLED");

  const today = bangkokToday();
  const posWhere = (p: TechnicianPosition) =>
    p.destination ? (
      <>
        <span className="code">{p.destination.bookingNo}</span>
        <Typography variant="body2" sx={{ color: "text.primary" }}>{p.destination.customerName}</Typography>
        <Typography variant="body2">{p.destination.address}</Typography>
      </>
    ) : (
      "— ไม่มีคิวค้าง —"
    );
  const posEta = (p: TechnicianPosition) =>
    p.destination?.status === "ARRIVED" ? "ถึงแล้ว" : p.destination?.etaMinutes ? `${p.destination.etaMinutes} นาที` : "—";
  const posAgo = (p: TechnicianPosition) => (p.minutesAgo === 0 ? "เมื่อสักครู่" : `${p.minutesAgo} นาทีที่แล้ว`);
  const mapLink = (p: TechnicianPosition) => (
    <MuiLink href={`https://maps.google.com/?q=${p.lat},${p.lng}`} target="_blank" rel="noopener noreferrer">
      เปิดแผนที่
    </MuiLink>
  );
  const posCols: WomsColumn<TechnicianPosition>[] = [
    { key: "name", label: "ช่าง", sortValue: (p) => p.userName, render: (p) => p.userName },
    { key: "ll", label: "พิกัด", hideBelowLg: true, render: (p) => <span className="mono">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</span> },
    {
      key: "at",
      label: "อัปเดตเมื่อ",
      sortValue: (p) => p.minutesAgo,
      render: (p) => (
        <>
          {posAgo(p)}
          <Typography variant="body2" className="mono">{fmtTime(p.at)}</Typography>
        </>
      ),
    },
    { key: "dest", label: "กำลังไปที่", render: posWhere },
    { key: "km", label: "ระยะทาง", align: "right", render: (p) => <span className="mono">{p.destination?.distanceKm ? `${p.destination.distanceKm} กม.` : "—"}</span> },
    { key: "eta", label: "คาดว่าถึงใน", render: (p) => <span className="mono">{posEta(p)}</span> },
    { key: "map", label: "แผนที่", render: mapLink },
  ];

  const bookingNo = (b: Booking) => (
    <>
      <span className="code">{b.bookingNo}</span>
      {b.id === focusId ? (
        <Box component="span" sx={{ ml: 0.75 }}>
          <WomsStatusChip label="กำลังติดตาม" tone="primary" />
        </Box>
      ) : null}
      {b.date && b.date !== today ? <Typography variant="body2">คิววันที่ {b.date}</Typography> : null}
    </>
  );
  const actual = (b: Booking) => (
    <Box className="mono" sx={{ fontSize: 12 }}>
      {b.startedAt ? <div>ออกเดินทาง {fmtTime(b.startedAt)}</div> : null}
      {b.arrivedAt ? <div>ถึงหน้างาน {fmtTime(b.arrivedAt)}</div> : null}
      {b.doneAt ? <div>ปิดงาน {fmtTime(b.doneAt)}</div> : null}
    </Box>
  );
  const eta = (b: Booking) =>
    etas[b.id] ? (
      <Typography variant="body2">{etas[b.id].message}</Typography>
    ) : (
      <Button size="small" variant="outlined" onClick={() => loadEta(b)}>
        คำนวณ ETA
      </Button>
    );
  const bkCols: WomsColumn<Booking>[] = [
    { key: "no", label: "เลขคิว", sortValue: (b) => b.bookingNo, render: bookingNo },
    { key: "time", label: "เวลา", sortValue: (b) => b.start, render: (b) => <span className="mono">{b.start}–{b.end}</span> },
    {
      key: "cust",
      label: "ลูกค้า",
      render: (b) => (
        <>
          {b.customerName}
          <Typography variant="body2">{b.address}</Typography>
        </>
      ),
    },
    { key: "tech", label: "ช่าง", render: (b) => b.techName },
    { key: "st", label: "สถานะ", render: (b) => bookingStatusLabel[b.status] },
    { key: "actual", label: "เวลาจริง", hideBelowLg: true, render: actual },
    { key: "eta", label: "ETA", render: eta },
  ];

  return (
    <>
      <WomsPageHeader
        title="ติดตามช่าง & เครื่อง"
        subtitle={`อัปเดตอัตโนมัติทุก 30 วินาที${updatedAt ? ` · ล่าสุด ${updatedAt}` : ""}`}
        actions={
          // คิวงานเป็นฟังก์ชันที่ซ่อนอยู่ (HIDE-01) — เดิมปุ่มนี้แสดงเสมอ ทำให้เข้าหน้าที่ซ่อนได้จากตรงนี้
          FEATURES.techQueue ? (
            <Button component={Link} href="/queue" variant="outlined">
              คิวงาน
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={load}>ลองอีกครั้ง</Button>}>
          {error}
        </Alert>
      ) : null}
      {focusMissing ? (
        <Alert severity="warning" sx={{ mb: 2 }} role="status">
          ไม่พบคิวที่ขอติดตาม (อาจถูกลบไปแล้ว) — แสดงคิวของวันนี้แทน
        </Alert>
      ) : null}

      <WomsFormSection title="ตำแหน่งล่าสุดของช่าง">
        <WomsDataTable
          caption="ตำแหน่งล่าสุดของช่าง"
          rows={items}
          loading={loading}
          columns={posCols}
          rowKey={(p) => p.userId}
          pageSize={25}
          emptyTitle="ยังไม่มีช่างส่งพิกัดเข้ามา"
          emptyDescription="ช่างต้องเปิดหน้ามือถือ (/m) และอนุญาตตำแหน่ง"
          renderCard={(p) => (
            <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{p.userName}</Typography>
                <Typography variant="body2">{posAgo(p)}</Typography>
              </Stack>
              <Box sx={{ mt: 0.5 }}>{posWhere(p)}</Box>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                ระยะ {p.destination?.distanceKm ? `${p.destination.distanceKm} กม.` : "—"} · ถึงใน {posEta(p)}
              </Typography>
              <Box sx={{ mt: 0.5 }}>{mapLink(p)}</Box>
            </Box>
          )}
        />
      </WomsFormSection>

      <WomsFormSection title={`คิวของวันนี้${focusBooking && focusBooking.date !== today ? " + คิวที่กำลังติดตาม" : ""}`}>
        <WomsDataTable
          caption="คิวของวันนี้"
          rows={active}
          loading={loading}
          columns={bkCols}
          rowKey={(b) => b.id}
          pageSize={25}
          emptyTitle="ไม่มีคิววันนี้"
          renderCard={(b) => (
            <Box sx={{ border: 1, borderColor: b.id === focusId ? "primary.main" : "divider", borderRadius: 1, p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Box>{bookingNo(b)}</Box>
                <Typography variant="body2">{bookingStatusLabel[b.status]}</Typography>
              </Stack>
              <Typography sx={{ color: "text.primary" }}>
                <span className="mono">{b.start}–{b.end}</span> · {b.customerName}
              </Typography>
              <Typography variant="body2">{b.address}</Typography>
              <Typography variant="body2">ช่าง: {b.techName}</Typography>
              {actual(b)}
              <Box sx={{ mt: 1 }}>{eta(b)}</Box>
            </Box>
          )}
        />
      </WomsFormSection>
    </>
  );
}

// backend บังคับ tracking:view อยู่แล้ว — gate นี้แค่ไม่ให้เห็นหน้าเปล่าที่ error
export default function TrackingPage() {
  return (
    <WomsPermissionGate perm="tracking:view">
      <TrackingPageInner />
    </WomsPermissionGate>
  );
}
