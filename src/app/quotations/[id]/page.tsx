"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Quotation, QuotationStatus } from "@/lib/types";
import { quotationStatusLabel, fmtMoney } from "@/lib/options";
import { useToast } from "@/components/Toast";

const NEXT_STATUS: { status: QuotationStatus; label: string }[] = [
  { status: "SENT", label: "ทำเป็นส่งแล้ว" },
  { status: "ACCEPTED", label: "ลูกค้าตอบรับ" },
  { status: "REJECTED", label: "ลูกค้าปฏิเสธ" },
  { status: "EXPIRED", label: "หมดอายุ" },
];

export default function QuotationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToast();

  const [x, setX] = useState<Quotation | null>(null);
  const [acting, setActing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setX(await api.getQuotation(id));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (status: QuotationStatus) => {
    if (!x || acting) return;
    setActing(true);
    try {
      const updated = await api.setQuotationStatus(id, status, x.updatedAt);
      setX(updated);
      toast.success("อัปเดตสถานะแล้ว");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error(e.message);
        load();
      } else {
        toast.error(e instanceof ApiError ? e.message : "อัปเดตไม่สำเร็จ");
      }
    } finally {
      setActing(false);
    }
  };

  const remove = async () => {
    if (!x || acting) return;
    if (!confirm(`ลบใบเสนอราคา ${x.quotationNo}?`)) return;
    setActing(true);
    try {
      await api.deleteQuotation(id);
      toast.success(`ลบ ${x.quotationNo} แล้ว`);
      router.push("/quotations");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ลบไม่สำเร็จ");
      setActing(false);
    }
  };

  if (loadError) {
    return (
      <>
        <div className="page-head"><h1>ไม่พบใบเสนอราคา</h1></div>
        <div className="alert alert-error">{loadError}</div>
        <Link href="/quotations" className="btn">← กลับ</Link>
      </>
    );
  }
  if (!x) return <div className="state">กำลังโหลด…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="code" style={{ fontSize: 18 }}>{x.quotationNo}</span>
            <span className="pill">{quotationStatusLabel[x.status]}</span>
          </h1>
          <div className="detail-meta">
            <span>ลูกค้า: {x.customerName}</span>
            <span>ออก: <span className="mono">{x.issueDate}</span></span>
            {x.validUntil ? <span>ใช้ได้ถึง: <span className="mono">{x.validUntil}</span></span> : null}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/quotations/${id}/document`} className="btn btn-primary" target="_blank" rel="noopener noreferrer">
            พิมพ์ / PDF
          </Link>
          <Link href="/quotations" className="btn">← รายการ</Link>
        </div>
      </div>

      <div className="filters" style={{ marginBottom: 4 }}>
        <div className="stat"><div className="stat-num">{fmtMoney(x.subtotal)}</div><div className="stat-label">ก่อน VAT</div></div>
        <div className="stat"><div className="stat-num">{fmtMoney(x.vatAmount)}</div><div className="stat-label">VAT {x.vatRate}%</div></div>
        <div className="stat"><div className="stat-num" style={{ color: "var(--accent)" }}>{fmtMoney(x.total)}</div><div className="stat-label">ยอดสุทธิ</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>รายการ</th>
              <th style={{ textAlign: "right" }}>จำนวน</th>
              <th style={{ textAlign: "right" }}>ราคา/หน่วย</th>
              <th style={{ textAlign: "right" }}>รวม</th>
            </tr>
          </thead>
          <tbody>
            {x.lines.map((l, i) => (
              <tr key={l.no}>
                <td className="code">{l.no}</td>
                <td>{l.description || "—"}</td>
                <td className="mono" style={{ textAlign: "right" }}>{l.qty}</td>
                <td className="mono" style={{ textAlign: "right" }}>{fmtMoney(l.unitPrice)}</td>
                <td className="mono" style={{ textAlign: "right" }}>{fmtMoney(x.lineTotals[i] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {x.note ? (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="stat-label" style={{ marginBottom: 4 }}>หมายเหตุ</div>
          {x.note}
        </div>
      ) : null}

      <div className="toolbar">
        {NEXT_STATUS.filter((s) => s.status !== x.status).map((s) => (
          <button key={s.status} className="btn" onClick={() => changeStatus(s.status)} disabled={acting}>
            {s.label}
          </button>
        ))}
        <button className="btn btn-danger" onClick={remove} disabled={acting}>ลบ</button>
      </div>
    </>
  );
}
