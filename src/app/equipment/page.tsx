"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type {
  Equipment,
  EquipmentStatus,
  EquipmentSummary,
  Options,
  WarrantyStatus,
} from "@/lib/types";
import { equipmentStatusLabel, warrantyStatusLabel } from "@/lib/options";
import { EquipmentStatusBadge, WarrantyBadge } from "@/components/EquipmentBadges";

const STATUSES: EquipmentStatus[] = ["IN_STOCK", "RENTED", "SOLD", "REPAIR", "RETIRED"];
const WARRANTIES: WarrantyStatus[] = ["ACTIVE", "EXPIRING", "EXPIRED", "NONE"];

export default function EquipmentPage() {
  const router = useRouter();
  const [items, setItems] = useState<Equipment[]>([]);
  const [options, setOptions] = useState<Options | null>(null);
  const [summary, setSummary] = useState<EquipmentSummary | null>(null);
  const [status, setStatus] = useState<EquipmentStatus | "">("");
  const [warranty, setWarranty] = useState<WarrantyStatus | "">("");
  const [model, setModel] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listEquipment({
        status: status || undefined,
        warranty: warranty || undefined,
        model: model || undefined,
        q: q || undefined,
      });
      setItems(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [status, warranty, model, q]);

  useEffect(() => {
    api.getOptions().then(setOptions).catch(() => setOptions(null));
    api.equipmentSummary().then(setSummary).catch(() => setSummary(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>คลังเครื่อง</h1>
          <div className="sub">{items.length} เครื่อง</div>
        </div>
        <Link href="/equipment/new" className="btn btn-primary">
          + เพิ่มเครื่อง
        </Link>
      </div>

      {summary ? (
        <div className="filters" style={{ marginBottom: 4 }}>
          <div className="stat">
            <div className="stat-num">{summary.total}</div>
            <div className="stat-label">ทั้งหมด</div>
          </div>
          <div className="stat">
            <div className="stat-num">{summary.byStatus.IN_STOCK ?? 0}</div>
            <div className="stat-label">ว่างในคลัง</div>
          </div>
          <div className="stat">
            <div className="stat-num">{summary.byStatus.RENTED ?? 0}</div>
            <div className="stat-label">ปล่อยเช่า</div>
          </div>
          <button
            className="stat stat-btn"
            onClick={() => setWarranty(warranty === "EXPIRING" ? "" : "EXPIRING")}
            style={warranty === "EXPIRING" ? { outline: "2px solid var(--open)" } : undefined}
          >
            <div className="stat-num" style={{ color: "var(--open)" }}>{summary.warrantyExpiring}</div>
            <div className="stat-label">ใกล้หมดประกัน</div>
          </button>
          <button
            className="stat stat-btn"
            onClick={() => setWarranty(warranty === "EXPIRED" ? "" : "EXPIRED")}
            style={warranty === "EXPIRED" ? { outline: "2px solid var(--danger)" } : undefined}
          >
            <div className="stat-num" style={{ color: "var(--danger)" }}>{summary.warrantyExpired}</div>
            <div className="stat-label">หมดประกัน</div>
          </button>
        </div>
      ) : null}

      <div className="filters">
        <div className="field">
          <label>สถานะ</label>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value as EquipmentStatus | "")}>
            <option value="">ทั้งหมด</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {equipmentStatusLabel[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>ประกัน</label>
          <select className="select" value={warranty} onChange={(e) => setWarranty(e.target.value as WarrantyStatus | "")}>
            <option value="">ทั้งหมด</option>
            {WARRANTIES.map((w) => (
              <option key={w} value={w}>
                {warrantyStatusLabel[w]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>รุ่น</label>
          {options?.models.length ? (
            <select className="select" value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="">ทุกรุ่น</option>
              {options.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="รุ่น" />
          )}
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>ค้นหา</label>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="serial / รุ่น / ลูกค้า / สถานที่"
          />
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card">
        {loading ? (
          <div className="state">กำลังโหลด…</div>
        ) : items.length === 0 ? (
          <div className="state">
            ยังไม่มีเครื่องที่ตรงเงื่อนไข — <Link href="/equipment/new">เพิ่มเครื่องแรก</Link>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Serial</th>
                <th>รุ่น</th>
                <th>สถานะ</th>
                <th>ลูกค้า/ผู้ถือครอง</th>
                <th>หมดประกัน</th>
                <th>ประกัน</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="row-link" onClick={() => router.push(`/equipment/${it.id}`)}>
                  <td className="code">{it.serial}</td>
                  <td>{it.model || "—"}</td>
                  <td>
                    <EquipmentStatusBadge status={it.status} />
                  </td>
                  <td>{it.customerName || "—"}</td>
                  <td className="mono" style={{ fontSize: 13 }}>{it.warrantyEnd || "—"}</td>
                  <td>
                    <WarrantyBadge status={it.warrantyStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
