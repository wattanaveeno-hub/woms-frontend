"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { Booking, BookingEta, TechnicianPosition } from "@/lib/types";
import { bookingStatusLabel } from "@/lib/options";
import { bangkokClock, bangkokTime, bangkokToday } from "@/lib/date";

function fmtTime(iso: string): string {
  return bangkokClock(iso) || "—";
}

// ตำแหน่งช่างแบบใกล้เวลาจริง + ETA ของคิวที่กำลังจะถึง
export default function TrackingPage() {
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

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ติดตามช่าง & เครื่อง</h1>
          <div className="sub">
            อัปเดตอัตโนมัติทุก 30 วินาที {updatedAt ? `· ล่าสุด ${updatedAt}` : ""}
          </div>
        </div>
        <Link href="/queue" className="btn">
          คิวงาน
        </Link>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {focusMissing ? (
        <div className="alert alert-warn" role="status">
          ไม่พบคิวที่ขอติดตาม (อาจถูกลบไปแล้ว) — แสดงคิวของวันนี้แทน
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-pad" style={{ paddingBottom: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>ตำแหน่งล่าสุดของช่าง</h2>
        </div>
        {items.length === 0 ? (
          <div className="state">ยังไม่มีช่างส่งพิกัดเข้ามา — ช่างต้องเปิดหน้ามือถือ (/m) และอนุญาตตำแหน่ง</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ช่าง</th>
                <th>พิกัด</th>
                <th>อัปเดตเมื่อ</th>
                <th>กำลังไปที่</th>
                <th>ระยะทาง</th>
                <th>คาดว่าถึงใน</th>
                <th>แผนที่</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.userId}>
                  <td>{p.userName}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                  </td>
                  <td>
                    {p.minutesAgo === 0 ? "เมื่อสักครู่" : `${p.minutesAgo} นาทีที่แล้ว`}
                    <div className="mono" style={{ fontSize: 11 }}>{fmtTime(p.at)}</div>
                  </td>
                  <td>
                    {p.destination ? (
                      <>
                        <div className="code">{p.destination.bookingNo}</div>
                        <div style={{ fontSize: 13 }}>{p.destination.customerName}</div>
                        <div className="sub">{p.destination.address}</div>
                      </>
                    ) : (
                      "— ไม่มีคิวค้าง —"
                    )}
                  </td>
                  <td className="mono">{p.destination?.distanceKm ? `${p.destination.distanceKm} กม.` : "—"}</td>
                  <td className="mono">
                    {p.destination?.status === "ARRIVED"
                      ? "ถึงแล้ว"
                      : p.destination?.etaMinutes
                        ? `${p.destination.etaMinutes} นาที`
                        : "—"}
                  </td>
                  <td>
                    <a
                      href={`https://maps.google.com/?q=${p.lat},${p.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      เปิดแผนที่
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-pad" style={{ paddingBottom: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>
            คิวของวันนี้{focusBooking && focusBooking.date !== bangkokToday() ? " + คิวที่กำลังติดตาม" : ""}
          </h2>
        </div>
        {loading ? (
          <div className="state">กำลังโหลด…</div>
        ) : active.length === 0 ? (
          <div className="state">ไม่มีคิววันนี้</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>เลขคิว</th>
                <th>เวลา</th>
                <th>ลูกค้า</th>
                <th>ช่าง</th>
                <th>สถานะ</th>
                <th>เวลาจริง</th>
                <th>ETA</th>
              </tr>
            </thead>
            <tbody>
              {active.map((b) => (
                <tr key={b.id} className={b.id === focusId ? "row-focus" : undefined}>
                  <td className="code">
                    {b.bookingNo}
                    {b.id === focusId ? (
                      <span className="pill" style={{ marginLeft: 6 }}>
                        กำลังติดตาม
                      </span>
                    ) : null}
                    {b.date && b.date !== bangkokToday() ? (
                      <div className="sub">คิววันที่ {b.date}</div>
                    ) : null}
                  </td>
                  <td className="mono">{b.start}–{b.end}</td>
                  <td>
                    {b.customerName}
                    <div className="sub">{b.address}</div>
                  </td>
                  <td>{b.techName}</td>
                  <td>{bookingStatusLabel[b.status]}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {b.startedAt ? <div>ออกเดินทาง {fmtTime(b.startedAt)}</div> : null}
                    {b.arrivedAt ? <div>ถึงหน้างาน {fmtTime(b.arrivedAt)}</div> : null}
                    {b.doneAt ? <div>ปิดงาน {fmtTime(b.doneAt)}</div> : null}
                  </td>
                  <td>
                    {etas[b.id] ? (
                      <span style={{ fontSize: 13 }}>{etas[b.id].message}</span>
                    ) : (
                      <button className="btn" style={{ padding: "4px 10px" }} onClick={() => loadEta(b)}>
                        คำนวณ ETA
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
