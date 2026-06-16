"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { InventoryRow } from "@/lib/types";

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .equipmentInventory()
      .then((res) => setRows(res.rows))
      .catch((e) => setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  const sum = (k: keyof InventoryRow) => rows.reduce((s, r) => s + (r[k] as number), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>สต็อกรวม (ตามหมวด/รุ่น)</h1>
          <div className="sub">สรุปจำนวนเครื่องจริงในคลัง แยกตามหมวดหมู่และรุ่น</div>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card">
        {loading ? (
          <div className="state">กำลังโหลด…</div>
        ) : rows.length === 0 ? (
          <div className="state">ยังไม่มีเครื่องในคลัง</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>หมวดหมู่</th>
                <th>รุ่น</th>
                <th style={{ textAlign: "right" }}>ทั้งหมด</th>
                <th style={{ textAlign: "right" }}>ว่าง</th>
                <th style={{ textAlign: "right" }}>เช่า</th>
                <th style={{ textAlign: "right" }}>ขายแล้ว</th>
                <th style={{ textAlign: "right" }}>ซ่อม</th>
                <th style={{ textAlign: "right" }}>ปลดระวาง</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.category}||${r.model}`}>
                  <td>{r.category}</td>
                  <td>{r.model}</td>
                  <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>{r.total}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{r.inStock}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{r.rented}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{r.sold}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{r.repair}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{r.retired}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} style={{ fontWeight: 700, textAlign: "right" }}>รวม</td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>{sum("total")}</td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>{sum("inStock")}</td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>{sum("rented")}</td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>{sum("sold")}</td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>{sum("repair")}</td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>{sum("retired")}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
