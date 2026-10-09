"use client";

// แนบหลักฐาน (รูปใบเสร็จ / สลิปโอน / PDF) เป็น data URL — ใช้กับบิลช่าง (BILL-06 / BR-12.2)
// รูปถูกย่อเหลือด้านยาว 1280px JPEG ก่อนส่ง · PDF ส่งตามจริงแต่จำกัดขนาดเท่ารูปปิดงาน
import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";

/** เท่ากับเพดานต่อไฟล์ของ backend (MAX_IMAGE_DATA_URL_CHARS) */
export const MAX_EVIDENCE_CHARS = 2_000_000;

function compressImage(file: File, maxDim = 1280, quality = 0.7): Promise<string> {
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
      if (!ctx) return reject(new Error("no canvas"));
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

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    r.readAsDataURL(file);
  });
}

export async function fileToEvidence(file: File): Promise<string> {
  const data = file.type === "application/pdf" ? await readAsDataUrl(file) : await compressImage(file);
  if (data.length > MAX_EVIDENCE_CHARS) throw new Error("ไฟล์ใหญ่เกินไป (ไม่เกินประมาณ 1.5 MB)");
  return data;
}

export function EvidencePreview({ src, label = "หลักฐาน" }: { src: string; label?: string }) {
  if (!src) return null;
  if (src.startsWith("data:application/pdf")) {
    return (
      <Button size="small" startIcon={<PictureAsPdfIcon />} href={src} target="_blank" rel="noopener" download={`${label}.pdf`}>
        เปิด PDF
      </Button>
    );
  }
  return (
    <Box
      component="a"
      href={src}
      target="_blank"
      rel="noopener"
      sx={{ display: "inline-block", border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden", lineHeight: 0 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} style={{ maxWidth: 160, maxHeight: 120, objectFit: "cover" }} />
    </Box>
  );
}

/** หลายไฟล์ (สูงสุด max) */
export default function BillEvidenceInput({
  value,
  onChange,
  max = 1,
  label = "แนบหลักฐาน",
  disabled = false,
  error,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  label?: string;
  disabled?: boolean;
  error?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setMsg(null);
    setBusy(true);
    try {
      const next = [...value];
      for (const f of Array.from(files)) {
        if (next.length >= max) break;
        if (!/^image\/(png|jpe?g|webp)$/.test(f.type) && f.type !== "application/pdf") {
          setMsg("รองรับเฉพาะรูป PNG / JPG / WEBP หรือ PDF");
          continue;
        }
        next.push(await fileToEvidence(f));
      }
      onChange(next);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "แนบไฟล์ไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
      if (camRef.current) camRef.current.value = "";
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        {value.map((v, i) => (
          <Box key={i} sx={{ position: "relative" }}>
            <EvidencePreview src={v} label={`${label} ${i + 1}`} />
            {!disabled ? (
              <IconButton
                size="small"
                aria-label={`ลบไฟล์ที่ ${i + 1}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                sx={{ position: "absolute", top: -10, right: -10, bgcolor: "background.paper", border: 1, borderColor: "divider" }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            ) : null}
          </Box>
        ))}
        {!disabled && value.length < max ? (
          <>
            <Button size="small" variant="outlined" startIcon={<AttachFileIcon />} disabled={busy} onClick={() => ref.current?.click()}>
              {busy ? "กำลังแนบ…" : label}
            </Button>
            {/* มือถือ: ถ่ายรูปใบเสร็จ/หลักฐานด้วยกล้องหลังทันที */}
            <Button size="small" variant="outlined" startIcon={<PhotoCameraIcon />} disabled={busy} onClick={() => camRef.current?.click()}>
              ถ่ายรูป
            </Button>
          </>
        ) : null}
      </Stack>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        multiple={max > 1}
        hidden
        onChange={(e) => pick(e.target.files)}
      />
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files)} />
      {msg || error ? (
        <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
          {msg || error}
        </Typography>
      ) : null}
    </Box>
  );
}
