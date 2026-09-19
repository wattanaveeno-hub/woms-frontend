"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import Pagination, { usePagination } from "@/components/Pagination";
import ServerImport from "@/components/ServerImport";
import { useToast } from "@/components/Toast";
import { num } from "@/lib/xlsx";
import type {
  Equipment,
  EquipmentStatus,
  EquipmentFormValues,
  EquipmentSummary,
  Options,
  PmStatus,
  WarrantyStatus,
} from "@/lib/types";
import { equipmentStatusLabel, pmStatusLabel, warrantyStatusLabel } from "@/lib/options";
import {
  EquipmentStatusBadge,
  WarrantyBadge,
  NeedsSerialBadge,
  PmBadge,
} from "@/components/EquipmentBadges";
import { setJobPrefill } from "@/lib/jobPrefill";

const STATUSES: EquipmentStatus[] = ["IN_STOCK", "RESERVED", "RENTED", "SOLD", "REPAIR", "RETIRED"];
const WARRANTIES: WarrantyStatus[] = ["ACTIVE", "EXPIRING", "EXPIRED", "NONE"];
const PM_STATUSES: PmStatus[] = ["NOT_CONFIGURED", "ON_SCHEDULE", "DUE_SOON", "OVERDUE"];

// คอลัมน์ทั้งหมดของตารางคลัง — ผู้ใช้เลือกซ่อน/แสดงได้เอง แล้วระบบจำไว้ให้
type ColumnKey =
  | "serial"
  | "model"
  | "category"
  | "status"
  | "customerName"
  | "site"
  | "warehouse"
  | "address"
  | "supplier"
  | "inboundDate"
  | "warrantyEnd"
  | "warranty"
  | "pm"
  | "alert";

const COLUMNS: { key: ColumnKey; label: string; defaultOn: boolean }[] = [
  { key: "serial", label: "Serial", defaultOn: true },
  { key: "model", label: "รุ่น", defaultOn: true },
  { key: "category", label: "หมวดหมู่", defaultOn: false },
  { key: "status", label: "สถานะ", defaultOn: true },
  { key: "customerName", label: "ลูกค้า/ผู้ถือครอง", defaultOn: true },
  // สาขา/ร้านของลูกค้า — ปิดไว้เป็นค่าเริ่มต้นเพื่อไม่เปลี่ยนตารางของผู้ใช้เดิม
  { key: "site", label: "สาขา/ร้าน", defaultOn: false },
  { key: "warehouse", label: "คลัง", defaultOn: false },
  { key: "address", label: "ที่อยู่ปัจจุบัน", defaultOn: true },
  { key: "supplier", label: "Supplier", defaultOn: false },
  { key: "inboundDate", label: "วันรับเข้า", defaultOn: false },
  { key: "warrantyEnd", label: "หมดประกัน", defaultOn: true },
  { key: "warranty", label: "ประกัน", defaultOn: true },
  // ปิดไว้เป็นค่าเริ่มต้น — ผู้ใช้เดิมที่ตั้งค่าคอลัมน์ไว้แล้วจะไม่เห็นตารางเปลี่ยนเอง
  { key: "pm", label: "PM", defaultOn: false },
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
    case "site":
      return it.siteLabel ?? "";
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
    case "pm":
      // เรียงตามความเร่งด่วน: เกินกำหนด → ใกล้ครบ → ตามกำหนด → ยังไม่ตั้งรอบ
      return { OVERDUE: 0, DUE_SOON: 1, ON_SCHEDULE: 2, NOT_CONFIGURED: 3 }[it.pmStatus] ?? 9;
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
  const [pmStatus, setPmStatus] = useState<PmStatus | "">("");
  const [q, setQ] = useState("");
  const toast = useToast();

  // Export ใช้ตัวกรองชุดเดียวกับที่หน้าจอกำลังแสดง — "สิ่งที่เห็น = สิ่งที่ได้"
  const exportQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (warranty) p.set("warranty", warranty);
    if (model) p.set("model", model);
    if (zone) p.set("zone", zone);
    if (category) p.set("category", category);
    if (warehouse) p.set("warehouse", warehouse);
    if (serialState) p.set("serialState", serialState);
    if (pmStatus) p.set("pmStatus", pmStatus);
    if (q) p.set("q", q);
    return p.toString() ? `?${p}` : "";
  }, [status, warranty, model, zone, category, warehouse, serialState, pmStatus, q]);
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
    // ?pmStatus= — ใช้โดยการ์ด PM บนแดชบอร์ด (ค่าที่ไม่รู้จักจะถูกละเว้น)
    const pm = params.get("pmStatus");
    if (pm && (PM_STATUSES as string[]).includes(pm)) setPmStatus(pm as PmStatus);
    const st = params.get("status");
    if (st && (STATUSES as string[]).includes(st)) setStatus(st as EquipmentStatus);
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
        pmStatus: pmStatus || undefined,
        q: q || undefined,
      });
      setItems(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [status, warranty, model, zone, category, warehouse, serialState, pmStatus, q]);

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

  // ---- การเลือกเครื่อง (ใช้ id ของเครื่อง ไม่ใช่ serial) ----
  // เก็บตัวเครื่องไว้ด้วย เพื่อให้แถบสรุปยังแสดงได้แม้ผู้ใช้เปลี่ยน filter จนแถวนั้นหายไปจากตาราง
  // การเปลี่ยน filter / sort / หน้า จึงไม่ล้างสิ่งที่เลือกไว้
  const canCreateJob = has("jobs:create");
  const [selected, setSelected] = useState<Map<string, Equipment>>(new Map());
  const [typePickerOpen, setTypePickerOpen] = useState(false);

  const toggleOne = (it: Equipment) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(it.id)) next.delete(it.id);
      else next.set(it.id, it);
      return next;
    });
  };

  const pageAllSelected = pageItems.length > 0 && pageItems.every((it) => selected.has(it.id));

  // "เลือกทั้งหมด" = เฉพาะแถวที่มองเห็นอยู่ในหน้านี้เท่านั้น
  const togglePage = () => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (pageAllSelected) pageItems.forEach((it) => next.delete(it.id));
      else pageItems.forEach((it) => next.set(it.id, it));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Map());

  // เลือกประเภทงานแล้วไปหน้าเปิดงาน — ไม่บันทึกงานให้อัตโนมัติ ผู้ใช้ต้องกดบันทึกเอง
  const startCreateJob = (jobType: string) => {
    setJobPrefill({ equipmentIds: [...selected.keys()], jobType });
    setTypePickerOpen(false);
    router.push("/jobs/new");
  };

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
          <ServerImport
            label="เครื่อง"
            perm="equipment:create"
            templatePath="/api/equipment/import/template.xlsx"
            templateName="woms-equipment-template.xlsx"
            onImport={(b64, dryRun) => api.importEquipment(b64, dryRun)}
            onDone={load}
          />
          {has("equipment:view") ? (
            <button
              className="btn"
              onClick={() =>
                downloadFile(
                  `/api/equipment/export.xlsx${exportQuery}`,
                  "woms-equipment.xlsx"
                ).catch((e) => toast.error(e.message))
              }
            >
              Export Excel
            </button>
          ) : null}
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
        <div className="field">
          <label>PM</label>
          <select className="select" value={pmStatus} onChange={(e) => setPmStatus(e.target.value as PmStatus | "")}>
            <option value="">ทั้งหมด</option>
            {PM_STATUSES.map((p) => (
              <option key={p} value={p}>
                {pmStatusLabel[p]}
              </option>
            ))}
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

      {canCreateJob && selected.size > 0 ? (
        <div className="card card-pad" style={{ marginBottom: 10 }}>
          <div className="toolbar" style={{ marginTop: 0, alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <strong>เลือกแล้ว {selected.size} เครื่อง</strong>
              <div className="sub" style={{ marginTop: 2 }}>
                {[...selected.values()].slice(0, 4).map((e) => e.serial).join(", ")}
                {selected.size > 4 ? ` และอีก ${selected.size - 4} เครื่อง` : ""}
              </div>
            </div>
            <div className="head-actions">
              <button className="btn" onClick={clearSelection}>
                ล้างที่เลือก
              </button>
              <div className="col-picker">
                <button className="btn btn-primary" onClick={() => setTypePickerOpen((o) => !o)}>
                  สร้างงาน
                </button>
                {typePickerOpen ? (
                  <div className="col-picker-panel" style={{ minWidth: 200 }}>
                    <div className="sub" style={{ padding: "2px 0 6px" }}>เลือกประเภทงาน</div>
                    {(options?.jobTypes ?? []).map((t) => (
                      <label key={t.value} style={{ cursor: "pointer" }} onClick={() => startCreateJob(t.value)}>
                        {t.label}
                      </label>
                    ))}
                    {!options?.jobTypes?.length ? <div className="sub">โหลดประเภทงานไม่สำเร็จ</div> : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
                  {canCreateJob ? (
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        checked={pageAllSelected}
                        onChange={togglePage}
                        aria-label="เลือกทั้งหมดในหน้านี้"
                      />
                    </th>
                  ) : null}
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
                    {canCreateJob ? (
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(it.id)}
                          onChange={() => toggleOne(it)}
                          aria-label={`เลือกเครื่อง ${it.serial}`}
                        />
                      </td>
                    ) : null}
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
                    {shows("customerName") ? (
                      <td>
                        {it.customerId ? (
                          <Link href={`/partners/${it.customerId}`}>{it.customerName || "(ไม่ระบุชื่อ)"}</Link>
                        ) : (
                          it.customerName || "—"
                        )}
                      </td>
                    ) : null}
                    {shows("site") ? <td>{it.siteLabel || "—"}</td> : null}
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
                    {shows("pm") ? (
                      <td>
                        <PmBadge status={it.pmStatus} />
                        {it.nextPmDate ? (
                          <div className="row-alert" style={{ color: it.pmDaysLeft < 0 ? "#b3261e" : "#6b7a86" }}>
                            {it.nextPmDate}
                            {it.pmDaysLeft >= 0 ? ` · เหลือ ${it.pmDaysLeft} วัน` : ` · เกิน ${Math.abs(it.pmDaysLeft)} วัน`}
                          </div>
                        ) : null}
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
