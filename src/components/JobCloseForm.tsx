"use client";

import { useState } from "react";
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
    <div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label>
          รูปหน้างาน ({photos.length}/{MAX_PHOTOS})
          {totalChars > 0 ? (
            <span className="sub" style={{ marginLeft: 8 }}>
              ~{(totalChars / 1_000_000).toFixed(1)} MB จากที่รับได้ {MAX_TOTAL_CHARS / 1_000_000} MB
            </span>
          ) : null}
        </label>
        <div className="photo-grid">
          {photos.map((src, i) => (
            <div key={i} className="photo-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`photo-${i + 1}`} />
              <button type="button" className="photo-rm" onClick={() => removePhoto(i)} aria-label="ลบรูป">×</button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <label className="photo-add">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
              <span>{working ? "…" : "+ ถ่าย/เลือกรูป"}</span>
            </label>
          ) : null}
        </div>
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>ลายเซ็นลูกค้า<span className="req">*</span></label>
        <SignaturePad onChange={setSignature} />
      </div>

      <div className="form-grid">
        <div className="field">
          <label>ชื่อผู้เซ็นรับงาน</label>
          <input className="input" value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="ชื่อลูกค้า" />
        </div>
        <div className="field col-span">
          <label>หมายเหตุการปิดงาน</label>
          <textarea className="textarea" value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="สรุปงานที่ทำ / สภาพเครื่อง ฯลฯ" />
        </div>
      </div>

      <div className="toolbar">
        <button className="btn btn-primary" onClick={submit} disabled={!canSubmit}>
          {busy ? "กำลังปิดงาน…" : "ปิดงาน + บันทึกหลักฐาน"}
        </button>
        {!signature ? <span className="stat-label" style={{ alignSelf: "center" }}>ต้องมีลายเซ็นลูกค้าก่อน</span> : null}
      </div>
    </div>
  );
}
