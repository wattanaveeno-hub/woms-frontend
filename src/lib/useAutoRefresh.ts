"use client";

// ---------------------------------------------------------------------------
// MOM-34 (MoM 23/11/69) "อัปเดตสถานะ realtime" — รีเฟรชอัตโนมัติด้วย polling (ไม่มี WebSocket/SSE ฝั่ง backend)
//   · เรียกทุก intervalMs เฉพาะตอนแท็บเปิดอยู่ (document visible) — แท็บที่ซ่อนอยู่ไม่ยิง API
//   · กลับมาที่แท็บ/หน้าต่าง → รีเฟรชทันที (เว้นอย่างน้อย minGapMs)
//   · มีการเปลี่ยนคิวในแท็บเดียวกัน (event "woms:queue-changed") → รีเฟรช
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";

export const AUTO_REFRESH_MS = 30_000;

export function shouldRefreshNow(lastAt: number, now: number, minGapMs: number, visible: boolean): boolean {
  return visible && now - lastAt >= minGapMs;
}

export function useAutoRefresh(fn: () => void, opts: { intervalMs?: number; minGapMs?: number; enabled?: boolean } = {}) {
  const { intervalMs = AUTO_REFRESH_MS, minGapMs = 10_000, enabled = true } = opts;
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const lastRef = useRef(Date.now());
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const visible = () => document.visibilityState === "visible";
    const run = (force = false) => {
      const now = Date.now();
      if (!force && !shouldRefreshNow(lastRef.current, now, minGapMs, visible())) return;
      lastRef.current = now;
      fnRef.current();
    };
    const timer = window.setInterval(() => run(), intervalMs);
    const onVisible = () => run();
    const onChanged = () => run(true);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("woms:queue-changed", onChanged);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("woms:queue-changed", onChanged);
    };
  }, [enabled, intervalMs, minGapMs]);
}

/**
 * หน้ารายละเอียด (มีฟอร์ม/กล่องโต้ตอบ) ไม่โหลดทับเอง — ตรวจทุก 30 วินาทีว่าข้อมูลบนเซิร์ฟเวอร์เปลี่ยนหรือยัง
 * เปลี่ยนแล้ว → คืน true ให้หน้าแสดงแถบ "มีการอัปเดต · โหลดข้อมูลล่าสุด" (ผู้ใช้กดเอง ค่าที่กำลังกรอกไม่หาย)
 * stamp = ค่าที่เปลี่ยนทุกครั้งที่ข้อมูลเปลี่ยน (version / updatedAt) · "" = ยังไม่มีข้อมูล (ไม่ตรวจ)
 */
export function useStaleWatch(stamp: string, fetchStamp: () => Promise<string>, opts: { intervalMs?: number } = {}): boolean {
  const [stale, setStale] = useState(false);
  const fetchRef = useRef(fetchStamp);
  fetchRef.current = fetchStamp;
  useEffect(() => setStale(false), [stamp]);
  useAutoRefresh(
    () => {
      if (!stamp) return;
      fetchRef
        .current()
        .then((s) => {
          if (s && s !== stamp) setStale(true);
        })
        .catch(() => undefined);
    },
    { intervalMs: opts.intervalMs, enabled: !!stamp }
  );
  return stale;
}
