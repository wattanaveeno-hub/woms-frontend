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

export default function Notifications() {
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status !== "authed") return;
    let active = true;
    (async () => {
      const today = todayStr();
      const [jobsRes, contractsRes, summary] = await Promise.all([
        safe(api.listJobs({})),
        safe(api.listContracts({})),
        safe(api.equipmentSummary()),
      ]);
      if (!active) return;
      const list: Notif[] = [];

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
    })();
    return () => {
      active = false;
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

  const count = notifs.length;

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
            แจ้งเตือน {count > 0 ? `(${count})` : ""}
          </div>
          {count === 0 ? (
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
        </div>
      ) : null}
    </div>
  );
}
