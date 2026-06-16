"use client";

import { useState } from "react";
import type { EquipmentFormValues, EquipmentStatus, Options } from "@/lib/types";
import { equipmentStatusLabel } from "@/lib/options";

const STATUSES: EquipmentStatus[] = ["IN_STOCK", "RENTED", "SOLD", "REPAIR", "RETIRED"];

const EMPTY: EquipmentFormValues = {
  serial: "",
  model: "",
  category: "",
  status: "IN_STOCK",
  customerName: "",
  location: "",
  inboundDate: "",
  lat: 0,
  lng: 0,
  supplierWarrantyStart: "",
  supplierWarrantyMonths: 0,
  customerWarrantyStart: "",
  customerWarrantyMonths: 0,
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
  const [v, setV] = useState<EquipmentFormValues>({ ...EMPTY, ...initial });
  const [mapLink, setMapLink] = useState("");

  const set = <K extends keyof EquipmentFormValues>(k: K, val: EquipmentFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const numMonths = (s: string) => (s === "" ? 0 : Number(s));

  const errFor = (field: string) =>
    fieldError && fieldError.field === field ? (
      <span className="field-error">{fieldError.message}</span>
    ) : null;

  const applyLink = () => {
    const r = parseLatLng(mapLink);
    if (r) setV((prev) => ({ ...prev, lat: r.lat, lng: r.lng }));
  };

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
          <label>สถานที่ / หน้างาน</label>
          <input className="input" value={v.location} onChange={(e) => set("location", e.target.value)} />
        </div>

        <div className="field">
          <label>วันที่รับเข้าคลัง</label>
          <input className="input" type="date" value={v.inboundDate} onChange={(e) => set("inboundDate", e.target.value)} />
          {errFor("inboundDate")}
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

        <div className="field col-span">
          <label style={{ fontWeight: 700 }}>ประกันจากซัพพลายเออร์ (Supplier)</label>
        </div>
        <div className="field">
          <label>วันเริ่มประกันซัพพลายเออร์</label>
          <input className="input" type="date" value={v.supplierWarrantyStart} onChange={(e) => set("supplierWarrantyStart", e.target.value)} />
          {errFor("supplierWarrantyStart")}
        </div>
        <div className="field">
          <label>ระยะประกันซัพพลายเออร์ (เดือน)</label>
          <input className="input" type="number" min={0} inputMode="numeric" value={v.supplierWarrantyMonths} onChange={(e) => set("supplierWarrantyMonths", numMonths(e.target.value))} />
          {errFor("supplierWarrantyMonths")}
        </div>

        <div className="field col-span">
          <label style={{ fontWeight: 700 }}>ประกันที่ให้ลูกค้า (Customer)</label>
        </div>
        <div className="field">
          <label>วันเริ่มประกันลูกค้า</label>
          <input className="input" type="date" value={v.customerWarrantyStart} onChange={(e) => set("customerWarrantyStart", e.target.value)} />
          {errFor("customerWarrantyStart")}
        </div>
        <div className="field">
          <label>ระยะประกันลูกค้า (เดือน)</label>
          <input className="input" type="number" min={0} inputMode="numeric" value={v.customerWarrantyMonths} onChange={(e) => set("customerWarrantyMonths", numMonths(e.target.value))} />
          {errFor("customerWarrantyMonths")}
        </div>

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
