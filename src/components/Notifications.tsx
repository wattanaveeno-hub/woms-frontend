"use client";

// แผง "งานค้างที่ต้องติดตาม" (สรุปจากข้อมูลจริงในระบบ) + เปิด/ปิด Web Push ของอุปกรณ์
// แยกจาก <NotificationBell /> ซึ่งเป็นกล่องข้อความแจ้งเตือนของระบบ — จึงใช้ไอคอนต่างกัน
import { useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CircleIcon from "@mui/icons-material/Circle";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import { FEATURES } from "@/lib/features";
import { chatNotificationsEnabled } from "@/lib/uiRules";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { bangkokToday } from "@/lib/date";

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

// "วันนี้" ต้องเป็นค่าเดียวกับที่แดชบอร์ด/เซิร์ฟเวอร์ใช้ (Phase 9)
// ปกติได้มาจาก /api/dashboard/jobs (serverDate) — bangkokToday() เป็นทางสำรอง
// เมื่อผู้ใช้ไม่มีสิทธิ์เรียก endpoint นั้น ไม่ได้ใช้เขตเวลาของเบราว์เซอร์อีกต่อไป

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
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = !!anchor;
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

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
      const [jobDash, overdueRes, openRes, contractsRes, summary, pendingSubs, unread] =
        await Promise.all([
          safe(api.dashboardJobs()),
          // งานเลยกำหนดนัด: ให้เซิร์ฟเวอร์เป็นคนเทียบวันที่ ไม่ใช่เบราว์เซอร์
          safe(api.listJobs({ status: "OPEN", dateScope: "OVERDUE" })),
          safe(api.listJobs({ status: "OPEN" })),
          safe(api.listContracts({})),
          safe(api.equipmentSummary()),
          // HIDE-01 — รายการจากแชทต่องาน แสดงเฉพาะเมื่อเปิดฟังก์ชันแชท
          chatNotificationsEnabled(FEATURES) ? safe(api.listSubmissions({ status: "PENDING" })) : Promise.resolve(null),
          chatNotificationsEnabled(FEATURES) ? safe(api.unreadChats()) : Promise.resolve(null),
        ]);
      if (!active) return;
      const today = jobDash?.serverDate || bangkokToday();
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

      // งานเลยกำหนดนัด — รายการมาจาก backend ที่กรองด้วยวันที่ของเซิร์ฟเวอร์แล้ว
      const overdueJobs = overdueRes?.jobs ?? [];
      const openCount = jobDash?.open ?? openRes?.jobs.length ?? 0;
      overdueJobs.slice(0, 8).forEach((j) =>
        list.push({
          id: "job-" + j.jobId,
          group: "งานเลยกำหนดนัด",
          text: `${j.jobName || j.jobId} • นัด ${j.jobDate}`,
          href: `/jobs/${j.jobId}`,
          sev: "red",
        })
      );
      if (openCount > 0) {
        list.push({
          id: "jobs-open",
          group: "งานที่ยังเปิดอยู่",
          text: `มีงานเปิดค้างทั้งหมด ${openCount} งาน`,
          href: "/jobs?status=OPEN",
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

  if (status !== "authed") return null;

  // ป้ายตัวเลขบนกระดิ่งนับเฉพาะรายการด่วน (สีแดง) — ส่วนแผงยังแสดงทุกรายการ
  const count = notifs.filter((n) => n.sev === "red").length;
  const total = notifs.length;

  const label = count ? `งานค้างที่ต้องติดตาม — ด่วน ${count} รายการ` : "งานค้างที่ต้องติดตาม";
  return (
    <>
      <Tooltip title={label}>
        <IconButton aria-label={label} aria-haspopup="dialog" onClick={(e) => setAnchor(e.currentTarget)}>
          <Badge color="error" badgeContent={count > 99 ? "99+" : count} invisible={count === 0}>
            <PendingActionsIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 360, maxWidth: "calc(100vw - 16px)", maxHeight: "70vh", display: "flex", flexDirection: "column" } } }}
      >
        <Typography sx={{ px: 2, py: 1.5, fontWeight: 700, color: "text.primary" }}>
          งานค้างที่ต้องติดตาม {total > 0 ? `(${total})` : ""}
        </Typography>
        <Divider />
        {total === 0 ? (
          <Typography variant="body2" sx={{ p: 3, textAlign: "center" }}>
            ไม่มีงานค้าง
          </Typography>
        ) : (
          <List dense sx={{ overflowY: "auto", flex: 1 }}>
            {notifs.map((n) => (
              <ListItemButton key={n.id} component={Link} href={n.href} onClick={() => setAnchor(null)} alignItems="flex-start">
                <CircleIcon
                  aria-hidden
                  sx={{ fontSize: 10, mt: 1, mr: 1.5, color: n.sev === "red" ? "error.main" : "warning.main" }}
                />
                <ListItemText
                  primary={n.group}
                  secondary={n.text}
                  primaryTypographyProps={{ fontSize: 12, fontWeight: 700, color: n.sev === "red" ? "error.main" : "warning.dark" }}
                  secondaryTypographyProps={{ color: "text.primary" }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
        {pushSupported() ? (
          <Box sx={{ p: 1.5, borderTop: 1, borderColor: "divider" }}>
            {isIOSNotInstalled() ? (
              <Alert severity="info" sx={{ fontSize: 13 }}>
                บน iPhone/iPad: กดปุ่มแชร์ แล้วเลือก &quot;เพิ่มลงในหน้าจอโฮม&quot; จากนั้นเปิดแอปจากไอคอนเพื่อเปิดใช้แจ้งเตือน
              </Alert>
            ) : pushOn ? (
              <Button fullWidth variant="outlined" disabled={pushBusy} onClick={disablePush} startIcon={<NotificationsOffIcon />}>
                ปิดแจ้งเตือนบนอุปกรณ์นี้
              </Button>
            ) : (
              <Button fullWidth variant="contained" disabled={pushBusy} onClick={enablePush} startIcon={<NotificationsActiveIcon />}>
                เปิดแจ้งเตือนบนอุปกรณ์นี้
              </Button>
            )}
          </Box>
        ) : null}
      </Popover>
    </>
  );
}
