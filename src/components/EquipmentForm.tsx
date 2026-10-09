"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type {
  CustomerSite,
  EquipmentFormValues,
  MachineType,
  Partner,
  EquipmentStatus,
  Options,
  Warranty,
  WarrantyPreset,
  WarrantyProvider,
} from "@/lib/types";
import { equipmentStatusLabel, warrantyProviderLabel } from "@/lib/options";
import { serialEditableInForm } from "@/lib/uiRules";
import { parseLatLng } from "@/lib/equipmentRules";
import { fieldErrorHelpers, withCurrent } from "@/lib/formErrors";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid2";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const STATUSES: EquipmentStatus[] = ["IN_STOCK", "RESERVED", "RENTED", "SOLD", "REPAIR", "RETIRED"];
const PROVIDERS: WarrantyProvider[] = ["BRAND", "AGENT", "OTHER"];
// MCH-02: ประเภทเครื่องตามต้นฉบับ — "อื่น ๆ" ใส่รายละเอียดในหมายเหตุ ไม่เพิ่มประเภทใหม่ (Q-16)
const MACHINE_TYPES: Exclude<MachineType, "">[] = ["ตู้แช่", "เครื่องทำน้ำแข็ง", "อื่น ๆ"];
// MCH-02: Supplier ของประกัน Supplier — เลือกจากรายการหรือพิมพ์ชื่ออื่นเองได้
const SUPPLIER_BRANDS = ["HOSHIZAKI", "SNOOKER", "HISAKE"];

const EMPTY: EquipmentFormValues = {
  serial: "",
  model: "",
  category: "",
  status: "IN_STOCK",
  customerName: "",
  customerId: "",
  siteId: "",
  supplier: "",
  warehouse: "",
  location: "",
  address: "",
  district: "",
  province: "",
  postcode: "",
  zone: "",
  inboundDate: "",
  installDate: "",
  lat: 0,
  lng: 0,
  warranties: [],
  machineType: "",
  filterUnit: "",
  businessType: "",
  note: "",
};

const EMPTY_WARRANTY: Warranty = {
  provider: "BRAND",
  providerName: "",
  start: "",
  months: 12,
  coverage: "",
  note: "",
};

// D-02: ใช้ตัวดึงพิกัดตัวเดียวกับ "วางข้อความ" (lib/equipmentRules)
// วันหมดประกัน = วันเริ่ม + จำนวนเดือน (คำนวณฝั่ง client เพื่อแสดงตัวอย่างทันที)
function warrantyEnd(start: string, months: number): string {
  if (!start || !months) return "—";
  const [y, m, d] = start.split("-").map(Number);
  if (!y || !m || !d) return "—";
  const t = new Date(Date.UTC(y, m - 1 + months, d));
  if (t.getUTCDate() !== d) t.setUTCDate(0);
  return t.toISOString().slice(0, 10);
}

export interface EquipmentFormProps {
  options: Options;
  initial?: Partial<EquipmentFormValues>;
  submitLabel: string;
  fieldError?: { field?: string; message: string } | null;
  busy?: boolean;
  onSubmit: (values: EquipmentFormValues) => void;
  extraActions?: React.ReactNode;
  /** "create" = ฟอร์มเพิ่มเครื่องที่มีค่าตั้งต้น (เช่น จากการวางข้อความ D-02) — ไม่ถือว่าเป็นการแก้ไข */
  mode?: "create" | "edit";
}

// ฟอร์มรับเครื่องเข้าคลัง — ตั้งใจให้กรอกสั้นที่สุด (8 ช่องบน)
// ข้อมูลที่อยู่/พิกัด/ประกันรายชุด ซ่อนไว้ใต้ "ข้อมูลเพิ่มเติม" กดเปิดเมื่อต้องใช้
export default function EquipmentForm({
  options,
  initial,
  submitLabel,
  fieldError,
  busy,
  onSubmit,
  extraActions,
  mode,
}: EquipmentFormProps) {
  const [v, setV] = useState<EquipmentFormValues>({
    ...EMPTY,
    ...initial,
    warranties: (initial?.warranties ?? []).map((w) => ({ ...w })),
  });
  const [mapLink, setMapLink] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [presets, setPresets] = useState<WarrantyPreset[]>([]);
  // ---- ฐานข้อมูลลูกค้า: รายชื่อลูกค้า + สาขาของลูกค้าที่เลือก ----
  const [customers, setCustomers] = useState<Partner[]>([]);
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const isEdit = mode ? mode === "edit" : !!initial?.serial;

  useEffect(() => {
    api
      .listWarrantyPresets()
      .then((r) => setPresets(r.items))
      .catch(() => setPresets([]));
    // ผู้ใช้ที่ไม่มีสิทธิ์ดูคู่ค้าจะได้ 403 — ปล่อยให้รายการว่าง แล้วพิมพ์ชื่ออิสระแทน
    api
      .listPartners({ type: "CUSTOMER" })
      .then((r) => setCustomers(r.items))
      .catch(() => setCustomers([]));
  }, []);

  // โหลดสาขาใหม่ทุกครั้งที่เปลี่ยนลูกค้า
  useEffect(() => {
    if (!v.customerId) {
      setSites([]);
      return;
    }
    let cancelled = false;
    setSitesLoading(true);
    api
      .listCustomerSites(v.customerId, { activeOnly: true })
      .then((r) => {
        if (!cancelled) setSites(r.items);
      })
      .catch(() => {
        if (!cancelled) setSites([]);
      })
      .finally(() => {
        if (!cancelled) setSitesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [v.customerId]);

  const set = <K extends keyof EquipmentFormValues>(k: K, val: EquipmentFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const { fid, errMsg, fe } = fieldErrorHelpers(fieldError, "eq");
  const serialLocked = !serialEditableInForm(isEdit, initial?.serial);

  /**
   * QA BUG-039 — หลังกด "บันทึกการแก้ไข" คอลัมน์ "ลูกค้า/ผู้ถือครอง" ในหน้ารายการ
   * กลายเป็น "(ไม่ระบุชื่อ)" ทั้งที่ customerId ยังถูกต้อง
   * ต้นเหตุ: ช่องชื่อผู้ถือครอง (ข้อความอิสระ) ถูกซ่อนเมื่อเลือกลูกค้าจากฐานข้อมูล
   * แต่ค่าที่ซ่อนอยู่ถูกส่งไปทับค่าที่ denormalize ไว้ได้ถ้ามันว่าง
   * ที่นี่บังคับให้ชื่อตรงกับลูกค้าที่เลือกเสมอตอนส่งฟอร์ม
   */
  const submitForm = () => {
    const picked = v.customerId ? customers.find((c) => c.id === v.customerId) : undefined;
    onSubmit(picked ? { ...v, customerName: picked.name } : v);
  };

  const applyLink = () => {
    const r = parseLatLng(mapLink);
    if (r) setV((prev) => ({ ...prev, lat: r.lat, lng: r.lng }));
  };

  // ---- ประกัน ----
  const addWarranty = (provider: WarrantyProvider) =>
    setV((prev) => ({
      ...prev,
      warranties: [...prev.warranties, { ...EMPTY_WARRANTY, provider, start: prev.inboundDate }],
    }));

  const setWarranty = <K extends keyof Warranty>(i: number, k: K, val: Warranty[K]) =>
    setV((prev) => ({
      ...prev,
      warranties: prev.warranties.map((w, idx) => (idx === i ? { ...w, [k]: val } : w)),
    }));

  const removeWarranty = (i: number) =>
    setV((prev) => ({ ...prev, warranties: prev.warranties.filter((_, idx) => idx !== i) }));

  // ช่อง "อายุประกัน (เดือน)" แบบเร็ว — ผูกกับประกันชุดแรก และใช้วันรับเข้าคลังเป็นวันเริ่ม
  const quickMonths = v.warranties[0]?.months ?? 0;
  const setQuickMonths = (months: number) =>
    setV((prev) => {
      if (!months && prev.warranties.length <= 1) return { ...prev, warranties: [] };
      if (!prev.warranties.length) {
        return {
          ...prev,
          warranties: [{ ...EMPTY_WARRANTY, start: prev.inboundDate, months }],
        };
      }
      return {
        ...prev,
        warranties: prev.warranties.map((w, i) =>
          i === 0 ? { ...w, months, start: w.start || prev.inboundDate } : w
        ),
      };
    });

  // เปลี่ยนวันรับเข้าคลัง → เลื่อนวันเริ่มประกันที่ยังผูกกับวันเดิมตามไปด้วย
  const setInboundDate = (date: string) =>
    setV((prev) => ({
      ...prev,
      inboundDate: date,
      warranties: prev.warranties.map((w) =>
        !w.start || w.start === prev.inboundDate ? { ...w, start: date } : w
      ),
    }));

  const applyPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    setV((prev) => ({
      ...prev,
      warranties: preset.items.map((i) => ({
        provider: i.provider,
        providerName: i.providerName,
        start: prev.inboundDate,
        months: i.months,
        coverage: i.coverage,
        note: `จากโปรไฟล์ ${preset.name}`,
      })),
    }));
  };

  const defaultPreset = useMemo(() => presets.find((p) => p.isDefault), [presets]);

  const pickedCustomer = customers.find((c) => c.id === v.customerId) ?? null;
  const g = { xs: 12, sm: 6, md: 4 } as const;

  return (
    <Box component="form" noValidate onSubmit={(e: React.FormEvent) => { e.preventDefault(); submitForm(); }}>
      {fieldError && !fieldError.field ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {fieldError.message}
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        <Grid size={g}>
          <TextField
            {...fe(
              "serial",
              serialLocked
                ? "เลขชั่วคราว — ลง Serial จริงด้วยปุ่ม “ลง Serial จริง” ด้านบน (เครื่องเดิม ประวัติเดิม)"
                : !isEdit && !v.serial.trim()
                  ? "ยังไม่มี Serial ก็รับเข้าคลังได้ ระบบจะออกเลข TMP- ให้ แล้วขึ้นเตือนไว้ให้ตามลงทีหลัง"
                  : isEdit && v.serial.trim() !== (initial?.serial ?? "")
                    ? "แก้ Serial แล้วระบบย้าย serial ในสัญญาและใบงานให้ด้วย (เครื่องเดิม id เดิม · บันทึกในประวัติ)"
                    : undefined
            )}
            label="Serial"
            value={v.serial}
            onChange={(e) => set("serial", e.target.value)}
            placeholder="เว้นว่างได้ — ระบบจะออกเลขชั่วคราวให้"
            InputProps={{ readOnly: serialLocked }}
            disabled={serialLocked}
          />
        </Grid>

        <Grid size={g}>
          <Autocomplete
            freeSolo
            options={options.models}
            inputValue={v.model}
            onInputChange={(_, val) => set("model", val)}
            renderInput={(params) => <TextField {...params} {...fe("model")} label="รุ่นเครื่อง" required />}
          />
        </Grid>

        <Grid size={g}>
          {options.categories?.length ? (
            <TextField select id={fid("category")} label="หมวดหมู่" value={v.category} onChange={(e) => set("category", e.target.value)}>
              <MenuItem value="">— เลือกหมวดหมู่ —</MenuItem>
              {withCurrent(options.categories, v.category).map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              id={fid("category")}
              label="หมวดหมู่"
              value={v.category}
              onChange={(e) => set("category", e.target.value)}
              helperText="ตั้งรายการได้ที่ ข้อมูลพื้นฐาน → หมวดหมู่เครื่อง"
            />
          )}
        </Grid>

        <Grid size={g}>
          <TextField select id={fid("status")} label="สถานะ" value={v.status} onChange={(e) => set("status", e.target.value as EquipmentStatus)}>
            {STATUSES.map((st) => (
              <MenuItem key={st} value={st}>
                {equipmentStatusLabel[st]}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid size={g}>
          <TextField
            select
            id={fid("machineType")}
            label="ประเภทเครื่อง"
            value={v.machineType ?? ""}
            onChange={(e) => set("machineType", e.target.value as MachineType)}
            error={!!errMsg("machineType")}
            helperText={errMsg("machineType") || (v.machineType === "อื่น ๆ" ? "ระบุรายละเอียดในหมายเหตุ (ข้อมูลเพิ่มเติม)" : undefined)}
            SelectProps={{ displayEmpty: true }}
            InputLabelProps={{ shrink: true }}
          >
            <MenuItem value="">— ไม่ระบุ —</MenuItem>
            {MACHINE_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid size={g}>
          {/* D-09 / MCH-03: ประเภทการขาย/เช่า — ใช้กับคำเตือนเครื่องเช่าไม่มีสัญญาและการ์ดขาย/เช่า */}
          <TextField
            select
            id={fid("businessType")}
            label="ประเภทการขาย/เช่า"
            value={v.businessType ?? ""}
            onChange={(e) => set("businessType", e.target.value as EquipmentFormValues["businessType"])}
            error={!!errMsg("businessType")}
            helperText={errMsg("businessType") || undefined}
            SelectProps={{ displayEmpty: true }}
            InputLabelProps={{ shrink: true }}
          >
            <MenuItem value="">— ไม่ระบุ —</MenuItem>
            <MenuItem value="SALE">ขาย</MenuItem>
            <MenuItem value="RENTAL">เช่า</MenuItem>
          </TextField>
        </Grid>

        <Grid size={g}>
          <TextField
            {...fe("filterUnit")}
            label="เครื่องกรอง"
            value={v.filterUnit ?? ""}
            onChange={(e) => set("filterUnit", e.target.value)}
          />
        </Grid>

        {/* ---- ผูกกับฐานข้อมูลลูกค้า ----
            เลือกจากรายการ = ผูกด้วยรหัส ชื่อจะไม่หลุดเมื่อลูกค้าเปลี่ยนชื่อ
            ยังพิมพ์ชื่ออิสระได้สำหรับเครื่องเก่า/ลูกค้าที่ยังไม่ได้บันทึกในระบบ */}
        <Grid size={g}>
          <Autocomplete
            options={customers}
            value={pickedCustomer}
            getOptionLabel={(c) => c.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onChange={(_, p) => {
              setV((prev) => ({
                ...prev,
                customerId: p?.id ?? "",
                siteId: "",
                customerName: p ? p.name : "",
              }));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                id={fid("customerId")}
                label="ลูกค้า / ผู้ถือครอง"
                placeholder="เลือกจากฐานข้อมูลลูกค้า (เว้นว่างถ้าอยู่ในคลัง)"
              />
            )}
          />
          {!v.customerId ? (
            <TextField
              sx={{ mt: 1 }}
              label="หรือพิมพ์ชื่อผู้ถือครองที่ยังไม่มีในระบบ"
              value={v.customerName}
              onChange={(e) => set("customerName", e.target.value)}
            />
          ) : null}
        </Grid>

        <Grid size={g}>
          <TextField
            select
            id={fid("siteId")}
            label="สาขา / ร้าน / สถานที่ติดตั้ง"
            value={v.siteId}
            disabled={!v.customerId || sitesLoading}
            onChange={(e) => set("siteId", e.target.value)}
            SelectProps={{ displayEmpty: true }}
            InputLabelProps={{ shrink: true }}
          >
            <MenuItem value="">
              {!v.customerId
                ? "— เลือกลูกค้าก่อน —"
                : sitesLoading
                  ? "กำลังโหลดสาขา…"
                  : sites.length
                    ? "— ไม่ระบุสาขา —"
                    : "— ลูกค้ารายนี้ยังไม่มีสาขา —"}
            </MenuItem>
            {sites.map((st) => (
              <MenuItem key={st.id} value={st.id}>
                {st.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid size={g}>
          <TextField
            {...fe("inboundDate")}
            label="วันที่รับเข้าคลัง"
            type="date"
            value={v.inboundDate}
            onChange={(e) => setInboundDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>

        <Grid size={g}>
          <TextField
            {...fe("installDate", "แยกจากวันเริ่มประกัน")}
            label="วันที่ติดตั้ง"
            type="date"
            value={v.installDate ?? ""}
            onChange={(e) => set("installDate", e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>

        <Grid size={g}>
          <TextField
            {...fe("supplier")}
            label="Supplier"
            value={v.supplier}
            onChange={(e) => set("supplier", e.target.value)}
            placeholder="ผู้จัดจำหน่ายที่รับเครื่องเข้ามา"
          />
        </Grid>

        <Grid size={g}>
          <TextField
            id={fid("quickMonths")}
            label="อายุประกัน (เดือน)"
            type="number"
            inputProps={{ min: 0, inputMode: "numeric" }}
            value={quickMonths}
            onChange={(e) => setQuickMonths(e.target.value === "" ? 0 : Number(e.target.value))}
            helperText={`นับจากวันรับเข้าคลัง${v.inboundDate ? ` (${v.inboundDate})` : ""} · หมดประกัน ${warrantyEnd(
              v.warranties[0]?.start || v.inboundDate,
              quickMonths
            )}`}
          />
        </Grid>

        {presets.length ? (
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-start" }}>
              <TextField
                select
                id={fid("preset")}
                label="ใช้โปรไฟล์ประกันสำเร็จรูป"
                value=""
                onChange={(e) => applyPreset(e.target.value)}
                SelectProps={{ displayEmpty: true }}
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem value="">— เลือกโปรไฟล์เพื่อเติมประกันให้อัตโนมัติ —</MenuItem>
                {presets.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name} · {p.summary}
                    {p.isDefault ? " (ค่าตั้งต้น)" : ""}
                  </MenuItem>
                ))}
              </TextField>
              {defaultPreset ? (
                <Button variant="outlined" onClick={() => applyPreset(defaultPreset.id)} sx={{ flexShrink: 0, minHeight: 40 }}>
                  ใช้ค่าตั้งต้น
                </Button>
              ) : null}
            </Stack>
          </Grid>
        ) : null}

        <Grid size={12}>
          <Button
            onClick={() => setAdvanced((a) => !a)}
            startIcon={advanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            aria-expanded={advanced}
          >
            {advanced ? "ซ่อนข้อมูลเพิ่มเติม" : "ข้อมูลเพิ่มเติม (คลัง · ที่อยู่ · พิกัด · ประกันรายชุด)"}
          </Button>
        </Grid>
      </Grid>

      {/* เก็บค่าไว้เมื่อพับ (ไม่ unmount) — ข้อความ error ของช่องที่ซ่อนอยู่จะเปิดกลุ่มนี้ให้เอง */}
      <Collapse in={advanced || !!(fieldError?.field && ["address", "postcode", "lat", "lng", "warranties"].includes(fieldError.field))}>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid size={g}>
            {options.warehouses?.length ? (
              <TextField select id={fid("warehouse")} label="คลังจัดเก็บ" value={v.warehouse} onChange={(e) => set("warehouse", e.target.value)}>
                <MenuItem value="">— เลือกคลัง —</MenuItem>
                {withCurrent(options.warehouses, v.warehouse).map((w) => (
                  <MenuItem key={w} value={w}>
                    {w}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField
                id={fid("warehouse")}
                label="คลังจัดเก็บ"
                value={v.warehouse}
                onChange={(e) => set("warehouse", e.target.value)}
                helperText="ตั้งรายการได้ที่ ข้อมูลพื้นฐาน → คลังจัดเก็บ"
              />
            )}
          </Grid>
          <Grid size={g}>
            <TextField
              id={fid("location")}
              label="สถานที่ / ไซต์"
              value={v.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="เช่น หน้างานลูกค้า, โชว์รูม"
            />
          </Grid>
          <Grid size={g}>
            <Autocomplete
              freeSolo
              options={options.zones ?? []}
              inputValue={v.zone}
              onInputChange={(_, val) => set("zone", val)}
              renderInput={(params) => <TextField {...params} id={fid("zone")} label="โซนบริการ" helperText="ใช้จัดคิวช่าง" />}
            />
          </Grid>
          <Grid size={12}>
            <TextField {...fe("address")} label="ที่อยู่ (บ้านเลขที่ ถนน แขวง)" value={v.address} onChange={(e) => set("address", e.target.value)} />
          </Grid>
          <Grid size={g}>
            <TextField id={fid("district")} label="อำเภอ / เขต" value={v.district} onChange={(e) => set("district", e.target.value)} />
          </Grid>
          <Grid size={g}>
            <TextField id={fid("province")} label="จังหวัด" value={v.province} onChange={(e) => set("province", e.target.value)} />
          </Grid>
          <Grid size={g}>
            <TextField
              {...fe("postcode")}
              label="รหัสไปรษณีย์"
              inputProps={{ inputMode: "numeric", maxLength: 5 }}
              value={v.postcode}
              onChange={(e) => set("postcode", e.target.value)}
            />
          </Grid>
          <Grid size={12}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-start" }}>
              <TextField
                id={fid("mapLink")}
                label="พิกัดแผนที่ (วางลิงก์ Google Maps แล้วกดดึง)"
                value={mapLink}
                onChange={(e) => setMapLink(e.target.value)}
                placeholder="วางลิงก์ Google Maps หรือ 13.7563,100.5018"
              />
              <Button variant="outlined" onClick={applyLink} sx={{ flexShrink: 0, minHeight: 40 }}>
                ดึงพิกัด
              </Button>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              {...fe("lat")}
              label="ละติจูด (lat)"
              type="number"
              inputProps={{ step: "any" }}
              value={v.lat}
              onChange={(e) => set("lat", e.target.value === "" ? 0 : Number(e.target.value))}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              {...fe("lng")}
              label="ลองจิจูด (lng)"
              type="number"
              inputProps={{ step: "any" }}
              value={v.lng}
              onChange={(e) => set("lng", e.target.value === "" ? 0 : Number(e.target.value))}
            />
          </Grid>

          {/* ---- ประกันรายชุด ---- */}
          <Grid size={12}>
            <Typography sx={{ fontWeight: 700, color: "text.primary", mb: 0.5 }}>ประกันรายชุด (Supplier / บริษัท / อื่น ๆ)</Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              ประกัน Supplier แยกจากประกันบริษัท (ETE) ที่ให้ลูกค้า · งานติดตั้งขายกรอกจำนวนเดือนและวันเริ่มนับของประกันบริษัทเอง ไม่ต้องตรงวันติดตั้ง
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {PROVIDERS.map((p) => (
                <Button key={p} variant="outlined" startIcon={<AddIcon />} onClick={() => addWarranty(p)}>
                  {warrantyProviderLabel[p]}
                </Button>
              ))}
            </Stack>
            {errMsg("warranties") ? (
              <Alert severity="error" sx={{ mt: 1 }} role="alert">
                {errMsg("warranties")}
              </Alert>
            ) : null}
          </Grid>

          {v.warranties.map((w, i) => (
            <Grid size={12} key={i}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontWeight: 700, color: "text.primary" }}>
                    {warrantyProviderLabel[w.provider]} #{i + 1}
                  </Typography>
                  <Tooltip title="ลบประกันชุดนี้">
                    <IconButton color="error" onClick={() => removeWarranty(i)} aria-label={`ลบประกันชุดที่ ${i + 1}`}>
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Grid container spacing={2}>
                  <Grid size={g}>
                    <TextField
                      select
                      id={fid(`w${i}-provider`)}
                      label="ผู้รับประกัน"
                      value={w.provider}
                      onChange={(e) => setWarranty(i, "provider", e.target.value as WarrantyProvider)}
                    >
                      {PROVIDERS.map((p) => (
                        <MenuItem key={p} value={p}>
                          {warrantyProviderLabel[p]}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={g}>
                    {w.provider === "BRAND" ? (
                      <Autocomplete
                        freeSolo
                        options={SUPPLIER_BRANDS}
                        inputValue={w.providerName}
                        onInputChange={(_, val) => setWarranty(i, "providerName", val)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            id={fid(`w${i}-providerName`)}
                            label="Supplier"
                            helperText="เลือก HOSHIZAKI / SNOOKER / HISAKE หรือพิมพ์ชื่ออื่น"
                          />
                        )}
                      />
                    ) : (
                      <TextField
                        id={fid(`w${i}-providerName`)}
                        label={w.provider === "AGENT" ? "ผู้ให้ประกัน (เว้นว่าง = ETE)" : "ชื่อผู้รับประกัน"}
                        value={w.providerName}
                        onChange={(e) => setWarranty(i, "providerName", e.target.value)}
                      />
                    )}
                  </Grid>
                  <Grid size={g}>
                    <TextField
                      id={fid(`w${i}-start`)}
                      label="วันเริ่มประกัน"
                      type="date"
                      value={w.start}
                      onChange={(e) => setWarranty(i, "start", e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid size={g}>
                    <TextField
                      id={fid(`w${i}-months`)}
                      label="ระยะประกัน (เดือน)"
                      type="number"
                      inputProps={{ min: 0, inputMode: "numeric" }}
                      value={w.months}
                      onChange={(e) => setWarranty(i, "months", e.target.value === "" ? 0 : Number(e.target.value))}
                    />
                  </Grid>
                  <Grid size={g}>
                    <TextField
                      id={fid(`w${i}-coverage`)}
                      label="ขอบเขตความคุ้มครอง"
                      value={w.coverage}
                      onChange={(e) => setWarranty(i, "coverage", e.target.value)}
                      placeholder="เช่น อะไหล่และค่าแรง"
                    />
                  </Grid>
                  <Grid size={g}>
                    <TextField
                      id={fid(`w${i}-end`)}
                      label="หมดประกัน (คำนวณให้)"
                      value={warrantyEnd(w.start, w.months)}
                      InputProps={{ readOnly: true }}
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          ))}

          <Grid size={12}>
            <TextField id={fid("note")} label="หมายเหตุ" multiline minRows={3} value={v.note} onChange={(e) => set("note", e.target.value)} />
          </Grid>
        </Grid>
      </Collapse>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 3 }}>
        <Button type="submit" variant="contained" disabled={busy}>
          {busy ? "กำลังบันทึก…" : submitLabel}
        </Button>
        {extraActions}
      </Stack>
    </Box>
  );
}
