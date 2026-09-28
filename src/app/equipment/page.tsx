"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
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
  NoContractBadge,
  PmBadge,
} from "@/components/EquipmentBadges";
import { setJobPrefill } from "@/lib/jobPrefill";
import { useUrlFilters } from "@/lib/urlFilters";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import {
  WomsDataTable,
  WomsFilterPanel,
  WomsPageHeader,
  WomsSearchBar,
  WomsSelectFilter,
  WomsStatCard,
  WomsStatGrid,
  type WomsColumn,
} from "@/components/woms";

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
  /*
   * QA BUG-009 — ตัวกรองทั้ง 9 ตัวสะท้อนลง URL
   * ส่งลิงก์ผลการกรองให้คนอื่นได้ · bookmark ได้ · F5 แล้วตัวกรองยังอยู่ ·
   * ปุ่ม Back ย้อนตัวกรองแทนการเด้งออกจากหน้า
   */
  const [f, setF] = useUrlFilters({
    status: "",
    warranty: "",
    model: "",
    zone: "",
    category: "",
    warehouse: "",
    serialState: "",
    contractState: "",
    pmStatus: "",
    q: "",
  });
  const status = f.status as EquipmentStatus | "";
  const warranty = f.warranty as WarrantyStatus | "";
  const model = f.model;
  const zone = f.zone;
  const category = f.category;
  const warehouse = f.warehouse;
  const serialState = f.serialState as "" | "REAL" | "TEMP";
  const contractState = f.contractState as "" | "MISSING";
  const setContractState = (v: "" | "MISSING") => setF({ contractState: v });
  const pmStatus = f.pmStatus as PmStatus | "";
  const q = f.q;
  const setStatus = (v: EquipmentStatus | "") => setF({ status: v });
  const setWarranty = (v: WarrantyStatus | "") => setF({ warranty: v });
  const setModel = (v: string) => setF({ model: v });
  const setZone = (v: string) => setF({ zone: v });
  const setCategory = (v: string) => setF({ category: v });
  const setWarehouse = (v: string) => setF({ warehouse: v });
  const setSerialState = (v: "" | "REAL" | "TEMP") => setF({ serialState: v });
  const setPmStatus = (v: PmStatus | "") => setF({ pmStatus: v });
  const setQ = (v: string) => setF({ q: v });
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
    if (contractState) p.set("contractState", contractState);
    if (pmStatus) p.set("pmStatus", pmStatus);
    if (q) p.set("q", q);
    return p.toString() ? `?${p}` : "";
  }, [status, warranty, model, zone, category, warehouse, serialState, contractState, pmStatus, q]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  // คอลัมน์ที่เลือกแสดง
  const [visible, setVisible] = useState<ColumnKey[]>(() =>
    COLUMNS.filter((c) => c.defaultOn).map((c) => c.key)
  );
  const [colAnchor, setColAnchor] = useState<HTMLElement | null>(null);

  // initialise warranty filter from URL (?warranty=) — used by notification deep-links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const w = params.get("warranty");
    if (w === "EXPIRING" || w === "EXPIRED" || w === "ACTIVE" || w === "NONE") {
      setWarranty(w as WarrantyStatus);
    }
    if (params.get("serialState") === "TEMP") setSerialState("TEMP");
    if (params.get("contractState") === "MISSING") setContractState("MISSING");
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

  // กันคำตอบที่มาช้าทับผลลัพธ์ใหม่กว่า (เช่น โหลดครั้งแรกก่อนอ่านตัวกรองจาก URL) — แบบเดียวกับหน้ารายการงาน
  const loadSeqRef = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
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
        contractState: contractState || undefined,
        pmStatus: pmStatus || undefined,
        q: q || undefined,
      });
      if (seq !== loadSeqRef.current) return;
      setItems(res.items);
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [status, warranty, model, zone, category, warehouse, serialState, contractState, pmStatus, q]);

  useEffect(() => {
    api.getOptions().then(setOptions).catch(() => setOptions(null));
    api.equipmentSummary().then(setSummary).catch(() => setSummary(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shows = (key: ColumnKey) => visible.includes(key);
  const tempCount = items.filter((i) => i.needsSerial).length;

  // ---- การเลือกเครื่อง (ใช้ id ของเครื่อง ไม่ใช่ serial) ----
  // เก็บตัวเครื่องไว้ด้วย เพื่อให้แถบสรุปยังแสดงได้แม้ผู้ใช้เปลี่ยน filter จนแถวนั้นหายไปจากตาราง
  // การเปลี่ยน filter / sort / หน้า จึงไม่ล้างสิ่งที่เลือกไว้
  const canCreateJob = has("jobs:create");
  const [selected, setSelected] = useState<Map<string, Equipment>>(new Map());
  const [typeAnchor, setTypeAnchor] = useState<HTMLElement | null>(null);

  const toggleOne = (it: Equipment) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(it.id)) next.delete(it.id);
      else next.set(it.id, it);
      return next;
    });
  };

  // "เลือกทั้งหมด" = เฉพาะแถวที่มองเห็นอยู่ในหน้านี้เท่านั้น (ตารางส่งแถวของหน้าปัจจุบันมาให้)
  const togglePage = (rows: Equipment[], all: boolean) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (all) rows.forEach((it) => next.set(it.id, it));
      else rows.forEach((it) => next.delete(it.id));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Map());

  // เลือกประเภทงานแล้วไปหน้าเปิดงาน — ไม่บันทึกงานให้อัตโนมัติ ผู้ใช้ต้องกดบันทึกเอง
  const startCreateJob = (jobType: string) => {
    setJobPrefill({ equipmentIds: [...selected.keys()], jobType });
    setTypeAnchor(null);
    router.push("/jobs/new");
  };

  const days = (n: number, over: boolean) => (over ? `เกิน ${Math.abs(n)} วัน` : `เหลือ ${n} วัน`);
  const sub = (text: React.ReactNode, danger?: boolean) => (
    <Typography component="div" variant="body2" sx={{ fontSize: 12.5, color: danger ? "error.main" : "text.secondary" }}>
      {text}
    </Typography>
  );

  const cellFor: Record<ColumnKey, (it: Equipment) => React.ReactNode> = {
    serial: (it) => (
      <>
        <Link href={`/equipment/${it.id}`} className="code" onClick={(e) => e.stopPropagation()}>
          {it.serial}
        </Link>
        {it.needsSerial ? sub("ชั่วคราว", true) : null}
      </>
    ),
    model: (it) => it.model || "—",
    category: (it) => it.category || "—",
    status: (it) => <EquipmentStatusBadge status={it.status} />,
    customerName: (it) =>
      it.customerId ? (
        <Link href={`/partners/${it.customerId}`} onClick={(e) => e.stopPropagation()}>
          {it.customerName || "(ไม่ระบุชื่อ)"}
        </Link>
      ) : (
        it.customerName || "—"
      ),
    site: (it) => it.siteLabel || "—",
    warehouse: (it) => it.warehouse || "—",
    address: (it) => (
      <Box sx={{ fontSize: 13 }}>
        <div>{it.addressFull || it.location || "—"}</div>
        {it.zone ? sub(it.zone) : null}
      </Box>
    ),
    supplier: (it) => it.supplier || "—",
    inboundDate: (it) => <span className="mono">{it.inboundDate || "—"}</span>,
    warrantyEnd: (it) => (
      <>
        <span className="mono">{it.warrantyEnd || "—"}</span>
        {it.warrantyEnd ? sub(days(it.warrantyDaysLeft, it.warrantyDaysLeft < 0), it.warrantyDaysLeft < 0) : null}
      </>
    ),
    warranty: (it) => <WarrantyBadge status={it.warrantyStatus} />,
    pm: (it) => (
      <>
        <PmBadge status={it.pmStatus} />
        {it.nextPmDate ? sub(`${it.nextPmDate} · ${days(it.pmDaysLeft, it.pmDaysLeft < 0)}`, it.pmDaysLeft < 0) : null}
      </>
    ),
    alert: (it) =>
      it.needsSerial || it.rentalWithoutContract ? (
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {it.needsSerial ? <NeedsSerialBadge /> : null}
          {it.rentalWithoutContract ? <NoContractBadge /> : null}
        </Stack>
      ) : (
        "—"
      ),
  };

  const columns: WomsColumn<Equipment>[] = COLUMNS.filter((c) => shows(c.key)).map((c) => ({
    key: c.key,
    label: c.label,
    sortValue: (it: Equipment) => sortValue(it, c.key),
    render: cellFor[c.key],
  }));

  const activeCount = [status, warranty, model, category, warehouse, zone, serialState, pmStatus, contractState].filter(Boolean).length;
  const clearFilters = () =>
    setF({ status: "", warranty: "", model: "", category: "", warehouse: "", zone: "", serialState: "", pmStatus: "", contractState: "" });

  return (
    <>
      <WomsPageHeader
        title="คลังเครื่อง"
        subtitle={loading ? "กำลังโหลด…" : `${items.length} เครื่อง${tempCount ? ` · ยังไม่มี SN ${tempCount} เครื่อง` : ""}`}
        actions={
          <>
            <ServerImport
              label="เครื่อง"
              perm="equipment:create"
              templatePath="/api/equipment/import/template.xlsx"
              templateName="woms-equipment-template.xlsx"
              onImport={(b64, dryRun) => api.importEquipment(b64, dryRun)}
              onDone={load}
            />
            {has("equipment:view") ? (
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() =>
                  downloadFile(`/api/equipment/export.xlsx${exportQuery}`, "woms-equipment.xlsx").catch((e) => toast.error(e.message))
                }
              >
                Export Excel
              </Button>
            ) : null}
            {/* B-09 — ขณะที่มีเครื่องถูกเลือก ปุ่มหลักของมุมมองคือ "สร้างงาน" ในแถบที่เลือก */}
            {has("equipment:create") ? (
              <Button
                component={Link}
                href="/equipment/new"
                variant={selected.size > 0 ? "outlined" : "contained"}
                startIcon={<AddIcon />}
              >
                เพิ่มเครื่อง
              </Button>
            ) : null}
          </>
        }
      />

      {summary ? (
        <WomsStatGrid max={8}>
          <WomsStatCard value={summary.total} label="ทั้งหมด" />
          <WomsStatCard value={summary.byStatus.IN_STOCK ?? 0} label="ว่างในคลัง" />
          <WomsStatCard value={summary.byStatus.RESERVED ?? 0} label="จอง" />
          <WomsStatCard value={summary.byStatus.RENTED ?? 0} label="ปล่อยเช่า" />
          <WomsStatCard
            value={summary.warrantyExpiring}
            label="ใกล้หมดประกัน"
            tone="warning"
            active={warranty === "EXPIRING"}
            onClick={() => setWarranty(warranty === "EXPIRING" ? "" : "EXPIRING")}
          />
          <WomsStatCard
            value={summary.warrantyExpired}
            label="หมดประกัน"
            tone="error"
            active={warranty === "EXPIRED"}
            onClick={() => setWarranty(warranty === "EXPIRED" ? "" : "EXPIRED")}
          />
          {/* สองการ์ดนี้นับจากรายการที่แสดงอยู่ (API สรุปยังไม่มีตัวเลขนี้) จึงบอกขอบเขตให้ชัด */}
          <WomsStatCard
            value={loading ? "…" : tempCount}
            label="ยังไม่มี SN"
            hint="ในรายการที่กรองอยู่"
            tone="error"
            active={serialState === "TEMP"}
            onClick={() => setSerialState(serialState === "TEMP" ? "" : "TEMP")}
          />
          <WomsStatCard
            value={loading ? "…" : items.filter((i) => i.rentalWithoutContract).length}
            label="เช่ายังไม่ผูกสัญญา"
            hint="ในรายการที่กรองอยู่"
            tone="error"
            active={contractState === "MISSING"}
            onClick={() => setContractState(contractState === "MISSING" ? "" : "MISSING")}
          />
        </WomsStatGrid>
      ) : null}

      <WomsFilterPanel
        search={<WomsSearchBar value={q} onChange={setQ} placeholder="serial / รุ่น / ลูกค้า / supplier / ที่อยู่" />}
        activeCount={activeCount}
        onClear={clearFilters}
      >
        <WomsSelectFilter
          label="สถานะ"
          value={status}
          onChange={(v) => setStatus(v as EquipmentStatus | "")}
          options={STATUSES.map((s) => ({ value: s, label: equipmentStatusLabel[s] }))}
        />
        <WomsSelectFilter
          label="ประกัน"
          value={warranty}
          onChange={(v) => setWarranty(v as WarrantyStatus | "")}
          options={WARRANTIES.map((w) => ({ value: w, label: warrantyStatusLabel[w] }))}
        />
        <WomsSelectFilter label="รุ่น" value={model} onChange={setModel} options={options?.models ?? []} allLabel="ทุกรุ่น" freeTextFallback />
        <WomsSelectFilter label="หมวดหมู่" value={category} onChange={setCategory} options={options?.categories ?? []} allLabel="ทุกหมวด" freeTextFallback />
        <WomsSelectFilter label="คลัง" value={warehouse} onChange={setWarehouse} options={options?.warehouses ?? []} allLabel="ทุกคลัง" freeTextFallback />
        <WomsSelectFilter label="โซน" value={zone} onChange={setZone} options={options?.zones ?? []} allLabel="ทุกโซน" freeTextFallback />
        <WomsSelectFilter
          label="Serial"
          value={serialState}
          onChange={(v) => setSerialState(v as "" | "REAL" | "TEMP")}
          options={[
            { value: "TEMP", label: "ยังไม่มี SN จริง" },
            { value: "REAL", label: "มี SN จริงแล้ว" },
          ]}
        />
        <WomsSelectFilter
          label="PM"
          value={pmStatus}
          onChange={(v) => setPmStatus(v as PmStatus | "")}
          options={PM_STATUSES.map((p) => ({ value: p, label: pmStatusLabel[p] }))}
        />
        <WomsSelectFilter
          label="สัญญา"
          value={contractState}
          onChange={(v) => setContractState(v as "" | "MISSING")}
          options={[{ value: "MISSING", label: "เช่ายังไม่ผูกสัญญา" }]}
        />
      </WomsFilterPanel>

      {canCreateJob && selected.size > 0 ? (
        <Paper
          variant="outlined"
          sx={{ p: 2, mb: 1.5, borderColor: "primary.main", position: { xs: "sticky", md: "static" }, top: 64, zIndex: 2 }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: "center" }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, color: "text.primary" }}>เลือกแล้ว {selected.size} เครื่อง</Typography>
              <Typography variant="body2" noWrap>
                {[...selected.values()].slice(0, 4).map((e) => e.serial).join(", ")}
                {selected.size > 4 ? ` และอีก ${selected.size - 4} เครื่อง` : ""}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button onClick={clearSelection}>ล้างที่เลือก</Button>
              <Button
                variant="contained"
                onClick={(e) => setTypeAnchor(e.currentTarget)}
                aria-haspopup="menu"
                aria-expanded={!!typeAnchor}
              >
                สร้างงาน
              </Button>
              <Menu anchorEl={typeAnchor} open={!!typeAnchor} onClose={() => setTypeAnchor(null)}>
                <ListSubheader>เลือกประเภทงาน</ListSubheader>
                {(options?.jobTypes ?? []).map((t) => (
                  <MenuItem key={t.value} onClick={() => startCreateJob(t.value)}>
                    {t.label}
                  </MenuItem>
                ))}
                {!options?.jobTypes?.length ? <MenuItem disabled>โหลดประเภทงานไม่สำเร็จ</MenuItem> : null}
              </Menu>
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      <WomsDataTable
        caption="รายการเครื่อง"
        rows={items}
        columns={columns}
        rowKey={(it) => it.id}
        loading={loading}
        error={error}
        onRetry={load}
        pageSize={10}
        initialSort={{ key: "serial", dir: "asc" }}
        onRowClick={(it) => router.push(`/equipment/${it.id}`)}
        emptyTitle="ยังไม่มีเครื่องที่ตรงเงื่อนไข"
        emptyAction={
          has("equipment:create") ? (
            <Button component={Link} href="/equipment/new" variant="outlined" startIcon={<AddIcon />}>
              เพิ่มเครื่องแรก
            </Button>
          ) : undefined
        }
        selection={
          canCreateJob
            ? {
                isSelected: (it) => selected.has(it.id),
                onToggle: toggleOne,
                onTogglePage: togglePage,
                label: (it) => `เลือกเครื่อง ${it.serial}`,
              }
            : undefined
        }
        toolbar={
          <>
            <Typography variant="body2">กดหัวคอลัมน์เพื่อเรียงลำดับ</Typography>
            <Button
              size="small"
              startIcon={<ViewColumnIcon />}
              onClick={(e) => setColAnchor(e.currentTarget)}
              aria-haspopup="menu"
              sx={{ display: { xs: "none", md: "inline-flex" } }}
            >
              เลือกคอลัมน์ ({visible.length}/{COLUMNS.length})
            </Button>
            <Menu anchorEl={colAnchor} open={!!colAnchor} onClose={() => setColAnchor(null)}>
              {COLUMNS.map((c) => (
                <MenuItem
                  key={c.key}
                  dense
                  onClick={() => toggleColumn(c.key)}
                  disabled={shows(c.key) && visible.length === 1}
                >
                  <ListItemIcon>
                    <Checkbox edge="start" size="small" checked={shows(c.key)} tabIndex={-1} disableRipple />
                  </ListItemIcon>
                  <ListItemText primary={c.label} />
                </MenuItem>
              ))}
            </Menu>
          </>
        }
        renderCard={(it) => (
          <Card>
            <CardActionArea component={Link} href={`/equipment/${it.id}`}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                  <Box sx={{ minWidth: 0 }}>
                    <Typography className="code" sx={{ fontWeight: 600 }}>
                      {it.serial}
                    </Typography>
                    <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{it.model || "—"}</Typography>
                  </Box>
                  <EquipmentStatusBadge status={it.status} />
                </Stack>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {it.customerName || "ยังไม่มีผู้ถือครอง"}
                  {it.siteLabel ? ` · ${it.siteLabel}` : ""}
                </Typography>
                {it.addressFull || it.location ? <Typography variant="body2">{it.addressFull || it.location}</Typography> : null}
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                  <WarrantyBadge status={it.warrantyStatus} />
                  {it.pmStatus !== "NOT_CONFIGURED" ? <PmBadge status={it.pmStatus} /> : null}
                  {it.needsSerial ? <NeedsSerialBadge /> : null}
                  {it.rentalWithoutContract ? <NoContractBadge /> : null}
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        )}
      />
    </>
  );
}
