"use client";

import { useState } from "react";
import type { Partner, QuotationFormValues, QuotationLine } from "@/lib/types";
import { fmtMoney } from "@/lib/options";

const EMPTY: QuotationFormValues = {
  partnerId: "",
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  issueDate: "",
  validUntil: "",
  lines: [{ no: 1, description: "", qty: 1, unitPrice: 0 }],
  vatRate: 7,
  note: "",
};

export interface QuotationFormProps {
  partners: Partner[];
  initial?: Partial<QuotationFormValues>;
  submitLabel: string;
  fieldError?: { field?: string; message: string } | null;
  busy?: boolean;
  onSubmit: (values: QuotationFormValues) => void;
}

export default function QuotationForm({
  partners,
  initial,
  submitLabel,
  fieldError,
  busy,
  onSubmit,
}: QuotationFormProps) {
  const [v, setV] = useState<QuotationFormValues>({
    ...EMPTY,
    ...initial,
    lines: initial?.lines && initial.lines.length ? initial.lines : EMPTY.lines,
  });

  const set = <K extends keyof QuotationFormValues>(k: K, val: QuotationFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const num = (s: string) => (s === "" ? 0 : Number(s));

  const setLine = (i: number, patch: Partial<QuotationLine>) =>
    setV((prev) => ({
      ...prev,
      lines: prev.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    }));

  const addLine = () =>
    setV((prev) => ({
      ...prev,
      lines: [...prev.lines, { no: prev.lines.length + 1, description: "", qty: 1, unitPrice: 0 }],
    }));

  const removeLine = (i: number) =>
    setV((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, no: idx + 1 })),
    }));

  const onPartner = (partnerId: string) => {
    const p = partners.find((x) => x.id === partnerId);
    setV((prev) => ({
      ...prev,
      partnerId,
      customerName: p ? p.name : prev.customerName,
      customerPhone: p ? p.phone : prev.customerPhone,
      customerAddress: p ? p.address : prev.customerAddress,
    }));
  };

  const subtotal = v.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
  const vatAmount = Math.round((subtotal * (Number(v.vatRate) || 0)) / 100 * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;

  const errFor = (field: string) =>
    fieldError && fieldError.field === field ? <span className="field-error">{fieldError.message}</span> : null;

  return (
    <div>
      {fieldError && !fieldError.field ? <div className="alert alert-error">{fieldError.message}</div> : null}

      <div className="form-grid">
        <div className="field">
          <label>เลือกคู่ค้า (ลูกค้า)</label>
          <select className="select" value={v.partnerId} onChange={(e) => onPartner(e.target.value)}>
            <option value="">— กรอกเอง —</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>
            วันที่ออก<span className="req">*</span>
          </label>
          <input className="input" type="date" value={v.issueDate} onChange={(e) => set("issueDate", e.target.value)} />
          {errFor("issueDate")}
        </div>

        <div className="field col-span">
          <label>
            ชื่อลูกค้า<span className="req">*</span>
          </label>
          <input className="input" value={v.customerName} onChange={(e) => set("customerName", e.target.value)} />
          {errFor("customerName")}
        </div>

        <div className="field">
          <label>เบอร์โทร</label>
          <input className="input" value={v.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} />
        </div>
        <div className="field">
          <label>ใช้ได้ถึง</label>
          <input className="input" type="date" value={v.validUntil} onChange={(e) => set("validUntil", e.target.value)} />
        </div>

        <div className="field col-span">
          <label>ที่อยู่</label>
          <input className="input" value={v.customerAddress} onChange={(e) => set("customerAddress", e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ margin: "8px 0 12px" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>รายการ</th>
              <th style={{ width: 90, textAlign: "right" }}>จำนวน</th>
              <th style={{ width: 130, textAlign: "right" }}>ราคา/หน่วย</th>
              <th style={{ width: 130, textAlign: "right" }}>รวม</th>
              <th style={{ width: 50 }} />
            </tr>
          </thead>
          <tbody>
            {v.lines.map((l, i) => (
              <tr key={i}>
                <td className="code">{i + 1}</td>
                <td>
                  <input className="input" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="รายละเอียดสินค้า/บริการ" />
                </td>
                <td>
                  <input className="input" type="number" min={0} style={{ textAlign: "right" }} value={l.qty} onChange={(e) => setLine(i, { qty: num(e.target.value) })} />
                </td>
                <td>
                  <input className="input" type="number" min={0} style={{ textAlign: "right" }} value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: num(e.target.value) })} />
                </td>
                <td className="mono" style={{ textAlign: "right" }}>{fmtMoney((Number(l.qty) || 0) * (Number(l.unitPrice) || 0))}</td>
                <td style={{ textAlign: "center" }}>
                  <button className="btn btn-danger" style={{ padding: "2px 8px" }} onClick={() => removeLine(i)} disabled={v.lines.length <= 1}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: 10 }}>
          <button className="btn" onClick={addLine}>+ เพิ่มรายการ</button>
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label>VAT (%)</label>
          <input className="input" type="number" min={0} max={100} value={v.vatRate} onChange={(e) => set("vatRate", num(e.target.value))} />
        </div>
        <div className="field" style={{ alignSelf: "end" }}>
          <div className="detail-meta" style={{ justifyContent: "flex-end", gap: 24 }}>
            <span>ยอดก่อน VAT: <b className="mono">{fmtMoney(subtotal)}</b></span>
            <span>VAT: <b className="mono">{fmtMoney(vatAmount)}</b></span>
            <span>รวมสุทธิ: <b className="mono">{fmtMoney(total)}</b></span>
          </div>
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
      </div>
    </div>
  );
}
