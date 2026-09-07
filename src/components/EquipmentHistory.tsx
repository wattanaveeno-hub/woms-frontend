"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { Equipment, EquipmentEvent, MoveEquipmentValues, Options } from "@/lib/types";
import { equipmentEventLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";

function fmt(at: string): string {
  return at ? at.slice(0, 16).replace("T", " ") : "—";
}

export interface EquipmentHistoryProps {
  equipment: Equipment;
  options: Options;
  onMoved: (updated: Equipment) => void;
}

// ประวัติเครื่อง + ฟอร์มย้ายที่อยู่ (บันทึกประวัติให้อัตโนมัติ)
export default function EquipmentHistory({ equipment, options, onMoved }: EquipmentHistoryProps) {
  const { has } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<EquipmentEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<MoveEquipmentValues>({
    location: equipment.location,
    address: equipment.address,
    district: equipment.district,
    province: equipment.province,
    postcode: equipment.postcode,
    zone: equipment.zone,
    lat: equipment.lat,
    lng: equipment.lng,
    note: "",
  });

  const load = useCallback(async () => {
    try {
      const res = await api.equipmentHistory(equipment.id);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดประวัติไม่สำเร็จ");
    }
  }, [equipment.id]);

  useEffect(() => {
    load();
  }, [load]);

  const set = <K extends keyof MoveEquipmentValues>(k: K, v: MoveEquipmentValues[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  // ดึงพิกัดปัจจุบันจากมือถือ/เบราว์เซอร์
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set("lat", Number(pos.coords.latitude.toFixed(6)));
        set("lng", Number(pos.coords.longitude.toFixed(6)));
        toast.success("ดึงพิกัดปัจจุบันแล้ว");
      },
      () => toast.error("ดึงพิกัดไม่สำเร็จ — ตรวจสอบการอนุญาตตำแหน่ง")
    );
  };

  const submit = async () => {
    setBusy(true);
    try {
      const updated = await api.moveEquipment(equipment.id, form, equipment.updatedAt);
      onMoved(updated);
      setOpen(false);
      toast.success("ย้ายเครื่องและบันทึกประวัติแล้ว");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ย้ายเครื่องไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad" style={{ marginTop: 18 }}>
      <div className="toolbar" style={{ marginTop: 0, justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>ประวัติเครื่อง</h2>
        {has("equipment:edit") ? (
          <button className="btn" onClick={() => setOpen((o) => !o)}>
            {open ? "ปิดฟอร์มย้าย" : "ย้ายเครื่อง / อัปเดตที่อยู่"}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="form-grid" style={{ marginTop: 14 }}>
          <div className="field">
            <label>สถานที่ / ไซต์</label>
            <input className="input" value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} />
          </div>
          <div className="field">
            <label>โซนบริการ</label>
            <input className="input" list="move-zone-options" value={form.zone ?? ""} onChange={(e) => set("zone", e.target.value)} />
            <datalist id="move-zone-options">
              {(options.zones ?? []).map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </div>
          <div className="field col-span">
            <label>ที่อยู่</label>
            <input className="input" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="field">
            <label>อำเภอ / เขต</label>
            <input className="input" value={form.district ?? ""} onChange={(e) => set("district", e.target.value)} />
          </div>
          <div className="field">
            <label>จังหวัด</label>
            <input className="input" value={form.province ?? ""} onChange={(e) => set("province", e.target.value)} />
          </div>
          <div className="field">
            <label>รหัสไปรษณีย์</label>
            <input className="input" inputMode="numeric" maxLength={5} value={form.postcode ?? ""} onChange={(e) => set("postcode", e.target.value)} />
          </div>
          <div className="field">
            <label>พิกัด (lat / lng)</label>
            <div className="toolbar" style={{ marginTop: 0 }}>
              <input className="input" type="number" step="any" value={form.lat ?? 0} onChange={(e) => set("lat", Number(e.target.value))} />
              <input className="input" type="number" step="any" value={form.lng ?? 0} onChange={(e) => set("lng", Number(e.target.value))} />
              <button className="btn" type="button" onClick={useMyLocation}>ตำแหน่งฉัน</button>
            </div>
          </div>
          <div className="field col-span">
            <label>เหตุผล / หมายเหตุการย้าย</label>
            <input className="input" value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} placeholder="เช่น ย้ายไปติดตั้งที่สาขาใหม่ตามใบงาน JOB-2026-0012" />
          </div>
          <div className="field col-span">
            <button className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy ? "กำลังบันทึก…" : "บันทึกการย้าย"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="alert alert-error" style={{ marginTop: 14 }}>{error}</div> : null}

      {!items ? (
        <div className="state">กำลังโหลดประวัติ…</div>
      ) : items.length === 0 ? (
        <div className="state">ยังไม่มีประวัติของเครื่องนี้</div>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 14 }}>
          <table className="table">
            <thead>
              <tr>
                <th>เวลา</th>
                <th>รายการ</th>
                <th>สถานะ</th>
                <th>ที่อยู่</th>
                <th>อ้างอิง</th>
                <th>ผู้ทำรายการ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((ev) => (
                <tr key={ev.id}>
                  <td className="mono">{fmt(ev.at)}</td>
                  <td>{equipmentEventLabel[ev.type] ?? ev.label}</td>
                  <td>
                    {ev.fromStatus || ev.toStatus
                      ? `${ev.fromStatus || "—"} → ${ev.toStatus || "—"}`
                      : "—"}
                  </td>
                  <td>
                    {ev.toLocation || ev.fromLocation ? (
                      <>
                        {ev.fromLocation ? <div style={{ color: "#6b7a86" }}>จาก: {ev.fromLocation}</div> : null}
                        {ev.toLocation ? <div>ไป: {ev.toLocation}</div> : null}
                        {ev.lat || ev.lng ? (
                          <div className="mono" style={{ fontSize: 12 }}>
                            {ev.lat}, {ev.lng}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {ev.refId ? <span className="code">{ev.refId}</span> : "—"}
                    {ev.note ? <div style={{ fontSize: 12, color: "#6b7a86" }}>{ev.note}</div> : null}
                  </td>
                  <td>{ev.byName || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
