"use client";

// รายละเอียดคิว (QUEUE 03): ใบงาน · รายการเครื่อง · บทสนทนาที่เกี่ยวข้อง · วันเวลาที่เสนอ · ประวัติรอบนัด · Log
// ปุ่มแสดงตามบทบาทและสถานะ — ทุกปุ่มส่ง roundNo/version ไปให้ backend ตรวจว่าเป็นข้อมูลล่าสุด
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useDialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import type { AuthUser, JobEquipmentLine } from "@/lib/types";
import {
  WomsErrorState,
  WomsFormSection,
  WomsKeyValue,
  WomsLoadingState,
  WomsPageHeader,
  WomsPermissionGate,
  WomsStatusChip,
} from "@/components/woms";
import QueueForm from "@/components/serviceQueue/QueueForm";
import { QueueStatusChip, apptText, periodLabel, typeLabel } from "@/components/serviceQueue/QueueBits";
import {
  sqApi,
  type GroupMessage,
  type PeriodConflict,
  type QueueFormValues,
  type ServiceQueue,
  type SqEvent,
} from "@/lib/serviceQueueApi";
import {
  ROUND_STATUS_LABEL,
  SQ_ACTION_LABEL,
  SQ_STATUS_LABEL,
  bangkokTime,
  queueButtons,
  timePeriodOf,
  type QueueButton,
  type SqStatus,
} from "@/lib/serviceQueueRules";

const BUTTON_LABEL: Record<QueueButton, string> = {
  assign: "จัดช่าง",
  reassign: "เปลี่ยนช่าง",
  propose: "เสนอวันเวลาเริ่ม",
  reject: "ไม่สะดวกรับคิว",
  confirm: "คอนเฟิร์มลูกค้า",
  requestNewDate: "ขอคิวใหม่",
  openJob: "เปิดงาน (ออก JN)",
  releaseReschedule: "ยืนยันส่งงานเดิมกลับ",
  edit: "แก้ไขข้อมูล",
  cancel: "ยกเลิกคิว",
};

const PRIMARY: QueueButton[] = ["assign", "propose", "confirm", "openJob", "releaseReschedule"];

function fmtValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return `${v.length} รายการ`;
  return JSON.stringify(v);
}

function ConflictAlert({ items }: { items: PeriodConflict[] }) {
  if (!items.length) return null;
  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      ช่างมีคิวอื่นในวันและช่วงเวลาเดียวกัน (เป็นคำเตือน ไม่บล็อกการรับงาน):
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {items.map((c) => (
          <li key={`${c.queueId}-${c.jobId}`}>
            {c.queueId ? <Link href={`/service-queue/${c.queueId}`}>{c.queueNo}</Link> : null}
            {c.jobId ? (
              <>
                {c.queueId ? " · " : ""}
                <Link href={`/jobs/${c.jobId}`}>{c.jobId}</Link>
              </>
            ) : null}{" "}
            {c.jobName} — {c.date} {c.time} ({periodLabel(c.period)}) · {SQ_STATUS_LABEL[c.status as SqStatus] ?? c.status}
          </li>
        ))}
      </Box>
    </Alert>
  );
}

/** เลือกช่าง — จัดช่าง/เปลี่ยนช่าง */
function AssignDialog({
  open,
  reassign,
  currentTechId,
  onClose,
  onSubmit,
}: {
  open: boolean;
  reassign: boolean;
  currentTechId: string;
  onClose: () => void;
  onSubmit: (techId: string, note: string) => Promise<void>;
}) {
  const [techs, setTechs] = useState<AuthUser[]>([]);
  const [techId, setTechId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setTechId("");
    setNote("");
    setErr(null);
    api.listTechnicians().then((r) => setTechs(r.items.filter((t) => t.active !== false))).catch(() => setTechs([]));
  }, [open]);
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{reassign ? "เปลี่ยนช่างผู้รับผิดชอบ" : "จัดช่าง"}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          หนึ่งใบงานมีช่างผู้รับผิดชอบหนึ่งคน {reassign ? "— ช่างเดิมจะไม่มีสิทธิ์ตอบคิวนี้ต่อ และกลุ่มเดิมจะได้รับแจ้งการย้าย" : "— คิวจะเข้าตารางและกลุ่มงานของช่างคนนี้"}
        </Typography>
        <TextField select fullWidth label="ช่าง" value={techId} onChange={(e) => setTechId(e.target.value)} sx={{ mb: 2 }}>
          {techs
            .filter((t) => t.id !== currentTechId)
            .map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
                {t.team ? ` · ${t.team}` : ""}
              </MenuItem>
            ))}
        </TextField>
        <TextField
          fullWidth
          multiline
          minRows={2}
          label={reassign ? "เหตุผลการเปลี่ยนช่าง (จำเป็น)" : "หมายเหตุ (ถ้ามี)"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          error={!!err}
          helperText={err ?? " "}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          disabled={busy || !techId}
          onClick={async () => {
            if (reassign && !note.trim()) return setErr("ต้องระบุเหตุผลการเปลี่ยนช่าง");
            setBusy(true);
            try {
              await onSubmit(techId, note.trim());
            } finally {
              setBusy(false);
            }
          }}
        >
          บันทึก
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** ช่างเสนอวันและเวลาเริ่ม — ไม่ต้องระบุเวลาจบ · ช่วงเวลาคำนวณให้อัตโนมัติ */
function ProposeDialog({
  open,
  queue,
  onClose,
  onSubmit,
}: {
  open: boolean;
  queue: ServiceQueue;
  onClose: () => void;
  onSubmit: (date: string, time: string, note: string) => Promise<void>;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflicts, setConflicts] = useState<PeriodConflict[]>([]);
  useEffect(() => {
    if (open) {
      setDate(queue.preferredDate || "");
      setTime(queue.preferredTime || "");
      setNote("");
    }
  }, [open, queue.preferredDate, queue.preferredTime]);
  useEffect(() => {
    if (!open || !date || !time || !queue.techId) return setConflicts([]);
    const t = setTimeout(() => {
      sqApi
        .conflicts(queue.techId, date, time, queue.id)
        .then((r) => setConflicts(r.items))
        .catch(() => setConflicts([]));
    }, 300);
    return () => clearTimeout(t);
  }, [open, date, time, queue.techId, queue.id]);
  const period = timePeriodOf(time);
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>เสนอวันและเวลาเริ่ม — {queue.queueNo}</DialogTitle>
      <DialogContent>
        {queue.preferredDate ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            ลูกค้าต้องการ {queue.preferredDate} {queue.preferredTime} (ข้อมูลประกอบ)
          </Alert>
        ) : null}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth type="date" label="วันที่" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              type="time"
              label="เวลาเริ่ม"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              helperText={period ? `ช่วงเวลา: ${periodLabel(period)} (คำนวณอัตโนมัติ · เวลาไทย)` : "ไม่ต้องระบุเวลาจบ"}
            />
          </Grid>
          <Grid size={12}>
            <TextField fullWidth multiline minRows={2} label="หมายเหตุ (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} />
          </Grid>
        </Grid>
        <Box sx={{ mt: 2 }}>
          <ConflictAlert items={conflicts} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          disabled={busy || !date || !time}
          onClick={async () => {
            setBusy(true);
            try {
              await onSubmit(date, time, note.trim());
            } finally {
              setBusy(false);
            }
          }}
        >
          ส่งวันเวลาที่เสนอ
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EditDialog({
  open,
  queue,
  onClose,
  onSubmit,
}: {
  open: boolean;
  queue: ServiceQueue;
  onClose: () => void;
  onSubmit: (v: QueueFormValues, reason: string) => Promise<void>;
}) {
  const theme = useTheme();
  const full = useMediaQuery(theme.breakpoints.down("md"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  const [reason, setReason] = useState("");
  const initial: QueueFormValues = useMemo(
    () => ({
      jobType: queue.jobType,
      jobSubType: queue.jobSubType,
      customerType: queue.customerType,
      jobName: queue.jobName,
      customerId: queue.customerId,
      siteId: queue.siteId,
      address: queue.address,
      contactName: queue.contactName,
      phone: queue.phone,
      mapLink: queue.mapLink,
      note: queue.note,
      preferredDate: queue.preferredDate,
      preferredTime: queue.preferredTime,
      ownerSaleId: queue.ownerSaleId,
      items: queue.items.map((i) => ({ itemId: i.itemId, machineType: i.machineType, model: i.model, serial: i.serial, equipmentId: i.equipmentId, note: i.note })),
    }),
    [queue]
  );
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="lg" fullScreen={full}>
      <DialogTitle>แก้ไขข้อมูลคิว {queue.queueNo} (Admin)</DialogTitle>
      <DialogContent>
        <TextField fullWidth label="เหตุผล/หมายเหตุการแก้ไข (บันทึกใน Log)" value={reason} onChange={(e) => setReason(e.target.value)} sx={{ my: 1 }} />
        {open ? (
          <QueueForm
            editing
            initial={initial}
            submitLabel="บันทึกการแก้ไข"
            busy={busy}
            error={err}
            onSubmit={async (v) => {
              setBusy(true);
              setErr(null);
              try {
                await onSubmit(queue.jobId ? { ...v, items: undefined as any } : v, reason.trim());
              } catch (e) {
                setErr(e instanceof ApiError ? { field: e.field, message: e.message } : { message: "บันทึกไม่สำเร็จ" });
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ปิด
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function MessageLine({ m }: { m: GroupMessage }) {
  return (
    <Box sx={{ py: 1, borderBottom: 1, borderColor: "divider" }}>
      <Typography variant="caption" color="text.secondary">
        {m.groupKey === "CHECK_QUEUE" ? "กลุ่มเช็คคิว" : "กลุ่มงานช่าง"} · {m.kind === "TEXT" ? m.senderName : "ระบบ"} · {bangkokTime(m.createdAt)}
      </Typography>
      {m.replyTo ? (
        <Typography variant="caption" component="div" sx={{ borderLeft: 3, borderColor: "divider", pl: 1, color: "text.secondary" }}>
          ตอบ {m.replyTo.senderName}: {m.replyTo.excerpt}
        </Typography>
      ) : null}
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
        {m.kind === "CARD" ? `การ์ดคิว — ${m.text}` : m.text}
        {m.attachments?.length ? ` (ไฟล์แนบ ${m.attachments.length})` : ""}
      </Typography>
      <Button size="small" component={Link} href={`/group-chat?g=${encodeURIComponent(m.groupKey)}&m=${encodeURIComponent(m.messageId)}`}>
        เปิดในแชท
      </Button>
    </Box>
  );
}

function ServiceQueueDetailInner() {
  const { id } = useParams<{ id: string }>();
  const { has, user } = useAuth();
  const dialog = useDialog();
  const toast = useToast();
  const [queue, setQueue] = useState<ServiceQueue | null>(null);
  const [events, setEvents] = useState<SqEvent[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [jobLines, setJobLines] = useState<JobEquipmentLine[]>([]);
  const [conflicts, setConflicts] = useState<PeriodConflict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<null | "assign" | "propose" | "edit">(null);

  const load = useCallback(() => {
    setError(null);
    sqApi
      .get(id)
      .then((r) => {
        setQueue(r.queue);
        setEvents(r.events);
        setMessages(r.messages);
        setJobLines(r.jobEquipment);
        setConflicts(r.conflicts);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "โหลดคิวไม่สำเร็จ"));
  }, [id]);
  useEffect(load, [load]);

  const buttons = useMemo(() => (queue && user ? queueButtons(queue, { id: user.id, has }) : []), [queue, user, has]);

  if (error && !queue) return <WomsErrorState message={error} onRetry={load} />;
  if (!queue) return <WomsLoadingState />;
  const q = queue;
  const cur = q.current;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      toast.success(`${label} เรียบร้อย`);
      setOpen(null);
      window.dispatchEvent(new Event("woms:queue-changed"));
    } catch (e) {
      // 409 = ข้อมูลเปลี่ยนไปแล้ว (หน้าจอค้าง/มีคนทำก่อน) → โหลดสถานะล่าสุดให้เห็นทันที
      toast.error(e instanceof ApiError ? e.message : `${label} ไม่สำเร็จ`);
    } finally {
      setBusy(false);
      load();
    }
  };

  const onButton = async (b: QueueButton) => {
    if (b === "assign" || b === "reassign") return setOpen("assign");
    if (b === "propose") return setOpen("propose");
    if (b === "edit") return setOpen("edit");
    if (b === "reject") {
      const reason = await dialog.prompt({ title: "ไม่สะดวกรับคิว", label: "เหตุผล", type: "textarea", required: true, message: "คิวจะกลับไปรอ Admin จัดช่างใหม่", confirmLabel: "ส่งเหตุผล", danger: true });
      if (reason !== null) await run("แจ้งไม่สะดวกรับคิว", () => sqApi.reject(q.id, q.roundNo, reason.trim()));
      return;
    }
    if (b === "confirm") {
      const ok = await dialog.confirm({
        title: "ลูกค้าคอนเฟิร์มวันนัด",
        message: `ยืนยันว่าลูกค้าคอนเฟิร์ม ${apptText(cur?.date ?? "", cur?.time ?? "", cur?.period ?? "")} (รอบนัด ${q.roundNo}) — การคอนเฟิร์มยังไม่ใช่การเปิดงาน ระบบจะแจ้ง Admin ให้กดเปิดงาน`,
        confirmLabel: "คอนเฟิร์มลูกค้า",
      });
      if (ok) await run("คอนเฟิร์มลูกค้า", () => sqApi.confirm(q.id, q.roundNo));
      return;
    }
    if (b === "requestNewDate") {
      const note = await dialog.prompt({ title: "ขอคิวใหม่", label: "หมายเหตุถึงช่าง (ถ้ามี)", type: "textarea", message: "วันเดิมจะถูกเก็บเป็นประวัติ ช่างต้องเสนอวันใหม่และลูกค้าต้องคอนเฟิร์มอีกครั้ง", confirmLabel: "ขอคิวใหม่" });
      if (note !== null) await run("ขอคิวใหม่", () => sqApi.requestNewDate(q.id, q.roundNo, note.trim()));
      return;
    }
    if (b === "openJob" || b === "releaseReschedule") {
      const ok = await dialog.confirm({
        title: b === "openJob" ? "เปิดงานและออก JN" : "ยืนยันส่งงานเดิมกลับเข้าระบบงาน",
        message:
          b === "openJob"
            ? `ระบบจะออก JN ตามรูปแบบเดิมและผูกคิว ${q.queueNo} กับใบงาน · ช่าง ${q.techName} · ${apptText(cur?.date ?? "", cur?.time ?? "", cur?.period ?? "")} · เครื่องที่ยังไม่มี SN จะแสดง Pending Serial`
            : `อัปเดตวันนัดและช่างในใบงาน ${q.jobId} เดิม (ไม่สร้างใบงานหรือ JN ใหม่) · ช่าง ${q.techName} · ${apptText(cur?.date ?? "", cur?.time ?? "", cur?.period ?? "")}`,
        confirmLabel: b === "openJob" ? "เปิดงาน" : "ยืนยันส่งงานกลับ",
      });
      if (ok) await run(b === "openJob" ? "เปิดงาน" : "ส่งงานกลับ", () => sqApi.release(q.id, q.roundNo));
      return;
    }
    if (b === "cancel") {
      const reason = await dialog.prompt({ title: `ยกเลิกคิว ${q.queueNo}`, label: "เหตุผลการยกเลิก", type: "textarea", required: true, danger: true, confirmLabel: "ยกเลิกคิว" });
      if (reason !== null) await run("ยกเลิกคิว", () => sqApi.cancel(q.id, q.version, reason.trim()));
    }
  };

  const items = q.jobId && jobLines.length ? null : q.items;

  return (
    <>
      <WomsPageHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <span>{q.queueNo}</span>
            {q.jobId ? <Chip component={Link} href={`/jobs/${q.jobId}`} clickable label={q.jobId} color="primary" variant="outlined" /> : null}
            <QueueStatusChip status={q.status} mode={q.mode} />
          </Stack>
        }
        subtitle={`${q.jobName} · ${typeLabel(q.jobType)} · รอบนัดที่ ${q.roundNo || "—"}`}
        actions={
          <Button component={Link} href="/service-queue" startIcon={<ArrowBackIcon />}>
            รายการคิว
          </Button>
        }
      />

      {buttons.length ? (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {buttons.map((b) => (
              <Button
                key={b}
                disabled={busy}
                variant={PRIMARY.includes(b) ? "contained" : "outlined"}
                color={b === "cancel" || b === "reject" ? "error" : "primary"}
                onClick={() => onButton(b)}
              >
                {BUTTON_LABEL[b]}
              </Button>
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            การพิมพ์ข้อความหรือ Reply ในแชทไม่ถือเป็นการคอนเฟิร์มหรือเปลี่ยนสถานะ — ต้องใช้ปุ่มด้านบน
          </Typography>
        </Paper>
      ) : null}

      {q.status === "CANCELLED" ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          ยกเลิกโดย {q.cancelledByName} เมื่อ {bangkokTime(q.cancelledAt)} — {q.cancelReason}
        </Alert>
      ) : null}
      {q.mode === "RESCHEDULE" && q.status !== "RELEASED" && q.status !== "CANCELLED" ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          งานเดิม {q.jobId} รอเช็คคิวใหม่ — เหตุผล: {q.rescheduleReason || "—"} · หลังลูกค้าคอนเฟิร์ม Admin ต้องกด “ยืนยันส่งงานเดิมกลับ”
        </Alert>
      ) : null}
      <ConflictAlert items={conflicts} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <WomsFormSection title="ข้อมูลงาน">
            <WomsKeyValue
              items={[
                ["ประเภทงาน", typeLabel(q.jobType)],
                ["ประเภทลูกค้า", q.customerType === "IN" ? "ลูกค้าใน" : q.customerType === "OUT" ? "ลูกค้านอก" : "—"],
                ["เซลล์เจ้าของงาน", q.ownerSaleName || "— (Admin ดำเนินการ)"],
                ["ผู้เปิดคิว", `${q.createdByName} · ${bangkokTime(q.createdAt)}`],
                ["ช่างผู้รับผิดชอบ", q.techName || "ยังไม่จัดช่าง"],
                ["วันเวลาเริ่ม", apptText(cur?.date ?? "", cur?.time ?? "", cur?.period ?? "")],
                ["ลูกค้าต้องการ", q.preferredDate ? `${q.preferredDate} ${q.preferredTime} (ข้อมูลประกอบ)` : "—"],
                ["หมายเหตุ", q.note || "—"],
              ]}
            />
          </WomsFormSection>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <WomsFormSection title="ลูกค้าและสถานที่">
            <WomsKeyValue
              items={[
                ["ร้าน / บริษัท", q.jobName],
                ["สาขา", q.branchNo || "—"],
                ["ผู้ติดต่อ", q.contactName || "—"],
                ["เบอร์โทร", q.phone || "—"],
                ["ที่อยู่", q.address || "—"],
                [
                  "Map",
                  q.mapLink ? (
                    <a href={q.mapLink} target="_blank" rel="noreferrer">
                      เปิดแผนที่
                    </a>
                  ) : (
                    "—"
                  ),
                ],
              ]}
            />
          </WomsFormSection>
        </Grid>
      </Grid>

      <WomsFormSection title={q.jobId ? `เครื่องในใบงาน ${q.jobId}` : `รายการเครื่อง (${q.items.length})`}>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>ประเภท</TableCell>
                <TableCell>รุ่น</TableCell>
                <TableCell>SN</TableCell>
                <TableCell>หมายเหตุ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items
                ? items.map((it, i) => (
                    <TableRow key={it.itemId}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{it.machineType || "—"}</TableCell>
                      <TableCell>{it.model || "—"}</TableCell>
                      <TableCell>{it.serial ? it.serial : <WomsStatusChip label="Pending Serial" tone="warning" />}</TableCell>
                      <TableCell>{it.note || "—"}</TableCell>
                    </TableRow>
                  ))
                : jobLines.map((l, i) => (
                    <TableRow key={l.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{l.machineType || "—"}</TableCell>
                      <TableCell>{l.model || "—"}</TableCell>
                      <TableCell>
                        {l.needsSerial ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <WomsStatusChip label="Pending Serial" tone="warning" />
                            <Typography variant="caption" color="text.secondary">
                              ({l.serial})
                            </Typography>
                          </Stack>
                        ) : (
                          l.serial
                        )}
                      </TableCell>
                      <TableCell>{l.note || "—"}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </Box>
        {q.jobId ? (
          <Typography variant="caption" color="text.secondary">
            เติม SN / ผูกเครื่องได้ที่หน้าใบงาน <Link href={`/jobs/${q.jobId}`}>{q.jobId}</Link>
          </Typography>
        ) : null}
      </WomsFormSection>

      <WomsFormSection title="ประวัติรอบนัด">
        {q.rounds.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            ยังไม่มีรอบนัด (รอ Admin จัดช่าง)
          </Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>รอบ</TableCell>
                  <TableCell>ช่าง</TableCell>
                  <TableCell>วันเวลาที่เสนอ</TableCell>
                  <TableCell>สถานะรอบ</TableCell>
                  <TableCell>รายละเอียด</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...q.rounds].reverse().map((r) => (
                  <TableRow key={r.roundNo} selected={r.roundNo === q.roundNo}>
                    <TableCell>{r.roundNo}</TableCell>
                    <TableCell>{r.techName || "—"}</TableCell>
                    <TableCell>{r.date ? `${r.date} ${r.time} · ${periodLabel(r.period)}` : "—"}</TableCell>
                    <TableCell>{ROUND_STATUS_LABEL[r.status] ?? r.status}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>
                      {r.openedReason}
                      {r.proposedByName ? ` · เสนอโดย ${r.proposedByName} ${bangkokTime(r.proposedAt)}` : ""}
                      {r.confirmedByName ? ` · คอนเฟิร์มโดย ${r.confirmedByName} ${bangkokTime(r.confirmedAt)}` : ""}
                      {r.rejectReason ? ` · ไม่รับคิว: ${r.rejectReason}` : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </WomsFormSection>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <WomsFormSection title={`บทสนทนาที่เกี่ยวข้อง (${messages.length})`}>
            {messages.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                ยังไม่มีข้อความที่อ้างถึงคิวนี้
              </Typography>
            ) : (
              <Box sx={{ maxHeight: 420, overflowY: "auto" }}>
                {messages.map((m) => (
                  <MessageLine key={m.messageId} m={m} />
                ))}
              </Box>
            )}
          </WomsFormSection>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <WomsFormSection title={`Log (${events.length})`}>
            <Box sx={{ maxHeight: 420, overflowY: "auto" }}>
              {[...events].reverse().map((e, i) => (
                <Box key={`${e.at}-${i}`} sx={{ py: 1, borderBottom: 1, borderColor: "divider" }}>
                  <Typography variant="body2" fontWeight={600}>
                    {SQ_ACTION_LABEL[e.action] ?? e.action}
                    {e.toStatus && e.fromStatus !== e.toStatus ? ` → ${SQ_STATUS_LABEL[e.toStatus as SqStatus] ?? e.toStatus}` : ""}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {e.actorName} · {bangkokTime(e.at)} · รอบนัด {e.roundNo || "—"}
                  </Typography>
                  {e.reason ? <Typography variant="caption" component="div">เหตุผล/หมายเหตุ: {e.reason}</Typography> : null}
                  {e.changes?.map((c, j) => (
                    <Typography key={j} variant="caption" component="div" color="text.secondary">
                      {c.field}: {fmtValue(c.before)} → {fmtValue(c.after)}
                    </Typography>
                  ))}
                </Box>
              ))}
            </Box>
          </WomsFormSection>
        </Grid>
      </Grid>

      <AssignDialog
        open={open === "assign"}
        reassign={q.status !== "WAIT_ASSIGN"}
        currentTechId={q.techId}
        onClose={() => setOpen(null)}
        onSubmit={(techId, note) => run(q.status === "WAIT_ASSIGN" ? "จัดช่าง" : "เปลี่ยนช่าง", () => sqApi.assign(q.id, q.version, techId, note))}
      />
      <ProposeDialog
        open={open === "propose"}
        queue={q}
        onClose={() => setOpen(null)}
        onSubmit={(date, time, note) =>
          run("เสนอวันเวลา", async () => {
            const r = await sqApi.propose(q.id, q.roundNo, date, time, note);
            if (r.conflicts.length) toast.warning(`ช่างมีคิวอื่นในช่วงเวลาเดียวกัน ${r.conflicts.length} รายการ (ไม่บล็อก)`);
          })
        }
      />
      <EditDialog
        open={open === "edit"}
        queue={q}
        onClose={() => setOpen(null)}
        onSubmit={async (v, reason) => {
          await sqApi.edit(q.id, q.version, { ...v, reason });
          toast.success("บันทึกการแก้ไขแล้ว");
          setOpen(null);
          load();
        }}
      />
    </>
  );
}

export default function ServiceQueueDetailPage() {
  return (
    <WomsPermissionGate perm="svcqueue:view">
      <ServiceQueueDetailInner />
    </WomsPermissionGate>
  );
}
