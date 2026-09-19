"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { AuthUser, Options, Slot } from "@/lib/types";
import { slotStatusLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";
import { addDaysISO, bangkokToday } from "@/lib/date";

// "วันนี้" ตามเวลาไทย — ตัวช่วยกลางที่ lib/date.ts
const today = bangkokToday;
const addDays = addDaysISO;

// ตาราง slot ของช่าง — ช่างจัดการของตัวเอง, admin/manager จัดการของทุกคน
export default function SlotsPage() {
  const { user, has } = useAuth();
  const toast = useToast();
  const canManageAll = has("queue:manage");

  const [items, setItems] = useState<Slot[]>([]);
  const [techs, setTechs] = useState<AuthUser[]>([]);
  const [options, setOptions] = useState<Options | null>(null);
  const [techId, setTechId] = useState<string>("");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(addDays(today(), 14));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ฟอร์มสร้าง slot ล่วงหน้า
  const [bulkFrom, setBulkFrom] = useState(today());
  const [bulkDays, setBulkDays] = useState(7);
  const [bulkZone, setBulkZone] = useState("");
  const [bulkCapacity, setBulkCapacity] = useState(1);
  const [skipWeekend, setSkipWeekend] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = canManageAll
        ? await api.listSlots({ from, to, techId: techId || undefined })
        : await api.mySlots({ from, to });
      setItems(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [from, to, techId, canManageAll]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.getOptions().then(setOptions).catch(() => setOptions(null));
    api
      .listTechnicians()
      .then((r) => setTechs(r.items))
      .catch(() => setTechs([]));
  }, []);

  const createBulk = async () => {
    setBusy(true);
    try {
      const target = canManageAll && techId ? techs.find((t) => t.id === techId) : null;
      const res = await api.bulkCreateSlots({
        techId: target?.id,
        techName: target?.name,
        from: bulkFrom,
        days: bulkDays,
        zone: bulkZone,
        capacity: bulkCapacity,
        skipWeekend,
      });
      toast.success(`สร้าง slot ใหม่ ${res.created} ช่อง (ข้ามที่ซ้ำ ${res.skipped})`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "สร้าง slot ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (s: Slot) => {
    try {
      await api.patchSlot(s.id, { status: s.status === "OPEN" ? "BLOCKED" : "OPEN" });
      toast.success(s.status === "OPEN" ? "ปิดรับคิวแล้ว" : "เปิดรับคิวแล้ว");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "อัปเดตไม่สำเร็จ");
    }
  };

  const setCapacity = async (s: Slot) => {
    const raw = prompt(`จำนวนคิวที่รับได้ในช่วง ${s.date} ${s.start}:`, String(s.capacity));
    if (raw === null) return;
    const capacity = Number(raw);
    if (!Number.isInteger(capacity) || capacity < 1) return toast.error("จำนวนคิวไม่ถูกต้อง");
    try {
      await api.patchSlot(s.id, { capacity });
      toast.success("อัปเดตจำนวนคิวแล้ว");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "อัปเดตไม่สำเร็จ");
    }
  };

  const remove = async (s: Slot) => {
    if (!confirm(`ลบ slot ${s.date} ${s.start}–${s.end}?`)) return;
    try {
      await api.deleteSlot(s.id);
      toast.success("ลบ slot แล้ว");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ลบไม่สำเร็จ");
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ตาราง slot ช่าง</h1>
          <div className="sub">
            {canManageAll ? "จัดการ slot ของช่างทุกคน" : `slot ของ ${user?.name ?? "คุณ"}`} · {items.length} ช่อง
          </div>
        </div>
        <Link href="/queue" className="btn">
          ← คิวงาน
        </Link>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>สร้าง slot ล่วงหน้า</h2>
        <div className="form-grid">
          {canManageAll ? (
            <div className="field">
              <label>ช่าง</label>
              <select className="select" value={techId} onChange={(e) => setTechId(e.target.value)}>
                <option value="">— ตัวฉันเอง —</option>
                {techs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.team ? `(${t.team})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="field">
            <label>เริ่มวันที่</label>
            <input className="input" type="date" value={bulkFrom} onChange={(e) => setBulkFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>จำนวนวัน</label>
            <input className="input" type="number" min={1} max={60} value={bulkDays} onChange={(e) => setBulkDays(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>โซนที่รับ</label>
            <input className="input" list="slot-zone-options" value={bulkZone} onChange={(e) => setBulkZone(e.target.value)} placeholder="เว้นว่าง = ทุกโซน" />
            <datalist id="slot-zone-options">
              {(options?.zones ?? []).map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>คิวต่อช่วงเวลา</label>
            <input className="input" type="number" min={1} max={20} value={bulkCapacity} onChange={(e) => setBulkCapacity(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>ข้ามเสาร์–อาทิตย์</label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
              <input type="checkbox" checked={skipWeekend} onChange={(e) => setSkipWeekend(e.target.checked)} />
              ข้ามวันหยุดสุดสัปดาห์
            </label>
          </div>
        </div>
        <div className="toolbar">
          <button className="btn btn-primary" onClick={createBulk} disabled={busy}>
            {busy ? "กำลังสร้าง…" : "สร้าง slot (09:00–17:00 ช่วงละ 2 ชม.)"}
          </button>
        </div>
      </div>

      <div className="toolbar" style={{ marginTop: 0, marginBottom: 14 }}>
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        {canManageAll ? (
          <select className="select" value={techId} onChange={(e) => setTechId(e.target.value)}>
            <option value="">ช่างทุกคน</option>
            {techs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card">
        {loading ? (
          <div className="state">กำลังโหลด…</div>
        ) : items.length === 0 ? (
          <div className="state">ยังไม่มี slot ในช่วงนี้ — สร้างได้จากฟอร์มด้านบน</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>เวลา</th>
                <th>ช่าง</th>
                <th>โซน</th>
                <th>จอง / รับได้</th>
                <th>สถานะ</th>
                <th style={{ textAlign: "right" }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.date}</td>
                  <td className="mono">{s.start}–{s.end}</td>
                  <td>{s.techName}</td>
                  <td>{s.zone || "ทุกโซน"}</td>
                  <td className="mono">
                    {s.booked} / {s.capacity}
                  </td>
                  <td>
                    <span className={`badge ${s.status === "OPEN" ? "badge-completed" : "badge-cancelled"}`}>
                      {slotStatusLabel[s.status]}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn" style={{ padding: "4px 10px" }} onClick={() => setCapacity(s)}>
                      จำนวนคิว
                    </button>{" "}
                    <button className="btn" style={{ padding: "4px 10px" }} onClick={() => toggle(s)}>
                      {s.status === "OPEN" ? "ปิดรับ" : "เปิดรับ"}
                    </button>{" "}
                    <button className="btn btn-danger" style={{ padding: "4px 10px" }} onClick={() => remove(s)} disabled={s.booked > 0}>
                      ลบ
                    </button>
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
