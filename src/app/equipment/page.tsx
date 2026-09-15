"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { EquipmentStatusBadge, WarrantyBadge, NeedsSerialBadge } from "@/components/EquipmentBadges";

const STATUSES: EquipmentStatus[] = ["IN_STOCK", "RESERVED", "RENTED", "SOLD", "REPAIR", "RETIRED"];
const WARRANTIES: WarrantyStatus[] = ["ACTIVE", "EXPIRING", "EXPIRED", "NONE"];

// คอลัมน์ทั้งหมดของตารางคลัง — ผู้ใช้เลือกซ่อน/แสดงได้เอง แล้วระบบจำไว้ให้
type ColumnKey =
  | "serial"
  | "model"
  | "category"
  | "status"
  | "customerName"
  | "warehouse"
  | "address"
  | "supplier"
  | "inboundDate"
  | "warrantyEnd"
  | "warranty"
  | "alert";

const COLUMNS: { key: ColumnKey; label: string; defaultOn: boolean }[] = [
  { key: "serial", label: "Serial", defaultOn: true },
  { key: "model", label: "รุ่น", defaultOn: true },
  { key: "category", label: "หมวดหมู่", defaultOn: false },
  { key: "status", label: "สถานะ", defaultOn: true },
  { key: "customerName", label: "ลูกค้า/ผู้ถือครอง", defaultOn: true },
  { key: "warehouse", label: "คลัง", defaultOn: false },
  { key: "address", label: "ที่อยู่ปัจจุบัน", defaultOn: true },
  { key: "supplier", label: "Supplier", defaultOn: false },
  { key: "inboundDate", label: "วันรับเข้า", defaultOn: false },
  { key: "warrantyEnd", label: "หมดประกัน", defaultOn: true },
  { key: "warranty", label: "ประกัน", defaultOn: true },
  { key: "alert", label: "แจ้งเตือน", defaultOn: true },
];

const COLUMN_STORAGE_KEY = "woms_equipment_columns";

// ค่าที่ใช้เรียงของแต่ละคอลัมน์
function sortValue(it: Equipment, key: ColumnKey): string | number {
  switch (key) {
    case "serial":
      return it.serial;
    case "model":
      return it.model;
    case "category":
      return it.category;
    case "status":
      return equipmentStatusLabel[it.status] ?? it.status;
    case "customerName":
      return it.customerName;
    case "warehouse":
      return it.warehouse ?? "";
    case "address":
      return it.addressFull || it.location || "";
    case "supplier":
      return it.supplier ?? "";
    case "inboundDate":
      return it.inboundDate || "";
    case "warrantyEnd":
      return it.warrantyEnd || "9999-99-99"; // ไม่มีข้อมูล → ไปท้ายสุด
    case "warranty":
      return it.warrantyDaysLeft ?? 0;
    case "alert":
      return it.needsSerial ? 0 : 1;
    default:
      return "";
  }
}

export default function EquipmentPage() {
  const router = useRouter();
  const { has } = useAuth();
  const [items, setItems] = useState<Equipment[]>([]);
  const [options, setOptions] = useState<Options | null>(null);
  const [summary, setSummary] = useState<EquipmentSummary | null>(null);
  const [status, setStatus] = useState<EquipmentStatus | "">("");
  const [warranty, setWarranty] = useState<WarrantyStatus | "">("");
  const [model, setModel] = useState("");
  const [zone, setZone] = useState("");
  const [category, setCategory] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [serialState, setSerialState] = useState<"" | "REAL" | "TEMP">("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // การเรียงลำดับ (กดหัวคอลัมน์)
  const [sortKey, setSortKey] = useState<ColumnKey>("serial");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // คอลัมน์ที่เลือกแสดง
  const [visible, setVisible] = useState<ColumnKey[]>(() =>
    COLUMNS.filter((c) => c.defaultOn).map((c) => c.key)
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  // initialise warranty filter from URL (?warranty=) — used by notification deep-links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const w = params.get("warranty");
    if (w === "EXPIRING" || w === "EXPIRED" || w === "ACTIVE" || w === "NONE") {
      setWarranty(w as WarrantyStatus);
    }
    if (params.get("serialState") === "TEMP") setSerialState("TEMP");
    try {
      const saved = localStorage.getItem(COLUMN_STORAGE_KEY);
      if (saved) {
        const keys = JSON.parse(saved) as ColumnKey[];
        const valid = keys.filter((k) => COLUMNS.some((c) => c.key === k));
        if (valid.length) setVisible(valid);
      }
    } catch {
      /* จำค่าคอลัมน์ไม่ได้ก็ใช้ค่าเริ่มต้น */
    }
  }, []);

  const toggleColumn = (key: ColumnKey) => {
    setVisible((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      const ordered = COLUMNS.filter((c) => next.includes(c.key)).map((c) => c.key);
      try {
        localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(ordered));
      } catch {
        /* ignore */
      }
      return ordered;
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listEquipment({
        status: status || undefined,
        warranty: warranty || undefined,
        model: model || undefined,
        zone: zone || undefined,
        category: category || undefined,
        warehouse: warehouse || undefined,
        serialState: serialState || undefined,
        q: q || undefined,
      });
      setItems(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [status, warranty, model, zone, category, warehouse, serialState, q]);

  useEffect(() => {
    api.getOptions().then(setOptions).catch(() => setOptions(null));
    api.equipmentSummary().then(setSummary).catch(() => setSummary(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "th");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [items, sortKey, sortDir]);

  const { page, setPage, pageCount, pageItems, total } = usePagination(sorted, 10);

  const onSort = (key: ColumnKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const shows = (key: ColumnKey) => visible.includes(key);
  const tempCount = items.filter((i) => i.needsSerial).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>คลังเครื่อง</h1>
          <div className="sub">
            {items.length} เครื่อง{tempCount ? ` · ยังไม่มี SN ${tempCount} เครื่อง` : ""}
          </div>
        </div>
<div className="head-actions">
          <BulkImport<EquipmentFormValues>
            label="เครื่อง"
            templateName="equipment-template.xlsx"
            perm="equipment:create"
            headers={["Serial", "รุ่น", "หมวดหมู่", "สถานะ", "ลูกค้า/ผู้ถือครอง", "Supplier", "คลัง", "สถานที่", "ที่อยู่", "อำเภอ/เขต", "จังหวัด", "รหัสไปรษณีย์", "โซน", "วันรับเข้า", "lat", "lng", "เริ่มประกันแบรนด์", "ประกันแบรนด์(เดือน)", "เริ่มประกันตัวแทน", "ประกันตัวแทน(เดือน)", "หมายเหตุ"]}
            example={["SN-0001", "RO-300", "เครื่องกรองน้ำ", "IN_STOCK", "", "บจก. ซัพพลายเออร์ A", "คลังหลัก", "คลังกลาง", "99 ถนนสุขุมวิท", "คลองเตย", "กรุงเทพมหานคร", "10110", "โซนกลาง", "2026-01-15", "", "", "2026-01-15", "12", "", "", "ตัวอย่าง"]}
            toValues={(r) => {
              // Serial เว้นว่างได้ — ระบบจะออกเลขชั่วคราว TMP- ให้เอง
              const serial = r["Serial"] || r["serial"] || "";
              const sraw = (r["สถานะ"] || "").trim();
              const smap: Record<string, EquipmentStatus> = { "ว่าง (ในคลัง)": "IN_STOCK", "จอง": "RESERVED", "ปล่อยเช่า": "RENTED", "ขายแล้ว": "SOLD", "ส่งซ่อม": "REPAIR", "ปลดระวาง": "RETIRED" };
              const codes = ["IN_STOCK", "RESERVED", "RENTED", "SOLD", "REPAIR", "RETIRED"];
              let status: EquipmentStatus = "IN_STOCK";
              if (sraw) {
                if (codes.includes(sraw)) status = sraw as EquipmentStatus;
                else if (smap[sraw]) status = smap[sraw];
                else return { ok: false, error: "สถานะไม่ถูกต้อง: " + sraw };
              }
              if (!r["รุ่น"]) return { ok: false, error: "ไม่มีรุ่นเครื่อง" };
              const warranties: EquipmentFormValues["warranties"] = [];
              if (r["เริ่มประกันแบรนด์"] || num(r["ประกันแบรนด์(เดือน)"])) {
                warranties.push({ provider: "BRAND", providerName: "", start: r["เริ่มประกันแบรนด์"] || "", months: num(r["ประกันแบรนด์(เดือน)"]), coverage: "", note: "" });
              }
              if (r["เริ่มประกันตัวแทน"] || num(r["ประกันตัวแทน(เดือน)"])) {
                warranties.push({ provider: "AGENT", providerName: "", start: r["เริ่มประกันตัวแทน"] || "", months: num(r["ประกันตัวแทน(เดือน)"]), coverage: "", note: "" });
              }
              return { ok: true, value: {
                serial, model: r["รุ่น"] || "", category: r["หมวดหมู่"] || "", status,
                customerName: r["ลูกค้า/ผู้ถือครอง"] || "", supplier: r["Supplier"] || "",
                warehouse: r["คลัง"] || "", location: r["สถานที่"] || "",
                address: r["ที่อยู่"] || "", district: r["อำเภอ/เขต"] || "", province: r["จังหวัด"] || "",
                postcode: r["รหัสไปรษณีย์"] || "", zone: r["โซน"] || "",
                inboundDate: r["วันรับเข้า"] || "", lat: num(r["lat"]), lng: num(r["lng"]),
                warranties,
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
            <div className="stat-num">{summary.byStatus.RESERVED ?? 0}</div>
            <div className="stat-label">จอง</div>
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
          <button
            className="stat stat-btn red"
            onClick={() => setSerialState(serialState === "TEMP" ? "" : "TEMP")}
            style={serialState === "TEMP" ? { outline: "2px solid var(--danger)" } : undefined}
          >
            <div className="stat-num">{tempCount}</div>
            <div className="stat-label">ยังไม่มี SN</div>
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
        <div className="field">
          <label>หมวดหมู่</label>
          {options?.categories?.length ? (
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">ทุกหมวด</option>
              {options.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="หมวดหมู่" />
          )}
        </div>
        <div className="field">
          <label>คลัง</label>
          {options?.warehouses?.length ? (
            <select className="select" value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
              <option value="">ทุกคลัง</option>
              {options.warehouses.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          ) : (
            <input className="input" value={warehouse} onChange={(e) => setWarehouse(e.target.value)} placeholder="คลัง" />
          )}
        </div>
        <div className="field">
          <label>โซน</label>
          {options?.zones?.length ? (
            <select className="select" value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="">ทุกโซน</option>
              {options.zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          ) : (
            <input className="input" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="โซน" />
          )}
        </div>
        <div className="field">
          <label>Serial</label>
          <select className="select" value={serialState} onChange={(e) => setSerialState(e.target.value as "" | "REAL" | "TEMP")}>
            <option value="">ทั้งหมด</option>
            <option value="TEMP">ยังไม่มี SN จริง</option>
            <option value="REAL">มี SN จริงแล้ว</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>ค้นหา</label>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="serial / รุ่น / ลูกค้า / supplier / ที่อยู่"
          />
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card">
        <div className="card-pad" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 0 }}>
          <span className="sub">เรียงตาม: {COLUMNS.find((c) => c.key === sortKey)?.label} ({sortDir === "asc" ? "น้อย→มาก" : "มาก→น้อย"})</span>
          <div className="col-picker">
            <button className="btn" onClick={() => setPickerOpen((o) => !o)}>
              เลือกคอลัมน์ ({visible.length}/{COLUMNS.length})
            </button>
            {pickerOpen ? (
              <div className="col-picker-panel">
                {COLUMNS.map((c) => (
                  <label key={c.key}>
                    <input
                      type="checkbox"
                      checked={shows(c.key)}
                      onChange={() => toggleColumn(c.key)}
                      disabled={shows(c.key) && visible.length === 1}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="state">กำลังโหลด…</div>
        ) : items.length === 0 ? (
          <div className="state">
            ยังไม่มีเครื่องที่ตรงเงื่อนไข — <Link href="/equipment/new">เพิ่มเครื่องแรก</Link>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  {COLUMNS.filter((c) => shows(c.key)).map((c) => (
                    <th key={c.key} className="th-sort" onClick={() => onSort(c.key)}>
                      {c.label}
                      {sortKey === c.key ? <span className="arrow">{sortDir === "asc" ? "▲" : "▼"}</span> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((it) => (
                  <tr key={it.id} className="row-link" onClick={() => router.push(`/equipment/${it.id}`)}>
                    {shows("serial") ? (
                      <td className="code">
                        {it.serial}
                        {it.needsSerial ? <div className="row-alert" style={{ color: "#b3261e" }}>ชั่วคราว</div> : null}
                      </td>
                    ) : null}
                    {shows("model") ? <td>{it.model || "—"}</td> : null}
                    {shows("category") ? <td>{it.category || "—"}</td> : null}
                    {shows("status") ? (
                      <td>
                        <EquipmentStatusBadge status={it.status} />
                      </td>
                    ) : null}
                    {shows("customerName") ? <td>{it.customerName || "—"}</td> : null}
                    {shows("warehouse") ? <td>{it.warehouse || "—"}</td> : null}
                    {shows("address") ? (
                      <td style={{ fontSize: 13 }}>
                        <div>{it.addressFull || it.location || "—"}</div>
                        {it.zone ? <div style={{ color: "#6b7a86" }}>{it.zone}</div> : null}
                      </td>
                    ) : null}
                    {shows("supplier") ? <td>{it.supplier || "—"}</td> : null}
                    {shows("inboundDate") ? <td className="mono" style={{ fontSize: 13 }}>{it.inboundDate || "—"}</td> : null}
                    {shows("warrantyEnd") ? (
                      <td className="mono" style={{ fontSize: 13 }}>
                        {it.warrantyEnd || "—"}
                        {it.warrantyEnd ? (
                          <div className="row-alert" style={{ color: it.warrantyDaysLeft < 0 ? "#b3261e" : "#6b7a86" }}>
                            {it.warrantyDaysLeft >= 0
                              ? `เหลือ ${it.warrantyDaysLeft} วัน`
                              : `เกิน ${Math.abs(it.warrantyDaysLeft)} วัน`}
                          </div>
                        ) : null}
                      </td>
                    ) : null}
                    {shows("warranty") ? (
                      <td>
                        <WarrantyBadge status={it.warrantyStatus} />
                      </td>
                    ) : null}
                    {shows("alert") ? <td>{it.needsSerial ? <NeedsSerialBadge /> : "—"}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination page={page} pageCount={pageCount} total={total} onPage={setPage} />
    </>
  );
}
