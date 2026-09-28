"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, downloadFile } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/AuthContext";
import type { Equipment, EquipmentJobRow, TimelineItem, TimelineTab } from "@/lib/types";
import { jobTypeLabel } from "@/lib/options";
import { bangkokDateTime } from "@/lib/date";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import type { JobStatus } from "@/lib/types";
import {
  JobStatusChip,
  WomsEmptyState,
  WomsErrorState,
  WomsFormSection,
  WomsLoadingState,
} from "@/components/woms";

const JOB_STATUSES: string[] = ["OPEN", "HOLD", "CLOSED", "CANCELLED"];
// เดิมแสดงทุกสถานะที่ไม่ใช่ CLOSED ว่า "เปิดอยู่" — งานพัก/ยกเลิกจึงแสดงผิด
const jobStatusChip = (s: string) =>
  JOB_STATUSES.includes(s) ? <JobStatusChip status={s as JobStatus} /> : <Chip size="small" label={s} />;

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

  const emptyText =
    tab === "pm"
      ? "ยังไม่มีประวัติงาน PM ของเครื่องนี้"
      : tab === "cm"
      ? "ยังไม่มีประวัติงาน CM ของเครื่องนี้"
      : tab === "move"
      ? "ยังไม่มีประวัติการย้ายของเครื่องนี้"
      : tab === "job"
      ? "เครื่องนี้ยังไม่เคยถูกผูกกับใบงาน"
      : "ยังไม่มีประวัติของเครื่องนี้";
  const empty = (items && items.length === 0) || (jobs && jobs.length === 0);

  const row = (key: string, date: React.ReactNode, chips: React.ReactNode, main: React.ReactNode, detail?: React.ReactNode) => (
    <Box key={key} sx={{ py: 1.25, borderTop: 1, borderColor: "divider" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.5, sm: 1.25 }} alignItems={{ sm: "center" }} flexWrap="wrap" useFlexGap>
        <Typography component="span" className="mono" sx={{ fontSize: 13, minWidth: 128, color: "text.secondary" }}>
          {date}
        </Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          {chips}
        </Stack>
        <Box sx={{ minWidth: 0 }}>{main}</Box>
      </Stack>
      {detail ? (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {detail}
        </Typography>
      ) : null}
    </Box>
  );

  const downloadPdf = async () => {
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
  };

  return (
    <WomsFormSection
      title="ไทม์ไลน์เครื่อง"
      actions={
        <Box className="no-print" sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {/* Export PDF จริงจากเซิร์ฟเวอร์ (ฝังฟอนต์ไทย) — ไม่ใช่การสั่งพิมพ์หน้าเว็บ */}
          <Button variant="outlined" startIcon={<DownloadIcon />} disabled={pdfBusy} onClick={downloadPdf}>
            {pdfBusy ? "กำลังสร้าง PDF…" : "ดาวน์โหลด PDF"}
          </Button>
          <Button startIcon={<PrintIcon />} onClick={() => window.print()}>
            พิมพ์ประวัติ
          </Button>
        </Box>
      }
    >
      {/* หัวข้อสำหรับหน้าพิมพ์ (ไม่แสดงบนจอ) */}
      <h2 className="print-only" style={{ margin: "0 0 4px", fontSize: 16 }}>
        ประวัติเครื่อง {equipment.serial}
        {equipment.model ? ` · ${equipment.model}` : ""}
      </h2>

      <Tabs
        className="no-print"
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label="ประเภทประวัติ"
        sx={{ mb: 1 }}
      >
        {TABS.map((t) => (
          <Tab key={t.key} value={t.key} label={t.label} />
        ))}
      </Tabs>

      {error ? <WomsErrorState message={error} onRetry={load} /> : null}
      {!items && !jobs && !error ? <WomsLoadingState rows={3} /> : null}
      {empty ? <WomsEmptyState title={emptyText} /> : null}

      {/* ---- แท็บใบงาน ---- */}
      {jobs && jobs.length
        ? jobs.map((j) =>
            row(
              j.lineId,
              `${j.jobDate || "—"}${j.jobTime ? ` ${j.jobTime}` : ""}`,
              <>
                {jobRef(j.jobId)}
                <Chip size="small" variant="outlined" label={typeLabel(j.jobType)} />
                {jobStatusChip(j.status)}
              </>,
              <>
                <span>{j.jobName || "—"}</span>
                {j.technicianTeam || j.contactName ? (
                  <Typography component="span" variant="body2">
                    {" "}
                    · {[j.technicianTeam, j.contactName].filter(Boolean).join(" · ")}
                  </Typography>
                ) : null}
              </>,
              j.note || undefined
            )
          )
        : null}

      {/* ---- แท็บอื่น ๆ (ไทม์ไลน์รวม) ---- */}
      {items && items.length
        ? items.map((it) =>
            row(
              `${it.kind}-${it.id}`,
              fmtAt(it.at),
              <>
                <Chip size="small" label={it.title} />
                {it.kind === "JOB" && it.jobType ? <Chip size="small" variant="outlined" label={typeLabel(it.jobType)} /> : null}
                {it.jobId ? jobRef(it.jobId) : null}
              </>,
              <Typography component="span" variant="body2">
                {[it.status ? `สถานะ: ${it.status}` : "", it.by ? `โดย ${it.by}` : ""].filter(Boolean).join(" · ")}
              </Typography>,
              it.detail || undefined
            )
          )
        : null}
    </WomsFormSection>
  );
}
