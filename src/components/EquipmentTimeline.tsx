"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, downloadFile } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/AuthContext";
import type { Equipment, EquipmentJobRow, TimelineItem, TimelineTab } from "@/lib/types";
import { jobTypeLabel } from "@/lib/options";
import { bangkokDateTime } from "@/lib/date";

// jobType ที่ได้จาก backend เป็น string ทั่วไป — แปลงเป็นป้ายไทยถ้ารู้จัก
const typeLabel = (t: string) => (jobTypeLabel as Record<string, string>)[t] ?? t;

/**
 * ไทม์ไลน์ของเครื่อง — ประวัติเครื่อง + ใบงานที่เคยเข้า
 *
 * ข้อมูลและการกรองทั้งหมดมาจาก backend (`/timeline` และ `/jobs` ของ Phase 3)
 * หน้าเว็บไม่คำนวณหรือจับคู่ประวัติเองเลย และไม่เดาความสัมพันธ์จากข้อความ filterUnit
 */

const TABS: { key: TimelineTab; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "job", label: "ใบงาน" },
  { key: "pm", label: "PM" },
  { key: "cm", label: "CM" },
  { key: "move", label: "การย้าย" },
];

function fmtAt(at: string): string {
  if (!at) return "—";
  return bangkokDateTime(at);
}

export default function EquipmentTimeline({ equipment }: { equipment: Equipment }) {
  const { has } = useAuth();
  const canOpenJob = has("jobs:view");

  const toast = useToast();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [tab, setTab] = useState<TimelineTab>("all");
  const [items, setItems] = useState<TimelineItem[] | null>(null);
  const [jobs, setJobs] = useState<EquipmentJobRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      if (tab === "job") {
        // แท็บใบงานใช้ endpoint ที่ให้รายละเอียดครบกว่า (ทีมช่าง / ผู้ติดต่อ / วันที่)
        const res = await api.equipmentJobs(equipment.id);
        setJobs(res.items);
        setItems(null);
      } else {
        const res = await api.equipmentTimeline(equipment.id, tab);
        setItems(res.items);
        setJobs(null);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดประวัติไม่สำเร็จ");
    }
  }, [equipment.id, equipment.updatedAt, tab]);


  useEffect(() => {
    setItems(null);
    setJobs(null);
    load();
  }, [load]);

  // เลข/ชื่อใบงาน — กดเข้าไปดูได้เฉพาะผู้ที่มีสิทธิ์ดูใบงาน
  const jobRef = (jobId: string) => {
    if (!jobId) return null;
    return canOpenJob ? (
      <Link href={`/jobs/${jobId}`} className="code">
        {jobId}
      </Link>
    ) : (
      <span className="code" title="ไม่มีสิทธิ์เปิดใบงาน">
        {jobId}
      </span>
    );
  };

  const empty =
    (items && items.length === 0) || (jobs && jobs.length === 0) ? (
      <div className="state">
        {tab === "pm"
          ? "ยังไม่มีประวัติงาน PM ของเครื่องนี้"
          : tab === "cm"
          ? "ยังไม่มีประวัติงาน CM ของเครื่องนี้"
          : tab === "move"
          ? "ยังไม่มีประวัติการย้ายของเครื่องนี้"
          : tab === "job"
          ? "เครื่องนี้ยังไม่เคยถูกผูกกับใบงาน"
          : "ยังไม่มีประวัติของเครื่องนี้"}
      </div>
    ) : null;

  return (
    <div className="card card-pad" style={{ marginTop: 18 }}>
      <div
        className="toolbar no-print"
        style={{ marginTop: 0, justifyContent: "space-between", alignItems: "center" }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>ไทม์ไลน์เครื่อง</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {/* Export PDF จริงจากเซิร์ฟเวอร์ (ฝังฟอนต์ไทย) — ไม่ใช่การสั่งพิมพ์หน้าเว็บ */}
          <button
            className="btn"
            disabled={pdfBusy}
            onClick={async () => {
              setPdfBusy(true);
              try {
                await downloadFile(
                  `/api/equipment/${encodeURIComponent(equipment.id)}/history.pdf`,
                  `woms-history-${equipment.serial}.pdf`
                );
              } catch (e: any) {
                toast.error(e?.message ?? "ดาวน์โหลด PDF ไม่สำเร็จ");
              } finally {
                setPdfBusy(false);
              }
            }}
          >
            {pdfBusy ? "กำลังสร้าง PDF…" : "ดาวน์โหลด PDF"}
          </button>
          <button className="btn" onClick={() => window.print()}>
            พิมพ์ประวัติ
          </button>
        </div>
      </div>

      {/* หัวข้อสำหรับหน้าพิมพ์ (ไม่แสดงบนจอ) */}
      <h2 className="print-only" style={{ margin: "0 0 4px", fontSize: 16 }}>
        ประวัติเครื่อง {equipment.serial}
        {equipment.model ? ` · ${equipment.model}` : ""}
      </h2>

      <div className="toolbar no-print" style={{ gap: 8 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`btn ${tab === t.key ? "btn-primary" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div> : null}

      {!items && !jobs && !error ? <div className="state">กำลังโหลด…</div> : null}
      {empty}

      {/* ---- แท็บใบงาน ---- */}
      {jobs && jobs.length ? (
        <div style={{ marginTop: 12 }}>
          {jobs.map((j) => (
            <div
              key={j.lineId}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
                padding: "10px 0",
                borderTop: "1px solid var(--line)",
              }}
            >
              <span className="mono" style={{ fontSize: 13, minWidth: 96 }}>
                {j.jobDate || "—"}
                {j.jobTime ? ` ${j.jobTime}` : ""}
              </span>
              {jobRef(j.jobId)}
              <span className="badge badge-off">{typeLabel(j.jobType)}</span>
              <span className={`badge ${j.status === "CLOSED" ? "badge-closed" : "badge-open"}`}>
                {j.status === "CLOSED" ? "ปิดงานแล้ว" : "เปิดอยู่"}
              </span>
              <span>{j.jobName || "—"}</span>
              {j.technicianTeam ? <span className="sub">{j.technicianTeam}</span> : null}
              {j.contactName ? <span className="sub">· {j.contactName}</span> : null}
              {j.note ? (
                <span className="sub" style={{ flexBasis: "100%" }}>
                  {j.note}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* ---- แท็บอื่น ๆ (ไทม์ไลน์รวม) ---- */}
      {items && items.length ? (
        <div style={{ marginTop: 12 }}>
          {items.map((it) => (
            <div
              key={`${it.kind}-${it.id}`}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
                padding: "10px 0",
                borderTop: "1px solid var(--line)",
              }}
            >
              <span className="mono" style={{ fontSize: 13, minWidth: 128 }}>
                {fmtAt(it.at)}
              </span>
              <span className="badge badge-off">{it.title}</span>
              {it.kind === "JOB" && it.jobType ? (
                <span className="badge badge-off">{typeLabel(it.jobType)}</span>
              ) : null}
              {it.jobId ? jobRef(it.jobId) : null}
              {it.status ? <span className="sub">สถานะ: {it.status}</span> : null}
              {it.by ? <span className="sub">โดย {it.by}</span> : null}
              {it.detail ? (
                <span style={{ flexBasis: "100%", color: "var(--slate-2)", fontSize: 13 }}>
                  {it.detail}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
