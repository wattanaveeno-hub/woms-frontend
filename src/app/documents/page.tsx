"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { DocumentStatus, DocumentType, SalesDocument } from "@/lib/types";
import { documentStatusLabel, documentTypeLabel, fmtMoney } from "@/lib/options";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { parseMoney } from "@/components/FieldErrors";
import { useUrlFilters } from "@/lib/urlFilters";

const TYPES: DocumentType[] = [
  "RECEIPT",
  "TAX_INVOICE",
  "INVOICE",
  "CREDIT_NOTE",
  "DELIVERY_NOTE",
  "CONTRACT",
  "WARRANTY_CARD",
];
const STATUSES: DocumentStatus[] = ["ISSUED", "VOID"];

export default function DocumentsPage() {
  const { has } = useAuth();
  const toast = useToast();
  const dialog = useDialog();
  const [items, setItems] = useState<SalesDocument[]>([]);
  // QA BUG-009 — ตัวกรองสะท้อนลง URL
  const [f, setF] = useUrlFilters({ type: "", status: "", q: "" });
  const type = f.type as DocumentType | "";
  const status = f.status as DocumentStatus | "";
  const q = f.q;
  const setType = (v: DocumentType | "") => setF({ type: v });
  const setStatus = (v: DocumentStatus | "") => setF({ status: v });
  const setQ = (v: string) => setF({ q: v });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listDocuments({
        type: type || undefined,
        status: status || undefined,
        q: q || undefined,
      });
      setItems(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [type, status, q]);

  useEffect(() => {
    load();
  }, [load]);

  const voidDoc = async (d: SalesDocument) => {
    const reason = await dialog.prompt({
      title: `ยกเลิกเอกสาร ${d.docNo}?`,
      message: "เอกสารจะยังอยู่ในระบบแต่ถูกทำเครื่องหมายว่ายกเลิก และย้อนกลับไม่ได้",
      label: "เหตุผลการยกเลิก",
      type: "textarea",
      required: true,
      confirmLabel: "ยืนยันยกเลิกเอกสาร",
      cancelLabel: "ไม่ยกเลิก",
      danger: true,
      validate: (v) => (v.trim().length < 3 ? "ต้องระบุเหตุผลอย่างน้อย 3 ตัวอักษร" : null),
    });
    if (reason === null) return;
    setBusyId(d.id);
    try {
      await api.voidDocument(d.id, reason.trim());
      toast.success(`ยกเลิก ${d.docNo} แล้ว`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ยกเลิกไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const creditNote = async (d: SalesDocument) => {
    const remaining = d.netTotal;
    const raw = await dialog.prompt({
      title: `ออกใบลดหนี้จาก ${d.docNo}`,
      label: "ยอดที่ต้องการลดหนี้ (บาท)",
      help: `คงเหลือของเอกสารนี้ ${fmtMoney(remaining)} บาท`,
      type: "number",
      min: 0,
      step: 0.01,
      defaultValue: String(remaining),
      required: true,
      confirmLabel: "ถัดไป",
      // QA BUG-011 pattern — ยอดเงินต้องเป็นตัวเลขจริง ไม่รับ 1e5 / abc
      validate: (v) => {
        const r = parseMoney(v);
        if (!r.ok) return r.message;
        if (r.value <= 0) return "ยอดลดหนี้ต้องมากกว่า 0";
        if (r.value > remaining) return `ยอดลดหนี้ต้องไม่เกินยอดคงเหลือ ${fmtMoney(remaining)} บาท`;
        return null;
      },
    });
    if (raw === null) return;
    const parsedAmount = parseMoney(raw);
    if (!parsedAmount.ok) {
      toast.error(parsedAmount.message);
      return;
    }
    const amount = parsedAmount.value;
    const reason = await dialog.prompt({
      title: "เหตุผลการลดหนี้",
      message: `ลดหนี้ ${fmtMoney(amount)} บาท จากเอกสาร ${d.docNo}`,
      label: "เหตุผลการลดหนี้",
      type: "textarea",
      required: true,
      confirmLabel: "ออกใบลดหนี้",
      validate: (v) => (v.trim().length < 3 ? "ต้องระบุเหตุผลอย่างน้อย 3 ตัวอักษร" : null),
    });
    if (reason === null) return;
    setBusyId(d.id);
    try {
      const cn = await api.createCreditNote(d.id, { amount, reason: reason.trim() });
      toast.success(`ออกใบลดหนี้ ${cn.docNo} แล้ว`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ออกใบลดหนี้ไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>เอกสารการขาย</h1>
          <div className="sub">{items.length} ฉบับ · ใบเสร็จ ใบกำกับภาษี ใบลดหนี้ ใบส่งของ</div>
        </div>
        {has("documents:create") ? (
          <div className="head-actions">
            <Link href="/documents/new" className="btn btn-primary">
              ออกเอกสาร
            </Link>
          </div>
        ) : null}
      </div>

      <div className="toolbar" style={{ marginTop: 0, marginBottom: 14 }}>
        <select className="select" value={type} onChange={(e) => setType(e.target.value as DocumentType | "")}>
          <option value="">ทุกประเภท</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {documentTypeLabel[t]}
            </option>
          ))}
        </select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value as DocumentStatus | "")}>
          <option value="">ทุกสถานะ</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {documentStatusLabel[s]}
            </option>
          ))}
        </select>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาเลขที่เอกสาร / ลูกค้า / สัญญา / serial"
        />
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card">
        {loading ? (
          <div className="state">กำลังโหลด…</div>
        ) : items.length === 0 ? (
          <div className="state">ยังไม่มีเอกสาร</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>เลขที่</th>
                <th>ประเภท</th>
                <th>วันที่</th>
                <th>ลูกค้า</th>
                <th>อ้างอิง</th>
                <th style={{ textAlign: "right" }}>ยอดรวม</th>
                <th style={{ textAlign: "right" }}>คงเหลือสุทธิ</th>
                <th>สถานะ</th>
                <th style={{ textAlign: "right" }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/documents/${d.id}`} className="code">
                      {d.docNo}
                    </Link>
                  </td>
                  <td>{documentTypeLabel[d.type]}</td>
                  <td className="mono" style={{ fontSize: 13 }}>{d.issueDate}</td>
                  <td>{d.customerName || "—"}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {d.contractNo || "—"}
                    {d.refDocNo ? <div>อ้างถึง {d.refDocNo}</div> : null}
                  </td>
                  <td className="mono" style={{ textAlign: "right" }}>{fmtMoney(d.total)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{fmtMoney(d.netTotal)}</td>
                  <td>
                    <span className={`badge ${d.status === "VOID" ? "badge-cancelled" : "badge-completed"}`}>
                      {documentStatusLabel[d.status]}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {d.status === "ISSUED" && d.type !== "CREDIT_NOTE" && has("documents:create") ? (
                      <button
                        className="btn"
                        style={{ padding: "4px 10px" }}
                        onClick={() => creditNote(d)}
                        disabled={busyId === d.id || d.netTotal <= 0}
                      >
                        ใบลดหนี้
                      </button>
                    ) : null}{" "}
                    {d.status === "ISSUED" && has("documents:void") ? (
                      <button
                        className="btn btn-danger"
                        style={{ padding: "4px 10px" }}
                        onClick={() => voidDoc(d)}
                        disabled={busyId === d.id}
                      >
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
