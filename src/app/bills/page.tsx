"use client";

// ---------------------------------------------------------------------------
// ระบบวางบิลช่าง (BILL-FN-001..014)
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { BillStatus, BillSummaryRow, TechBill } from "@/lib/types";
import { BILL_STATUS_LABEL } from "@/lib/types";

const STATUSES: Array<BillStatus | ""> = ["", "DRAFT", "SUBMITTED", "RETURNED", "APPROVED", "PAID", "CANCELLED"];

export default function BillsPage() {
  const { has } = useAuth();
  const canReview = has("bill:review");

  const [items, setItems] = useState<TechBill[] | null>(null);
  const [summary, setSummary] = useState<BillSummaryRow[]>([]);
  const [status, setStatus] = useState<BillStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setItems(null);
    try {
      const r = await api.listBills({
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setItems(r.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดรายการวางบิลไม่สำเร็จ");
      setItems([]);
    }
    if (canReview) {
      try {
        const s = await api.billSummary({ from: from || undefined, to: to || undefined });
        setSummary(s.items);
      } catch {
        setSummary([]);
      }
    }
  }, [status, from, to, canReview]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>วางบิลช่าง</h1>
          <div className="detail-meta">
            วางบิลได้เฉพาะใบงานที่ Admin ยืนยันปิดงานแล้ว · ค่าเดินทางคิดต่อวัน ไม่ใช่ต่อใบงาน
          </div>
        </div>
        {has("bill:create") && (
          <Link href="/bills/new" className="btn btn-primary">
            + ทำรายการวางบิล
          </Link>
        )}
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="form-grid">
          <label className="field">
            <span>สถานะ</span>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as BillStatus | "")}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s ? BILL_STATUS_LABEL[s] : "ทุกสถานะ"}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>ตั้งแต่</span>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>ถึง</span>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {canReview && summary.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>สรุปยอดตามช่าง (ไม่นับบิลที่ยกเลิก)</h2>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>ช่าง</th>
                  <th>จำนวนบิล</th>
                  <th>ใบงาน</th>
                  <th>ค่าแรง</th>
                  <th>ค่าเดินทาง</th>
                  <th>ค่าใช้จ่ายอื่น</th>
                  <th>รวม</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((r) => (
                  <tr key={r.technicianId}>
                    <td>{r.technicianName}</td>
                    <td className="mono">{r.billCount}</td>
                    <td className="mono">{r.jobCount}</td>
                    <td className="mono">{r.laborTotal.toLocaleString("th-TH")}</td>
                    <td className="mono">{r.travelTotal.toLocaleString("th-TH")}</td>
                    <td className="mono">{r.expenseTotal.toLocaleString("th-TH")}</td>
                    <td className="mono">
                      <strong>{r.grandTotal.toLocaleString("th-TH")}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {items === null ? (
        <div className="state">กำลังโหลด…</div>
      ) : items.length === 0 ? (
        <div className="state">ยังไม่มีรายการวางบิล</div>
      ) : (
        <div className="card">
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>ช่าง</th>
                  <th>รอบ</th>
                  <th>สถานะ</th>
                  <th>ใบงาน</th>
                  <th>ค่าแรง</th>
                  <th>ค่าเดินทาง</th>
                  <th>รวม</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id}>
                    <td className="mono">{b.billNo}</td>
                    <td>{b.technicianName}</td>
                    <td className="mono">
                      {b.periodFrom} → {b.periodTo}
                    </td>
                    <td>
                      <span className="badge">{b.statusLabel}</span>
                    </td>
                    <td className="mono">{b.totals.jobCount}</td>
                    <td className="mono">{b.totals.laborTotal.toLocaleString("th-TH")}</td>
                    <td className="mono">
                      {b.totals.travelTotal.toLocaleString("th-TH")}
                      <span className="detail-meta"> ({b.totals.dayCount} วัน)</span>
                    </td>
                    <td className="mono">
                      <strong>{b.totals.grandTotal.toLocaleString("th-TH")}</strong>
                    </td>
                    <td>
                      <Link className="btn btn-sm" href={`/bills/${b.id}`}>
                        เปิด
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
