"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import Pagination, { usePagination } from "@/components/Pagination";
import BulkImport from "@/components/BulkImport";
import { num } from "@/lib/xlsx";
import type {
  Equipment,
  EquipmentStatus,
  EquipmentFormValues,
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
  const { has } = useAuth();
  const [items, setItems] = useState<Equipment[]>([]);
  const { page, setPage, pageCount, pageItems, total } = usePagination(items, 10);
  // initialise warranty filter from URL (?warranty=) — used by notification deep-links
  useEffect(() => {
    const w = new URLSearchParams(window.location.search).get("warranty");
    if (w === "EXPIRING" || w === "EXPIRED" || w === "ACTIVE" || w === "NONE") {
      setWarranty(w as WarrantyStatus);
    }
  }, []);
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
<div className="head-actions">
          <BulkImport<EquipmentFormValues>
            label="เครื่อง"
            templateName="equipment-template.xlsx"
            perm="equipment:create"
            headers={["Serial", "รุ่น", "หมวดหมู่", "สถานะ", "ลูกค้า/ผู้ถือครอง", "สถานที่", "วันรับเข้า", "lat", "lng", "เริ่มประกันศูนย์", "ประกันศูนย์(เดือน)", "เริ่มประกันลูกค้า", "ประกันลูกค้า(เดือน)", "หมายเหตุ"]}
            example={["SN-0001", "RO-300", "RO", "IN_STOCK", "", "คลังกลาง", "2026-01-15", "", "", "2026-01-15", "12", "", "", "ตัวอย่าง"]}
            toValues={(r) => {
              const serial = r["Serial"] || r["serial"] || "";
              if (!serial) return { ok: false, error: "ไม่มี Serial" };
              const sraw = (r["สถานะ"] || "").trim();
              const smap: Record<string, EquipmentStatus> = { "ว่าง (ในคลัง)": "IN_STOCK", "ปล่อยเช่า": "RENTED", "ขายแล้ว": "SOLD", "ส่งซ่อม": "REPAIR", "ปลดระวาง": "RETIRED" };
              const codes = ["IN_STOCK", "RENTED", "SOLD", "REPAIR", "RETIRED"];
              let status: EquipmentStatus = "IN_STOCK";
              if (sraw) {
                if (codes.includes(sraw)) status = sraw as EquipmentStatus;
                else if (smap[sraw]) status = smap[sraw];
                else return { ok: false, error: "สถานะไม่ถูกต้อง: " + sraw };
              }
              return { ok: true, value: {
                serial, model: r["รุ่น"] || "", category: r["หมวดหมู่"] || "", status,
                customerName: r["ลูกค้า/ผู้ถือครอง"] || "", location: r["สถานที่"] || "",
                inboundDate: r["วันรับเข้า"] || "", lat: num(r["lat"]), lng: num(r["lng"]),
                supplierWarrantyStart: r["เริ่มประกันศูนย์"] || "", supplierWarrantyMonths: num(r["ประกันศูนย์(เดือน)"]),
                customerWarrantyStart: r["เริ่มประกันลูกค้า"] || "", customerWarrantyMonths: num(r["ประกันลูกค้า(เดือน)"]),
                note: r["หมายเหตุ"] || "",
              } };
            }}
            create={(v) => api.createEquipment(v)}
            onDone={load}
          />
          {has("equipment:create") ? (
            <Link href="/equipment/new" className="btn btn-primary">
              + เพิ่มเครื่อง
            </Link>
          ) : null}
        </div>
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
            className="stat stat-btn amber"
            onClick={() => setWarranty(warranty === "EXPIRING" ? "" : "EXPIRING")}
            style={warranty === "EXPIRING" ? { outline: "2px solid var(--open)" } : undefined}
          >
            <div className="stat-num">{summary.warrantyExpiring}</div>
            <div className="stat-label">ใกล้หมดประกัน</div>
          </button>
          <button
            className="stat stat-btn red"
            onClick={() => setWarranty(warranty === "EXPIRED" ? "" : "EXPIRED")}
            style={warranty === "EXPIRED" ? { outline: "2px solid var(--danger)" } : undefined}
          >
            <div className="stat-num">{summary.warrantyExpired}</div>
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
              {pageItems.map((it) => (
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
      <Pagination page={page} pageCount={pageCount} total={total} onPage={setPage} />
    </>
  );
}
