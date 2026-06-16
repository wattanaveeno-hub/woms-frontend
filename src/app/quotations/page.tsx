"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import Pagination, { usePagination } from "@/components/Pagination";
import { useAuth } from "@/lib/AuthContext";
import type { Quotation, QuotationStatus } from "@/lib/types";
import { quotationStatusLabel, fmtMoney } from "@/lib/options";

const STATUSES: QuotationStatus[] = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"];
const statusClass: Record<QuotationStatus, string> = {
  DRAFT: "badge-cancelled",
  SENT: "badge-active",
  ACCEPTED: "badge-completed",
  REJECTED: "badge-wexp",
  EXPIRED: "badge-cancelled",
};

export default function QuotationsPage() {
  const router = useRouter();
  const { has } = useAuth();
  const [items, setItems] = useState<Quotation[]>([]);
  const { page, setPage, pageCount, pageItems, total } = usePagination(items, 10);
  const [status, setStatus] = useState<QuotationStatus | "">("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listQuotations({ status: status || undefined, q: q || undefined });
      setItems(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ใบเสนอราคา</h1>
          <div className="sub">{items.length} ใบ</div>
        </div>
{has("quotations:create") ? (
        <Link href="/quotations/new" className="btn btn-primary">
          + สร้างใบเสนอราคา
        </Link>
        ) : null}
      </div>

      <div className="filters">
        <div className="field">
          <label>สถานะ</label>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value as QuotationStatus | "")}>
            <option value="">ทั้งหมด</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {quotationStatusLabel[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>ค้นหา</label>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="เลขที่ / ลูกค้า" />
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card">
        {loading ? (
          <div className="state">กำลังโหลด…</div>
        ) : items.length === 0 ? (
          <div className="state">
            ยังไม่มีใบเสนอราคา — <Link href="/quotations/new">สร้างใบแรก</Link>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>เลขที่</th>
                <th>ลูกค้า</th>
                <th>วันที่ออก</th>
                <th style={{ textAlign: "right" }}>ยอดสุทธิ</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((x) => (
                <tr key={x.id} className="row-link" onClick={() => router.push(`/quotations/${x.id}`)}>
                  <td className="code">{x.quotationNo}</td>
                  <td>{x.customerName}</td>
                  <td className="mono" style={{ fontSize: 13 }}>{x.issueDate}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{fmtMoney(x.total)}</td>
                  <td><span className={`badge ${statusClass[x.status]}`}>{quotationStatusLabel[x.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination page={page} pageCount={pageCount} total={total} onPage={setPage} />
    </>
  );
}
