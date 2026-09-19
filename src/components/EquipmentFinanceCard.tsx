"use client";

// ---------------------------------------------------------------------------
// รายรับ / รายจ่าย / ผลต่างสุทธิ ของเครื่องหนึ่งเครื่อง
// ---------------------------------------------------------------------------
// ที่มา: ชีตหลัก "รวบรวมรายรับ รายจ่าย … เพื่อคำนวณผลต่างรายรับและรายจ่ายสุทธิของเครื่องได้"
// ทุกยอดมีแหล่งที่มากำกับ และแหล่งที่ปันส่วนลงรายเครื่องไม่ได้จะถูกแสดงว่า "ไม่รวม" พร้อมเหตุผล

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { EquipmentFinance } from "@/lib/types";

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 2 });

export default function EquipmentFinanceCard({ equipmentId }: { equipmentId: string }) {
  const [data, setData] = useState<EquipmentFinance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api.equipmentFinance(equipmentId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลรายรับ/รายจ่ายไม่สำเร็จ");
    }
  }, [equipmentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <div className="card card-pad" style={{ marginTop: 16 }}><div className="state">กำลังโหลด…</div></div>;

  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>รายรับ / รายจ่ายของเครื่องนี้</h2>

      <div className="filters" style={{ marginBottom: 12 }}>
        <div className="stat">
          <div className="stat-num">{baht(data.revenueTotal)}</div>
          <div className="stat-label">รายรับรวม</div>
        </div>
        <div className="stat">
          <div className="stat-num">{baht(data.costTotal)}</div>
          <div className="stat-label">รายจ่ายรวม</div>
        </div>
        <div className="stat">
          <div className="stat-num">{baht(data.net)}</div>
          <div className="stat-label">ผลต่างสุทธิ</div>
        </div>
      </div>

      {data.bySource.length > 0 && (
        <table className="table" style={{ marginBottom: 12 }}>
          <thead>
            <tr>
              <th>แหล่งที่มา</th>
              <th>รายรับ</th>
              <th>รายจ่าย</th>
            </tr>
          </thead>
          <tbody>
            {data.bySource.map((b) => (
              <tr key={b.source}>
                <td>{b.label}</td>
                <td className="mono">{baht(b.revenue)}</td>
                <td className="mono">{baht(b.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data.lines.length === 0 ? (
        <div className="state">ยังไม่มีรายการรายรับ/รายจ่ายของเครื่องนี้</div>
      ) : (
        <details>
          <summary>รายการทั้งหมด ({data.lines.length})</summary>
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>แหล่ง</th>
                  <th>อ้างอิง</th>
                  <th>รายละเอียด</th>
                  <th>รายรับ</th>
                  <th>รายจ่าย</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l, i) => (
                  <tr key={`${l.ref}-${i}`}>
                    <td className="mono">{l.date || "—"}</td>
                    <td>{l.sourceLabel}</td>
                    <td className="mono">
                      {l.source === "JOB" || l.source === "PARTS" ? (
                        <Link href={`/jobs/${l.ref}`}>{l.ref}</Link>
                      ) : (
                        l.ref
                      )}
                    </td>
                    <td>{l.description}</td>
                    <td className="mono">{l.revenue ? baht(l.revenue) : "—"}</td>
                    <td className="mono">{l.cost ? baht(l.cost) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {data.excluded.length > 0 && (
        <div className="alert" style={{ marginTop: 12 }}>
          <strong>แหล่งที่ไม่ได้นำมารวม (ตั้งใจ)</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {data.excluded.map((x, i) => (
              <li key={i}>
                <strong>{x.source}</strong> — {x.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
