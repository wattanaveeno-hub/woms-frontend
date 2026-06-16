"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Contract } from "@/lib/types";
import { contractTypeLabel, fmtMoney } from "@/lib/options";
import { bahtText } from "@/lib/baht";
import { COMPANY } from "@/lib/company";

export default function ReceiptPage() {
  const params = useParams<{ id: string; no: string }>();
  const id = params.id;
  const no = Number(params.no);
  const [c, setC] = useState<Contract | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setC(await api.getContract(id));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (err) return <div className="alert alert-error">{err}</div>;
  if (!c) return <div className="state">กำลังโหลด…</div>;

  const inst = c.installments.find((i) => i.no === no);
  if (!inst) return <div className="alert alert-error">ไม่พบงวดที่ {no}</div>;

  const isPaid = inst.status === "PAID";
  const docTitle = isPaid ? "ใบเสร็จรับเงิน" : "ใบแจ้งหนี้ / ใบวางบิล";
  const docDate = isPaid ? inst.paidDate : inst.dueDate;
  const itemDesc =
    `ค่า${contractTypeLabel[c.type]}เครื่อง ${c.serial || "-"}${c.model ? ` (${c.model})` : ""}` +
    ` งวดที่ ${inst.no}/${c.installments.length}`;

  return (
    <>
      <div className="doc-toolbar no-print">
        <Link href={`/contracts/${id}`} className="btn">
          ← กลับ
        </Link>
        <button className="btn btn-primary" onClick={() => window.print()}>
          พิมพ์ / บันทึก PDF
        </button>
      </div>

      <div className="doc doc-receipt">
        <div className="doc-head">
          <div className="doc-company">{COMPANY.name}</div>
          <div className="doc-company-sub">{COMPANY.address}</div>
          <div className="doc-company-sub">
            โทร. {COMPANY.phone} · เลขประจำตัวผู้เสียภาษี {COMPANY.taxId}
          </div>
        </div>

        <h1 className="doc-title">{docTitle}</h1>

        <div className="doc-row-between">
          <div>เลขที่ {c.contractNo}/{String(inst.no).padStart(2, "0")}</div>
          <div>วันที่ {docDate || "................"}</div>
        </div>

        <table className="doc-kv">
          <tbody>
            <tr>
              <td className="doc-kv-key">{isPaid ? "ได้รับเงินจาก" : "เรียกเก็บจาก"}</td>
              <td>{c.customerName}</td>
            </tr>
            {c.customerAddress ? (
              <tr>
                <td className="doc-kv-key">ที่อยู่</td>
                <td>{c.customerAddress}</td>
              </tr>
            ) : null}
            <tr>
              <td className="doc-kv-key">อ้างอิงสัญญา</td>
              <td>{c.contractNo} ({contractTypeLabel[c.type]})</td>
            </tr>
          </tbody>
        </table>

        <table className="doc-table">
          <thead>
            <tr>
              <th style={{ width: "12%" }}>ลำดับ</th>
              <th>รายการ</th>
              <th style={{ textAlign: "right", width: "24%" }}>จำนวนเงิน (บาท)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ textAlign: "center" }}>1</td>
              <td>{itemDesc} (ครบกำหนด {inst.dueDate})</td>
              <td style={{ textAlign: "right" }}>{fmtMoney(inst.amount)}</td>
            </tr>
            <tr>
              <td colSpan={2} style={{ textAlign: "right", fontWeight: 700 }}>รวมเป็นเงิน</td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{fmtMoney(inst.amount)}</td>
            </tr>
          </tbody>
        </table>

        <div className="doc-amount-words">({bahtText(inst.amount)})</div>

        <div className="doc-row-between" style={{ marginTop: 8 }}>
          <div>
            สถานะ: {isPaid ? `ชำระแล้วเมื่อ ${inst.paidDate}` : "ยังไม่ชำระ"}
            <br />
            ยอดคงเหลือทั้งสัญญา: {fmtMoney(c.balance)} บาท
          </div>
          <div className="doc-sign" style={{ marginTop: 24 }}>
            <div className="doc-sign-line">ลงชื่อ ........................................ ผู้รับเงิน</div>
            <div>( ........................................ )</div>
            <div>วันที่ {docDate || "............"}</div>
          </div>
        </div>
      </div>
    </>
  );
}
