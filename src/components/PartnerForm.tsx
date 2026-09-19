"use client";

import { useEffect, useState } from "react";
import type { PartnerFormValues, PartnerType } from "@/lib/types";
import { partnerTypeLabel } from "@/lib/options";
import { useFieldErrors } from "@/components/FieldErrors";

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

/** ช่องที่ backend อาจชี้กลับมาว่าผิด */
const FIELDS = ["name", "type", "phone", "email", "taxId", "contactPerson", "address", "note"] as const;

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
  // QA BUG-001/002 — ฟอร์มนี้เคยไม่มี validation ฝั่งหน้าเว็บและไม่มี a11y binding เลย
  // กด "บันทึก" ตอนช่องบังคับว่าง แล้วหน้าจอนิ่งสนิท ไม่มี toast ไม่มี error ไม่มี request
  const err = useFieldErrors("ptn");

  // ข้อความผิดพลาดที่หน้าแม่ส่งลงมา (มาจาก API) ให้แสดงที่ช่องเดียวกัน
  useEffect(() => {
    if (fieldError?.field) err.setIssue(fieldError.field, fieldError.message);
    else if (!fieldError) err.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldError?.field, fieldError?.message]);

  const set = <K extends keyof PartnerFormValues>(k: K, val: PartnerFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const submit = () => {
    err.clear();
    if (!v.name.trim()) {
      err.setIssue("name", "ต้องระบุชื่อคู่ค้า");
      document.getElementById(err.fid("name"))?.focus();
      return;
    }
    if (v.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) {
      err.setIssue("email", "รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }
    if (v.taxId.trim() && !/^\d{13}$/.test(v.taxId.replace(/[\s-]/g, ""))) {
      err.setIssue("taxId", "เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก");
      return;
    }
    onSubmit({ ...v, name: v.name.trim() });
  };

  /** helper/error ใช้ช่องเดียวกันเสมอ ความสูงฟอร์มจึงไม่กระตุกตอน error ปรากฏ (B-05) */
  const slot = (field: (typeof FIELDS)[number], hint: string) =>
    err.errFor(field) ?? <span className="field-hint">{hint || " "}</span>;

  return (
    <div>
      {fieldError && !fieldError.field ? (
        <div className="alert alert-error" role="alert">
          {fieldError.message}
        </div>
      ) : null}

      <div className="form-grid">
        <div className="field col-span">
          <label htmlFor={err.fid("name")}>
            ชื่อคู่ค้า<span className="req">*</span>
          </label>
          <input
            id={err.fid("name")}
            {...err.aria("name")}
            required
            className="input"
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
          />
          {slot("name", "ชื่อที่ใช้ค้นหาและแสดงในใบงาน/สัญญา")}
        </div>

        <div className="field">
          <label htmlFor={err.fid("type")}>ประเภท</label>
          <select
            id={err.fid("type")}
            {...err.aria("type")}
            className="select"
            value={v.type}
            onChange={(e) => set("type", e.target.value as PartnerType)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {partnerTypeLabel[t]}
              </option>
            ))}
          </select>
          {slot("type", "เลือก BOTH เมื่อเป็นทั้งลูกค้าและผู้ขาย")}
        </div>

        <div className="field">
          <label htmlFor={err.fid("contactPerson")}>ผู้ติดต่อ</label>
          <input
            id={err.fid("contactPerson")}
            {...err.aria("contactPerson")}
            className="input"
            value={v.contactPerson}
            onChange={(e) => set("contactPerson", e.target.value)}
          />
          {slot("contactPerson", "")}
        </div>

        <div className="field">
          <label htmlFor={err.fid("phone")}>เบอร์โทร</label>
          <input
            id={err.fid("phone")}
            {...err.aria("phone")}
            className="input"
            value={v.phone}
            onChange={(e) => set("phone", e.target.value)}
            inputMode="tel"
          />
          {slot("phone", "ใช้ค้นหาลูกค้าที่หน้า /customers ได้")}
        </div>

        <div className="field">
          <label htmlFor={err.fid("email")}>อีเมล</label>
          <input
            id={err.fid("email")}
            {...err.aria("email")}
            className="input"
            value={v.email}
            onChange={(e) => set("email", e.target.value)}
            inputMode="email"
          />
          {slot("email", "")}
        </div>

        <div className="field">
          <label htmlFor={err.fid("taxId")}>เลขผู้เสียภาษี</label>
          <input
            id={err.fid("taxId")}
            {...err.aria("taxId")}
            className="input"
            value={v.taxId}
            onChange={(e) => set("taxId", e.target.value)}
            inputMode="numeric"
            placeholder="13 หลัก"
          />
          {slot("taxId", "ตัวเลข 13 หลัก — ใช้พิมพ์ลงเอกสารการขาย")}
        </div>

        <div className="field" aria-hidden />

        <div className="field col-span">
          <label htmlFor={err.fid("address")}>ที่อยู่</label>
          <textarea
            id={err.fid("address")}
            {...err.aria("address")}
            className="textarea"
            value={v.address}
            onChange={(e) => set("address", e.target.value)}
          />
          {slot("address", "")}
        </div>

        <div className="field col-span">
          <label htmlFor={err.fid("note")}>หมายเหตุ</label>
          <textarea
            id={err.fid("note")}
            {...err.aria("note")}
            className="textarea"
            value={v.note}
            onChange={(e) => set("note", e.target.value)}
          />
          {slot("note", "")}
        </div>
      </div>

      <div className="toolbar">
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? "กำลังบันทึก…" : submitLabel}
        </button>
        {extraActions}
      </div>
    </div>
  );
}
