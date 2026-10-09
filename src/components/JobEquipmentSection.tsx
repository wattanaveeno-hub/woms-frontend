"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type {
  Equipment,
  JobEquipmentInput,
  JobEquipmentLine,
  JobEquipmentLineFields,
  LinePmMode,
  MachineType,
  Options,
} from "@/lib/types";
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
import EditNoteIcon from "@mui/icons-material/EditNote";
import { NeedsSerialBadge } from "@/components/EquipmentBadges";
import { useAuth } from "@/lib/AuthContext";
import { legacyMachineShown } from "@/lib/jobView";
import { useDialog } from "@/components/Dialog";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import { WomsFormSection } from "@/components/woms";
import { lineFieldIssues, warrantyAllowed } from "@/lib/jobLineRules";

/**
 * "อุปกรณ์ในใบงาน" — ใช้ได้ทั้งตอนเปิดงานใหม่และตอนแก้ใบงานเดิม
 *
 * โหมด create : เก็บรายการไว้ในหน้าเว็บก่อน แล้วส่งไปพร้อมตอนกดบันทึกเปิดงาน
 * โหมด edit   : เรียก API ทันทีทีละรายการ แล้วให้หน้าแม่โหลดข้อมูลใหม่จาก backend
 *
 * กติกาที่ backend เป็นเจ้าของ (หน้าเว็บไม่ทำซ้ำ):
 *   filterUnit · model · equipmentCount · การออกเลข TMP · การปฏิเสธ serial ที่ไม่มีในคลัง
 */

export interface PendingItem extends JobEquipmentInput {
  /** key ชั่วคราวสำหรับ React เท่านั้น */
  key: string;
  /** ข้อความที่ใช้แสดงในรายการก่อนบันทึก */
  displaySerial: string;
  displayModel: string;
  hasRealSerial: boolean;
}

export interface JobEquipmentSectionProps {
  mode: "create" | "edit";
  /** ประเภทงานปัจจุบัน — ใช้แสดงเฉพาะช่องที่เกี่ยวข้อง (ประกันบริษัทเฉพาะติดตั้งขาย · AT-04) */
  jobType?: string;
  options: Options;
  canEdit: boolean;
  /** เหตุผลที่แก้ไม่ได้ (เช่น ใบงานปิดแล้ว) — แสดงให้ผู้ใช้เข้าใจว่าทำไมไม่มีปุ่ม */
  readOnlyReason?: string;
  /** โหมด edit */
  jobId?: string;
  lines?: JobEquipmentLine[];
  /** ข้อมูลเดิมของใบงานเก่าที่ยังไม่มีแถวเชื่อม */
  legacy?: { filterUnit: string; model: string };
  /** โหมด create */
  pending?: PendingItem[];
  onPendingChange?: (items: PendingItem[]) => void;
  /** หัวการ์ด (ค่าเริ่มต้น "อุปกรณ์ในใบงาน") — หน้าใบงานใช้ "รายละเอียดเครื่อง" ตาม JOB-02 */
  title?: string;
  /** เนื้อหาเพิ่มท้ายการ์ด (เช่น ช่องข้อความรุ่น/เครื่องกรองของฟอร์มเปิดงาน) */
  footer?: React.ReactNode;
  /** โหมด edit — ให้หน้าแม่โหลดข้อมูลใหม่ทั้งใบ */
  onChanged?: () => void | Promise<void>;
}

let seq = 0;
const nextKey = () => `p${++seq}`;

// ---------------------------------------------------------------------------
// ข้อมูลรายเครื่อง (JOB-01 / BR-01.3): ประเภทเครื่อง เครื่องกรอง ประกันบริษัท PM ส่วนลดค่าติดตั้ง
// ---------------------------------------------------------------------------
const MACHINE_TYPE_OPTIONS: Exclude<MachineType, "">[] = ["ตู้แช่", "เครื่องทำน้ำแข็ง", "อื่น ๆ"];
// D-18: ป้ายตาม mockup SCR-JOB-001 ("แถม", "PM แถมกี่รอบ", "วันเริ่มนับประกัน")
const PM_MODE_LABEL: Record<Exclude<LinePmMode, "">, string> = { PACKAGE: "แถม", RENTAL: "แบบเช่า" };

function fieldsOf(l: Partial<JobEquipmentLineFields>): JobEquipmentLineFields {
  return {
    machineType: (l.machineType ?? "") as MachineType,
    filterUnit: l.filterUnit ?? "",
    warrantyMonths: Number(l.warrantyMonths ?? 0) || 0,
    warrantyStart: l.warrantyStart ?? "",
    pmMode: (l.pmMode ?? "") as LinePmMode,
    pmRounds: Number(l.pmRounds ?? 0) || 0,
    pmEveryMonths: Number(l.pmEveryMonths ?? 0) || 0,
    pmYears: Number(l.pmYears ?? 0) || 0,
    installDiscount: Number(l.installDiscount ?? 0) || 0,
    note: l.note ?? "",
  };
}

/** สรุปข้อมูลรายเครื่องเป็นข้อความสั้น (แสดงใต้แถว) */
function fieldsSummary(f: JobEquipmentLineFields): string {
  const parts: string[] = [];
  if (f.machineType) parts.push(f.machineType);
  if (f.filterUnit) parts.push(`เครื่องกรอง ${f.filterUnit}`);
  if (f.warrantyMonths) parts.push(`ประกัน ${f.warrantyMonths} เดือน${f.warrantyStart ? ` เริ่ม ${f.warrantyStart}` : ""}`);
  if (f.pmMode === "PACKAGE") parts.push(`PM Package ${f.pmRounds} รอบ ทุก ${f.pmEveryMonths} เดือน`);
  if (f.pmMode === "RENTAL") parts.push(`PM เช่า ${f.pmYears} ปี ทุก ${f.pmEveryMonths} เดือน`);
  if (f.installDiscount) parts.push(`ส่วนลดติดตั้ง ${f.installDiscount.toLocaleString("th-TH")} บาท`);
  return parts.join(" · ");
}

function LineFieldsEditor({
  value,
  busy,
  onSave,
  onCancel,
  saveLabel,
  jobType = "",
}: {
  jobType?: string;
  value: JobEquipmentLineFields;
  busy?: boolean;
  onSave: (v: JobEquipmentLineFields) => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  const [f, setF] = useState<JobEquipmentLineFields>(value);
  // ช่องตัวเลขเก็บเป็นข้อความระหว่างพิมพ์ แปลงตอนบันทึก (backend ตรวจซ้ำเสมอ)
  const [nums, setNums] = useState({
    warrantyMonths: String(value.warrantyMonths || ""),
    pmRounds: String(value.pmRounds || ""),
    pmEveryMonths: String(value.pmEveryMonths || ""),
    pmYears: String(value.pmYears || ""),
    installDiscount: String(value.installDiscount || ""),
  });
  const num = (k: keyof typeof nums, label: string, extra?: object) => (
    <TextField
      label={label}
      value={nums[k]}
      inputProps={{ inputMode: "numeric" }}
      onChange={(e) => setNums((n) => ({ ...n, [k]: e.target.value.replace(/[^0-9.]/g, "") }))}
      {...extra}
    />
  );
  // ยังไม่เลือกประเภทงาน (หน้าเปิดงานใหม่) → แสดงช่องประกันไว้ก่อนและไม่ล้างค่า — ตรวจอีกครั้งตอนส่ง
  const showWarranty = !jobType || warrantyAllowed(jobType);
  const [issue, setIssue] = useState<string | null>(null);
  const save = () => {
    const next: JobEquipmentLineFields = {
      ...f,
      // งานที่ไม่ใช่ติดตั้งขายไม่มีช่องประกัน — ค่าที่ค้างจากการเปลี่ยนประเภทงานถูกล้าง
      warrantyMonths: showWarranty ? Math.floor(Number(nums.warrantyMonths || 0)) : 0,
      warrantyStart: showWarranty ? f.warrantyStart : "",
      pmRounds: f.pmMode === "PACKAGE" ? Math.floor(Number(nums.pmRounds || 0)) : 0,
      pmEveryMonths: f.pmMode ? Math.floor(Number(nums.pmEveryMonths || 0)) : 0,
      pmYears: f.pmMode === "RENTAL" ? Math.floor(Number(nums.pmYears || 0)) : 0,
      installDiscount: Number(nums.installDiscount || 0),
    };
    const issues = jobType ? lineFieldIssues(jobType, next) : lineFieldIssues("INSTALL_SALE", next);
    if (issues.length) {
      setIssue(issues.map((i) => i.message).join(" · "));
      return;
    }
    setIssue(null);
    onSave(next);
  };
  return (
    <Box sx={{ mt: 1, p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            select
            label="ประเภทเครื่อง"
            value={f.machineType}
            onChange={(e) => setF((x) => ({ ...x, machineType: e.target.value as MachineType }))}
            helperText={f.machineType === "อื่น ๆ" ? "ระบุรายละเอียดในหมายเหตุ" : " "}
          >
            <MenuItem value="">— ไม่ระบุ —</MenuItem>
            {MACHINE_TYPE_OPTIONS.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 8 }}>
          <TextField label="เครื่องกรอง" value={f.filterUnit} onChange={(e) => setF((x) => ({ ...x, filterUnit: e.target.value }))} />
        </Grid>
        {showWarranty ? (
          <>
            <Grid size={{ xs: 6, sm: 3 }}>{num("warrantyMonths", "ประกันบริษัท (เดือน)")}</Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="วันเริ่มนับประกัน"
                type="date"
                value={f.warrantyStart}
                onChange={(e) => setF((x) => ({ ...x, warrantyStart: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                helperText="ไม่จำเป็นต้องเท่าวันติดตั้ง"
              />
            </Grid>
          </>
        ) : null}
        <Grid size={{ xs: 12, sm: 6 }}>{num("installDiscount", "ส่วนลดค่าติดตั้ง (บาท)")}</Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            select
            label="PM ของเครื่อง"
            value={f.pmMode}
            onChange={(e) => setF((x) => ({ ...x, pmMode: e.target.value as LinePmMode }))}
          >
            <MenuItem value="">— ไม่มี —</MenuItem>
            <MenuItem value="PACKAGE">{PM_MODE_LABEL.PACKAGE}</MenuItem>
            <MenuItem value="RENTAL">{PM_MODE_LABEL.RENTAL}</MenuItem>
          </TextField>
        </Grid>
        {f.pmMode === "PACKAGE" ? <Grid size={{ xs: 6, sm: 3 }}>{num("pmRounds", "PM แถมกี่รอบ")}</Grid> : null}
        {f.pmMode === "RENTAL" ? <Grid size={{ xs: 6, sm: 3 }}>{num("pmYears", "ระยะสัญญา (ปี)")}</Grid> : null}
        {f.pmMode ? <Grid size={{ xs: 6, sm: 3 }}>{num("pmEveryMonths", "ทุกกี่เดือน")}</Grid> : null}
        <Grid size={12}>
          <TextField label="หมายเหตุเครื่องนี้" value={f.note} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} />
        </Grid>
      </Grid>
      {issue ? (
        <Alert severity="error" role="alert" sx={{ mt: 1.5 }}>
          {issue}
        </Alert>
      ) : null}
      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        <Button variant="contained" onClick={save} disabled={busy}>
          {busy ? "กำลังบันทึก…" : saveLabel}
        </Button>
        <Button onClick={onCancel} disabled={busy}>
          ยกเลิก
        </Button>
      </Stack>
    </Box>
  );
}

export default function JobEquipmentSection({
  mode,
  jobType = "",
  options,
  canEdit,
  readOnlyReason,
  jobId,
  lines = [],
  legacy,
  pending = [],
  onPendingChange,
  onChanged,
  title = "อุปกรณ์ในใบงาน",
  footer,
}: JobEquipmentSectionProps) {
  const dialog = useDialog();
  const { has } = useAuth();
  // SCR-JOB-001 "+ เพิ่มเครื่องใหม่" มีช่อง SN (ระบุภายหลังได้) — ใส่ SN = สร้างเครื่องในคลังด้วย SN จริง (ต้องมีสิทธิ์สร้างเครื่อง)
  const canCreateMachine = has("equipment:create");
  const [newSerial, setNewSerial] = useState("");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"pick" | "noserial">("pick");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Equipment[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [model, setModel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // แถวที่กำลังแก้ข้อมูลรายเครื่อง (key ของ pending หรือ id ของแถว)
  const [editing, setEditing] = useState<string | null>(null);

  const count = mode === "create" ? pending.length : lines.length;
  // ใบงานเก่าที่ยังไม่มีแถวเชื่อม แต่มีข้อความเครื่องเดิมอยู่ — D-01: รุ่นอย่างเดียว (ไม่มี serial) ก็ต้องแสดง
  const legacyOnly = mode === "edit" && legacyMachineShown(lines.length, legacy);
  // D-01: ข้อความรุ่น/เครื่องกรองระดับใบงานที่ผู้เปิดงานกรอกเอง (ไม่ใช่ serial ของแถวเครื่อง) — แสดงไว้ ไม่หายจากหน้าใบงาน
  const jobLevelText =
    mode === "edit" && lines.length > 0
      ? [legacy?.model ?? "", legacy?.filterUnit && !lines.some((l) => l.serial === legacy.filterUnit) ? legacy.filterUnit : ""].filter(Boolean)
      : [];

  const reset = () => {
    setQ("");
    setResults(null);
    setModel("");
    setNote("");
    setError(null);
  };

  const search = async () => {
    setSearching(true);
    setError(null);
    try {
      const res = await api.listEquipment({ q: q.trim() || undefined });
      setResults(res.items.slice(0, 8));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "ค้นหาเครื่องไม่สำเร็จ");
    } finally {
      setSearching(false);
    }
  };

  // เพิ่มรายการ — โหมด create เก็บไว้ในหน้าเว็บ, โหมด edit ยิง API ทันที
  const add = async (input: JobEquipmentInput, display: { serial: string; model: string; real: boolean }) => {
    setError(null);
    if (mode === "create") {
      const dupe = pending.some(
        (p) =>
          (input.equipmentId && p.equipmentId === input.equipmentId) ||
          (input.serial && p.serial?.toLowerCase() === input.serial.toLowerCase())
      );
      if (dupe) {
        setError("เครื่องนี้อยู่ในรายการแล้ว");
        return;
      }
      onPendingChange?.([
        ...pending,
        {
          key: nextKey(),
          ...input,
          displaySerial: display.serial,
          displayModel: display.model,
          hasRealSerial: display.real,
        },
      ]);
      setOpen(false);
      reset();
      return;
    }

    if (!jobId) return;
    setBusy(true);
    try {
      await api.addJobEquipment(jobId, input);
      await onChanged?.();
      setOpen(false);
      reset();
    } catch (e) {
      // ข้อความจาก backend เช่น "ไม่พบเครื่อง serial ... ในคลัง" ต้องแสดงให้ผู้ใช้เห็นตรง ๆ
      setError(e instanceof ApiError ? e.message : "เพิ่มเครื่องไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const removePending = (key: string) => {
    onPendingChange?.(pending.filter((p) => p.key !== key));
  };

  const savePendingFields = (key: string, f: JobEquipmentLineFields) => {
    onPendingChange?.(pending.map((p) => (p.key === key ? { ...p, ...f } : p)));
    setEditing(null);
  };

  const saveLineFields = async (line: JobEquipmentLine, f: JobEquipmentLineFields) => {
    if (!jobId) return;
    // ส่งเฉพาะฟิลด์ที่เปลี่ยน — backend บันทึก Audit Log รายฟิลด์
    const before = fieldsOf(line);
    const diff: Partial<JobEquipmentLineFields> = {};
    (Object.keys(f) as (keyof JobEquipmentLineFields)[]).forEach((k) => {
      if (String(before[k]) !== String(f[k])) (diff as Record<string, unknown>)[k] = f[k];
    });
    if (!Object.keys(diff).length) {
      setEditing(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.patchJobEquipmentLine(jobId, line.id, diff);
      setEditing(null);
      await onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "บันทึกข้อมูลเครื่องไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const removeLine = async (line: JobEquipmentLine) => {
    if (!jobId) return;
    if (
      !(await dialog.confirm({
        title: `เอาเครื่อง ${line.serial} ออกจากใบงานนี้?`,
        message: "เครื่องยังอยู่ในคลังเหมือนเดิม ไม่ถูกลบ",
        confirmLabel: "เอาออกจากใบงาน",
        danger: true,
      }))
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await api.removeJobEquipment(jobId, line.id);
      await onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "เอาเครื่องออกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  // แถวหนึ่งรายการ — ซ้อนบรรทัดได้บนจอแคบ ไม่ใช้ตารางกว้าง
  const row = (
    key: string,
    serial: string,
    modelText: string,
    real: boolean,
    noteText: string,
    action?: React.ReactNode,
    tag?: string,
    extra?: string,
    equipmentId?: string,
    below?: React.ReactNode
  ) => (
    <Box key={key} sx={{ py: 1.25, borderTop: 1, borderColor: "divider" }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        {/* BR-01.1 "กดเครื่องในใบงานไปข้อมูลเครื่องได้" */}
        {equipmentId ? (
          <Link href={`/equipment/${equipmentId}`} className="code" style={{ fontWeight: 600 }}>
            {serial || "—"}
          </Link>
        ) : (
          <Typography component="span" className="code" sx={{ fontWeight: 600 }}>
            {serial || "—"}
          </Typography>
        )}
        {!real ? <NeedsSerialBadge /> : null}
        {tag ? <Chip size="small" variant="outlined" label={tag} /> : null}
        <Typography component="span" variant="body2">
          {modelText || "—"}
          {extra ? ` · ${extra}` : ""}
        </Typography>
        {action ? <Box sx={{ ml: "auto !important" }}>{action}</Box> : null}
      </Stack>
      {noteText ? (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {noteText}
        </Typography>
      ) : null}
      {below}
    </Box>
  );
  const editBtn = (key: string) => (
    <Button size="small" startIcon={<EditNoteIcon />} onClick={() => setEditing(editing === key ? null : key)} disabled={busy}>
      ข้อมูลเครื่อง
    </Button>
  );
  const removeBtn = (onClick: () => void) => (
    <Button size="small" color="error" onClick={onClick} disabled={busy}>
      เอาออก
    </Button>
  );

  return (
    <WomsFormSection
      title={`${title}${count ? ` (${count})` : ""}`}
      actions={
        canEdit ? (
          <Button
            variant={open ? "text" : "outlined"}
            startIcon={open ? undefined : <AddIcon />}
            onClick={() => {
              setOpen((o) => !o);
              reset();
            }}
            disabled={busy}
            aria-expanded={open}
          >
            {open ? "ปิด" : "เพิ่มเครื่อง"}
          </Button>
        ) : undefined
      }
    >
      {error ? (
        <Alert severity="error" sx={{ mb: 1.5 }} role="alert">
          {error}
        </Alert>
      ) : null}

      {!canEdit && readOnlyReason ? (
        <Typography variant="body2" sx={{ mb: 1 }}>
          {readOnlyReason}
        </Typography>
      ) : null}

      {/* ---- รายการเครื่อง ---- */}
      {count === 0 && !legacyOnly ? (
        <Typography variant="body2" sx={{ py: 1.5 }}>
          ยังไม่มีเครื่องในใบงานนี้
          {canEdit ? " — กด “เพิ่มเครื่อง” เพื่อเลือกจากคลัง หรือเปิดงานโดยยังไม่ระบุ Serial ก็ได้" : ""}
        </Typography>
      ) : null}

      {mode === "create"
        ? pending.map((p) => {
            const f = fieldsOf(p);
            return row(
              p.key,
              p.displaySerial,
              p.displayModel,
              p.hasRealSerial,
              p.note ?? "",
              <Stack direction="row" spacing={0.5}>
                {editBtn(p.key)}
                {removeBtn(() => removePending(p.key))}
              </Stack>,
              undefined,
              fieldsSummary(f) || undefined,
              p.equipmentId,
              editing === p.key ? (
                <LineFieldsEditor jobType={jobType} value={f} saveLabel="ใช้ข้อมูลนี้" onSave={(v) => savePendingFields(p.key, v)} onCancel={() => setEditing(null)} />
              ) : null
            );
          })
        : lines.map((l) => {
            const f = fieldsOf(l);
            return row(
              l.id,
              l.serial,
              l.model,
              l.hasRealSerial,
              l.note,
              canEdit ? (
                <Stack direction="row" spacing={0.5}>
                  {editBtn(l.id)}
                  {removeBtn(() => removeLine(l))}
                </Stack>
              ) : undefined,
              l.linked ? undefined : "ข้อมูลเดิม (ยังไม่ผูกกับคลัง)",
              fieldsSummary(f) || undefined,
              l.linked ? l.equipmentId : undefined,
              canEdit && editing === l.id ? (
                <LineFieldsEditor
                  jobType={jobType}
                  value={f}
                  busy={busy}
                  saveLabel="บันทึกข้อมูลเครื่อง"
                  onSave={(v) => saveLineFields(l, v)}
                  onCancel={() => setEditing(null)}
                />
              ) : null
            );
          })}

      {/* ---- ใบงานเก่าที่ยังไม่มีแถวเชื่อมเลย ---- */}
      {legacyOnly ? (
        <Box sx={{ borderTop: 1, borderColor: "divider", pt: 1.25 }}>
          <Typography variant="body2" sx={{ mb: 0.75 }}>
            ใบงานนี้บันทึกไว้ก่อนระบบผูกเครื่อง — ข้อมูลเดิมที่มีคือ
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {legacy?.filterUnit ? <span className="code">{legacy.filterUnit}</span> : null}
            {legacy?.model ? <Typography variant="body2">รุ่น {legacy.model}</Typography> : null}
            <Chip size="small" variant="outlined" label="ข้อความเดิม ยังไม่ผูกกับคลัง" />
          </Stack>
          {canEdit ? (
            <Typography variant="body2" sx={{ mt: 0.75 }}>
              ผูกกับเครื่องจริงได้โดยกด “เพิ่มเครื่อง” — ข้อความเดิมจะไม่ถูกลบ
            </Typography>
          ) : null}
        </Box>
      ) : null}

      {jobLevelText.length ? (
        <Typography variant="body2" sx={{ borderTop: 1, borderColor: "divider", pt: 1.25 }}>
          ข้อมูลเครื่องที่กรอกตอนเปิดงาน: {jobLevelText.join(" · ")}
        </Typography>
      ) : null}

      {/* ---- ฟอร์มเพิ่มเครื่อง ---- */}
      <Collapse in={open && canEdit} unmountOnExit>
        <Box sx={{ borderTop: 1, borderColor: "divider", mt: 1, pt: 1 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" aria-label="วิธีเพิ่มเครื่อง">
            <Tab value="pick" label="เลือกจากคลัง" />
            <Tab value="noserial" label={canCreateMachine ? "เพิ่มเครื่องใหม่" : "ยังไม่มี Serial จริง"} />
          </Tabs>

          {tab === "pick" ? (
            <Box sx={{ mt: 2 }}>
              <Stack
                component="form"
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                onSubmit={(e: React.FormEvent) => {
                  e.preventDefault();
                  search();
                }}
              >
                <TextField label="ค้นหาเครื่องในคลัง" value={q} onChange={(e) => setQ(e.target.value)} placeholder="serial / รุ่น / ลูกค้า" />
                <Button type="submit" variant="outlined" startIcon={<SearchIcon />} disabled={searching} sx={{ flexShrink: 0, minHeight: 40 }}>
                  {searching ? "กำลังค้นหา…" : "ค้นหา"}
                </Button>
              </Stack>

              {results ? (
                results.length ? (
                  <Box sx={{ mt: 1 }}>
                    {results.map((e) =>
                      row(
                        e.id,
                        e.serial,
                        e.model,
                        !e.needsSerial,
                        "",
                        <Button
                          size="small"
                          variant="contained"
                          disabled={busy}
                          onClick={() =>
                            add({ equipmentId: e.id, note: note.trim() }, { serial: e.serial, model: e.model, real: e.hasRealSerial })
                          }
                        >
                          เลือก
                        </Button>,
                        undefined,
                        e.customerName || e.warehouse || ""
                      )
                    )}
                  </Box>
                ) : (
                  <Box sx={{ mt: 1.5 }}>
                    <Alert severity="warning" sx={{ mb: 1 }}>
                      ไม่พบเครื่องที่ตรงกับ “{q}” ในคลัง
                    </Alert>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      ถ้านี่คือ Serial จริงที่ยังไม่ได้รับเข้าคลัง ให้รับเข้าคลังก่อน หรือใช้แท็บ “ยังไม่มี Serial จริง”
                      เพื่อให้ระบบออกเลขชั่วคราวให้
                    </Typography>
                    {q.trim() ? (
                      <Button
                        variant="outlined"
                        disabled={busy}
                        onClick={() => add({ serial: q.trim(), note: note.trim() }, { serial: q.trim(), model: "", real: true })}
                      >
                        ลองใช้ “{q.trim()}” เป็น Serial
                      </Button>
                    ) : null}
                  </Box>
                )
              ) : null}
            </Box>
          ) : (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {canCreateMachine
                  ? "ใส่ Serial Number ถ้ามี — ระบบสร้างเครื่องใหม่ในคลังด้วย SN นี้ · เว้นว่าง = ระบบออกเลขชั่วคราวให้ และขึ้นป้าย “ยังไม่มี SN” เพื่อตามลง Serial จริงภายหลัง"
                  : "ระบบจะสร้างเครื่องใหม่ในคลังพร้อมออกเลขชั่วคราวให้ และขึ้นป้าย “ยังไม่มี SN” เพื่อให้ตามลง Serial จริงภายหลัง"}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                {canCreateMachine ? (
                  <TextField
                    label="Serial Number (SN)"
                    helperText="ระบุภายหลังได้"
                    value={newSerial}
                    onChange={(e) => setNewSerial(e.target.value)}
                    inputProps={{ maxLength: 80 }}
                  />
                ) : null}
                <Autocomplete
                  freeSolo
                  fullWidth
                  options={options.models}
                  inputValue={model}
                  onInputChange={(_, v) => setModel(v)}
                  renderInput={(params) => <TextField {...params} label="รุ่น" placeholder="เช่น RO-300" />}
                />
                <TextField label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น เครื่องลูกค้าเอง" />
              </Stack>
              <Button
                variant="contained"
                sx={{ mt: 2 }}
                disabled={busy}
                onClick={() => {
                  const sn = newSerial.trim();
                  if (sn) {
                    if (!model.trim()) {
                      setError("เครื่องใหม่ที่มี SN ต้องระบุรุ่น");
                      return;
                    }
                    add({ serial: sn, createNew: true, model: model.trim(), note: note.trim() }, { serial: sn, model: model.trim(), real: true });
                    setNewSerial("");
                    return;
                  }
                  add({ model: model.trim(), note: note.trim() }, { serial: "(ระบบออกเลขให้ตอนบันทึก)", model: model.trim(), real: false });
                }}
              >
                {newSerial.trim() ? "เพิ่มเครื่องใหม่ (SN จริง)" : "เพิ่มเครื่องที่ยังไม่มี Serial"}
              </Button>
            </Box>
          )}
        </Box>
      </Collapse>
      {footer}
    </WomsFormSection>
  );
}
