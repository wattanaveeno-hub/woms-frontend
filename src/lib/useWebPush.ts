"use client";

// Web Push บนเครื่องนี้ — ใช้ร่วมระหว่างกระดิ่งในแถบบน และหน้าการแจ้งเตือน (Phase 7 · ENTECH design "Notifications")
//   ย้ายมาจาก components/Notifications.tsx โดยไม่เปลี่ยนพฤติกรรม
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

export const isIOSNotInstalled = () => {
  if (typeof window === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
};

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}


export function useWebPush(authed: boolean) {
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  // BD-05: เซิร์ฟเวอร์ตั้งค่า VAPID แล้วหรือยัง (null = ยังไม่รู้) — ไม่มี key = แจ้งเตือนบนเครื่องใช้ไม่ได้ แสดงสถานะแทนปุ่ม
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (!authed || !pushSupported()) return;
    let alive = true;
    api
      .pushVapid()
      .then((r) => alive && setConfigured(!!r?.key))
      .catch(() => alive && setConfigured(null));
    return () => {
      alive = false;
    };
  }, [authed]);

  // ลงทะเบียน service worker + เช็คสถานะ subscribe ปัจจุบัน
  useEffect(() => {
    if (!authed || !pushSupported()) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setPushOn(!!sub);
      })
      .catch(() => {});
  }, [authed]);

  const enablePush = async () => {
    if (!pushSupported() || pushBusy) return;
    setPushBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const { key } = await api.pushVapid();
        if (!key) {
          setConfigured(false);
          return;
        }
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
      }
      const j = sub.toJSON();
      await api.pushSubscribe({
        endpoint: sub.endpoint,
        keys: { p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "" },
      });
      setPushOn(true);
    } catch {
      /* ignore */
    } finally {
      setPushBusy(false);
    }
  };

  const disablePush = async () => {
    if (!pushSupported() || pushBusy) return;
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.pushUnsubscribe(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
      }
      setPushOn(false);
    } catch {
      /* ignore */
    } finally {
      setPushBusy(false);
    }
  };

  return { pushOn, pushBusy, enablePush, disablePush, supported: pushSupported(), configured };
}
