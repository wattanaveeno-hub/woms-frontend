"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Equipment, JobEquipmentInput, JobEquipmentLine, Options } from "@/lib/types";
import { NeedsSerialBadge } from "@/components/EquipmentBadges";
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
  /** โหมด edit — ให้หน้าแม่โหลดข้อมูลใหม่ทั้งใบ */
  onChanged?: () => void | Promise<void>;
}

let seq = 0;
const nextKey = () => `p${++seq}`;

export default function JobEquipmentSection({
  mode,
  options,
  canEdit,
  readOnlyReason,
  jobId,
  lines = [],
  legacy,
  pending = [],
  onPendingChange,
  onChanged,
}: JobEquipmentSectionProps) {
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"pick" | "noserial">("pick");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Equipment[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [model, setModel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = mode === "create" ? pending.length : lines.length;
  // ใบงานเก่าที่ยังไม่มีแถวเชื่อม แต่มีข้อความเครื่องเดิมอยู่
  const legacyOnly = mode === "edit" && lines.length === 0 && !!legacy?.filterUnit;

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
    extra?: string
  ) => (
    <Box key={key} sx={{ py: 1.25, borderTop: 1, borderColor: "divider" }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography component="span" className="code" sx={{ fontWeight: 600 }}>
          {serial || "—"}
        </Typography>
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
    </Box>
  );
  const removeBtn = (onClick: () => void) => (
    <Button size="small" color="error" onClick={onClick} disabled={busy}>
      เอาออก
    </Button>
  );

  return (
    <WomsFormSection
      title={`อุปกรณ์ในใบงาน${count ? ` (${count})` : ""}`}
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
        ? pending.map((p) =>
            row(p.key, p.displaySerial, p.displayModel, p.hasRealSerial, p.note ?? "", removeBtn(() => removePending(p.key)))
          )
        : lines.map((l) =>
            row(
              l.id,
              l.serial,
              l.model,
              l.hasRealSerial,
              l.note,
              canEdit ? removeBtn(() => removeLine(l)) : undefined,
              l.linked ? undefined : "ข้อมูลเดิม (ยังไม่ผูกกับคลัง)"
            )
          )}

      {/* ---- ใบงานเก่าที่ยังไม่มีแถวเชื่อมเลย ---- */}
      {legacyOnly ? (
        <Box sx={{ borderTop: 1, borderColor: "divider", pt: 1.25 }}>
          <Typography variant="body2" sx={{ mb: 0.75 }}>
            ใบงานนี้บันทึกไว้ก่อนระบบผูกเครื่อง — ข้อมูลเดิมที่มีคือ
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <span className="code">{legacy?.filterUnit}</span>
            <Chip size="small" variant="outlined" label="ข้อความเดิม ยังไม่ผูกกับคลัง" />
            {legacy?.model ? <Typography variant="body2">{legacy.model}</Typography> : null}
          </Stack>
          {canEdit ? (
            <Typography variant="body2" sx={{ mt: 0.75 }}>
              ผูกกับเครื่องจริงได้โดยกด “เพิ่มเครื่อง” — ข้อความเดิมจะไม่ถูกลบ
            </Typography>
          ) : null}
        </Box>
      ) : null}

      {/* ---- ฟอร์มเพิ่มเครื่อง ---- */}
      <Collapse in={open && canEdit} unmountOnExit>
        <Box sx={{ borderTop: 1, borderColor: "divider", mt: 1, pt: 1 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" aria-label="วิธีเพิ่มเครื่อง">
            <Tab value="pick" label="เลือกจากคลัง" />
            <Tab value="noserial" label="ยังไม่มี Serial จริง" />
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
                ระบบจะสร้างเครื่องใหม่ในคลังพร้อมออกเลขชั่วคราวให้ และขึ้นป้าย “ยังไม่มี SN” เพื่อให้ตามลง Serial จริงภายหลัง
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
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
                onClick={() =>
                  add({ model: model.trim(), note: note.trim() }, { serial: "(ระบบออกเลขให้ตอนบันทึก)", model: model.trim(), real: false })
                }
              >
                เพิ่มเครื่องที่ยังไม่มี Serial
              </Button>
            </Box>
          )}
        </Box>
      </Collapse>
    </WomsFormSection>
  );
}
