"use client";

// รายละเอียดรายการวางบิล — ส่งตรวจ / ส่งกลับแก้ไข / อนุมัติ / จ่ายแล้ว
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import type { BillStatus, TechBill } from "@/lib/types";

export default function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, has } = useAuth();
  const toast = useToast();
  const dialog = useDialog();
  const canReview = has("bill:review");
  const canApprove = has("bill:approve");

  const [bill, setBill] = useState<TechBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBill(await api.getBill(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดรายการไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (status: BillStatus, needNote = false) => {
    let note = "";
    if (needNote) {
      const r = await dialog.prompt({
        title: status === "RETURNED" ? "ส่งบิลกลับให้แก้ไข" : "ยกเลิกบิล",
        label: status === "RETURNED" ? "เหตุผลที่ส่งกลับให้แก้ไข" : "เหตุผล",
        help: "ช่างจะเห็นข้อความนี้บนบิล",
        type: "textarea",
        required: true,
        confirmLabel: status === "RETURNED" ? "ส่งกลับให้แก้ไข" : "ยืนยันยกเลิกบิล",
        danger: status === "CANCELLED",
      });
      if (r === null) return;
      note = r.trim();
    }
    setBusy(true);
    try {
      setBill(await api.setBillStatus(id, status, note));
      toast.success("อัปเดตสถานะแล้ว");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "อัปเดตไม่สำเร็จ");
      load();
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <>
        <div className="alert alert-error">{error}</div>
        <Link href="/bills" className="btn">
          ← กลับรายการวางบิล
        </Link>
      </>
    );
  }
  if (!bill) return <div className="state">กำลังโหลด…</div>;

  const isOwner = bill.technicianId === user?.id;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="code">{bill.billNo}</span>
            <span className="badge">{bill.statusLabel}</span>
          </h1>
          <div className="detail-meta">
            {bill.technicianName} · รอบ {bill.periodFrom} → {bill.periodTo} · {bill.totals.jobCount} ใบงาน
          </div>
        </div>
        <Link href="/bills" className="btn">
          ← รายการวางบิล
        </Link>
      </div>

      {bill.status === "RETURNED" && bill.reviewNote && (
        <div className="alert alert-warn">
          ถูกส่งกลับให้แก้ไขโดย {bill.reviewedBy} — {bill.reviewNote}
        </div>
      )}
      {bill.status === "CANCELLED" && bill.cancelReason && (
        <div className="alert alert-error">ยกเลิกแล้ว — {bill.cancelReason}</div>
      )}
      {bill.datesMissingTravel && bill.datesMissingTravel.length > 0 && (
        <div className="alert alert-warn">
          ยังไม่ได้ลงระยะทางของวันที่: {bill.datesMissingTravel.join(", ")}
        </div>
      )}

      <div className="card card-pad" style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(bill.status === "DRAFT" || bill.status === "RETURNED") && (isOwner || canReview) && (
          <button className="btn btn-primary" disabled={busy} onClick={() => act("SUBMITTED")}>
            ส่งตรวจ
          </button>
        )}
        {bill.status === "SUBMITTED" && canReview && (
          <button className="btn" disabled={busy} onClick={() => act("RETURNED", true)}>
            ส่งกลับให้แก้ไข
          </button>
        )}
        {bill.status === "SUBMITTED" && canApprove && (
          <button className="btn btn-primary" disabled={busy} onClick={() => act("APPROVED")}>
            อนุมัติ
          </button>
        )}
        {bill.status === "APPROVED" && canApprove && (
          <button className="btn btn-primary" disabled={busy} onClick={() => act("PAID")}>
            บันทึกว่าจ่ายแล้ว
          </button>
        )}
        {bill.status !== "PAID" && bill.status !== "CANCELLED" && (isOwner || canReview) && (
          <button className="btn btn-danger" disabled={busy} onClick={() => act("CANCELLED", true)}>
            ยกเลิกบิล
          </button>
        )}
      </div>

      <div className="filters" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="stat-num">{bill.totals.laborTotal.toLocaleString("th-TH")}</div>
          <div className="stat-label">ค่าแรง</div>
        </div>
        <div className="stat">
          <div className="stat-num">{bill.totals.travelTotal.toLocaleString("th-TH")}</div>
          <div className="stat-label">
            ค่าเดินทาง ({bill.totals.dayCount} วัน · {bill.totals.distanceTotalKm} กม.)
          </div>
        </div>
        <div className="stat">
          <div className="stat-num">{bill.totals.expenseTotal.toLocaleString("th-TH")}</div>
          <div className="stat-label">ค่าใช้จ่ายอื่น</div>
        </div>
        <div className="stat">
          <div className="stat-num">{bill.totals.grandTotal.toLocaleString("th-TH")}</div>
          <div className="stat-label">รวมทั้งสิ้น</div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>ใบงานในบิลนี้</h2>
        <table className="table">
          <thead>
            <tr>
              <th>ใบงาน</th>
              <th>วันที่</th>
              <th>ลูกค้า</th>
              <th>ค่าแรง</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((it) => (
              <tr key={it.jobId}>
                <td className="mono">
                  <Link href={`/jobs/${it.jobId}`}>{it.jobId}</Link>
                  {it.jobName ? <div className="detail-meta">{it.jobName}</div> : null}
                </td>
                <td className="mono">{it.jobDate}</td>
                <td>{it.customerName || "—"}</td>
                <td className="mono">{it.laborAmount.toLocaleString("th-TH")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>ค่าเดินทางรายวัน</h2>
        <div className="detail-meta" style={{ marginBottom: 8 }}>
          หนึ่งวันหนึ่งแถว — หลายใบงานในวันเดียวกันไม่ทำให้ค่าเดินทางถูกคิดซ้ำ
        </div>
        {bill.days.length === 0 ? (
          <div className="state">ยังไม่ได้ลงค่าเดินทาง</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>ระยะทาง (กม.)</th>
                <th>ค่าเดินทาง</th>
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {bill.days.map((d) => (
                <tr key={d.date}>
                  <td className="mono">{d.date}</td>
                  <td className="mono">{d.distanceKm}</td>
                  <td className="mono">{d.travelAmount.toLocaleString("th-TH")}</td>
                  <td>{d.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {bill.expenses.length > 0 && (
        <div className="card card-pad">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>ค่าใช้จ่ายอื่น</h2>
          <table className="table">
            <thead>
              <tr>
                <th>รายการ</th>
                <th>จำนวนเงิน</th>
                <th>หลักฐาน</th>
              </tr>
            </thead>
            <tbody>
              {bill.expenses.map((e) => (
                <tr key={e.id}>
                  <td>{e.label}</td>
                  <td className="mono">{e.amount.toLocaleString("th-TH")}</td>
                  <td>{e.attachment ? "แนบแล้ว" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
