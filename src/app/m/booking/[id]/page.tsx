"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useTechLocation } from "@/lib/useTechLocation";
import type { Booking, BookingStatus, Equipment, GeofenceResult } from "@/lib/types";
import { bookingStatusLabel, bookingTypeLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";

// รายละเอียดคิวสำหรับช่างบนมือถือ: อัปเดตสถานะ นำทาง และตรวจว่าเครื่องอยู่ตามสัญญาไหม
export default function MobileBookingPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [b, setB] = useState<Booking | null>(null);
  const loc = useTechLocation(id, b?.jobId ?? "");
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [check, setCheck] = useState<GeofenceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const booking = await api.getBooking(id);
      setB(booking);
      if (booking.serial) {
        const res = await api.listEquipment({ q: booking.serial });
        setEquipment(res.items.find((e) => e.serial === booking.serial) ?? null);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatusOf = async (next: BookingStatus) => {
    if (!b) return;
    setBusy(true);
    try {
      const updated = await api.setBookingStatus(b.id, next, { lat: loc.lat, lng: loc.lng });
      setB(updated);
      if (loc.sharing) loc.sendNow();
      toast.success(bookingStatusLabel[next]);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "อัปเดตไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  // ตรวจว่าเครื่องยังอยู่ที่ที่อยู่ตามสัญญาไหม โดยใช้พิกัดปัจจุบันของช่างที่หน้างาน
  const verifyLocation = async () => {
    if (!equipment) return toast.error("ไม่พบเครื่องในระบบสำหรับ serial นี้");
    if (!navigator.geolocation) return toast.error("อุปกรณ์นี้ไม่รองรับ GPS");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await api.checkEquipmentLocation(equipment.id, {
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
            note: b ? `ตรวจจากคิว ${b.bookingNo}` : "",
          });
          setCheck(res);
          res.matched ? toast.success(res.message) : toast.error(res.message);
        } catch (e) {
          toast.error(e instanceof ApiError ? e.message : "ตรวจสอบไม่สำเร็จ");
        } finally {
          setBusy(false);
        }
      },
      () => {
        toast.error("อ่านตำแหน่งไม่ได้ — ตรวจการอนุญาตตำแหน่ง");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 20_000 }
    );
  };

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!b) return <div className="state">กำลังโหลด…</div>;

  return (
    <div className="m-wrap">
      <div className="m-head">
        <div>
          <div className="code">{b.bookingNo}</div>
          <div className="m-title">{bookingTypeLabel[b.type]}</div>
          <div className="m-sub">{bookingStatusLabel[b.status]}</div>
        </div>
        <Link href="/m" className="btn">
          ← กลับ
        </Link>
      </div>

      <div className="m-card">
        <div className="m-kv">
          <div className="k">ลูกค้า</div>
          <div>{b.customerName}</div>
          <div className="k">โทร</div>
          <div>{b.phone || "—"}</div>
          <div className="k">วัน/เวลา</div>
          <div className="mono">
            {b.date} {b.start}–{b.end}
          </div>
          <div className="k">ที่อยู่</div>
          <div>{b.address || "—"}</div>
          <div className="k">โซน</div>
          <div>{b.zone || "—"}</div>
          <div className="k">เครื่อง</div>
          <div>{b.serial || "—"}</div>
          <div className="k">สัญญา</div>
          <div>{b.contractNo || "—"}</div>
          <div className="k">ใบงาน</div>
          <div>{b.jobId || "— ยังไม่เปิด —"}</div>
          {b.note ? (
            <>
              <div className="k">หมายเหตุ</div>
              <div>{b.note}</div>
            </>
          ) : null}
        </div>

        <div className="m-actions">
          {b.lat || b.lng ? (
            <a className="btn" href={`https://maps.google.com/?q=${b.lat},${b.lng}`} target="_blank" rel="noopener noreferrer">
              นำทาง
            </a>
          ) : null}
          {b.phone ? (
            <a className="btn" href={`tel:${b.phone}`}>
              โทร
            </a>
          ) : null}
          {b.jobId ? (
            <Link className="btn" href={`/m/job/${encodeURIComponent(b.jobId)}`}>
              ปิดใบงาน
            </Link>
          ) : null}
        </div>
      </div>

      <div className="m-card">
        <strong>อัปเดตสถานะ</strong>
        <div className="m-actions">
          <button className="btn btn-primary" onClick={() => setStatusOf("ON_THE_WAY")} disabled={busy || b.status !== "BOOKED"}>
            ออกเดินทาง
          </button>
          <button className="btn btn-primary" onClick={() => setStatusOf("ARRIVED")} disabled={busy || b.status !== "ON_THE_WAY"}>
            ถึงหน้างาน
          </button>
          <button className="btn btn-primary" onClick={() => setStatusOf("DONE")} disabled={busy || b.status === "DONE" || b.status === "CANCELLED"}>
            ปิดคิว
          </button>
        </div>
        <div className="m-sub" style={{ marginTop: 8 }}>
          {b.startedAt ? `ออกเดินทาง ${b.startedAt.slice(11, 16)} · ` : ""}
          {b.arrivedAt ? `ถึงหน้างาน ${b.arrivedAt.slice(11, 16)} · ` : ""}
          {b.doneAt ? `ปิดคิว ${b.doneAt.slice(11, 16)}` : ""}
        </div>
      </div>

      {b.serial ? (
        <div className="m-card">
          <strong>ตรวจตำแหน่งเครื่อง {b.serial}</strong>
          <div className="m-sub">เทียบพิกัดปัจจุบันกับที่อยู่ติดตั้งตามสัญญา แล้วบันทึกเป็นประวัติของเครื่อง</div>
          <div className="m-actions">
            <button className="btn btn-primary" onClick={verifyLocation} disabled={busy || !equipment}>
              ตรวจว่าเครื่องอยู่ที่เดิมไหม
            </button>
          </div>
          {check ? (
            <div className={`alert ${check.matched ? "alert-ok" : "alert-error"}`} style={{ marginTop: 10 }}>
              {check.message}
              <div className="m-sub">
                ที่อยู่ตามสัญญา: {check.siteAddress || "—"}
                {check.contractNo ? ` · ${check.contractNo}` : ""}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
