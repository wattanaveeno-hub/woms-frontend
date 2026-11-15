"use client";
// UAT2-08 / UAT2-15 — รูปหน้างานของใบคิว
//   PendingSitePhotos: ตอนเปิดคิว (ยังไม่มีเลขคิว) — เลือกรูปไว้ก่อน ระบบอัปโหลดหลังสร้างคิวสำเร็จ
//   QueueSitePhotosPanel: หน้ารายละเอียดคิว / ใบงานที่เปิดจากคิว — ดู ดาวน์โหลด และ (ผู้มีสิทธิ์) แนบเพิ่ม
//   รูปถูกย่อในเครื่องก่อนส่ง (ด้านยาวไม่เกิน 1600px) · รูปละไม่เกิน 5 MB · ครั้งละไม่เกิน 10 รูป (backend ตรวจซ้ำ)
import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import { ApiError } from "@/lib/api";
import { compressImage } from "@/lib/imageCompress";
import { sqApi, type QueueSitePhoto } from "@/lib/serviceQueueApi";
import { WomsFormSection } from "@/components/woms";

export interface PendingPhoto {
  key: string;
  name: string;
  dataUrl: string;
}

export const SITE_PHOTO_MAX_PER_BATCH = 10;

async function filesToPhotos(files: FileList | null): Promise<PendingPhoto[]> {
  const out: PendingPhoto[] = [];
  for (const f of Array.from(files ?? [])) {
    if (!f.type.startsWith("image/")) continue;
    out.push({ key: `${f.name}-${f.size}-${f.lastModified}-${Math.random()}`, name: f.name, dataUrl: await compressImage(f, 1600, 0.75) });
  }
  return out;
}

export function downloadDataUrl(dataUrl: string, name: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = name || "site-photo.jpg";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

const thumbSx = { width: 112, height: 84, objectFit: "cover" as const, borderRadius: 1, border: 1, borderColor: "divider", display: "block" };

/** ตอนเปิดคิว — เก็บรูปไว้ในฟอร์ม · อัปโหลดหลังได้เลขคิว (ดู uploadPendingSitePhotos) */
export function PendingSitePhotos({ value, onChange, disabled }: { value: PendingPhoto[]; onChange: (v: PendingPhoto[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const full = value.length >= SITE_PHOTO_MAX_PER_BATCH;
  return (
    <WomsFormSection
      title={`รูปหน้างาน (${value.length})`}
      actions={
        <Button size="small" variant="outlined" startIcon={<AddPhotoAlternateIcon />} disabled={disabled || busy || full} onClick={() => input.current?.click()} data-testid="queue-site-photo-add">
          {busy ? "กำลังเตรียมรูป…" : "เพิ่มรูปหน้างาน"}
        </Button>
      }
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        data-testid="queue-site-photo-input"
        onChange={async (e) => {
          setBusy(true);
          try {
            const add = await filesToPhotos(e.target.files);
            onChange([...value, ...add].slice(0, SITE_PHOTO_MAX_PER_BATCH));
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
      <Typography variant="body2" color="text.secondary" sx={{ mb: value.length ? 1.5 : 0 }}>
        รูปหน้าร้าน/จุดติดตั้ง/ปลั๊กไฟ ช่วยช่างเตรียมงาน (ไม่บังคับ · ไม่เกิน {SITE_PHOTO_MAX_PER_BATCH} รูป) — รูปถูกเก็บไว้กับใบคิวและเปิดดูได้จากใบงาน
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {value.map((p) => (
          <Box key={p.key} sx={{ position: "relative" }} data-testid="queue-site-photo-pending">
            <Box component="img" src={p.dataUrl} alt={p.name} sx={thumbSx} />
            <IconButton
              size="small"
              aria-label={`เอารูป ${p.name} ออก`}
              onClick={() => onChange(value.filter((x) => x.key !== p.key))}
              sx={{ position: "absolute", top: 2, right: 2, bgcolor: "rgba(255,255,255,.9)", "&:hover": { bgcolor: "#fff" } }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
      </Stack>
    </WomsFormSection>
  );
}

/** อัปโหลดรูปที่เลือกไว้หลังสร้างคิวสำเร็จ — คืนข้อความเตือนเมื่อไม่สำเร็จ (คิวถูกสร้างแล้ว แนบใหม่ได้จากหน้าคิว) */
export async function uploadPendingSitePhotos(queueId: string, photos: PendingPhoto[]): Promise<string | null> {
  if (!photos.length) return null;
  try {
    await sqApi.addSitePhotos(queueId, photos.map((p) => ({ name: p.name, dataUrl: p.dataUrl })));
    return null;
  } catch (e) {
    return `เปิดคิวแล้ว แต่แนบรูปหน้างานไม่สำเร็จ (${e instanceof ApiError ? e.message : "เครือข่ายขัดข้อง"}) — แนบใหม่ได้ที่หน้าคิว`;
  }
}

function SiteThumb({ queueId, p, onOpen, onDelete }: { queueId: string; p: QueueSitePhoto; onOpen: (src: string, name: string) => void; onDelete?: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    sqApi
      .sitePhoto(queueId, p.id)
      .then((r) => alive && setSrc(r.dataUrl))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [queueId, p.id]);
  if (failed) return <Box sx={{ ...thumbSx, display: "grid", placeItems: "center", fontSize: 12, color: "error.main" }}>เปิดรูปไม่ได้</Box>;
  if (!src) return <Box sx={{ ...thumbSx, bgcolor: "grey.100" }} aria-label={`กำลังโหลด ${p.name}`} />;
  return (
    <Box sx={{ position: "relative" }}>
      <Box component="img" src={src} alt={p.name} onClick={() => onOpen(src, p.name)} sx={{ ...thumbSx, cursor: "zoom-in" }} data-testid="queue-site-photo" />
      {onDelete ? (
        <IconButton
          size="small"
          aria-label={`ลบรูป ${p.name}`}
          data-testid="queue-site-photo-delete"
          onClick={onDelete}
          sx={{ position: "absolute", top: 2, right: 2, bgcolor: "rgba(255,255,255,.9)", "&:hover": { bgcolor: "#fff" } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      ) : null}
    </Box>
  );
}

/** แสดงรูปหน้างานของคิว (หน้าคิว / ใบงาน) · canUpload = แนบเพิ่มได้ */
export function QueueSitePhotosPanel({
  queueId,
  canUpload,
  canDelete,
  requireReason,
  title = "รูปหน้างาน (จากใบคิว)",
}: {
  queueId: string;
  canUpload?: boolean;
  /** D-R2-04: ร่างคิว = เจ้าของ/Admin · ส่งแล้ว = Admin เท่านั้น (backend ตรวจซ้ำ) */
  canDelete?: boolean;
  /** ส่งคิวแล้ว: ต้องระบุเหตุผลการลบ */
  requireReason?: boolean;
  title?: string;
}) {
  const [items, setItems] = useState<QueueSitePhoto[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [del, setDel] = useState<QueueSitePhoto | null>(null);
  const [reason, setReason] = useState("");
  const [delErr, setDelErr] = useState<string | null>(null);
  const confirmDelete = async () => {
    if (!del) return;
    if (requireReason && !reason.trim()) return setDelErr("ต้องระบุเหตุผลการลบ");
    setBusy(true);
    try {
      await sqApi.deleteSitePhoto(queueId, del.id, reason.trim());
      setDel(null);
      load();
    } catch (e) {
      setDelErr(e instanceof ApiError ? e.message : "ลบรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };
  const load = useCallback(() => {
    sqApi
      .sitePhotos(queueId)
      .then((r) => {
        setItems(r.items);
        setErr(null);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "โหลดรูปหน้างานไม่สำเร็จ"));
  }, [queueId]);
  useEffect(load, [load]);
  if (!items && !err) return null;
  if (items && !items.length && !canUpload) return null;
  return (
    <WomsFormSection
      title={`${title} (${items?.length ?? 0})`}
      actions={
        canUpload ? (
          <Button size="small" variant="outlined" startIcon={<AddPhotoAlternateIcon />} disabled={busy} onClick={() => input.current?.click()} data-testid="queue-site-photo-add">
            {busy ? "กำลังอัปโหลด…" : "แนบรูปหน้างาน"}
          </Button>
        ) : null
      }
    >
      {canUpload ? (
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          data-testid="queue-site-photo-input"
          onChange={async (e) => {
            setBusy(true);
            try {
              const photos = (await filesToPhotos(e.target.files)).slice(0, SITE_PHOTO_MAX_PER_BATCH);
              if (photos.length) await sqApi.addSitePhotos(queueId, photos.map((p) => ({ name: p.name, dataUrl: p.dataUrl })));
              load();
            } catch (er) {
              setErr(er instanceof ApiError ? er.message : "แนบรูปไม่สำเร็จ");
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      ) : null}
      {err ? (
        <Alert severity="error" sx={{ mb: 1 }}>
          {err}
        </Alert>
      ) : null}
      {items && !items.length ? (
        <Typography variant="body2" color="text.secondary">
          ยังไม่มีรูปหน้างาน
        </Typography>
      ) : null}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {items?.map((p) => (
          <SiteThumb
            key={p.id}
            queueId={queueId}
            p={p}
            onOpen={(src, name) => setPreview({ src, name })}
            onDelete={
              canDelete
                ? () => {
                    setReason("");
                    setDelErr(null);
                    setDel(p);
                  }
                : undefined
            }
          />
        ))}
      </Stack>
      <Dialog open={!!del} onClose={busy ? undefined : () => setDel(null)} fullWidth maxWidth="xs">
        <DialogTitle>ลบรูปหน้างาน</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: requireReason ? 2 : 0 }}>
            {del?.name} — {requireReason ? "คิวนี้ส่งแล้ว ระบบเก็บประวัติการลบ (ผู้ลบ เวลา เหตุผล) ไว้ตรวจสอบ" : "ลบออกจากร่างคิว"}
          </Typography>
          {requireReason ? (
            <TextField
              fullWidth
              required
              label="เหตุผลการลบ"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={!!delErr}
              helperText={delErr ?? " "}
              inputProps={{ "data-testid": "site-photo-delete-reason" }}
            />
          ) : delErr ? (
            <Alert severity="error" sx={{ mt: 1 }}>
              {delErr}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDel(null)} disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant="contained" color="error" onClick={() => void confirmDelete()} disabled={busy} data-testid="site-photo-delete-confirm">
            ลบรูป
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="lg">
        <DialogTitle>{preview?.name}</DialogTitle>
        <DialogContent>{preview ? <Box component="img" src={preview.src} alt={preview.name} sx={{ maxWidth: "100%", maxHeight: "75vh" }} /> : null}</DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setPreview(null)}>
            ปิด
          </Button>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => preview && downloadDataUrl(preview.src, preview.name)}>
            ดาวน์โหลด
          </Button>
        </DialogActions>
      </Dialog>
    </WomsFormSection>
  );
}
