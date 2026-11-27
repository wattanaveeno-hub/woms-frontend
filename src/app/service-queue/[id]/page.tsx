"use client";

// รายละเอียดคิว (QUEUE 03): ใบงาน · รายการเครื่อง · บทสนทนาที่เกี่ยวข้อง · วันเวลาที่เสนอ · ประวัติรอบนัด · Log
// ปุ่มแสดงตามบทบาทและสถานะ — ทุกปุ่มส่ง roundNo/version ไปให้ backend ตรวจว่าเป็นข้อมูลล่าสุด
import { QueueSitePhotosPanel } from "@/components/serviceQueue/QueueSitePhotos";
import { fmtDate } from "@/lib/date";
import DateField from "@/components/DateField";
import TechAvailability from "@/components/serviceQueue/TechAvailability";
import AssignDialog from "@/components/serviceQueue/AssignDialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
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
import { ApptCompareView, QueueStatusChip, apptText, periodLabel, typeLabel } from "@/components/serviceQueue/QueueBits";
import { queueToFormValues } from "@/lib/serviceQueueRules";
import {
  sqApi,
  type GroupMessage,
  type PeriodConflict,
  type QueueFormValues,
  type ServiceQueue,
  type SqEvent,
} from "@/lib/serviceQueueApi";
import { useStaleWatch } from "@/lib/useAutoRefresh";
import {
  jnLabel,
  ROUND_STATUS_LABEL,
  SQ_ACTION_LABEL,
  SQ_STATUS_LABEL,
  bangkokTime,
  bangkokTodayISO,
  isPastBangkokDate,
  queueButtons,
  queueSteps,
  timePeriodOf,
  type QueueButton,
  type SqStatus,
} from "@/lib/serviceQueueRules";

const BUTTON_LABEL: Record<QueueButton, string> = {
  assign: "จัดช่าง",
  reassign: "เปลี่ยนช่าง",
  propose: "เสนอวันเวลาเริ่ม",
  reject: "ไม่สะดวกรับคิว",
  accept: "รับคิว (ยืนยันวันเวลาที่ช่างเสนอ)",
  confirm: "ลูกค้าคอนเฟิร์มแล้ว",
  requestNewDate: "ขอคิวใหม่",
  openJob: "ตรวจและเปิดงาน (ออก JN)",
  releaseReschedule: "ยืนยันส่งงานเดิมกลับ",
  edit: "แก้ไขข้อมูล",
  cancel: "ยกเลิกคิว",
};

const PRIMARY: QueueButton[] = ["assign", "propose", "accept", "confirm", "openJob", "releaseReschedule"];

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
            {c.jobName} — {fmtDate(c.date)} {c.time} ({periodLabel(c.period)}) · {SQ_STATUS_LABEL[c.status as SqStatus] ?? c.status}
          </li>
        ))}
      </Box>
    </Alert>
  );
}


/** ขอคิวใหม่ (CHAT-05 v2 หมายเหตุบังคับ) · MOM-20 วัน/เวลาที่ลูกค้าต้องการ (ไม่บังคับ · ค่าเริ่มต้น = ค่าเดิมของคิว) */
function RequestNewDateDialog({
  open,
  queue,
  onClose,
  onSubmit,
}: {
  open: boolean;
  queue: ServiceQueue;
  onClose: () => void;
  onSubmit: (note: string, want: { preferredDate: string; preferredTime: string }) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setNote("");
    setErr(null);
    // วันเดิมที่ผ่านไปแล้วไม่ใช้เป็นค่าเริ่มต้น (ระบบไม่รับวันย้อนหลัง)
    const past = !!queue.preferredDate && queue.preferredDate < bangkokTodayISO();
    setDate(past ? "" : queue.preferredDate ?? "");
    setTime(past ? "" : queue.preferredTime ?? "");
  }, [open, queue.preferredDate, queue.preferredTime]);
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" data-testid="request-new-date-dialog">
      <DialogTitle>ขอคิวใหม่</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          วันเดิมจะถูกเก็บเป็นประวัติ หมายเหตุนี้ต่อท้ายหมายเหตุเดิมของคิว ช่างต้องเสนอวันใหม่และลูกค้าต้องคอนเฟิร์มอีกครั้ง
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={2}
          required
          label="หมายเหตุการขอคิวใหม่"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          error={!!err}
          helperText={err ?? " "}
          inputProps={{ "data-testid": "request-new-date-note" }}
        />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mt: 1 }}>
          <DateField
            label="วันที่ลูกค้าต้องการ (ไม่บังคับ)"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText="ช่างเห็นวันนี้ตอนเสนอวันรอบใหม่"
            inputProps={{ min: bangkokTodayISO(), "data-testid": "request-new-date-date" }}
          />
          <TextField type="time" label="เวลาที่ลูกค้าต้องการ (ไม่บังคับ)" value={time} onChange={(e) => setTime(e.target.value)} InputLabelProps={{ shrink: true }} disabled={!date} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          disabled={busy}
          data-testid="request-new-date-submit"
          onClick={async () => {
            if (!note.trim()) {
              setErr("ต้องระบุหมายเหตุการขอคิวใหม่");
              return;
            }
            setBusy(true);
            try {
              await onSubmit(note.trim(), { preferredDate: date, preferredTime: date ? time : "" });
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          ขอคิวใหม่
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
  const dialog = useDialog();
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
            ลูกค้าต้องการ {fmtDate(queue.preferredDate)} {queue.preferredTime} (ข้อมูลประกอบ)
          </Alert>
        ) : null}
        {/* UAT2-01: ปฏิทินว่าง/ไม่ว่างของช่างที่รับคิว — กดวันเพื่อเลือก */}
        {queue.techId ? (
          <Box sx={{ mb: 1 }}>
            <TechAvailability techId={queue.techId} value={date} onPick={setDate} excludeQueueId={queue.id} />
          </Box>
        ) : null}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <DateField
              fullWidth
              
              label="วันที่"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              // D-21: เสนอวันย้อนหลังไม่ได้ (วันนี้ตามเวลาไทย) — backend ตรวจซ้ำ
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: bangkokTodayISO() } }}
              error={isPastBangkokDate(date)}
              helperText={isPastBangkokDate(date) ? "ห้ามเสนอวันย้อนหลัง" : " "}
            />
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
          disabled={busy || !date || !time || isPastBangkokDate(date)}
          onClick={async () => {
            // UAT 2026-11-16: เสนอเวลาซ้ำได้ แต่ช่างต้องรู้ตัว — ยืนยันอีกครั้ง · ระบบแจ้ง Admin ว่าเวลาซ้ำ
            if (
              conflicts.length &&
              !(await dialog.confirm({
                title: "เวลานี้ซ้ำกับงาน/คิวอื่นของคุณ",
                message: `${conflicts.map((c) => `${c.queueNo || c.jobId} ${c.jobName} ${c.time}`.trim()).join(" · ")} — ยังส่งได้ ระบบจะแจ้งแอดมินว่าเวลาซ้ำ`,
                confirmLabel: "ยืนยันส่ง",
              }))
            )
              return;
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
  const initial: QueueFormValues = useMemo(() => formValuesOf(queue), [queue]);
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="lg" fullScreen={full}>
      <DialogTitle>แก้ไขข้อมูลคิว {queue.queueNo} (Admin)</DialogTitle>
      <DialogContent>
        <TextField fullWidth label="เหตุผล/หมายเหตุการแก้ไข (บันทึกใน Log)" value={reason} onChange={(e) => setReason(e.target.value)} sx={{ my: 1 }} />
        {queue.jobId ? (
          <Alert severity="info" sx={{ mb: 1 }}>
            คิวนี้ผูกกับใบงาน {queue.jobId} แล้ว — บันทึกได้เฉพาะหมายเหตุและเซลล์เจ้าของงาน ข้อมูลลูกค้า/เครื่องแก้ที่หน้าใบงาน
          </Alert>
        ) : null}
        {open ? (
          <QueueForm
            editing
            itemsFromJob={!!queue.jobId}
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

/** ค่าฟอร์มจากคิวที่บันทึกไว้ (แก้ไขของ Admin / แก้ร่าง) */
function formValuesOf(queue: ServiceQueue): QueueFormValues {
  return queueToFormValues(queue as any);
}

/**
 * D-05: ร่างคิว — ผู้สร้างแก้/ส่ง/ลบได้ (backend ตรวจผู้สร้างซ้ำ) · ส่งคิว = บันทึกร่างล่าสุดแล้วส่ง (ต้องครบ + ตรวจทาน)
 */
function DraftEditor({ queue, onChanged }: { queue: ServiceQueue; onChanged: (q: ServiceQueue | null) => void }) {
  const router = useRouter();
  const dialog = useDialog();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  const initial = useMemo(() => formValuesOf(queue), [queue]);
  const fail = (e: unknown, msg: string) => setErr(e instanceof ApiError ? { field: e.field, message: e.message } : { message: msg });
  return (
    <>
      <WomsPageHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center">
            <span>ร่างคิว</span>
            <QueueStatusChip status={queue.status} />
          </Stack>
        }
        subtitle={`บันทึกล่าสุด ${bangkokTime(queue.updatedAt)} — ร่างเห็นเฉพาะคุณ ยังไม่ส่งเข้ากลุ่มเช็คคิวและยังไม่แจ้ง Admin`}
        back={{ href: "/service-queue?status=DRAFT", label: "ร่างของฉัน" }}
      />
      <QueueForm
        key={`${queue.id}:${queue.version}`}
        review
        initial={initial}
        placeLabel={[queue.customerName, [queue.branchNo, queue.storeName].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
        submitLabel="ส่งคิว"
        busy={busy}
        error={err}
        // UAT2-08: ร่างคิวแนบ/ดูรูปหน้างานได้ (รูปผูกกับคิวนี้ ส่งคิวแล้วยังอยู่)
        extraSection={<QueueSitePhotosPanel queueId={queue.id} title="รูปหน้างาน" canUpload canDelete />}
        onSaveDraft={async (values) => {
          setBusy(true);
          setErr(null);
          try {
            const q = await sqApi.saveDraft(queue.id, queue.version, values);
            toast.success("บันทึกร่างแล้ว");
            onChanged(q);
          } catch (e) {
            fail(e, "บันทึกร่างไม่สำเร็จ");
          } finally {
            setBusy(false);
          }
        }}
        onSubmit={async (values) => {
          setBusy(true);
          setErr(null);
          try {
            const saved = await sqApi.saveDraft(queue.id, queue.version, values);
            const q = await sqApi.submitDraft(queue.id, saved.version);
            toast.success(`ส่งคิว ${q.queueNo} แล้ว — รอ Admin จัดช่าง`);
            window.dispatchEvent(new Event("woms:queue-changed"));
            onChanged(null);
          } catch (e) {
            fail(e, "ส่งคิวไม่สำเร็จ");
            onChanged(null);
          } finally {
            setBusy(false);
          }
        }}
        extraActions={
          <Button
            color="error"
            disabled={busy}
            onClick={async () => {
              const ok = await dialog.confirm({ title: "ลบร่างคิว", message: "ลบร่างนี้ทิ้ง — ร่างยังไม่เคยส่งเป็นคิว จึงไม่มีผลกับคิวหรือการแจ้งเตือนใด ๆ", confirmLabel: "ลบร่าง", danger: true });
              if (!ok) return;
              setBusy(true);
              try {
                await sqApi.deleteDraft(queue.id);
                toast.success("ลบร่างแล้ว");
                router.push("/service-queue?status=DRAFT");
              } catch (e) {
                fail(e, "ลบร่างไม่สำเร็จ");
                setBusy(false);
              }
            }}
          >
            ลบร่าง
          </Button>
        }
      />
    </>
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
  // TECH-02: หน้าช่างไม่แสดงประวัติรอบนัด บทสนทนาที่เกี่ยวข้อง Log และ SN (API ไม่ส่งข้อมูลเหล่านี้ให้ช่างด้วย)
  const [techView, setTechView] = useState(false);
  // BUG-V2-18: ช่างที่ถูกย้ายออกเปิดลิงก์เดิม → บอกเหตุผลและพาไปหน้าที่เปิดได้ แทนหน้า error ที่กดลองใหม่ไม่ได้ผล
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<null | "assign" | "propose" | "edit" | "requestNewDate">(null);

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
        setTechView(!!r.techView);
      })
      .catch((e) => {
        setForbidden(e instanceof ApiError && e.status === 403);
        setError(e instanceof ApiError ? e.message : "โหลดคิวไม่สำเร็จ");
      });
  }, [id]);
  // MOM-34: มีคนอื่นเปลี่ยนคิวนี้ → แสดงแถบให้โหลดข้อมูลล่าสุด (ไม่โหลดทับระหว่างกรอกในกล่องโต้ตอบ)
  const stale = useStaleWatch(queue ? String(queue.version) : "", () => sqApi.get(id).then((r) => String(r.queue.version)));
  useEffect(load, [load]);

  const buttons = useMemo(() => (queue && user ? queueButtons(queue, { id: user.id, has }) : []), [queue, user, has]);

  if (error && !queue && forbidden)
    return (
      <Box sx={{ maxWidth: 560, mx: "auto", py: 4 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          <AlertTitle>คุณไม่ได้รับผิดชอบคิวนี้แล้ว</AlertTitle>
          {error} — คิวอาจถูกย้ายให้ช่างคนอื่นหรือยกเลิก ไม่ต้องดำเนินการต่อ
        </Alert>
        <Stack direction="row" spacing={1}>
          {has("svcqueue:respond") ? (
            <Button component={Link} href="/m" variant="contained">
              กลับหน้างานของฉัน
            </Button>
          ) : null}
          <Button component={Link} href="/service-queue" variant="outlined">
            ไปหน้าคิวช่าง
          </Button>
        </Stack>
      </Box>
    );
  if (error && !queue) return <WomsErrorState message={error} onRetry={load} />;
  if (!queue) return <WomsLoadingState />;
  // D-05: ร่าง → ฟอร์มแก้ร่าง/ส่งคิว (null = โหลดใหม่จากเซิร์ฟเวอร์)
  if (queue.status === "DRAFT") return <DraftEditor queue={queue} onChanged={(nq) => (nq ? setQueue(nq) : load())} />;
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
    if (b === "accept") {
      const ok = await dialog.confirm({
        title: "รับคิว",
        message: `รับวันเวลาที่ช่าง ${q.techName} เสนอ: ${apptText(cur?.date ?? "", cur?.time ?? "", cur?.period ?? "")} (รอบนัด ${q.roundNo}) — คิวจะเข้าสู่ “รอลูกค้าคอนเฟิร์ม” และแจ้งเซลล์เจ้าของงาน`,
        confirmLabel: "รับคิว",
      });
      if (ok) await run("รับคิว", () => sqApi.accept(q.id, q.roundNo));
      return;
    }
    if (b === "confirm") {
      const ok = await dialog.confirm({
        title: "ลูกค้าคอนเฟิร์มวันนัด",
        message:
          q.mode === "RESCHEDULE"
            ? `ยืนยันว่าลูกค้าคอนเฟิร์ม ${apptText(cur?.date ?? "", cur?.time ?? "", cur?.period ?? "")} (รอบนัด ${q.roundNo}) — คิวจะรอ Admin ตรวจและยืนยันส่งงานเดิม ${q.jobId} กลับ`
            : `ยืนยันว่าลูกค้าคอนเฟิร์ม ${apptText(cur?.date ?? "", cur?.time ?? "", cur?.period ?? "")} (รอบนัด ${q.roundNo}) — คิวจะรอ Admin ตรวจและกดเปิดงาน (ออก JN) ระบบยังไม่เปิดงานในขั้นนี้`,
        confirmLabel: "คอนเฟิร์มลูกค้า",
      });
      if (!ok) return;
      setBusy(true);
      try {
        await sqApi.confirm(q.id, q.roundNo);
        toast.success("บันทึกลูกค้าคอนเฟิร์มแล้ว — แจ้ง Admin ให้ตรวจและเปิดงาน");
        window.dispatchEvent(new Event("woms:queue-changed"));
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "คอนเฟิร์มลูกค้าไม่สำเร็จ");
      } finally {
        setBusy(false);
        load();
      }
      return;
    }
    if (b === "requestNewDate") {
      // CHAT-05 v2: ขอคิวใหม่ต้องมีหมายเหตุ · MOM-20: ใส่วัน/เวลาที่ลูกค้าต้องการได้
      setOpen("requestNewDate");
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
            {/* ENTECH design: หัวเรื่อง = ชื่องาน · เลขคิวอยู่บรรทัดรอง */}
            <span>{q.jobName || q.queueNo}</span>
            {/* UAT2-13: JN ต้องเห็นชัด — ป้าย "JN" นำหน้า กดเข้าใบงานได้ · ยังไม่ออก JN แสดงสถานะ */}
            {q.jobId ? (
              <Chip component={Link} href={`/jobs/${q.jobId}`} clickable label={jnLabel(q.jobId)} color="primary" data-testid="queue-jn" sx={{ fontWeight: 700 }} />
            ) : (
              <Chip size="small" variant="outlined" label="ยังไม่ออก JN" data-testid="queue-jn-none" />
            )}
            {q.jobId && q.jobStatus && q.jobStatus !== "OPEN" ? (
              <Chip
                size="small"
                label={JOB_STATUS_TEXT[q.jobStatus] ?? q.jobStatus}
                color={q.jobStatus === "CLOSED" ? "success" : q.jobStatus === "CANCELLED" ? "default" : "warning"}
              />
            ) : null}
            <QueueStatusChip status={q.status} mode={q.mode} />
            {q.sourceLabel ? <Chip size="small" color="info" label={`${q.sourceLabel}${q.pmMonth ? ` · เดือน ${q.pmMonth}` : ""}${q.pmDueDate ? ` · ครบกำหนด ${fmtDate(q.pmDueDate)}` : ""}`} /> : null}
          </Stack>
        }
        subtitle={
          <>
            <span className="mono" data-testid="queue-no">{q.queueNo}</span>
            {` · ${typeLabel(q.jobType)} · ขอโดย ${q.createdByName || "—"} · ${bangkokTime(q.createdAt)} · รอบนัดที่ ${q.roundNo || "—"}`}
          </>
        }
        back={{ href: "/service-queue", label: "คิวช่าง" }}
      />
      {stale ? (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="queue-stale" action={<Button color="inherit" size="small" onClick={() => load()}>โหลดข้อมูลล่าสุด</Button>}>
          คิวนี้มีการอัปเดตจากผู้อื่น
        </Alert>
      ) : null}
      {q.restricted ? (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="queue-restricted">
          {q.restrictedReason || "ใบงานของคิวนี้ถูกยกเลิกแล้ว — ดูได้เฉพาะประวัติย่อ"}
        </Alert>
      ) : null}

      {/* ขั้นของคิว (ENTECH DS .steps) — อ่านจากสถานะ/Log ไม่เปลี่ยนสถานะ */}
      {q.status !== "CANCELLED" ? (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }} aria-label="ขั้นของคิว" data-testid="queue-steps">
          <Box sx={{ display: "flex", flexWrap: "wrap", rowGap: 2 }}>
            {queueSteps(q, events).map((st) => (
              <Box key={st.label} sx={{ flex: "1 1 112px", display: "flex", flexDirection: "column", gap: 0.5, pr: 1 }} data-state={st.state}>
                <Box component="span" sx={{ height: 6, borderRadius: 999, bgcolor: st.state === "done" ? "primary.main" : st.state === "cur" ? "info.main" : "divider" }} />
                <Typography component="b" sx={{ fontSize: 14, fontWeight: 700, color: st.state === "cur" ? "info.main" : st.state === "todo" ? "text.secondary" : "text.primary" }}>
                  {st.label}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: 12 }}>
                  {st.state === "done" ? (
                    <>
                      {st.at ? <span className="mono">{bangkokTime(st.at)}</span> : null}
                      {st.by ? ` · ${st.by}` : ""}
                      {!st.at && !st.by ? "เสร็จแล้ว" : ""}
                    </>
                  ) : st.state === "cur" ? (
                    st.hint
                  ) : (
                    "—"
                  )}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      ) : null}

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

      {q.status === "READY_TO_OPEN" ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          ลูกค้าคอนเฟิร์มแล้ว{cur?.confirmedByName ? ` (บันทึกโดย ${cur.confirmedByName})` : ""} — รอ Admin ตรวจข้อมูลแล้วกด “{q.mode === "RESCHEDULE" ? "ยืนยันส่งงานเดิมกลับ" : "ตรวจและเปิดงาน (ออก JN)"}”
        </Alert>
      ) : null}
      {q.status === "TECH_REPLIED" ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          ช่าง {q.techName} ตอบคิวแล้ว: {apptText(cur?.date ?? "", cur?.time ?? "", cur?.period ?? "")} — รอ Admin รับคิวก่อน จึงคอนเฟิร์มกับลูกค้าได้
        </Alert>
      ) : null}
      {q.status === "CANCELLED" ? (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            // MOM-18: เปิดคิวใหม่จากคิวที่ยกเลิก — เติมลูกค้า เครื่อง และงานจากคิวเดิมแล้วแก้ได้ทุกช่อง (เป็นคิวใหม่ทั้งใบ)
            has("svcqueue:request") || has("svcqueue:admin") ? (
              <Button component={Link} href={`/service-queue/new?from=${encodeURIComponent(q.id)}`} variant="contained" size="small" data-testid="queue-reopen-from">
                เปิดคิวใหม่จากคิวนี้
              </Button>
            ) : undefined
          }
        >
          ยกเลิกโดย {q.cancelledByName} เมื่อ {bangkokTime(q.cancelledAt)} — {q.cancelReason}
        </Alert>
      ) : null}
      {q.mode === "RESCHEDULE" && q.status !== "RELEASED" && q.status !== "CANCELLED" ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          งานเดิม {q.jobId} รอเช็คคิวใหม่ — เหตุผล: {q.rescheduleReason || "—"} · หลังลูกค้าคอนเฟิร์ม Admin เป็นผู้ยืนยันส่งงานเดิมกลับพร้อมวันนัดใหม่
        </Alert>
      ) : null}
      <ConflictAlert items={conflicts} />

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "flex-start" }}>
      <Box sx={{ flex: "3 1 560px", minWidth: 0 }}>
      {/* ENTECH design: การ์ด "นัดที่เสนอให้ลูกค้า" — สรุปรอบนัดปัจจุบัน (ปุ่มดำเนินการอยู่แถบด้านบนตามเดิม) */}
      {cur?.date && !["RELEASED", "CANCELLED"].includes(q.status) ? (
        <Paper
          variant="outlined"
          component="section"
          sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderWidth: q.status === "WAIT_CUSTOMER" || q.status === "TECH_REPLIED" ? 2 : 1, borderColor: q.status === "WAIT_CUSTOMER" || q.status === "TECH_REPLIED" ? "primary.main" : undefined }}
          data-testid="queue-proposed"
        >
          <Typography variant="h2" component="h2" sx={{ mb: 1.5 }}>
            นัดที่เสนอให้ลูกค้า
          </Typography>
          {/* MOM-17: เทียบวันที่ลูกค้าขอ กับวันที่ช่างเสนอ */}
          <Box sx={{ mb: 2 }}>
            <ApptCompareView
              wantDate={q.preferredDate ?? ""}
              wantTime={q.preferredTime ?? ""}
              propDate={cur.date ?? ""}
              propTime={cur.time ?? ""}
              propPeriod={cur.period ?? ""}
            />
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0,1fr))" }, gap: 2 }}>
            <Box>
              <Typography variant="body2">วันเวลา</Typography>
              <Typography sx={{ fontWeight: 700, color: "text.primary" }}>{apptText(cur.date, cur.time ?? "", cur.period ?? "")}</Typography>
            </Box>
            <Box>
              <Typography variant="body2">ช่าง</Typography>
              <Typography sx={{ fontWeight: 700, color: "text.primary" }}>{q.techName || "—"}</Typography>
            </Box>
            <Box>
              <Typography variant="body2">รอบนัด</Typography>
              <Typography sx={{ fontWeight: 700, color: "text.primary" }}>{q.roundNo || "—"}</Typography>
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1.5 }}>
            ระบบไม่เปิดใบงานเอง — Admin กด “ตรวจและเปิดงาน (ออก JN)” หลังลูกค้าตกลง แล้วตรวจข้อมูลก่อนส่งให้ช่าง
          </Typography>
        </Paper>
      ) : null}

      {/* MOM-03: "ต้องการให้ช่างทำอะไร" อยู่บนสุดของรายละเอียดคิว */}
      <Paper variant="outlined" component="section" sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderLeft: "4px solid", borderLeftColor: "primary.main" }} data-testid="queue-work-brief">
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
          ต้องการให้ช่างทำอะไร
        </Typography>
        <Typography sx={{ fontSize: 20, fontWeight: 700, color: "text.primary" }}>
          {typeLabel(q.jobType)} · {q.items.length} เครื่อง
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
          {q.note || "ไม่มีรายละเอียดเพิ่ม"}
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <WomsFormSection title="ข้อมูลงาน">
            <WomsKeyValue
              items={[
                [
                  "เลขใบงาน (JN)",
                  q.jobId ? (
                    <Link key="jn" href={`/jobs/${q.jobId}`} style={{ fontWeight: 700 }} className="mono">
                      {q.jobId}
                    </Link>
                  ) : (
                    "ยังไม่ออก JN (ออกเมื่อ Admin ตรวจและเปิดงาน)"
                  ),
                ],
                ["ประเภทงาน", typeLabel(q.jobType)],
                ["ประเภทลูกค้า", q.customerType === "IN" ? "ลูกค้าใน" : q.customerType === "OUT" ? "ลูกค้านอก" : "—"],
                ["เซลล์เจ้าของงาน", q.ownerSaleName || "— (Admin ดำเนินการ)"],
                ["ผู้เปิดคิว", `${q.createdByName} · ${bangkokTime(q.createdAt)}`],
                ["ช่างผู้รับผิดชอบ", q.techName || "ยังไม่จัดช่าง"],
                ["วันเวลาเริ่ม", apptText(cur?.date ?? "", cur?.time ?? "", cur?.period ?? "")],
                ["ลูกค้าต้องการ", q.preferredDate ? `${fmtDate(q.preferredDate)} ${q.preferredTime} (ข้อมูลประกอบ)` : "—"],
                ["หมายเหตุ", q.note || "—"],
              ]}
            />
          </WomsFormSection>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <WomsFormSection title="ลูกค้าและสถานที่">
            <WomsKeyValue
              items={[
                [
                  "ลูกค้า (ฐานข้อมูล)",
                  q.customerId ? (
                    <Link href={`/partners/${q.customerId}?from=customers`}>
                      {[q.customerCode, q.customerName].filter(Boolean).join(" · ") || "เปิดข้อมูลลูกค้า"}
                    </Link>
                  ) : (
                    "— (ยังไม่ผูกฐานข้อมูลลูกค้า)"
                  ),
                ],
                ["ร้าน / บริษัท", q.jobName],
                ["สาขา", [q.branchNo, q.storeName].filter(Boolean).join(" · ") || "—"],
                ["ผู้ติดต่อ", q.contactName || "—"],
                ["เบอร์โทร", q.phone || "—"],
                ["ที่อยู่", q.address || "—"],
                // D-15: ตำบล/แขวงของสาขา (แสดงเมื่อมี — สาขาเดิมไม่มีค่า)
                ...(q.siteSubdistrict ? ([["ตำบล/แขวง", q.siteSubdistrict]] as [string, string][]) : []),
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
                {techView ? null : <TableCell>SN</TableCell>}
                <TableCell>หมายเหตุ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items
                ? items.map((it, i) => (
                    <TableRow key={it.itemId}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{it.machineType || "—"}</TableCell>
                      <TableCell>
                        {it.model || "—"}
                        {/* D-19: ช่างเห็นลำดับ + ท้าย SN เพื่อแยกเครื่องรุ่นเดียวกัน */}
                        {it.identLabel ? <Typography component="span" variant="caption" className="code" sx={{ ml: 1 }} data-testid="machine-ident">{it.identLabel}</Typography> : null}
                      </TableCell>
                      {techView ? null : <TableCell>
                        {it.serial ? (
                          it.equipmentId ? <Link href={`/equipment/${it.equipmentId}`}>{it.serial}</Link> : it.serial
                        ) : (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <WomsStatusChip label="Pending Serial" tone="warning" />
                            {it.internalCode ? (
                              <Typography variant="caption" component={it.equipmentId ? Link : "span"} href={it.equipmentId ? `/equipment/${it.equipmentId}` : undefined}>
                                {it.internalCode}
                              </Typography>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                {it.equipmentId ? "เครื่องในคลัง" : "เครื่องใหม่ (ยังไม่มีในคลัง)"}
                              </Typography>
                            )}
                          </Stack>
                        )}
                      </TableCell>}
                      <TableCell>{it.note || "—"}</TableCell>
                    </TableRow>
                  ))
                : jobLines.map((l, i) => (
                    <TableRow key={l.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{l.machineType || "—"}</TableCell>
                      <TableCell>
                        {l.model || "—"}
                        {(l as JobEquipmentLine & { identLabel?: string }).identLabel ? (
                          <Typography component="span" variant="caption" className="code" sx={{ ml: 1 }} data-testid="machine-ident">
                            {(l as JobEquipmentLine & { identLabel?: string }).identLabel}
                          </Typography>
                        ) : null}
                      </TableCell>
                      {techView ? null : <TableCell>
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
                      </TableCell>}
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

      {/* UAT2-08 / UAT2-15: รูปหน้างานของใบคิว — ช่างที่ได้รับมอบหมายดูได้ · ผู้เปิดคิว/Admin แนบเพิ่มได้ */}
      <QueueSitePhotosPanel
        queueId={q.id}
        title="รูปหน้างาน"
        canUpload={!techView && (has("svcqueue:request") || has("svcqueue:admin"))}
        // D-R2-04: คิวส่งแล้ว ลบได้เฉพาะ Admin พร้อมเหตุผล
        canDelete={!techView && has("svcqueue:admin")}
        requireReason
      />

      {techView ? null : (<>
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
                    <TableCell>{r.date ? `${fmtDate(r.date)} ${r.time} · ${periodLabel(r.period)}` : "—"}</TableCell>
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
      </>)}
      </Box>
      {/* ENTECH design: คอลัมน์ขวา "ความเคลื่อนไหว" = Log ของคิว (ข้อมูลเดิมครบ ล่าสุดอยู่บน) · ช่างไม่เห็น Log (TECH-02) */}
      {techView ? null : (
        <Box component="aside" sx={{ flex: "1 1 300px", minWidth: 0 }}>
          <WomsFormSection title={`ความเคลื่อนไหว · Log (${events.length})`}>
            <Box sx={{ maxHeight: 720, overflowY: "auto" }} data-testid="queue-log">
              {[...events].reverse().map((e, i) => (
                <Box key={`${e.at}-${i}`} sx={{ display: "flex", gap: 1.25, py: 1, borderBottom: 1, borderColor: "divider" }}>
                  <Box component="i" sx={{ flex: "0 0 auto", width: 8, height: 8, mt: 0.9, borderRadius: "50%", bgcolor: "primary.main" }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ color: "text.primary" }}>
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
                </Box>
              ))}
            </Box>
          </WomsFormSection>
        </Box>
      )}
      </Box>

      <AssignDialog
        open={open === "assign"}
        reassign={q.status !== "WAIT_ASSIGN"}
        currentTechId={q.techId}
        onClose={() => setOpen(null)}
        onSubmit={(techId, note) => run(q.status === "WAIT_ASSIGN" ? "จัดช่าง" : "เปลี่ยนช่าง", () => sqApi.assign(q.id, q.version, techId, note))}
      />
      <RequestNewDateDialog
        open={open === "requestNewDate"}
        queue={q}
        onClose={() => setOpen(null)}
        onSubmit={(note, want) => run("ขอคิวใหม่", () => sqApi.requestNewDate(q.id, q.roundNo, note, want))}
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
          // Round 2 (QA-F06 retest): คิวที่ผูก JN แล้ว backend รับแก้เฉพาะหมายเหตุ/เซลล์เจ้าของงาน
          // เดิมส่งทุกฟิลด์ที่ฟอร์มคำนวณใหม่ (ชื่อลูกค้า/ร้าน/รหัส) → ถูกปฏิเสธทั้งที่ผู้ใช้ไม่ได้แก้
          const payload = q.jobId ? { note: v.note, ownerSaleId: v.ownerSaleId } : v;
          await sqApi.edit(q.id, q.version, { ...payload, reason });
          toast.success("บันทึกการแก้ไขแล้ว");
          setOpen(null);
          load();
        }}
      />
    </>
  );
}

/** สถานะใบงานปลายทาง — คิวที่ส่งเข้าระบบงานแล้วไม่เปลี่ยนสถานะตามใบงาน จึงแสดงแยก */
const JOB_STATUS_TEXT: Record<string, string> = { CLOSED: "ใบงานปิดแล้ว", CANCELLED: "ใบงานถูกยกเลิก", HOLD: "ใบงานพักไว้" };

export default function ServiceQueueDetailPage() {
  return (
    <WomsPermissionGate perm="svcqueue:view">
      <ServiceQueueDetailInner />
    </WomsPermissionGate>
  );
}
