"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { Booking, BookingStatus, BookingType } from "@/lib/types";
import { bookingStatusLabel, bookingTypeLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";
import { addDaysISO, bangkokToday } from "@/lib/date";

const TYPES: BookingType[] = ["DELIVERY", "REPAIR", "INSTALL", "PM", "PICKUP"];
const STATUSES: BookingStatus[] = ["BOOKED", "ON_THE_WAY", "ARRIVED", "DONE", "CANCELLED"];

const STATUS_CLASS: Record<BookingStatus, string> = {
  BOOKED: "badge-open",
  ON_THE_WAY: "badge-rented",
  ARRIVED: "badge-active",
  DONE: "badge-completed",
  CANCELLED: "badge-cancelled",
};

// "วันนี้" ตามเวลาไทย — ตัวช่วยกลางที่ lib/date.ts (ห้ามคำนวณจาก UTC หรือเขตเวลาเครื่อง)
const today = bangkokToday;

const addDays = addDaysISO;

export default function QueuePage() {
  const { has } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Booking[]>([]);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(addDays(today(), 14));
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [type, setType] = useState<BookingType | "">("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listBookings({
        from,
        to,
        status: status || undefined,
        type: type || undefined,
        q: q || undefined,
      });
      setItems(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [from, to, status, type, q]);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async (b: Booking) => {
    const reason = prompt(`เหตุผลการยกเลิกคิว ${b.bookingNo}:`);
    if (reason === null) return;
    try {
      await api.setBookingStatus(b.id, "CANCELLED", { reason });
      toast.success(`ยกเลิกคิว ${b.bookingNo} แล้ว`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ยกเลิกไม่สำเร็จ");
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>คิวจัดส่ง / คิวซ่อม</h1>
          <div className="sub">{items.length} คิว ระหว่าง {from} ถึง {to}</div>
        </div>
        <div className="head-actions">
          <Link href="/queue/slots" className="btn">
            ตาราง slot ช่าง
          </Link>
          {has("queue:book") ? (
            <Link href="/queue/new" className="btn btn-primary">
              จองคิว
            </Link>
          ) : null}
        </div>
      </div>

      <div className="toolbar" style={{ marginTop: 0, marginBottom: 14 }}>
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value as BookingStatus | "")}>
          <option value="">ทุกสถานะ</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {bookingStatusLabel[s]}
            </option>
          ))}
        </select>
        <select className="select" value={type} onChange={(e) => setType(e.target.value as BookingType | "")}>
          <option value="">ทุกประเภท</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {bookingTypeLabel[t]}
            </option>
          ))}
        </select>
        <input
          className="input"
          style={{ flex: 1, minWidth: 180 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาเลขคิว / ลูกค้า / ที่อยู่ / serial"
        />
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card">
        {loading ? (
          <div className="state">กำลังโหลด…</div>
        ) : items.length === 0 ? (
          <div className="state">ไม่มีคิวในช่วงเวลานี้</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>เลขคิว</th>
                <th>วัน/เวลา</th>
                <th>ประเภท</th>
                <th>ลูกค้า</th>
                <th>โซน / ที่อยู่</th>
                <th>ช่าง</th>
                <th>สถานะ</th>
                <th style={{ textAlign: "right" }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id}>
                  <td className="code">{b.bookingNo}</td>
                  <td className="mono" style={{ fontSize: 13 }}>
                    {b.date}
                    <div>{b.start}–{b.end}</div>
                  </td>
                  <td>{bookingTypeLabel[b.type]}</td>
                  <td>
                    {b.customerName}
                    {b.phone ? <div style={{ fontSize: 12, color: "#6b7a86" }}>{b.phone}</div> : null}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {b.zone ? <div>{b.zone}</div> : null}
                    {b.address}
                  </td>
                  <td>{b.techName}</td>
                  <td>
                    <span className={`badge ${STATUS_CLASS[b.status]}`}>{bookingStatusLabel[b.status]}</span>
                    {b.jobId ? <div className="mono" style={{ fontSize: 11 }}>{b.jobId}</div> : null}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <Link href={`/tracking?booking=${b.id}`} className="btn" style={{ padding: "4px 10px" }}>
                      ติดตาม
                    </Link>{" "}
                    {has("queue:book") && b.status !== "DONE" && b.status !== "CANCELLED" ? (
                      <button className="btn btn-danger" style={{ padding: "4px 10px" }} onClick={() => cancel(b)}>
                        ยกเลิก
                      </button>
                    ) : null}
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
