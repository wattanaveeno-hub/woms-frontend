"use client";

// ---------------------------------------------------------------------------
// CR-PH01 (CF v1.1 §7.1 · AC12) — คลังรูปปิดงานไม่จำกัดจำนวนสะสม
//   เพิ่มได้หลายชุด (เลือกครั้งละไม่เกิน 20 ไฟล์ · D06 ข้อเสนอ) ไม่ต้องลบรูปเดิม · เห็นความคืบหน้ารายรูป
//   รูปที่ล้มเหลวกดส่งซ้ำได้ (รหัสรูปเดิม ไม่ซ้ำ) · แสดงภาพย่อแบบแบ่งหน้า โหลดต้นฉบับเมื่อเปิดดู
//   ผูกเครื่อง (รูป SN / รูปงาน) หรือรูปหน้างานเพิ่มเติม · ใบงานปิดแล้วดูได้อย่างเดียว
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { compressImage } from "@/lib/imageCompress";
import type { JobEquipmentLine } from "@/lib/types";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export const PHOTO_BATCH_MAX = 20;
type Kind = "SN" | "WORK" | "SITE";
type Item = { clientId: string; name: string; status: "pending" | "uploading" | "ok" | "failed"; error?: string; dataUrl?: string; thumb?: string };
export type PhotoCounts = Record<string, { SN: number; WORK: number }>;

function newClientId(): string {
  return `ph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function Gallery({ jobId, kind, lineId, refresh }: { jobId: string; kind: Kind; lineId: string; refresh: number }) {
  const [items, setItems] = useState<any[]>([]);
  const [next, setNext] = useState("");
  const [total, setTotal] = useState(0);
  const [full, setFull] = useState<string | null>(null);
  const load = useCallback(
    async (after = "") => {
      const r = await api.listJobPhotos(jobId, { kind, jobLineId: lineId, after, limit: 24 }).catch(() => ({ items: [], next: "", total: 0 }));
      setItems((p) => (after ? [...p, ...r.items] : r.items));
      setNext(r.next);
      setTotal(r.total);
    },
    [jobId, kind, lineId]
  );
  useEffect(() => {
    void load();
  }, [load, refresh]);
  if (!total) return null;
  return (
    <Box sx={{ mt: 1 }}>
      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
        {items.map((p) => (
          <Box
            key={p.id}
            component="img"
            src={p.thumb || undefined}
            alt={`${p.kind} ${p.createdAt?.slice(0, 16) ?? ""}`}
            title={`${p.createdByName ?? ""} ${p.createdAt?.slice(0, 16).replace("T", " ") ?? ""}`}
            onClick={async () => setFull((await api.getJobPhoto(jobId, p.id)).dataUrl)}
            sx={{ width: 72, height: 72, objectFit: "cover", borderRadius: 1, cursor: "pointer", bgcolor: "action.hover" }}
            data-testid="photo-thumb"
          />
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary" data-testid="photo-total">
        บันทึกแล้ว {total} รูป
      </Typography>
      {next ? (
        <Button size="small" onClick={() => load(next)} data-testid="photo-more">
          โหลดเพิ่ม
        </Button>
      ) : null}
      <Dialog open={!!full} onClose={() => setFull(null)} maxWidth="lg">
        <DialogContent>{full ? <Box component="img" src={full} alt="รูปต้นฉบับ" sx={{ maxWidth: "100%" }} /> : null}</DialogContent>
      </Dialog>
    </Box>
  );
}

function Uploader({ jobId, kind, lineId, canAdd, onSaved }: { jobId: string; kind: Kind; lineId: string; canAdd: boolean; onSaved: () => void }) {
  const [queue, setQueue] = useState<Item[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const send = async (batchId: string, items: Item[]) => {
    for (const it of items) {
      setQueue((q) => q.map((x) => (x.clientId === it.clientId ? { ...x, status: "uploading", error: undefined } : x)));
      try {
        const r = await api.addJobPhotos(jobId, { batchId, items: [{ clientId: it.clientId, kind, jobLineId: kind === "SITE" ? "" : lineId, dataUrl: it.dataUrl!, thumb: it.thumb }] });
        const res = r.results[0];
        setQueue((q) => q.map((x) => (x.clientId === it.clientId ? { ...x, status: res?.ok ? "ok" : "failed", error: res?.error } : x)));
      } catch (e) {
        setQueue((q) => q.map((x) => (x.clientId === it.clientId ? { ...x, status: "failed", error: e instanceof ApiError ? e.message : "ส่งไม่สำเร็จ" } : x)));
      }
    }
    setRefresh((n) => n + 1);
    onSaved();
  };

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(null);
    const list = [...files].slice(0, PHOTO_BATCH_MAX);
    if (files.length > PHOTO_BATCH_MAX) setErr(`เลือกได้ครั้งละไม่เกิน ${PHOTO_BATCH_MAX} รูป — เพิ่มชุดถัดไปได้ไม่จำกัด`);
    const batchId = `b-${Date.now().toString(36)}`;
    const prepared: Item[] = [];
    for (const f of list) {
      try {
        const [dataUrl, thumb] = await Promise.all([compressImage(f), compressImage(f, 200, 0.5)]);
        prepared.push({ clientId: newClientId(), name: f.name, status: "pending", dataUrl, thumb });
      } catch {
        prepared.push({ clientId: newClientId(), name: f.name, status: "failed", error: "อ่านไฟล์รูปไม่ได้ (รองรับ JPEG / PNG / WebP / HEIC ที่อุปกรณ์แปลงได้)" });
      }
    }
    setQueue((q) => [...q.filter((x) => x.status !== "ok"), ...prepared]);
    await send(batchId, prepared.filter((x) => x.status === "pending"));
  };

  const failed = queue.filter((x) => x.status === "failed" && x.dataUrl);
  const active = queue.filter((x) => x.status === "pending" || x.status === "uploading");
  const done = queue.filter((x) => x.status === "ok").length;

  return (
    <Box>
      {canAdd ? (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button component="label" size="small" variant="outlined" data-testid={`photo-add-${kind}`}>
            เพิ่มรูป (หลายไฟล์)
            <input
              hidden
              multiple
              type="file"
              accept="image/*"
              onChange={(e) => {
                void pick(e.target.files);
                e.target.value = "";
              }}
              data-testid={`photo-input-${kind}${lineId ? `-${lineId}` : ""}`}
            />
          </Button>
          {failed.length ? (
            <Button size="small" color="warning" onClick={() => send(`retry-${Date.now().toString(36)}`, failed)} data-testid="photo-retry">
              ส่งซ้ำรูปที่ล้มเหลว ({failed.length})
            </Button>
          ) : null}
          {queue.length ? <Chip size="small" label={`สำเร็จ ${done} / ${queue.length}`} data-testid="photo-progress" /> : null}
        </Stack>
      ) : null}
      {active.length ? <LinearProgress variant="determinate" value={(done / Math.max(1, queue.length)) * 100} sx={{ mt: 1 }} /> : null}
      {err ? <Alert severity="info" sx={{ mt: 1 }}>{err}</Alert> : null}
      {queue.filter((x) => x.status === "failed").map((x) => (
        <Typography key={x.clientId} variant="caption" color="error" sx={{ display: "block" }} data-testid="photo-failed">
          {x.name}: {x.error}
        </Typography>
      ))}
      <Gallery jobId={jobId} kind={kind} lineId={kind === "SITE" ? "" : lineId} refresh={refresh} />
    </Box>
  );
}

export default function JobPhotoStore({ jobId, lines, canAdd, onCountsChange }: { jobId: string; lines: JobEquipmentLine[]; canAdd: boolean; onCountsChange?: (c: PhotoCounts) => void }) {
  const refreshCounts = useCallback(async () => {
    const r = await api.jobPhotoSummary(jobId).catch(() => null);
    if (r) onCountsChange?.(r.lines);
  }, [jobId, onCountsChange]);
  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);
  const machines = lines.filter((l) => !!l.equipmentId);
  return (
    <Box data-testid="photo-store">
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        เพิ่มรูปได้หลายชุดโดยไม่ต้องลบรูปเดิม (ครั้งละไม่เกิน {PHOTO_BATCH_MAX} รูป) · ไม่จำกัดจำนวนรูปสะสม · รูปที่บันทึกสำเร็จนับเป็นหลักฐานปิดงาน
      </Typography>
      {machines.map((l) => (
        <Box key={l.id} sx={{ mb: 1.5, p: 1, border: 1, borderColor: "divider", borderRadius: 1 }}>
          <Typography variant="subtitle2" className="code">{l.serial}</Typography>
          {(["SN", "WORK"] as const).map((k) => (
            <Box key={k} sx={{ mt: 0.75 }}>
              <Typography variant="body2">{k === "SN" ? "รูป SN" : "รูปงานที่ทำ"}</Typography>
              <Uploader jobId={jobId} kind={k} lineId={l.id} canAdd={canAdd} onSaved={refreshCounts} />
            </Box>
          ))}
        </Box>
      ))}
      <Box sx={{ p: 1, border: 1, borderColor: "divider", borderRadius: 1 }}>
        <Typography variant="body2">รูปหน้างานเพิ่มเติม</Typography>
        <Uploader jobId={jobId} kind="SITE" lineId="" canAdd={canAdd} onSaved={refreshCounts} />
      </Box>
    </Box>
  );
}
