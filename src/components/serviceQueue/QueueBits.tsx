"use client";

// ชิ้นส่วนแสดงผลของคิวช่างที่ใช้ซ้ำหลายหน้า (รายการ · รายละเอียด · การ์ดในแชท · Dashboard)
import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { WomsStatusChip } from "@/components/woms";
import { jobTypeLabel } from "@/lib/options";
import type { JobType } from "@/lib/types";
import { SQ_STATUS_LABEL, SQ_STATUS_TONE, TIME_PERIOD_LABEL, type SqStatus, type TimePeriod } from "@/lib/serviceQueueRules";
import type { QueueCard } from "@/lib/serviceQueueApi";

export function QueueStatusChip({ status, mode }: { status: SqStatus; mode?: string }) {
  const label = SQ_STATUS_LABEL[status] ?? status;
  return (
    <Stack direction="row" spacing={0.5} sx={{ display: "inline-flex" }}>
      <WomsStatusChip label={label} tone={SQ_STATUS_TONE[status] ?? "neutral"} />
      {mode === "RESCHEDULE" && status !== "RELEASED" && status !== "CANCELLED" ? (
        <WomsStatusChip label="รอเช็คคิวใหม่" tone="warning" title="นำงานเดิมกลับมานัดใหม่ (JN เดิม)" />
      ) : null}
    </Stack>
  );
}

export function periodLabel(p: string): string {
  return p ? TIME_PERIOD_LABEL[p as TimePeriod] ?? p : "";
}

export function apptText(date: string, time: string, period: string): string {
  if (!date) return "ยังไม่มีวันนัด";
  const p = periodLabel(period);
  return `${date} ${time}${p ? ` · ${p}` : ""}`;
}

export function typeLabel(t: string): string {
  return (jobTypeLabel as Record<JobType, string>)[t as JobType] ?? t;
}

/**
 * การ์ดคิว/JN ในห้องแชท (CHAT 03) — แสดงสถานะล่าสุดเสมอ กดเปิดรายละเอียดได้
 * ช่างเดิมหลังคิวถูกย้าย: เห็นแค่ว่าคิวถูกย้ายแล้ว ไม่มีลิงก์ไปต่อ
 */
export function QueueCardView({ card, fallback }: { card?: QueueCard; fallback: { queueId: string; queueNo: string; jobId: string } }) {
  const ref = fallback.jobId ? `${fallback.queueNo} / ${fallback.jobId}` : fallback.queueNo;
  if (!card || card.transferred) {
    return (
      <Card variant="outlined" sx={{ bgcolor: "grey.50", maxWidth: 420 }}>
        <Box sx={{ p: 1.5 }}>
          <Typography variant="subtitle2">การ์ดคิว {ref}</Typography>
          <Typography variant="body2" color="text.secondary">
            {card?.transferred ? "คิวนี้ถูกย้ายไปยังช่างคนอื่นแล้ว — ไม่ต้องดำเนินการต่อ" : "ไม่พบข้อมูลคิว"}
          </Typography>
        </Box>
      </Card>
    );
  }
  return (
    <Card variant="outlined" sx={{ maxWidth: 420, borderLeft: 4, borderLeftColor: `${SQ_STATUS_TONE[card.status!] ?? "neutral"}.main` }}>
      <CardActionArea component={Link} href={`/service-queue/${card.id}`} sx={{ p: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {card.queueNo}
              {card.jobId ? ` · ${card.jobId}` : ""}
            </Typography>
            <Typography variant="body2" noWrap title={card.jobName}>
              {card.jobName}
            </Typography>
          </Box>
          {card.status ? <QueueStatusChip status={card.status} mode={card.mode} /> : null}
        </Stack>
        <Box component="dl" sx={{ m: 0, mt: 1, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 1, rowGap: 0.25, fontSize: 13 }}>
          <Typography component="dt" variant="caption" color="text.secondary">ประเภทงาน</Typography>
          <Typography component="dd" variant="caption" sx={{ m: 0 }}>{typeLabel(card.jobType ?? "")} · {card.itemCount ?? 0} เครื่อง{card.pendingSerialCount ? ` (รอ SN ${card.pendingSerialCount})` : ""}</Typography>
          <Typography component="dt" variant="caption" color="text.secondary">เซลล์</Typography>
          <Typography component="dd" variant="caption" sx={{ m: 0 }}>{card.ownerSaleName || "—"}</Typography>
          <Typography component="dt" variant="caption" color="text.secondary">ช่าง</Typography>
          <Typography component="dd" variant="caption" sx={{ m: 0 }}>{card.techName || "ยังไม่จัดช่าง"}</Typography>
          <Typography component="dt" variant="caption" color="text.secondary">วันเวลา</Typography>
          <Typography component="dd" variant="caption" sx={{ m: 0 }}>{card.date ? `${card.date} ${card.time} · ${card.periodLabel}` : "ยังไม่มีวันนัด"}{card.roundNo ? ` (รอบ ${card.roundNo})` : ""}</Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
}
