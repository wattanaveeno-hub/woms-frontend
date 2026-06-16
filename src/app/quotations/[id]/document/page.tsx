"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Quotation } from "@/lib/types";
import { fmtMoney } from "@/lib/options";
import { bahtText } from "@/lib/baht";
import { COMPANY } from "@/lib/company";

export default function QuotationDocumentPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [x, setX] = useState<Quotation | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setX(await api.getQuotation(id));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (err) return <div className="alert alert-error">{err}</div>;
  if (!x) return <div className="state">กำลังโหลด…</div>;

  return (
    <>
      <div className="doc-toolbar no-print">
        <Link href={`/quotations/${id}`} className="btn">← กลับ</Link>
        <button className="btn btn-primary" onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button>
      </div>

      <div className="doc">
        <div className="doc-head">
          <div className="doc-company">{COMPANY.name}</div>
          <div className="doc-company-sub">{COMPANY.address}</div>
          <div className="doc-company-sub">โทร. {COMPANY.phone} · เลขประจำตัวผู้เสียภาษี {COMPANY.taxId}</div>
        </div>

        <h1 className="doc-title">ใบเสนอราคา</h1>

        <div className="doc-row-between">
          <div>เลขที่ {x.quotationNo}</div>
          <div>วันที่ {x.issueDate || "................"}</div>
        </div>

        <table className="doc-kv">
          <tbody>
            <tr><td className="doc-kv-key">เรียน</td><td>{x.customerName}</td></tr>
            {x.customerAddress ? <tr><td className="doc-kv-key">ที่อยู่</td><td>{x.customerAddress}</td></tr> : null}
            {x.customerPhone ? <tr><td className="doc-kv-key">โทร</td><td>{x.customerPhone}</td></tr> : null}
            {x.validUntil ? <tr><td className="doc-kv-key">ยืนราคาถึง</td><td>{x.validUntil}</td></tr> : null}
          </tbody>
        </table>

        <table className="doc-table">
          <thead>
            <tr>
              <th style={{ width: "8%" }}>ลำดับ</th>
              <th>รายการ</th>
              <th style={{ width: "12%", textAlign: "right" }}>จำนวน</th>
              <th style={{ width: "18%", textAlign: "right" }}>ราคา/หน่วย</th>
              <th style={{ width: "20%", textAlign: "right" }}>จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {x.lines.map((l, i) => (
              <tr key={l.no}>
                <td style={{ textAlign: "center" }}>{l.no}</td>
                <td>{l.description}</td>
                <td style={{ textAlign: "right" }}>{l.qty}</td>
                <td style={{ textAlign: "right" }}>{fmtMoney(l.unitPrice)}</td>
                <td style={{ textAlign: "right" }}>{fmtMoney(x.lineTotals[i] ?? 0)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} style={{ textAlign: "right" }}>ยอดรวมก่อนภาษี</td>
              <td style={{ textAlign: "right" }}>{fmtMoney(x.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={4} style={{ textAlign: "right" }}>ภาษีมูลค่าเพิ่ม {x.vatRate}%</td>
              <td style={{ textAlign: "right" }}>{fmtMoney(x.vatAmount)}</td>
            </tr>
            <tr>
              <td colSpan={4} style={{ textAlign: "right", fontWeight: 700 }}>ยอดรวมสุทธิ</td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{fmtMoney(x.total)}</td>
            </tr>
          </tbody>
        </table>

        <div className="doc-amount-words">({bahtText(x.total)})</div>

        {x.note ? <p className="doc-p"><b>หมายเหตุ:</b> {x.note}</p> : null}

        <div className="doc-signs">
          <div className="doc-sign">
            <div className="doc-sign-line">ลงชื่อ ........................................</div>
            <div>( ........................................ )</div>
            <div>ผู้เสนอราคา</div>
          </div>
          <div className="doc-sign">
            <div className="doc-sign-line">ลงชื่อ ........................................</div>
            <div>( {x.customerName} )</div>
            <div>ผู้อนุมัติ / ลูกค้า</div>
          </div>
        </div>
      </div>
    </>
  );
}
