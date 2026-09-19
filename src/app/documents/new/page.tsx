"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Contract, DocumentFormValues, DocumentType, PaymentMethod } from "@/lib/types";
import { documentTypeLabel, fmtMoney, paymentMethodLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";
import { bangkokToday } from "@/lib/date";

const TYPES: DocumentType[] = [
  "INVOICE",
  "RECEIPT",
  "TAX_INVOICE",
  "DELIVERY_NOTE",
  "CONTRACT",
  "WARRANTY_CARD",
];
const METHODS: PaymentMethod[] = ["CASH", "TRANSFER", "CHEQUE", "CARD", "CREDIT", "OTHER"];

type Line = { description: string; qty: number; unitPrice: number };

// ออกเอกสารทั่วไป (ใบแจ้งหนี้ / ใบส่งของ / ใบรับประกัน / หนังสือสัญญา ฯลฯ)
// ใบเสร็จของงวดสัญญาให้ออกจากหน้าสัญญาโดยตรง เพื่อให้ผูกกับงวดอัตโนมัติ
export default function NewDocumentPage() {
  const router = useRouter();
  const toast = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);

  const [v, setV] = useState<DocumentFormValues>({
    type: "DELIVERY_NOTE",
    issueDate: bangkokToday(), // วันที่เอกสาร = วันทำงานตามเวลาไทย
    contractId: "",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    customerTaxId: "",
    serial: "",
    model: "",
    lines: [{ description: "", qty: 1, unitPrice: 0 }],
    discount: 0,
    vatRate: 0,
    paymentMethod: "CASH",
    paymentRef: "",
    note: "",
  });

  useEffect(() => {
    api
      .listContracts({})
      .then((r) => setContracts(r.items))
      .catch(() => setContracts([]));
  }, []);

  const set = <K extends keyof DocumentFormValues>(k: K, val: DocumentFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const setLine = (i: number, patch: Partial<Line>) =>
    setV((prev) => ({
      ...prev,
      lines: prev.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    }));

  const onContract = (contractId: string) => {
    const c = contracts.find((x) => x.id === contractId);
    setV((prev) => ({
      ...prev,
      contractId,
      customerName: c?.customerName ?? prev.customerName,
      customerPhone: c?.customerPhone ?? prev.customerPhone,
      customerAddress: c?.customerAddress ?? prev.customerAddress,
      serial: c?.serial ?? prev.serial,
      model: c?.model ?? prev.model,
    }));
  };

  const subtotal = v.lines.reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0) - (v.discount ?? 0);
  const vatAmount = (subtotal * (v.vatRate ?? 0)) / 100;

  const submit = async () => {
    setBusy(true);
    setFieldError(null);
    try {
      const doc = await api.createDocument({
        ...v,
        lines: v.lines.filter((l) => l.description.trim()),
      });
      toast.success(`ออก${documentTypeLabel[doc.type]} ${doc.docNo} แล้ว`);
      router.push(`/documents/${doc.id}`);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldError({ field: e.field, message: e.message });
        toast.error(e.message);
      } else {
        toast.error("ออกเอกสารไม่สำเร็จ");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ออกเอกสาร</h1>
          <div className="sub">ใบแจ้งหนี้ · ใบส่งของ · ใบรับประกัน · หนังสือสัญญา</div>
        </div>
        <Link href="/documents" className="btn">
          ← รายการเอกสาร
        </Link>
      </div>

      {fieldError && !fieldError.field ? <div className="alert alert-error">{fieldError.message}</div> : null}

      <div className="card card-pad">
        <div className="form-grid">
          <div className="field">
            <label>ประเภทเอกสาร</label>
            <select className="select" value={v.type} onChange={(e) => set("type", e.target.value as DocumentType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {documentTypeLabel[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>วันที่เอกสาร</label>
            <input className="input" type="date" value={v.issueDate} onChange={(e) => set("issueDate", e.target.value)} />
          </div>

          <div className="field col-span">
            <label>อ้างอิงสัญญา (ถ้ามี)</label>
            <select className="select" value={v.contractId} onChange={(e) => onContract(e.target.value)}>
              <option value="">— ไม่อ้างอิงสัญญา —</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contractNo} · {c.customerName} {c.serial ? `· ${c.serial}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>ชื่อลูกค้า</label>
            <input className="input" value={v.customerName} onChange={(e) => set("customerName", e.target.value)} />
          </div>
          <div className="field">
            <label>เลขผู้เสียภาษี</label>
            <input className="input" inputMode="numeric" maxLength={13} value={v.customerTaxId} onChange={(e) => set("customerTaxId", e.target.value)} />
            {fieldError?.field === "customerTaxId" ? <span className="field-error">{fieldError.message}</span> : null}
          </div>
          <div className="field col-span">
            <label>ที่อยู่ลูกค้า</label>
            <input className="input" value={v.customerAddress} onChange={(e) => set("customerAddress", e.target.value)} />
          </div>
          <div className="field">
            <label>Serial เครื่อง</label>
            <input className="input" value={v.serial} onChange={(e) => set("serial", e.target.value)} />
          </div>
          <div className="field">
            <label>รุ่น</label>
            <input className="input" value={v.model} onChange={(e) => set("model", e.target.value)} />
          </div>

          <div className="field col-span">
            <label style={{ fontWeight: 700 }}>รายการ</label>
          </div>

          {v.lines.map((l, i) => (
            <div className="field col-span" key={i}>
              <div className="toolbar" style={{ marginTop: 0 }}>
                <input
                  className="input"
                  style={{ flex: 3 }}
                  value={l.description}
                  onChange={(e) => setLine(i, { description: e.target.value })}
                  placeholder="รายละเอียด"
                />
                <input
                  className="input"
                  style={{ width: 90 }}
                  type="number"
                  value={l.qty}
                  onChange={(e) => setLine(i, { qty: Number(e.target.value) })}
                  placeholder="จำนวน"
                />
                <input
                  className="input"
                  style={{ width: 140 }}
                  type="number"
                  value={l.unitPrice}
                  onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) })}
                  placeholder="ราคา/หน่วย"
                />
                <button
                  className="btn btn-danger"
                  type="button"
                  onClick={() => setV((p) => ({ ...p, lines: p.lines.filter((_, idx) => idx !== i) }))}
                  disabled={v.lines.length === 1}
                >
                  ลบ
                </button>
              </div>
            </div>
          ))}

          <div className="field col-span">
            <button
              className="btn"
              type="button"
              onClick={() => setV((p) => ({ ...p, lines: [...p.lines, { description: "", qty: 1, unitPrice: 0 }] }))}
            >
              + เพิ่มรายการ
            </button>
            {fieldError?.field === "lines" ? <span className="field-error">{fieldError.message}</span> : null}
          </div>

          <div className="field">
            <label>ส่วนลดท้ายบิล (บาท)</label>
            <input className="input" type="number" value={v.discount} onChange={(e) => set("discount", Number(e.target.value))} />
          </div>
          <div className="field">
            <label>VAT (%)</label>
            <input className="input" type="number" value={v.vatRate} onChange={(e) => set("vatRate", Number(e.target.value))} />
          </div>
          <div className="field">
            <label>วิธีชำระเงิน</label>
            <select className="select" value={v.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value as PaymentMethod)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {paymentMethodLabel[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>อ้างอิงการชำระ</label>
            <input className="input" value={v.paymentRef} onChange={(e) => set("paymentRef", e.target.value)} placeholder="เลขที่โอน / เลขเช็ค" />
          </div>

          <div className="field col-span">
            <label>หมายเหตุ</label>
            <textarea className="textarea" value={v.note} onChange={(e) => set("note", e.target.value)} />
          </div>

          <div className="field col-span">
            <div className="detail-meta">
              <span>รวมก่อนภาษี: {fmtMoney(subtotal)} บาท</span>
              <span>ภาษี: {fmtMoney(vatAmount)} บาท</span>
              <span>
                <strong>รวมทั้งสิ้น: {fmtMoney(subtotal + vatAmount)} บาท</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="toolbar">
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "กำลังออกเอกสาร…" : "ออกเอกสาร"}
          </button>
        </div>
      </div>
    </>
  );
}
