"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

const PING_INTERVAL_MS = 60_000; // ส่งพิกัดทุก 1 นาทีระหว่างเปิดแอป
const STORAGE_KEY = "woms_share_location";

export interface TechLocationState {
  sharing: boolean;
  lat: number;
  lng: number;
  accuracy: number;
  lastSentAt: string;
  error: string | null;
}

// hook สำหรับมือถือช่าง: ขอพิกัดจากเครื่องแล้วส่งเข้า /api/tracking/ping เป็นระยะ
export function useTechLocation(bookingId = "", jobId = "") {
  const [state, setState] = useState<TechLocationState>({
    sharing: false,
    lat: 0,
    lng: 0,
    accuracy: 0,
    lastSentAt: "",
    error: null,
  });
  const watchId = useRef<number | null>(null);
  const lastSent = useRef(0);
  const latest = useRef({ lat: 0, lng: 0, accuracy: 0 });

  const send = useCallback(
    async (force = false) => {
      const { lat, lng, accuracy } = latest.current;
      if (!lat || !lng) return;
      const now = Date.now();
      if (!force && now - lastSent.current < PING_INTERVAL_MS) return;
      lastSent.current = now;
      try {
        const res = await api.sendPing({ lat, lng, accuracy, bookingId, jobId });
        setState((s) => ({ ...s, lastSentAt: res.at, error: null }));
      } catch {
        setState((s) => ({ ...s, error: "ส่งพิกัดไม่สำเร็จ (จะลองใหม่อัตโนมัติ)" }));
      }
    },
    [bookingId, jobId]
  );

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: "อุปกรณ์นี้ไม่รองรับ GPS" }));
      return;
    }
    if (watchId.current !== null) return;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        latest.current = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy ?? 0),
        };
        setState((s) => ({ ...s, sharing: true, ...latest.current, error: null }));
        send();
      },
      (err) => setState((s) => ({ ...s, error: `อ่านตำแหน่งไม่ได้: ${err.message}` })),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 }
    );
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setState((s) => ({ ...s, sharing: true }));
  }, [send]);

  const stop = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    try {
      localStorage.setItem(STORAGE_KEY, "0");
    } catch {
      /* ignore */
    }
    setState((s) => ({ ...s, sharing: false }));
  }, []);

  // เปิดต่ออัตโนมัติถ้าช่างเคยเปิดไว้
  useEffect(() => {
    let saved = "0";
    try {
      saved = localStorage.getItem(STORAGE_KEY) ?? "0";
    } catch {
      /* ignore */
    }
    if (saved === "1") start();
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [start]);

  // ส่งพิกัดตามรอบเวลาแม้ตำแหน่งจะไม่เปลี่ยน
  useEffect(() => {
    const t = setInterval(() => send(), PING_INTERVAL_MS);
    return () => clearInterval(t);
  }, [send]);

  return { ...state, start, stop, sendNow: () => send(true) };
}
