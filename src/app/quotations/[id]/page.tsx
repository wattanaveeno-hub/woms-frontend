"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError, downloadFile } from "@/lib/api";
import type { Quotation, QuotationStatus } from "@/lib/types";
import { quotationStatusLabel, quotationTransitions, fmtMoney } from "@/lib/options";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";

/** ข้อความบนปุ่มของแต่ละสถานะปลายทาง */
const STATUS_ACTION_LABEL: Record<QuotationStatus, string> = {
  DRAFT: "กลับเป็นร่าง",
  SENT: "ทำเป็นส่งแล้ว",
  ACCEPTED: "ลูกค้าตอบรับ",
  REJECTED: "ลูกค้าปฏิเสธ",
  EXPIRED: "หมดอายุ",
  CANCELLED: "ยกเลิกใบเสนอราคา",
};

export default function QuotationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();

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
    // การยกเลิกใบเสนอราคาเป็นทางตัน (CANCELLED ไม่มีทางออก) จึงต้องยืนยันก่อน
    if (status === "CANCELLED") {
      const ok = await dialog.confirm({
        title: `ยกเลิกใบเสนอราคา ${x.quotationNo}?`,
        message: "ใบที่ยกเลิกแล้วเปลี่ยนสถานะต่อไม่ได้อีก",
        confirmLabel: "ยืนยันยกเลิก",
        danger: true,
      });
      if (!ok) return;
    }
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
    if (
      !(await dialog.confirm({
        title: `ลบใบเสนอราคา ${x.quotationNo}?`,
        message: "การลบย้อนกลับไม่ได้",
        confirmLabel: "ยืนยันลบ",
        danger: true,
      }))
    )
      return;
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
          <button
            className="btn"
            onClick={() =>
              downloadFile(
                `/api/quotations/${encodeURIComponent(id)}/document.pdf`,
                `quotation-${id}.pdf`
              ).catch(() => {})
            }
          >
            ⬇ PDF
          </button>
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
        {/* QA BUG-029 — เสนอเฉพาะสถานะที่เดินต่อได้จริงตาม QUOTATION_TRANSITIONS
            เดิมหน้าจอเสนอทุกสถานะเสมอ ใบที่ "ตอบรับ" แล้วจึงถอยกลับไป "ปฏิเสธ" ได้ */}
        {(quotationTransitions[x.status] ?? []).map((next) => (
          <button
            key={next}
            className={next === "CANCELLED" ? "btn btn-danger" : "btn"}
            onClick={() => changeStatus(next)}
            disabled={acting}
          >
            {STATUS_ACTION_LABEL[next]}
          </button>
        ))}
        {(quotationTransitions[x.status] ?? []).length === 0 ? (
          <span className="field-hint">
            ใบเสนอราคาที่สถานะ “{quotationStatusLabel[x.status]}” เปลี่ยนสถานะต่อไม่ได้แล้ว
          </span>
        ) : null}
        <button className="btn btn-danger" onClick={remove} disabled={acting}>ลบ</button>
      </div>
    </>
  );
}
