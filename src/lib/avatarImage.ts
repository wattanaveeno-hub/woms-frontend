"use client";
// CHAT-AV01: ย่อรูปโปรไฟล์ในเบราว์เซอร์ก่อนส่ง — ตัดกลางเป็นจัตุรัส 256×256 · JPEG (ปกติ < 60 KB)
import { AVATAR_SIZE_PX, centerSquare } from "./chatSearchRules";

export const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp,image/heic,image/heif";
export const AVATAR_MAX_SOURCE_BYTES = 15 * 1024 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("เปิดไฟล์รูปนี้ไม่ได้ — ใช้ไฟล์ JPG หรือ PNG"));
    };
    img.src = url;
  });
}

export async function resizeAvatar(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("ต้องเป็นไฟล์รูปภาพ");
  if (file.size > AVATAR_MAX_SOURCE_BYTES) throw new Error("ไฟล์รูปใหญ่เกินไป (ไม่เกิน 15 MB)");
  const img = await loadImage(file);
  const { sx, sy, size } = centerSquare(img.naturalWidth, img.naturalHeight);
  if (!size) throw new Error("เปิดไฟล์รูปนี้ไม่ได้");
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE_PX;
  canvas.height = AVATAR_SIZE_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("เบราว์เซอร์นี้ย่อรูปไม่ได้");
  ctx.fillStyle = "#ffffff"; // PNG โปร่งใส → พื้นขาว (JPEG ไม่มีความโปร่งใส)
  ctx.fillRect(0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, size, size, 0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);
  return canvas.toDataURL("image/jpeg", 0.85);
}
