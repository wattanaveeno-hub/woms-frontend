"use client";

import { useState } from "react";
import type {
  EquipmentFormValues,
  EquipmentStatus,
  Options,
  Warranty,
  WarrantyProvider,
} from "@/lib/types";
import { equipmentStatusLabel, warrantyProviderLabel } from "@/lib/options";

const STATUSES: EquipmentStatus[] = ["IN_STOCK", "RENTED", "SOLD", "REPAIR", "RETIRED"];
const PROVIDERS: WarrantyProvider[] = ["BRAND", "AGENT", "OTHER"];

const EMPTY: EquipmentFormValues = {
  serial: "",
  model: "",
  category: "",
  status: "IN_STOCK",
  customerName: "",
  location: "",
  address: "",
  district: "",
  province: "",
  postcode: "",
  zone: "",
  inboundDate: "",
  lat: 0,
  lng: 0,
  warranties: [],
  note: "",
};

const EMPTY_WARRANTY: Warranty = {
  provider: "BRAND",
  providerName: "",
  start: "",
  months: 12,
  coverage: "",
  note: "",
};

function parseLatLng(s: string): { lat: number; lng: number } | null {
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  }
  return null;
}

// วันหมดประกัน = วันเริ่ม + จำนวนเดือน (คำนวณฝั่ง client เพื่อแสดงตัวอย่างทันที)
function warrantyEnd(start: string, months: number): string {
  if (!start || !months) return "—";
  const [y, m, d] = start.split("-").map(Number);
  if (!y || !m || !d) return "—";
  const t = new Date(Date.UTC(y, m - 1 + months, d));
  if (t.getUTCDate() !== d) t.setUTCDate(0);
  return t.toISOString().slice(0, 10);
}

export interface EquipmentFormProps {
  options: Options;
  initial?: Partial<EquipmentFormValues>;
  submitLabel: string;
  fieldError?: { field?: string; message: string } | null;
  busy?: boolean;
  onSubmit: (values: EquipmentFormValues) => void;
  extraActions?: React.ReactNode;
}

export default function EquipmentForm({
  options,
  initial,
  submitLabel,
  fieldError,
  busy,
  onSubmit,
  extraActions,
}: EquipmentFormProps) {
  const [v, setV] = useState<EquipmentFormValues>({
    ...EMPTY,
    ...initial,
    warranties: (initial?.warranties ?? []).map((w) => ({ ...w })),
  });
  const [mapLink, setMapLink] = useState("");

  const set = <K extends keyof EquipmentFormValues>(k: K, val: EquipmentFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const errFor = (field: string) =>
    fieldError && fieldError.field === field ? (
      <span className="field-error">{fieldError.message}</span>
    ) : null;

  const applyLink = () => {
    const r = parseLatLng(mapLink);
    if (r) setV((prev) => ({ ...prev, lat: r.lat, lng: r.lng }));
  };

  // ---- ประกัน (หลายชุดต่อเครื่อง) ----
  const addWarranty = (provider: WarrantyProvider) =>
    setV((prev) => ({ ...prev, warranties: [...prev.warranties, { ...EMPTY_WARRANTY, provider }] }));

  const setWarranty = <K extends keyof Warranty>(i: number, k: K, val: Warranty[K]) =>
    setV((prev) => ({
      ...prev,
      warranties: prev.warranties.map((w, idx) => (idx === i ? { ...w, [k]: val } : w)),
    }));

  const removeWarranty = (i: number) =>
    setV((prev) => ({ ...prev, warranties: prev.warranties.filter((_, idx) => idx !== i) }));

  return (
    <div>
      {fieldError && !fieldError.field ? (
        <div className="alert alert-error">{fieldError.message}</div>
      ) : null}

      <div className="form-grid">
        <div className="field">
          <label>
            Serial<span className="req">*</span>
          </label>
          <input className="input" value={v.serial} onChange={(e) => set("serial", e.target.value)} placeholder="เลขเครื่อง / serial" />
          {errFor("serial")}
        </div>

        <div className="field">
          <label>
            รุ่นเครื่อง<span className="req">*</span>
          </label>
          <input className="input" list="equip-model-options" value={v.model} onChange={(e) => set("model", e.target.value)} />
          <datalist id="equip-model-options">
            {options.models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          {errFor("model")}
        </div>

        <div className="field">
          <label>หมวดหมู่</label>
          <input className="input" value={v.category} onChange={(e) => set("category", e.target.value)} placeholder="เช่น เครื่องกรองน้ำ, อะไหล่" />
        </div>

        <div className="field">
          <label>สถานะ</label>
          <select className="select" value={v.status} onChange={(e) => set("status", e.target.value as EquipmentStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {equipmentStatusLabel[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>ลูกค้า / ผู้ถือครอง</label>
          <input className="input" value={v.customerName} onChange={(e) => set("customerName", e.target.value)} placeholder="เว้นว่างถ้าอยู่ในคลัง" />
        </div>

        <div className="field">
          <label>วันที่รับเข้าคลัง</label>
          <input className="input" type="date" value={v.inboundDate} onChange={(e) => set("inboundDate", e.target.value)} />
          {errFor("inboundDate")}
        </div>

        {/* ---- ที่อยู่ปัจจุบันของเครื่อง ---- */}
        <div className="field col-span">
          <label style={{ fontWeight: 700 }}>ที่อยู่ปัจจุบันของเครื่อง</label>
        </div>

        <div className="field">
          <label>สถานที่ / ไซต์</label>
          <input className="input" value={v.location} onChange={(e) => set("location", e.target.value)} placeholder="เช่น คลังหลัก, สาขาลาดพร้าว" />
        </div>

        <div className="field">
          <label>โซนบริการ</label>
          <input className="input" list="equip-zone-options" value={v.zone} onChange={(e) => set("zone", e.target.value)} placeholder="ใช้จัดคิวช่าง" />
          <datalist id="equip-zone-options">
            {(options.zones ?? []).map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </div>

        <div className="field col-span">
          <label>ที่อยู่ (บ้านเลขที่ ถนน แขวง)</label>
          <input className="input" value={v.address} onChange={(e) => set("address", e.target.value)} />
          {errFor("address")}
        </div>

        <div className="field">
          <label>อำเภอ / เขต</label>
          <input className="input" value={v.district} onChange={(e) => set("district", e.target.value)} />
        </div>

        <div className="field">
          <label>จังหวัด</label>
          <input className="input" value={v.province} onChange={(e) => set("province", e.target.value)} />
        </div>

        <div className="field">
          <label>รหัสไปรษณีย์</label>
          <input className="input" inputMode="numeric" maxLength={5} value={v.postcode} onChange={(e) => set("postcode", e.target.value)} />
          {errFor("postcode")}
        </div>

        <div className="field" aria-hidden />

        <div className="field col-span">
          <label>พิกัดแผนที่ (วางลิงก์ Google Maps แล้วกดดึง)</label>
          <div className="toolbar" style={{ marginTop: 0 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              value={mapLink}
              onChange={(e) => setMapLink(e.target.value)}
              placeholder="วางลิงก์ Google Maps หรือ 13.7563,100.5018"
            />
            <button className="btn" type="button" onClick={applyLink}>ดึงพิกัด</button>
          </div>
        </div>

        <div className="field">
          <label>ละติจูด (lat)</label>
          <input className="input" type="number" step="any" value={v.lat} onChange={(e) => set("lat", e.target.value === "" ? 0 : Number(e.target.value))} />
          {errFor("lat")}
        </div>

        <div className="field">
          <label>ลองจิจูด (lng)</label>
          <input className="input" type="number" step="any" value={v.lng} onChange={(e) => set("lng", e.target.value === "" ? 0 : Number(e.target.value))} />
          {errFor("lng")}
        </div>

        {/* ---- ประกัน (ใส่ได้หลายชุด) ---- */}
        <div className="field col-span">
          <label style={{ fontWeight: 700 }}>ประกัน (ใส่ได้หลายชุด — แบรนด์ / ตัวแทน / อื่น ๆ)</label>
          <div className="toolbar" style={{ marginTop: 0 }}>
            {PROVIDERS.map((p) => (
              <button key={p} className="btn" type="button" onClick={() => addWarranty(p)}>
                + {warrantyProviderLabel[p]}
              </button>
            ))}
          </div>
          {errFor("warranties")}
        </div>

        {v.warranties.length === 0 ? (
          <div className="field col-span">
            <div className="state">ยังไม่มีข้อมูลประกัน — กดปุ่มด้านบนเพื่อเพิ่ม</div>
          </div>
        ) : null}

        {v.warranties.map((w, i) => (
          <div className="field col-span" key={i}>
            <div className="card card-pad" style={{ display: "grid", gap: 8 }}>
              <div className="toolbar" style={{ marginTop: 0, justifyContent: "space-between" }}>
                <strong>
                  {warrantyProviderLabel[w.provider]} #{i + 1}
                </strong>
                <button className="btn btn-danger" type="button" onClick={() => removeWarranty(i)}>
                  ลบ
                </button>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>ผู้รับประกัน</label>
                  <select
                    className="select"
                    value={w.provider}
                    onChange={(e) => setWarranty(i, "provider", e.target.value as WarrantyProvider)}
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p} value={p}>
                        {warrantyProviderLabel[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>ชื่อแบรนด์ / ตัวแทน</label>
                  <input className="input" value={w.providerName} onChange={(e) => setWarranty(i, "providerName", e.target.value)} />
                </div>
                <div className="field">
                  <label>วันเริ่มประกัน</label>
                  <input className="input" type="date" value={w.start} onChange={(e) => setWarranty(i, "start", e.target.value)} />
                </div>
                <div className="field">
                  <label>ระยะประกัน (เดือน)</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={w.months}
                    onChange={(e) => setWarranty(i, "months", e.target.value === "" ? 0 : Number(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label>ขอบเขตความคุ้มครอง</label>
                  <input className="input" value={w.coverage} onChange={(e) => setWarranty(i, "coverage", e.target.value)} placeholder="เช่น อะไหล่และค่าแรง" />
                </div>
                <div className="field">
                  <label>หมดประกัน (คำนวณให้)</label>
                  <input className="input" value={warrantyEnd(w.start, w.months)} readOnly />
                </div>
                <div className="field col-span">
                  <label>หมายเหตุประกัน</label>
                  <input className="input" value={w.note} onChange={(e) => setWarranty(i, "note", e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="field col-span">
          <label>หมายเหตุ</label>
          <textarea className="textarea" value={v.note} onChange={(e) => set("note", e.target.value)} />
        </div>
      </div>

      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => onSubmit(v)} disabled={busy}>
          {busy ? "กำลังบันทึก…" : submitLabel}
        </button>
        {extraActions}
      </div>
    </div>
  );
}
