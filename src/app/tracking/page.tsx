"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { Booking, BookingEta, TechnicianPosition } from "@/lib/types";
import { bookingStatusLabel } from "@/lib/options";
import { bangkokTime, bangkokToday } from "@/lib/date";

function fmtTime(iso: string): string {
  return iso ? iso.slice(11, 16) : "—";
}

// ตำแหน่งช่างแบบใกล้เวลาจริง + ETA ของคิวที่กำลังจะถึง
export default function TrackingPage() {
  const [items, setItems] = useState<TechnicianPosition[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [etas, setEtas] = useState<Record<string, BookingEta>>({});
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState("");

  const load = useCallback(async () => {
    try {
      const today = bangkokToday();
      const [pos, bk] = await Promise.all([
        api.technicianPositions(12),
        api.listBookings({ from: today, to: today }),
      ]);
      setItems(pos.items);
      setBookings(bk.items);
      setUpdatedAt(bangkokTime()); // เวลาไทย ไม่ใช่ UTC
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000); // รีเฟรชทุก 30 วินาที
    return () => clearInterval(t);
  }, [load]);

  const loadEta = async (b: Booking) => {
    try {
      const eta = await api.bookingEta(b.id);
      setEtas((prev) => ({ ...prev, [b.id]: eta }));
    } catch {
      /* ignore */
    }
  };

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
                        <div style={{ fontSize: 12, color: "#6b7a86" }}>{p.destination.address}</div>
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
          <h2 style={{ margin: 0, fontSize: 16 }}>คิวของวันนี้</h2>
        </div>
        {active.length === 0 ? (
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
                <tr key={b.id}>
                  <td className="code">{b.bookingNo}</td>
                  <td className="mono">{b.start}–{b.end}</td>
                  <td>
                    {b.customerName}
                    <div style={{ fontSize: 12, color: "#6b7a86" }}>{b.address}</div>
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
