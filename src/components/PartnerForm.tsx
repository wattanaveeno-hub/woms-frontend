"use client";

import { useState } from "react";
import type { PartnerFormValues, PartnerType } from "@/lib/types";
import { partnerTypeLabel } from "@/lib/options";

const TYPES: PartnerType[] = ["CUSTOMER", "SUPPLIER", "BOTH"];

const EMPTY: PartnerFormValues = {
  name: "",
  type: "CUSTOMER",
  phone: "",
  email: "",
  address: "",
  taxId: "",
  contactPerson: "",
  note: "",
};

export interface PartnerFormProps {
  initial?: Partial<PartnerFormValues>;
  submitLabel: string;
  fieldError?: { field?: string; message: string } | null;
  busy?: boolean;
  onSubmit: (values: PartnerFormValues) => void;
  extraActions?: React.ReactNode;
}

export default function PartnerForm({
  initial,
  submitLabel,
  fieldError,
  busy,
  onSubmit,
  extraActions,
}: PartnerFormProps) {
  const [v, setV] = useState<PartnerFormValues>({ ...EMPTY, ...initial });

  const set = <K extends keyof PartnerFormValues>(k: K, val: PartnerFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const errFor = (field: string) =>
    fieldError && fieldError.field === field ? (
      <span className="field-error">{fieldError.message}</span>
    ) : null;

  return (
    <div>
      {fieldError && !fieldError.field ? (
        <div className="alert alert-error">{fieldError.message}</div>
      ) : null}

      <div className="form-grid">
        <div className="field col-span">
          <label>
            ชื่อคู่ค้า<span className="req">*</span>
          </label>
          <input className="input" value={v.name} onChange={(e) => set("name", e.target.value)} />
          {errFor("name")}
        </div>

        <div className="field">
          <label>ประเภท</label>
          <select className="select" value={v.type} onChange={(e) => set("type", e.target.value as PartnerType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {partnerTypeLabel[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>ผู้ติดต่อ</label>
          <input className="input" value={v.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} />
        </div>

        <div className="field">
          <label>เบอร์โทร</label>
          <input className="input" value={v.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
          {errFor("phone")}
        </div>

        <div className="field">
          <label>อีเมล</label>
          <input className="input" value={v.email} onChange={(e) => set("email", e.target.value)} inputMode="email" />
          {errFor("email")}
        </div>

        <div className="field">
          <label>เลขผู้เสียภาษี</label>
          <input
            className="input"
            value={v.taxId}
            onChange={(e) => set("taxId", e.target.value)}
            inputMode="numeric"
            placeholder="13 หลัก"
          />
          {errFor("taxId")}
        </div>

        <div className="field" aria-hidden />

        <div className="field col-span">
          <label>ที่อยู่</label>
          <textarea className="textarea" value={v.address} onChange={(e) => set("address", e.target.value)} />
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
