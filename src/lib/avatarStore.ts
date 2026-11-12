"use client";
// CHAT-AV01 รูปโปรไฟล์ — cache ฝั่งหน้าเว็บ (ขอเป็นชุดผ่าน GET /api/users/avatars?ids=)
//   presigned URL ของ R2 หมดอายุ 1 ชม. → ถือว่าเก่าหลัง 45 นาทีแล้วขอใหม่ · รูปโหลดไม่ได้ = แสดงอักษรย่อ แล้วขอใหม่ได้ไม่ถี่กว่า 1 นาที
import { useEffect, useSyncExternalStore } from "react";
import { ApiError, request } from "./api";
import { AVATAR_TTL_MS, avatarStale } from "./chatSearchRules";

type Entry = { url: string | null; at: number };
const cache = new Map<string, Entry>();
const inflight = new Set<string>();
const queue = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const CHUNK = 200;
const RETRY_MS = 60_000;

function emit() {
  version++;
  for (const l of listeners) l();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const snapshot = () => version;

async function flush() {
  timer = null;
  const ids = [...queue];
  queue.clear();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);
    part.forEach((id) => inflight.add(id));
    try {
      const r = await request<{ items: Record<string, { url: string; updatedAt: string }> }>(
        `/api/users/avatars?ids=${encodeURIComponent(part.join(","))}`
      );
      const now = Date.now();
      for (const id of part) cache.set(id, { url: r.items?.[id]?.url || null, at: now });
    } catch (e) {
      // ขอไม่สำเร็จ: แสดงอักษรย่อ แล้วลองใหม่หลัง 1 นาที · 403 (role ไม่มีสิทธิ์แชท/ดูผู้ใช้) = ไม่ถามซ้ำถี่
      const at = e instanceof ApiError && e.status === 403 ? Date.now() : Date.now() - AVATAR_TTL_MS + RETRY_MS;
      for (const id of part) if (!cache.has(id)) cache.set(id, { url: null, at });
    } finally {
      part.forEach((id) => inflight.delete(id));
    }
    emit();
  }
}

/** ขอรูปของผู้ใช้หลายคน (ข้ามคนที่ cache ยังใช้ได้ / กำลังขออยู่) */
export function requestAvatars(ids: (string | null | undefined)[]): void {
  const now = Date.now();
  let added = false;
  for (const id of ids) {
    if (!id || inflight.has(id) || queue.has(id)) continue;
    if (!avatarStale(cache.get(id), now)) continue;
    queue.add(id);
    added = true;
  }
  if (added && !timer) timer = setTimeout(flush, 30);
}

/** URL รูปของผู้ใช้ (null = ไม่มีรูป/ยังไม่โหลด → แสดงอักษรย่อ) */
export function useAvatarUrl(userId: string | null | undefined): string | null {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    if (userId) requestAvatars([userId]);
  }, [userId]);
  return userId ? cache.get(userId)?.url ?? null : null;
}

/** โหลดล่วงหน้าเป็นชุด (เช่น ผู้ส่งทุกคนในห้อง + สมาชิก) */
export function usePrefetchAvatars(ids: (string | null | undefined)[]): void {
  const key = [...new Set(ids.filter(Boolean))].sort().join(",");
  useEffect(() => {
    if (key) requestAvatars(key.split(","));
  }, [key]);
}

/** หลังอัปโหลด/ลบรูป — แสดงผลทันทีทุกที่ */
export function setAvatarLocal(userId: string, url: string | null): void {
  cache.set(userId, { url, at: Date.now() });
  emit();
}

/** รูปโหลดไม่ได้ (เช่น ลิงก์หมดอายุ) — ขอใหม่ถ้าครั้งก่อนเกิน 1 นาที */
export function markAvatarBroken(userId: string): void {
  const e = cache.get(userId);
  if (!e || Date.now() - e.at < RETRY_MS) return;
  cache.delete(userId);
  requestAvatars([userId]);
}

/** ตั้ง/ลบรูป — target "me" = ตัวเอง · อื่น ๆ = User ID (ต้องมี users:manage · backend ตรวจลำดับบทบาท/Protected Admin) */
export async function saveAvatar(target: "me" | string, userId: string, dataUrl: string | null): Promise<void> {
  const path = `/api/users/${target === "me" ? "me" : encodeURIComponent(target)}/avatar`;
  const r = await request<{ userId: string; url: string | null }>(
    path,
    dataUrl ? { method: "PUT", body: JSON.stringify({ dataUrl }) } : { method: "DELETE" }
  );
  // backend คืน presigned URL (R2) หรือ data URL (ปิด R2) — ใช้ได้ทันที
  setAvatarLocal(userId, r.url ?? null);
}
