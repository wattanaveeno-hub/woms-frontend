"use client";

import { useState } from "react";
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
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import SignaturePad from "@/components/SignaturePad";

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
}

export default function JobCloseForm({ busy, onSubmit, onError }: JobCloseFormProps) {
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

  const canSubmit = signature !== "" && !busy && !working;

  const totalChars = photos.reduce((n, p) => n + p.length, 0) + signature.length;

  const submit = () => {
    if (!signature) {
      onError?.("กรุณาให้ลูกค้าเซ็นชื่อก่อนปิดงาน");
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
      <Box>
        <Typography component="div" sx={{ fontWeight: 600, color: "text.primary", mb: 1 }}>
          รูปหน้างาน ({photos.length}/{MAX_PHOTOS})
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
            <Button
              component="label"
              variant="outlined"
              disabled={working}
              sx={{ aspectRatio: "1", flexDirection: "column", gap: 0.5, borderStyle: "dashed", minHeight: 88 }}
            >
              {working ? <CircularProgress size={22} /> : <PhotoCameraIcon />}
              <Typography component="span" variant="body2" sx={{ fontSize: 12.5, color: "inherit" }}>
                {working ? "กำลังย่อรูป…" : "ถ่าย/เลือกรูป"}
              </Typography>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                hidden
                onChange={(e) => {
                  addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </Button>
          ) : null}
        </Box>
      </Box>

      <Box>
        <Typography component="div" sx={{ fontWeight: 600, color: "text.primary", mb: 1 }}>
          ลายเซ็นลูกค้า{" "}
          <Box component="span" sx={{ color: "error.main" }} aria-hidden>
            *
          </Box>
        </Typography>
        <SignaturePad onChange={setSignature} />
        {!signature ? (
          <FormHelperText>ต้องมีลายเซ็นลูกค้าก่อนปิดงาน</FormHelperText>
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
