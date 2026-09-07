"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { SalesDocument } from "@/lib/types";
import { documentTypeLabel, fmtMoney, paymentMethodLabel } from "@/lib/options";
import { bahtText } from "@/lib/baht";
import { COMPANY } from "@/lib/company";

// หน้าพิมพ์เอกสาร — รองรับทุกประเภท (ใบเสร็จ/ใบกำกับ/ใบลดหนี้/ใบส่งของ ฯลฯ)
export default function DocumentPrintPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [d, setD] = useState<SalesDocument | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setD(await api.getDocument(id));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (err) return <div className="alert alert-error">{err}</div>;
  if (!d) return <div className="state">กำลังโหลด…</div>;

  const isCredit = d.type === "CREDIT_NOTE";
  const isVoid = d.status === "VOID";

  return (
    <>
      <div className="doc-toolbar no-print">
        <Link href="/documents" className="btn">
          ← กลับรายการเอกสาร
        </Link>
        {d.contractId ? (
          <Link href={`/contracts/${d.contractId}`} className="btn">
            ดูสัญญา {d.contractNo}
          </Link>
        ) : null}
        <button className="btn btn-primary" onClick={() => window.print()}>
          พิมพ์ / บันทึก PDF
        </button>
      </div>

      {isVoid ? (
        <div className="alert alert-error no-print">
          เอกสารนี้ถูกยกเลิกเมื่อ {d.voidedAt.slice(0, 16).replace("T", " ")} โดย {d.voidedByName} — เหตุผล: {d.voidReason}
        </div>
      ) : null}
      {!isVoid && d.creditedAmount > 0 ? (
        <div className="alert alert-warn no-print">
          เอกสารนี้มีใบลดหนี้แล้ว {fmtMoney(d.creditedAmount)} บาท — คงเหลือสุทธิ {fmtMoney(d.netTotal)} บาท
        </div>
      ) : null}

      <div className="doc doc-receipt">
        <div className="doc-head">
          <div className="doc-company">{COMPANY.name}</div>
          <div className="doc-company-sub">{COMPANY.address}</div>
          <div className="doc-company-sub">
            โทร. {COMPANY.phone} · เลขประจำตัวผู้เสียภาษี {COMPANY.taxId}
          </div>
        </div>

        <h1 className="doc-title">
          {documentTypeLabel[d.type]}
          {isVoid ? " (ยกเลิก)" : ""}
        </h1>

        <div className="doc-row-between">
          <div>เลขที่ {d.docNo}</div>
          <div>วันที่ {d.issueDate || "................"}</div>
        </div>

        <table className="doc-kv">
          <tbody>
            <tr>
              <td className="doc-kv-key">{isCredit ? "ลดหนี้ให้" : "ลูกค้า"}</td>
              <td>{d.customerName || "—"}</td>
            </tr>
            {d.customerAddress ? (
              <tr>
                <td className="doc-kv-key">ที่อยู่</td>
                <td>{d.customerAddress}</td>
              </tr>
            ) : null}
            {d.customerTaxId ? (
              <tr>
                <td className="doc-kv-key">เลขผู้เสียภาษี</td>
                <td className="mono">{d.customerTaxId}</td>
              </tr>
            ) : null}
            {d.contractNo ? (
              <tr>
                <td className="doc-kv-key">อ้างอิงสัญญา</td>
                <td>
                  {d.contractNo}
                  {d.installmentNo ? ` งวดที่ ${d.installmentNo}` : ""}
                </td>
              </tr>
            ) : null}
            {d.refDocNo ? (
              <tr>
                <td className="doc-kv-key">อ้างถึงเอกสาร</td>
                <td>{d.refDocNo}</td>
              </tr>
            ) : null}
            {d.serial ? (
              <tr>
                <td className="doc-kv-key">เครื่อง</td>
                <td>
                  {d.serial}
                  {d.model ? ` (${d.model})` : ""}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <table className="doc-table">
          <thead>
            <tr>
              <th style={{ width: "10%" }}>ลำดับ</th>
              <th>รายการ</th>
              <th style={{ textAlign: "right", width: "12%" }}>จำนวน</th>
              <th style={{ textAlign: "right", width: "18%" }}>ราคา/หน่วย</th>
              <th style={{ textAlign: "right", width: "20%" }}>จำนวนเงิน (บาท)</th>
            </tr>
          </thead>
          <tbody>
            {d.lines.map((l, i) => (
              <tr key={l.no}>
                <td style={{ textAlign: "center" }}>{l.no}</td>
                <td>{l.description}</td>
                <td style={{ textAlign: "right" }}>{l.qty}</td>
                <td style={{ textAlign: "right" }}>{fmtMoney(l.unitPrice)}</td>
                <td style={{ textAlign: "right" }}>{fmtMoney(d.lineTotals[i] ?? 0)}</td>
              </tr>
            ))}
            {d.discount ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "right" }}>ส่วนลด</td>
                <td style={{ textAlign: "right" }}>-{fmtMoney(d.discount)}</td>
              </tr>
            ) : null}
            <tr>
              <td colSpan={4} style={{ textAlign: "right" }}>รวมเป็นเงิน</td>
              <td style={{ textAlign: "right" }}>{fmtMoney(d.subtotal)}</td>
            </tr>
            {d.vatRate ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "right" }}>ภาษีมูลค่าเพิ่ม {d.vatRate}%</td>
                <td style={{ textAlign: "right" }}>{fmtMoney(d.vatAmount)}</td>
              </tr>
            ) : null}
            <tr>
              <td colSpan={4} style={{ textAlign: "right", fontWeight: 700 }}>
                {isCredit ? "รวมยอดลดหนี้" : "จำนวนเงินรวมทั้งสิ้น"}
              </td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{fmtMoney(d.total)}</td>
            </tr>
          </tbody>
        </table>

        <div className="doc-amount-words">({bahtText(d.total)})</div>

        <div className="doc-row-between" style={{ marginTop: 8 }}>
          <div>
            {isCredit ? null : (
              <>
                ชำระโดย: {paymentMethodLabel[d.paymentMethod]}
                {d.paymentRef ? ` (อ้างอิง ${d.paymentRef})` : ""}
                <br />
              </>
            )}
            {d.note ? <>หมายเหตุ: {d.note}</> : null}
            {isVoid ? (
              <div style={{ color: "#b23", fontWeight: 700, marginTop: 6 }}>
                *** เอกสารนี้ถูกยกเลิก — {d.voidReason} ***
              </div>
            ) : null}
          </div>
          <div className="doc-sign" style={{ marginTop: 24 }}>
            <div className="doc-sign-line">ลงชื่อ ........................................ ผู้มีอำนาจลงนาม</div>
            <div>( ........................................ )</div>
            <div>วันที่ {d.issueDate || "............"}</div>
          </div>
        </div>
      </div>
    </>
  );
}
