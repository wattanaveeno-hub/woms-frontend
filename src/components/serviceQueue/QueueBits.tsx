"use client";

// ชิ้นส่วนแสดงผลของคิวช่างที่ใช้ซ้ำหลายหน้า (รายการ · รายละเอียด · การ์ดในแชท · Dashboard)
import { useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CardActions from "@mui/material/CardActions";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { WomsStatusChip } from "@/components/woms";
import { jobTypeLabel } from "@/lib/options";
import type { JobType } from "@/lib/types";
import { SQ_STATUS_LABEL, SQ_STATUS_TONE, TIME_PERIOD_LABEL, queueButtons, type SqStatus, type TimePeriod } from "@/lib/serviceQueueRules";
import { sqApi, type QueueCard } from "@/lib/serviceQueueApi";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useDialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";

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
export function QueueCardView({
  card,
  fallback,
  onChanged,
}: {
  card?: QueueCard;
  fallback: { queueId: string; queueNo: string; jobId: string };
  /** เรียกหลังกดปุ่มบนการ์ดสำเร็จ เพื่อโหลดสถานะล่าสุด */
  onChanged?: () => void;
}) {
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
  // CHAT-06 v2: หัวข้อ [สถานะงาน] [ประเภทงาน] • เลขคิว / JN • ป้ายงานจากตาราง PM
  // ที่อยู่สาขาจากฐานข้อมูลมักรวมอำเภอ/จังหวัดอยู่แล้ว — เติมเฉพาะส่วนที่ยังไม่มี (กันแสดงซ้ำ)
  const addr = (card.address ?? "").trim();
  const place = [addr, ...[card.district, card.province].filter((x) => (x ?? "").trim() && !addr.includes((x ?? "").trim()))].filter(Boolean).join(" · ");
  const row = (label: string, value: string) => (
    <>
      <Typography component="dt" variant="caption" color="text.secondary">{label}</Typography>
      <Typography component="dd" variant="caption" sx={{ m: 0, whiteSpace: "pre-line", wordBreak: "break-word" }}>{value || "—"}</Typography>
    </>
  );
  return (
    <Card variant="outlined" sx={{ maxWidth: 440, borderLeft: 4, borderLeftColor: `${SQ_STATUS_TONE[card.status!] ?? "neutral"}.main` }}>
      <CardActionArea component={Link} href={`/service-queue/${card.id}`} sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          {card.status ? <QueueStatusChip status={card.status} mode={card.mode} /> : null}
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{typeLabel(card.jobType ?? "")}</Typography>
          <Typography variant="subtitle2" color="text.secondary">• {card.queueNo}{card.jobId ? ` / ${card.jobId}` : ""}</Typography>
          {card.sourceLabel ? <WomsStatusChip label={card.sourceLabel} tone="info" /> : null}
        </Stack>
        <Box component="dl" sx={{ m: 0, mt: 1, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 1, rowGap: 0.25, fontSize: 13 }}>
          {row("ร้าน", [card.jobName, card.storeName && card.storeName !== card.jobName ? card.storeName : "", card.branchNo ? `สาขา ${card.branchNo}` : ""].filter(Boolean).join(" · "))}
          {row("เซลล์ / ช่าง", `${card.ownerSaleName || "—"} / ${card.techName || "ยังไม่จัดช่าง"}`)}
          {row("รุ่นเครื่อง", `${(card.models ?? []).join(", ") || "—"} (${card.itemCount ?? 0} เครื่อง${card.pendingSerialCount ? ` · รอ SN ${card.pendingSerialCount}` : ""})`)}
          {row("เครื่องกรองน้ำ", (card.filterUnits ?? []).join(", "))}
          {row("ผู้ติดต่อ / เบอร์", `${card.contactName || "—"} / ${card.phone || "—"}`)}
          {row("วันที่ / เวลา", card.date ? `${card.date} ${card.time}${card.periodLabel ? ` · ${card.periodLabel}` : ""}${card.roundNo ? ` (รอบ ${card.roundNo})` : ""}` : "ยังไม่มีวันนัด")}
          {row("ที่อยู่", place)}
          {row("หมายเหตุ", card.note ?? "")}
        </Box>
      </CardActionArea>
      {card.mapLink ? (
        <Box sx={{ px: 1.5, pb: 1 }}>
          <Button fullWidth size="large" variant="outlined" component="a" href={card.mapLink} target="_blank" rel="noopener noreferrer">
            เปิดแผนที่
          </Button>
        </Box>
      ) : null}
      <QueueCardActions card={card} onChanged={onChanged} />
    </Card>
  );
}

/**
 * FB-08: ปุ่มบนการ์ดคิวในแชท — เซลล์เจ้าของงาน/Admin คอนเฟิร์มลูกค้าได้จากการ์ด · Admin รับคิวที่ช่างตอบแล้ว
 * ปุ่มอื่น (เสนอวัน/ไม่รับ/จัดช่าง/ขอคิวใหม่) เปิดหน้าคิวเพื่อกรอกข้อมูล · backend ตรวจสิทธิ์และรอบนัดซ้ำทุกครั้ง
 */
function QueueCardActions({ card, onChanged }: { card: QueueCard; onChanged?: () => void }) {
  const { user, has } = useAuth();
  const dialog = useDialog();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // CHAT-03 v2: ช่างเสนอวันเวลาจากการ์ดในแชทได้เลย (ไม่ต้องเปิดหน้าคิว) — backend ตรวจช่างผู้รับผิดชอบ/รอบนัดซ้ำ
  const [proposeOpen, setProposeOpen] = useState(false);
  const [pDate, setPDate] = useState("");
  const [pTime, setPTime] = useState("");
  const [pNote, setPNote] = useState("");
  if (!user || !card.status) return null;
  const buttons = queueButtons(
    { status: card.status, mode: card.mode ?? "NEW", ownerSaleId: card.ownerSaleId ?? "", techId: card.techId ?? "", jobId: card.jobId },
    { id: user.id, has }
  );
  const inline = buttons.filter((b) => b === "accept" || b === "confirm");
  const canPropose = buttons.includes("propose");
  const other = buttons.some((b) => b === "reject" || b === "requestNewDate" || b === "assign" || b === "openJob" || b === "releaseReschedule");
  if (!inline.length && !other && !canPropose) return null;
  const submitPropose = async () => {
    if (!pDate || !pTime) {
      toast.error("กรุณาระบุวันที่และเวลาเริ่ม");
      return;
    }
    setBusy(true);
    try {
      const r = await sqApi.propose(card.id, card.roundNo ?? 0, pDate, pTime, pNote);
      toast.success(`เสนอวันเวลา ${card.queueNo} แล้ว — รอ Admin รับคิว`);
      if (r.conflicts?.length) toast.warning(`คุณมีคิวอื่นในช่วงเวลาเดียวกัน ${r.conflicts.length} รายการ (ไม่บล็อก)`);
      setProposeOpen(false);
      window.dispatchEvent(new Event("woms:queue-changed"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "เสนอวันเวลาไม่สำเร็จ");
    } finally {
      setBusy(false);
      onChanged?.();
    }
  };
  const appt = card.date ? `${card.date} ${card.time}${card.periodLabel ? ` · ${card.periodLabel}` : ""}` : "";
  const run = async (b: "accept" | "confirm") => {
    const ok = await dialog.confirm(
      b === "accept"
        ? { title: `รับคิว ${card.queueNo}`, message: `รับวันเวลาที่ช่าง ${card.techName ?? ""} เสนอ: ${appt} — คิวจะเข้าสู่ “รอลูกค้าคอนเฟิร์ม”`, confirmLabel: "รับคิว" }
        : {
            title: `ลูกค้าคอนเฟิร์ม ${card.queueNo}`,
            message: `ยืนยันว่าลูกค้าคอนเฟิร์ม ${appt} — คิวจะรอ Admin ตรวจและ${card.mode === "RESCHEDULE" ? `ยืนยันส่งงานเดิม ${card.jobId} กลับ` : "กดเปิดงาน (ออก JN)"}`,
            confirmLabel: "คอนเฟิร์มลูกค้า",
          }
    );
    if (!ok) return;
    setBusy(true);
    try {
      if (b === "accept") {
        await sqApi.accept(card.id, card.roundNo ?? 0);
        toast.success(`รับคิว ${card.queueNo} แล้ว — รอลูกค้าคอนเฟิร์ม`);
      } else {
        await sqApi.confirm(card.id, card.roundNo ?? 0);
        toast.success("บันทึกลูกค้าคอนเฟิร์มแล้ว — รอ Admin เปิดงาน");
      }
      window.dispatchEvent(new Event("woms:queue-changed"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
      onChanged?.();
    }
  };
  return (
    <CardActions sx={{ px: 1.5, pt: 0, pb: 1.25, gap: 0.5, flexWrap: "wrap" }}>
      {inline.map((b) => (
        <Button key={b} size="small" variant="contained" disabled={busy} onClick={() => run(b as "accept" | "confirm")}>
          {b === "accept" ? "รับคิว" : "ลูกค้าคอนเฟิร์มแล้ว"}
        </Button>
      ))}
      {canPropose ? (
        <Button
          size="small"
          variant="contained"
          disabled={busy}
          onClick={() => {
            setPDate("");
            setPTime("");
            setPNote("");
            setProposeOpen(true);
          }}
        >
          เสนอวันเวลา
        </Button>
      ) : null}
      {other || canPropose ? (
        <Button size="small" component={Link} href={`/service-queue/${card.id}`}>
          ดำเนินการในหน้าคิว
        </Button>
      ) : null}
      <Dialog open={proposeOpen} onClose={busy ? undefined : () => setProposeOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>เสนอวันและเวลาเริ่ม — {card.queueNo}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField type="date" label="วันที่" value={pDate} onChange={(e) => setPDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField type="time" label="เวลาเริ่ม" value={pTime} onChange={(e) => setPTime(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} helperText="ไม่ต้องระบุเวลาจบ (เวลาไทย)" />
            <TextField multiline minRows={2} label="หมายเหตุ (ถ้ามี)" value={pNote} onChange={(e) => setPNote(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProposeOpen(false)} disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant="contained" onClick={submitPropose} disabled={busy}>
            ส่งวันเวลาที่เสนอ
          </Button>
        </DialogActions>
      </Dialog>
    </CardActions>
  );
}
