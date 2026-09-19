"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useTechLocation } from "@/lib/useTechLocation";
import type { Booking, BookingStatus, JobListItem } from "@/lib/types";
import { bookingStatusLabel, bookingTypeLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";
import { addDaysISO, bangkokToday } from "@/lib/date";

// "วันนี้" ตามเวลาไทย — ตัวช่วยกลางที่ lib/date.ts
const today = bangkokToday;
const addDays = addDaysISO;

// หน้าหลักของช่างบนมือถือ (ติดตั้งเป็นแอปจากเบราว์เซอร์ได้ — PWA)
export default function MobileHome() {
  const { user, status, has } = useAuth();
  const toast = useToast();
  const loc = useTechLocation();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [jobs, setJobs] = useState<JobListItem[]>([]); // รายการไม่มีรูป/ลายเซ็น (Phase 9.1)
  const [range, setRange] = useState<"today" | "week">("today");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const from = today();
      const to = range === "today" ? today() : addDays(from, 7);
      const [bk, jb] = await Promise.all([
        api.myBookings({ from, to }),
        api.listJobs({ status: "OPEN" }),
      ]);
      setBookings(bk.items);
      setJobs(jb.jobs);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [range]);

  useEffect(() => {
    if (status === "authed") load();
  }, [load, status]);

  const setStatusOf = async (b: Booking, next: BookingStatus) => {
    setBusyId(b.id);
    try {
      await api.setBookingStatus(b.id, next, { lat: loc.lat, lng: loc.lng });
      if (loc.sharing) loc.sendNow();
      toast.success(bookingStatusLabel[next]);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "อัปเดตไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  if (status !== "authed") return <div className="state">กรุณาเข้าสู่ระบบ</div>;

  return (
    <div className="m-wrap">
      <div className="m-head">
        <div>
          {/* QA (Cosmetic) — บัญชีที่มี jobs:view_all เห็นงานของทั้งบริษัท
              หัวข้อ "งานของ <ชื่อตัวเอง>" จึงทำให้เข้าใจผิด */}
          <div className="m-title">{has("jobs:view_all") ? "งานที่ต้องติดตาม" : `งานของ ${user?.name ?? ""}`}</div>
          <div className="m-sub">
            {range === "today" ? "คิววันนี้" : "คิว 7 วันข้างหน้า"} · {bookings.length} คิว
          </div>
        </div>
        <button className="btn" onClick={() => setRange(range === "today" ? "week" : "today")}>
          {range === "today" ? "ดู 7 วัน" : "ดูวันนี้"}
        </button>
      </div>

      <div className="m-card">
        <div className="m-row">
          <div>
            <strong>แชร์ตำแหน่งให้ออฟฟิศ</strong>
            <div className="m-sub">
              {loc.sharing
                ? loc.lat
                  ? `กำลังส่ง · ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}${loc.lastSentAt ? ` · ล่าสุด ${loc.lastSentAt.slice(11, 16)}` : ""}`
                  : "กำลังขอตำแหน่ง…"
                : "ปิดอยู่ — เปิดเพื่อให้ออฟฟิศเห็น ETA"}
            </div>
            {loc.error ? <div className="m-err">{loc.error}</div> : null}
          </div>
          {/* B-09 — การแชร์ตำแหน่งเป็นสวิตช์ตั้งค่า ไม่ใช่ปุ่มหลักของหน้า */}
          <button className={`btn ${loc.sharing ? "btn-danger" : ""}`} onClick={loc.sharing ? loc.stop : loc.start}>
            {loc.sharing ? "หยุด" : "เปิด"}
          </button>
        </div>
      </div>

      <div className="m-actions">
        <Link href="/m/job/new" className="btn btn-primary">
          + เปิดงานใหม่
        </Link>
        <Link href="/queue/slots" className="btn">
          ตาราง slot ของฉัน
        </Link>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <h2 className="m-h2">คิวงาน</h2>
      {bookings.length === 0 ? (
        <div className="state">ไม่มีคิวในช่วงนี้</div>
      ) : (
        bookings.map((b) => (
          <div className="m-card" key={b.id}>
            <div className="m-row">
              <div>
                <div className="code">{b.bookingNo}</div>
                <div className="m-strong">
                  {bookingTypeLabel[b.type]} · {b.customerName}
                </div>
                <div className="m-sub">
                  {b.date} {b.start}–{b.end}
                </div>
                <div className="m-sub">{b.address}</div>
              </div>
              <span className="badge badge-open">{bookingStatusLabel[b.status]}</span>
            </div>
            <div className="m-actions">
              {b.lat || b.lng ? (
                <a className="btn" href={`https://maps.google.com/?q=${b.lat},${b.lng}`} target="_blank" rel="noopener noreferrer">
                  นำทาง
                </a>
              ) : null}
              {b.phone ? (
                <a className="btn" href={`tel:${b.phone}`}>
                  โทรหาลูกค้า
                </a>
              ) : null}
              <Link className="btn" href={`/m/booking/${b.id}`}>
                รายละเอียด
              </Link>
              {b.status === "BOOKED" ? (
                <button className="btn btn-primary" onClick={() => setStatusOf(b, "ON_THE_WAY")} disabled={busyId === b.id}>
                  ออกเดินทาง
                </button>
              ) : null}
              {b.status === "ON_THE_WAY" ? (
                <button className="btn btn-primary" onClick={() => setStatusOf(b, "ARRIVED")} disabled={busyId === b.id}>
                  ถึงหน้างานแล้ว
                </button>
              ) : null}
              {b.status === "ARRIVED" ? (
                <button className="btn btn-primary" onClick={() => setStatusOf(b, "DONE")} disabled={busyId === b.id}>
                  ปิดคิว
                </button>
              ) : null}
            </div>
          </div>
        ))
      )}

      <h2 className="m-h2">ใบงานที่ยังเปิดอยู่</h2>
      {jobs.length === 0 ? (
        <div className="state">ไม่มีใบงานค้าง</div>
      ) : (
        jobs.slice(0, 20).map((j) => (
          <div className="m-card" key={j.jobId}>
            <div className="m-row">
              <div>
                <div className="code">{j.jobId}</div>
                <div className="m-strong">{j.jobName}</div>
                <div className="m-sub">
                  {j.jobDate} {j.jobTime} · ทีม {j.technicianTeam}
                </div>
              </div>
              <Link className="btn btn-primary" href={`/m/job/${encodeURIComponent(j.jobId)}`}>
                ปิดงาน
              </Link>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
