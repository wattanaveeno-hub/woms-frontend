"use client";

import { useState } from "react";
import type { JobEquipmentLine } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import SignaturePad from "@/components/SignaturePad";
import MenuItem from "@mui/material/MenuItem";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useAuth } from "@/lib/AuthContext";
import { useDialog } from "@/components/Dialog";
import { closeReasons, lineHasSnEvidence, lineIsDone } from "@/lib/closeRules";

// ต้องตรงกับเพดานฝั่งเซิร์ฟเวอร์ใน backend/src/domain/job.ts (คำนวณจากขีดจำกัด BSON 16 MB)
// เซิร์ฟเวอร์เป็นผู้บังคับจริง ตัวเลขชุดนี้มีไว้เพื่อเตือนผู้ใช้ตั้งแต่ก่อนกดส่ง
const MAX_PHOTOS = 8;
const MAX_IMAGE_CHARS = 2_000_000; // ต่อรูป
const MAX_TOTAL_CHARS = 8_000_000; // รูปทั้งหมด + ลายเซ็น

// downscale + re-encode an image file to keep the data URL small (~100-200KB)
function compressImage(file: File, maxDim = 1024, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height >= width && height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas context"));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("โหลดรูปไม่สำเร็จ"));
    };
    img.src = url;
  });
}

export interface JobCloseValues {
  signerName: string;
  closeNote: string;
  signature: string;
  photos: string[];
}

export interface JobCloseFormProps {
  busy?: boolean;
  onSubmit: (v: JobCloseValues) => void;
  onError?: (msg: string) => void;
  /** JOB-03 — เลขใบงานและเครื่องในใบงาน (ไม่ส่ง/ไม่มีเครื่อง = ปิดงานแบบรูประดับใบงานเหมือนเดิม) */
  jobId?: string;
  lines?: JobEquipmentLine[];
}

type LineEvidence = { sn: string[]; work: string[] };

/** อ่านไฟล์รูปหลายไฟล์ → data URL ที่ย่อแล้ว (กันรูปใหญ่เกินและกันขนาดรวมเกิน) */
async function encodeFiles(
  files: FileList,
  room: number,
  usedChars: number,
  onError?: (msg: string) => void
): Promise<string[]> {
  const out: string[] = [];
  let used = usedChars;
  for (const f of Array.from(files).slice(0, Math.max(0, room))) {
    try {
      const data = await compressImage(f);
      if (data.length > MAX_IMAGE_CHARS) {
        onError?.("รูปนี้ใหญ่เกินไป ถ่ายใหม่หรือย่อรูปก่อน");
        continue;
      }
      if (used + data.length > MAX_TOTAL_CHARS) {
        onError?.("รูปรวมกันใหญ่เกินที่ระบบรับได้ — ลบรูปบางรูปออกก่อนเพิ่มรูปใหม่");
        break;
      }
      used += data.length;
      out.push(data);
    } catch {
      onError?.("บางรูปอ่านไม่ได้ ข้ามไป");
    }
  }
  return out;
}

/**
 * ปุ่มเพิ่มรูป 2 แบบ (TECH-02 "ถ่ายรูปหรือเลือกรูปจากอุปกรณ์"):
 *   ถ่ายรูป  = input capture="environment" เปิดกล้องหลังทันทีบนมือถือ (เดสก์ท็อปจะเปิดเลือกไฟล์ตามปกติ)
 *   คลังรูป = เลือกหลายรูปจากเครื่อง
 */
function PhotoAddTiles({
  inputId,
  working,
  workingLabel = "กำลังบันทึก…",
  onAdd,
}: {
  inputId: string;
  working: boolean;
  workingLabel?: string;
  onAdd: (files: FileList | null) => void;
}) {
  const tile = { aspectRatio: "1", flexDirection: "column", gap: 0.5, borderStyle: "dashed", minHeight: 88 } as const;
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    onAdd(e.target.files);
    e.target.value = "";
  };
  return (
    <>
      <Button component="label" variant="outlined" disabled={working} htmlFor={`${inputId}-camera`} sx={tile}>
        {working ? <CircularProgress size={22} /> : <PhotoCameraIcon />}
        <Typography component="span" variant="body2" sx={{ fontSize: 12.5, color: "inherit" }}>
          {working ? workingLabel : "ถ่ายรูป"}
        </Typography>
        <input id={`${inputId}-camera`} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      </Button>
      <Button component="label" variant="outlined" disabled={working} htmlFor={inputId} sx={tile}>
        <PhotoLibraryIcon />
        <Typography component="span" variant="body2" sx={{ fontSize: 12.5, color: "inherit" }}>
          คลังรูป
        </Typography>
        <input id={inputId} type="file" accept="image/*" multiple hidden onChange={pick} />
      </Button>
    </>
  );
}

/** กลุ่มรูปหนึ่งส่วน (รูป SN หรือรูปงาน) — "ถ่ายรูปหรือเลือกรูปจากอุปกรณ์" (TECH-02) จึงไม่บังคับกล้อง */
function PhotoGroup({
  title,
  photos,
  working,
  missing,
  inputId,
  onAdd,
  onRemove,
}: {
  title: string;
  photos: string[];
  working: boolean;
  missing: boolean;
  inputId: string;
  onAdd: (files: FileList | null) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
        <Typography component="div" variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
          {title} ({photos.length}/{MAX_PHOTOS})
        </Typography>
        {missing ? <Chip size="small" color="error" variant="outlined" label="ยังไม่มีรูป" /> : <Chip size="small" color="success" variant="outlined" label="ครบ" />}
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(3, 1fr)", sm: "repeat(4, 1fr)" }, gap: 1 }}>
        {photos.map((src, i) => (
          <Box key={i} sx={{ position: "relative", aspectRatio: "1", borderRadius: 1, overflow: "hidden", border: 1, borderColor: "divider" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${title} ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <IconButton
              size="small"
              aria-label={`ลบ${title}ที่ ${i + 1}`}
              onClick={() => onRemove(i)}
              disabled={working}
              sx={{ position: "absolute", top: 2, right: 2, bgcolor: "rgba(0,0,0,0.55)", color: "#fff", "&:hover": { bgcolor: "rgba(0,0,0,0.75)" } }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        {photos.length < MAX_PHOTOS ? <PhotoAddTiles inputId={inputId} working={working} onAdd={onAdd} /> : null}
      </Box>
    </Box>
  );
}

/** VFB แถว 7 — เครื่องที่ยังไม่มี SN: อ้างอิงใบส่งสินค้าหรือ IV แทนรูป SN (ไม่บังคับจำนวนรูป) */
function NoSnRefEditor({
  lineId,
  current,
  busy,
  onSave,
  onError,
}: {
  lineId: string;
  current: JobEquipmentLine["noSnRef"];
  busy: boolean;
  onSave: (v: { kind: "DELIVERY_NOTE" | "INVOICE"; docNo: string; photos: string[] }) => void;
  onError?: (m: string) => void;
}) {
  const [kind, setKind] = useState<"DELIVERY_NOTE" | "INVOICE">(current?.kind ?? "DELIVERY_NOTE");
  const [docNo, setDocNo] = useState(current?.docNo ?? "");
  const [photos, setPhotos] = useState<string[]>([]);
  return (
    <Box sx={{ mt: 1.5, p: 1.25, border: 1, borderColor: "divider", borderRadius: 1 }} aria-label="เอกสารอ้างอิงแทน SN">
      <Typography component="div" variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
        ไม่มี SN — อ้างอิงใบส่งสินค้าหรือ IV แทนรูป SN
      </Typography>
      {current ? (
        <Typography variant="body2" sx={{ mb: 1 }}>
          บันทึกแล้ว: {current.kind === "INVOICE" ? "IV" : "ใบส่งสินค้า"} <b>{current.docNo}</b>
          {current.photos?.length ? ` · รูปเอกสาร ${current.photos.length} รูป` : ""} · โดย {current.by}
        </Typography>
      ) : null}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField select size="small" label="ชนิดเอกสาร" value={kind} onChange={(e) => setKind(e.target.value as any)} sx={{ minWidth: 150 }}>
          <MenuItem value="DELIVERY_NOTE">ใบส่งสินค้า</MenuItem>
          <MenuItem value="INVOICE">ใบแจ้งหนี้ (IV)</MenuItem>
        </TextField>
        <TextField
          size="small"
          label="เลขที่เอกสาร"
          value={docNo}
          onChange={(e) => setDocNo(e.target.value)}
          inputProps={{ "aria-label": `เลขที่เอกสารอ้างอิง ${lineId}` }}
        />
        {[
          { key: "camera", label: `ถ่ายรูปเอกสาร (${photos.length})`, capture: true },
          { key: "gallery", label: "เลือกจากคลัง", capture: false },
        ].map((b) => (
          <Button key={b.key} component="label" size="small" variant="outlined" disabled={busy}>
            {b.label}
            <input
              type="file"
              accept="image/*"
              multiple={!b.capture}
              {...(b.capture ? { capture: "environment" as const } : {})}
              hidden
              onChange={async (e) => {
                const files = e.target.files;
                e.target.value = "";
                if (!files) return;
                setPhotos([...(photos ?? []), ...(await encodeFiles(files, MAX_PHOTOS - photos.length, 0, onError))]);
              }}
            />
          </Button>
        ))}
        <Button size="small" variant="contained" disabled={busy || !docNo.trim()} onClick={() => onSave({ kind, docNo: docNo.trim(), photos })}>
          บันทึกเอกสารอ้างอิง
        </Button>
      </Stack>
    </Box>
  );
}

export default function JobCloseForm({ busy, onSubmit, onError, jobId, lines = [] }: JobCloseFormProps) {
  const { has } = useAuth();
  const dialog = useDialog();
  // VFB แถว 9: ผลรายเครื่องเปลี่ยนได้ระหว่างอยู่ในฟอร์ม (บันทึกเสร็จทีละเครื่อง) — เก็บสำเนาไว้ในฟอร์ม
  const [rows, setRows] = useState<JobEquipmentLine[]>(() => (jobId ? lines : []));
  const rowOf = (id: string) => rows.find((r) => r.id === id) ?? lines.find((r) => r.id === id);
  const patchRow = (next: JobEquipmentLine) => setRows((rs) => (rs.some((r) => r.id === next.id) ? rs.map((r) => (r.id === next.id ? next : r)) : [...rs, next]));
  // ---- JOB-03: หลักฐานรายเครื่อง (เฉพาะเครื่องที่ผูกกับคลังจริง — ตรงกับกติกาฝั่งเซิร์ฟเวอร์) ----
  const allLines = jobId ? (rows.length ? rows : lines) : [];
  const machines = allLines.filter((l) => l.equipmentId);
  const legacyRows = allLines.filter((l) => !l.equipmentId);
  const perMachine = allLines.length > 0;
  const [ev, setEv] = useState<Record<string, LineEvidence>>(() =>
    Object.fromEntries(machines.map((l) => [l.id, { sn: l.snPhotos ?? [], work: l.workPhotos ?? [] }]))
  );
  const [savingLine, setSavingLine] = useState<string | null>(null);
  // รายการเครื่องอาจมาถึงหลังฟอร์มถูกสร้าง — ถ้ายังไม่มีในสถานะของฟอร์ม ใช้รูปที่บันทึกไว้แล้วจากเซิร์ฟเวอร์
  const evOf = (id: string): LineEvidence => {
    if (ev[id]) return ev[id];
    const l = machines.find((x) => x.id === id);
    return { sn: l?.snPhotos ?? [], work: l?.workPhotos ?? [] };
  };
  const missingOf = (id: string) => {
    const e = evOf(id);
    const l = rowOf(id);
    // VFB แถว 7: เครื่องที่ยังไม่มี SN ใช้เลขใบส่งสินค้า/IV แทนรูป SN ได้
    return { sn: !lineHasSnEvidence({ snPhotos: e.sn, noSnRef: l?.noSnRef }), work: e.work.length < 1 };
  };
  const incomplete = machines.filter((l) => missingOf(l.id).sn || missingOf(l.id).work);
  const pending = allLines.filter((l) => !lineIsDone(rowOf(l.id) ?? l));

  // รายละเอียดงานที่ทำรายเครื่อง — ต้องกรอกก่อนกด "บันทึกเครื่องนี้เสร็จ" (เก็บเป็น resultNote ของเครื่อง)
  const [lineNotes, setLineNotes] = useState<Record<string, string>>({});
  const completeLine = async (lineId: string) => {
    if (!jobId) return;
    setSavingLine(lineId);
    try {
      patchRow(await api.completeJobLine(jobId, lineId, (lineNotes[lineId] ?? "").trim()));
    } catch (e) {
      onError?.(e instanceof ApiError ? e.message : "บันทึกเครื่องเสร็จไม่สำเร็จ");
    } finally {
      setSavingLine(null);
    }
  };

  const reopenLine = async (lineId: string, serial: string) => {
    if (!jobId) return;
    const reason = await dialog.prompt({
      title: `ยกเลิกผล "เสร็จ" ของเครื่อง ${serial || ""}`,
      label: "เหตุผล",
      required: true,
      type: "textarea",
      confirmLabel: "ยกเลิกผลรายเครื่อง",
      danger: true,
    });
    if (!reason) return;
    setSavingLine(lineId);
    try {
      patchRow(await api.reopenJobLine(jobId, lineId, reason));
    } catch (e) {
      onError?.(e instanceof ApiError ? e.message : "ยกเลิกผลไม่สำเร็จ");
    } finally {
      setSavingLine(null);
    }
  };

  const saveNoSnRef = async (lineId: string, v: { kind: "DELIVERY_NOTE" | "INVOICE"; docNo: string; photos: string[] }) => {
    if (!jobId) return;
    setSavingLine(lineId);
    try {
      patchRow(await api.setJobLineNoSnRef(jobId, lineId, v));
    } catch (e) {
      onError?.(e instanceof ApiError ? e.message : "บันทึกเอกสารอ้างอิงไม่สำเร็จ");
    } finally {
      setSavingLine(null);
    }
  };

  // บันทึกทันทีที่เพิ่ม/ลบรูป — ความคืบหน้าไม่หายถ้าสัญญาณหลุดหรือปิดหน้าไปก่อน
  const saveLine = async (lineId: string, next: LineEvidence) => {
    if (!jobId) return;
    setSavingLine(lineId);
    try {
      const saved = await api.setJobLineEvidence(jobId, lineId, { snPhotos: next.sn, workPhotos: next.work });
      setEv((m) => ({ ...m, [lineId]: { sn: saved.snPhotos ?? next.sn, work: saved.workPhotos ?? next.work } }));
    } catch (e) {
      onError?.(e instanceof ApiError ? e.message : "บันทึกรูปไม่สำเร็จ");
    } finally {
      setSavingLine(null);
    }
  };

  const addLinePhotos = async (lineId: string, part: "sn" | "work", files: FileList | null) => {
    if (!files || files.length === 0) return;
    const cur = evOf(lineId);
    setSavingLine(lineId);
    const used = [...cur.sn, ...cur.work].reduce((n, p) => n + p.length, 0);
    const encoded = await encodeFiles(files, MAX_PHOTOS - cur[part].length, used, onError);
    if (!encoded.length) {
      setSavingLine(null);
      return;
    }
    await saveLine(lineId, { ...cur, [part]: [...cur[part], ...encoded].slice(0, MAX_PHOTOS) });
  };

  const removeLinePhoto = (lineId: string, part: "sn" | "work", i: number) => {
    const cur = evOf(lineId);
    void saveLine(lineId, { ...cur, [part]: cur[part].filter((_, idx) => idx !== i) });
  };

  const [photos, setPhotos] = useState<string[]>([]);
  const [signature, setSignature] = useState("");
  const [signerName, setSignerName] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [working, setWorking] = useState(false);

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setWorking(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      const list = Array.from(files).slice(0, Math.max(0, room));
      const encoded: string[] = [];
      let used = photos.reduce((n, p) => n + p.length, 0) + signature.length;
      for (const f of list) {
        try {
          const data = await compressImage(f);
          // กันรูปเดียวใหญ่เกิน และกันขนาดรวมทะลุเพดาน — บอกผู้ใช้ตรง ๆ ไม่ตัดทิ้งเงียบ ๆ
          if (data.length > MAX_IMAGE_CHARS) {
            onError?.("รูปนี้ใหญ่เกินไป ถ่ายใหม่หรือย่อรูปก่อน");
            continue;
          }
          if (used + data.length > MAX_TOTAL_CHARS) {
            onError?.("รูปรวมกันใหญ่เกินที่ระบบรับได้ — ลบรูปบางรูปออกก่อนเพิ่มรูปใหม่");
            break;
          }
          used += data.length;
          encoded.push(data);
        } catch {
          onError?.("บางรูปอ่านไม่ได้ ข้ามไป");
        }
      }
      setPhotos((p) => [...p, ...encoded].slice(0, MAX_PHOTOS));
    } finally {
      setWorking(false);
    }
  };

  const removePhoto = (i: number) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  // VFB แถว 8: ลายเซ็นตรวจรับบังคับทุกครั้ง · แถว 9: ทุกเครื่องต้องบันทึกว่าเสร็จก่อน (เซิร์ฟเวอร์ตรวจซ้ำเสมอ)
  const reasons = closeReasons({
    pending: pending.map((l) => l.serial || "—"),
    missingEvidence: incomplete.length,
    hasSignature: signature !== "",
  });
  const canSubmit = !busy && !working && savingLine === null && reasons.length === 0;

  const totalChars = photos.reduce((n, p) => n + p.length, 0) + signature.length;

  const submit = () => {
    if (pending.length) {
      onError?.(`ยังปิดใบงานไม่ได้ — มีเครื่องที่ยังไม่บันทึกว่าเสร็จ ${pending.length} เครื่อง`);
      return;
    }
    if (incomplete.length) {
      onError?.(`ยังแนบรูปไม่ครบ ${incomplete.length} เครื่อง — ต้องมีทั้งรูป SN และรูปงานที่ทำทุกเครื่อง`);
      return;
    }
    if (!signature) {
      onError?.("ต้องมีลายเซ็นตรวจรับก่อนปิดงาน");
      return;
    }
    if (totalChars > MAX_TOTAL_CHARS) {
      onError?.("รูปและลายเซ็นรวมกันใหญ่เกินที่ระบบรับได้ — ลบรูปบางรูปออกแล้วลองใหม่");
      return;
    }
    onSubmit({ signerName: signerName.trim(), closeNote: closeNote.trim(), signature, photos });
  };

  return (
    <Stack spacing={2}>
      {perMachine ? (
        <Box>
          <Typography component="div" sx={{ fontWeight: 600, color: "text.primary", mb: 1 }}>
            เครื่องในใบงาน — บันทึกเสร็จแล้ว {allLines.length - pending.length}/{allLines.length} เครื่อง
          </Typography>
          {incomplete.length ? (
            <Alert severity="warning" sx={{ mb: 1.5 }} id="job-close-missing">
              หลักฐานยังไม่ครบ — ต้องมีรูป SN (หรือเลขใบส่งสินค้า/IV กรณีไม่มี SN) และรูปงานที่ทำ:{" "}
              {incomplete
                .map((l) => {
                  const m = missingOf(l.id);
                  return `${l.serial || "—"} ขาด${[m.sn ? "รูป SN" : "", m.work ? "รูปงาน" : ""].filter(Boolean).join(" และ ")}`;
                })
                .join(" · ")}
            </Alert>
          ) : null}
          <Stack spacing={1.5}>
            {machines.map((l, idx) => {
              const row = rowOf(l.id) ?? l;
              const done = lineIsDone(row);
              const e = evOf(l.id);
              const m = missingOf(l.id);
              const saving = savingLine === l.id;
              return (
                <Paper key={l.id} variant="outlined" sx={{ p: 1.5, borderColor: done ? "success.main" : undefined }} aria-label={`หลักฐานเครื่อง ${l.serial}`}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                    <Typography component="span" variant="body2" sx={{ fontWeight: 700 }}>
                      เครื่องที่ {idx + 1}
                    </Typography>
                    <span className="code">{l.serial || "—"}</span>
                    {l.model ? <Typography component="span" variant="body2">{l.model}</Typography> : null}
                    {l.machineType ? <Chip size="small" variant="outlined" label={l.machineType} /> : null}
                    {l.needsSerial ? <Chip size="small" color="warning" variant="outlined" label="ยังไม่มี SN จริง" /> : null}
                    {done ? (
                      <Chip size="small" color="success" icon={<CheckCircleIcon />} label={`เสร็จแล้ว${row.completedBy ? ` · ${row.completedBy}` : ""}`} />
                    ) : (
                      <Chip size="small" variant="outlined" label="ยังไม่เสร็จ" />
                    )}
                  </Stack>
                  {done ? null : (
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <PhotoGroup
                          title="รูป SN"
                          inputId={`job-close-sn-${l.id}`}
                          photos={e.sn}
                          working={saving}
                          missing={m.sn}
                          onAdd={(files) => addLinePhotos(l.id, "sn", files)}
                          onRemove={(i) => removeLinePhoto(l.id, "sn", i)}
                        />
                        {l.needsSerial ? (
                          <NoSnRefEditor
                            lineId={l.id}
                            current={row.noSnRef}
                            busy={saving}
                            onSave={(v) => saveNoSnRef(l.id, v)}
                            onError={onError}
                          />
                        ) : null}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <PhotoGroup
                          title="รูปงานที่ทำ"
                          inputId={`job-close-work-${l.id}`}
                          photos={e.work}
                          working={saving}
                          missing={m.work}
                          onAdd={(files) => addLinePhotos(l.id, "work", files)}
                          onRemove={(i) => removeLinePhoto(l.id, "work", i)}
                        />
                      </Box>
                    </Stack>
                  )}
                  {done ? (
                    row.resultNote ? (
                      <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
                        งานที่ทำ: {row.resultNote}
                      </Typography>
                    ) : null
                  ) : (
                    <TextField
                      size="small"
                      required
                      multiline
                      minRows={2}
                      label="รายละเอียดงานที่ทำ (เครื่องนี้)"
                      placeholder="เช่น ล้างคอยล์ เปลี่ยนไส้กรอง ตรวจเช็คระบบน้ำ"
                      value={lineNotes[l.id] ?? ""}
                      onChange={(ev2) => setLineNotes((n) => ({ ...n, [l.id]: ev2.target.value }))}
                      inputProps={{ maxLength: 500, "aria-label": `รายละเอียดงานที่ทำ ${l.serial}` }}
                      sx={{ mt: 1.5 }}
                      fullWidth
                    />
                  )}
                  {done && row.noSnRef ? (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      อ้างอิงแทน SN: {row.noSnRef.kind === "INVOICE" ? "IV" : "ใบส่งสินค้า"} {row.noSnRef.docNo}
                    </Typography>
                  ) : null}
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    {done ? (
                      has("jobs:edit") ? (
                        <Button size="small" variant="outlined" color="warning" disabled={saving} onClick={() => reopenLine(l.id, l.serial)}>
                          ยกเลิกผลเครื่องนี้
                        </Button>
                      ) : null
                    ) : (
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        disabled={saving || m.sn || m.work || !(lineNotes[l.id] ?? "").trim()}
                        onClick={() => completeLine(l.id)}
                        aria-label={`บันทึกเครื่อง ${l.serial} เสร็จ`}
                      >
                        {saving ? "กำลังบันทึก…" : "บันทึกเครื่องนี้เสร็จ"}
                      </Button>
                    )}
                  </Stack>
                </Paper>
              );
            })}
            {legacyRows.map((l) => {
              const row = rowOf(l.id) ?? l;
              const done = lineIsDone(row);
              return (
                <Paper key={l.id} variant="outlined" sx={{ p: 1.5 }} aria-label={`รายการเดิม ${l.serial}`}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography component="span" variant="body2">รายการเดิม (ยังไม่ผูกเครื่องในคลัง)</Typography>
                    <span className="code">{l.serial || "—"}</span>
                    {done ? <Chip size="small" color="success" label="เสร็จแล้ว" /> : <Chip size="small" variant="outlined" label="ยังไม่เสร็จ" />}
                    {done ? null : (
                      <Button size="small" variant="contained" color="success" disabled={savingLine === l.id} onClick={() => completeLine(l.id)}>
                        บันทึกเสร็จ
                      </Button>
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </Box>
      ) : null}

      <Box>
        <Typography component="div" sx={{ fontWeight: 600, color: "text.primary", mb: 1 }}>
          {perMachine ? "รูปหน้างานเพิ่มเติม (ไม่บังคับ)" : "รูปหน้างาน"} ({photos.length}/{MAX_PHOTOS})
          {totalChars > 0 ? (
            <Typography component="span" variant="body2" sx={{ ml: 1 }}>
              ~{(totalChars / 1_000_000).toFixed(1)} MB จากที่รับได้ {MAX_TOTAL_CHARS / 1_000_000} MB
            </Typography>
          ) : null}
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(3, 1fr)", sm: "repeat(4, 1fr)" },
            gap: 1,
          }}
        >
          {photos.map((src, i) => (
            <Box
              key={i}
              sx={{ position: "relative", aspectRatio: "1", borderRadius: 1, overflow: "hidden", border: 1, borderColor: "divider" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`รูปหน้างาน ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <IconButton
                size="small"
                aria-label={`ลบรูปที่ ${i + 1}`}
                onClick={() => removePhoto(i)}
                sx={{ position: "absolute", top: 2, right: 2, bgcolor: "rgba(0,0,0,0.55)", color: "#fff", "&:hover": { bgcolor: "rgba(0,0,0,0.75)" } }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <PhotoAddTiles inputId="job-close-photos" working={working} workingLabel="กำลังย่อรูป…" onAdd={addPhotos} />
          ) : null}
        </Box>
      </Box>

      <Box>
        <Typography component="div" sx={{ fontWeight: 600, color: "text.primary", mb: 1 }}>
          ลายเซ็นตรวจรับ{" "}
          <Box component="span" sx={{ color: "error.main" }} aria-hidden>
            *
          </Box>
        </Typography>
        <SignaturePad onChange={setSignature} />
        {!signature ? (
          <FormHelperText>ต้องมีลายเซ็นตรวจรับทุกครั้งก่อนปิดงาน</FormHelperText>
        ) : null}
      </Box>

      <TextField
        label="ชื่อผู้เซ็นรับงาน"
        value={signerName}
        onChange={(e) => setSignerName(e.target.value)}
        placeholder="ชื่อลูกค้า"
      />
      <TextField
        label="หมายเหตุการปิดงาน"
        value={closeNote}
        onChange={(e) => setCloseNote(e.target.value)}
        placeholder="สรุปงานที่ทำ / สภาพเครื่อง ฯลฯ"
        multiline
        minRows={3}
      />

      {reasons.length ? (
        <Alert severity="info" id="job-close-reasons">
          ยังปิดใบงานไม่ได้:
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </Box>
        </Alert>
      ) : null}
      <Button
        variant="contained"
        size="large"
        fullWidth
        onClick={submit}
        disabled={!canSubmit}
        startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <TaskAltIcon />}
      >
        {busy ? "กำลังปิดงาน…" : "ปิดงาน + บันทึกหลักฐาน"}
      </Button>
    </Stack>
  );
}
