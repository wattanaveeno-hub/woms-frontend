"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

type Sev = "red" | "amber";
interface Notif {
  id: string;
  group: string;
  text: string;
  href: string;
  sev: Sev;
}

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

const todayStr = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD (local)

// ---- web push helpers ----
const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

const isIOSNotInstalled = () => {
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

export default function Notifications() {
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // ลงทะเบียน service worker + เช็คสถานะ subscribe ปัจจุบัน
  useEffect(() => {
    if (status !== "authed" || !pushSupported()) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setPushOn(!!sub);
      })
      .catch(() => {});
  }, [status]);

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
        if (!key) return;
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

  useEffect(() => {
    if (status !== "authed") return;
    let active = true;
    const loadNotifs = async () => {
      const today = todayStr();
      const [jobsRes, contractsRes, summary, pendingSubs, unread] = await Promise.all([
        safe(api.listJobs({})),
        safe(api.listContracts({})),
        safe(api.equipmentSummary()),
        safe(api.listSubmissions({ status: "PENDING" })),
        safe(api.unreadChats()),
      ]);
      if (!active) return;
      const list: Notif[] = [];

      // unread chat messages (ห้องที่เคยเปิด แล้วมีข้อความใหม่จากคนอื่น)
      const un = unread?.items ?? [];
      un.slice(0, 8).forEach((u) =>
        list.push({
          id: "chat-" + u.jobId,
          group: "ข้อความใหม่ในแชท",
          text: `${u.jobId} • ${u.lastFrom}: ${u.lastText.slice(0, 40)}${u.lastText.length > 40 ? "…" : ""}${u.count > 1 ? ` (${u.count} ข้อความ)` : ""}`,
          href: `/jobs/${u.jobId}/chat`,
          sev: "red",
        })
      );

      // pending work submissions from the job chat (waiting for review)
      // ซ่อนรายการที่เราเปิดห้องแชทไปดูแล้ว (seen จาก read receipt)
      const subs = (pendingSubs?.items ?? []).filter((s) => !s.seen);
      subs.slice(0, 8).forEach((s) =>
        list.push({
          id: "sub-" + s.subId,
          group: "งานส่งรอตรวจ",
          text: `${s.jobId} • ส่งโดย ${s.submittedBy}`,
          href: `/jobs/${s.jobId}/chat`,
          sev: "red",
        })
      );

      // overdue jobs (open + past appointment date)
      const jobs = jobsRes?.jobs ?? [];
      const openJobs = jobs.filter((j) => j.status === "OPEN");
      openJobs
        .filter((j) => j.jobDate && j.jobDate < today)
        .slice(0, 8)
        .forEach((j) =>
          list.push({
            id: "job-" + j.jobId,
            group: "งานเลยกำหนดนัด",
            text: `${j.jobName || j.jobId} • นัด ${j.jobDate}`,
            href: `/jobs/${j.jobId}`,
            sev: "red",
          })
        );
      if (openJobs.length > 0) {
        list.push({
          id: "jobs-open",
          group: "งานที่ยังเปิดอยู่",
          text: `มีงานเปิดค้างทั้งหมด ${openJobs.length} งาน`,
          href: "/jobs",
          sev: "amber",
        });
      }

      // overdue installments (active contracts, pending + past due)
      const contracts = contractsRes?.items ?? [];
      let instCount = 0;
      for (const c of contracts) {
        if (c.status !== "ACTIVE") continue;
        for (const inst of c.installments) {
          if (inst.status === "PENDING" && inst.dueDate && inst.dueDate < today) {
            if (instCount < 8) {
              list.push({
                id: `inst-${c.id}-${inst.no}`,
                group: "งวดผ่อนเลยกำหนด",
                text: `${c.contractNo} งวดที่ ${inst.no} • ครบกำหนด ${inst.dueDate}`,
                href: `/contracts/${c.id}`,
                sev: "red",
              });
            }
            instCount++;
          }
        }
      }

      // warranty (summary counts)
      if (summary && summary.warrantyExpired > 0) {
        list.push({
          id: "warranty-exp",
          group: "ประกันหมดแล้ว",
          text: `เครื่องหมดประกัน ${summary.warrantyExpired} เครื่อง`,
          href: "/equipment?warranty=EXPIRED",
          sev: "red",
        });
      }
      if (summary && summary.warrantyExpiring > 0) {
        list.push({
          id: "warranty-soon",
          group: "ประกันใกล้หมด",
          text: `เครื่องใกล้หมดประกัน ${summary.warrantyExpiring} เครื่อง`,
          href: "/equipment?warranty=EXPIRING",
          sev: "amber",
        });
      }

      setNotifs(list);
    };
    loadNotifs();
    const t = setInterval(loadNotifs, 30_000); // refresh every 30s
    // รีเฟรชทันทีเมื่อเปิดอ่านห้องแชท (event จากหน้าแชท) หรือสลับกลับมาที่แท็บนี้
    const onRead = () => loadNotifs();
    window.addEventListener("woms:chat-read", onRead);
    window.addEventListener("focus", onRead);
    return () => {
      active = false;
      clearInterval(t);
      window.removeEventListener("woms:chat-read", onRead);
      window.removeEventListener("focus", onRead);
    };
  }, [status]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (status !== "authed") return null;

  // ป้ายตัวเลขบนกระดิ่งนับเฉพาะรายการด่วน (สีแดง) — ส่วนแผงยังแสดงทุกรายการ
  const count = notifs.filter((n) => n.sev === "red").length;
  const total = notifs.length;

  return (
    <div className="notif" ref={ref}>
      <button className="notif-bell" aria-label="แจ้งเตือน" onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
        </svg>
        {count > 0 ? <span className="notif-badge">{count > 99 ? "99+" : count}</span> : null}
      </button>

      {open ? (
        <div className="notif-panel">
          <div className="notif-head">
            แจ้งเตือน {total > 0 ? `(${total})` : ""}
          </div>
          {total === 0 ? (
            <div className="notif-empty">ไม่มีงานค้าง 🎉</div>
          ) : (
            <div className="notif-list">
              {notifs.map((n) => (
                <Link key={n.id} href={n.href} className="notif-item" onClick={() => setOpen(false)}>
                  <span className={`notif-dot ${n.sev}`} />
                  <span className="notif-body">
                    <span className="notif-group">{n.group}</span>
                    <span className="notif-text">{n.text}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
          {pushSupported() ? (
            <div className="notif-foot">
              {isIOSNotInstalled() ? (
                <div className="notif-push-hint">
                  📱 บน iPhone/iPad: กดปุ่มแชร์ แล้วเลือก &quot;เพิ่มลงในหน้าจอโฮม&quot;
                  จากนั้นเปิดแอปจากไอคอนเพื่อเปิดใช้แจ้งเตือน
                </div>
              ) : pushOn ? (
                <button className="notif-push-btn on" disabled={pushBusy} onClick={disablePush}>
                  🔕 ปิดแจ้งเตือนบนอุปกรณ์นี้
                </button>
              ) : (
                <button className="notif-push-btn" disabled={pushBusy} onClick={enablePush}>
                  🔔 เปิดแจ้งเตือนบนอุปกรณ์นี้
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
