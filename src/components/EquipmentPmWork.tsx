"use client";

// ---------------------------------------------------------------------------
// OD-P12-01 / BD-3 / BD-11 — งาน PM ของเครื่อง (หน้าเครื่อง)
//   · มีคิว/JN PM ที่ยังไม่จบ → ลิงก์ไปงานเดิม (ไม่สร้างซ้ำ)
//   · ไม่มี และผู้ใช้เป็นผู้ดูแลเครื่องที่ถึงรอบ → เสนอวัน PM เข้า Flow คิวเดิม (Admin รับ → ลูกค้ายืนยัน → Admin เปิด JN)
//   · ผู้อื่น → แสดงเหตุผลที่ยังเสนอไม่ได้ (ไม่มีปุ่มสร้างใบงาน PM ตรง)
//   · Admin (pm:manage) ตั้งรับบริการ/หยุดบริการ พร้อมเหตุผล · ประวัติ
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, PmWorkInfo, ServiceStateChange } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { bangkokToday } from "@/lib/date";
import { useToast } from "@/components/Toast";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

export const PM_WORK_BLOCKER_TEXT: Record<string, string> = {
  PM_NOT_CONFIGURED: "เครื่องยังไม่ได้ตั้งรอบ PM",
  PM_BASELINE_MISSING: "ยังไม่มีวัน PM ล่าสุดที่ตรวจได้ — Admin ระบุวันฐานพร้อมที่มาก่อน",
  PM_NOT_DUE: "ยังไม่ถึงรอบ PM",
  SERVICE_STOPPED: "เครื่องหยุดบริการ",
  PM_ROUND_DUPLICATE: "มีคิวหรือใบงาน PM ที่ยังไม่จบอยู่แล้ว",
  NOT_CARETAKER: "เสนอวันได้เฉพาะช่างผู้ดูแลเครื่อง",
  NOT_ROUND_TECH: "รอบนี้ Admin มอบหมายให้ช่างคนอื่น",
};

export default function EquipmentPmWork({ equipmentId, onChanged }: { equipmentId: string; onChanged?: () => void }) {
  const { has } = useAuth();
  const toast = useToast();
  const [info, setInfo] = useState<PmWorkInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [propose, setPropose] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  const [needAck, setNeedAck] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stateDlg, setStateDlg] = useState(false);
  const [reason, setReason] = useState("");
  const [hist, setHist] = useState<ServiceStateChange[] | null>(null);

  const load = useCallback(async () => {
    try {
      setInfo(await api.pmWork(equipmentId));
      setErr(null);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "โหลดงาน PM ไม่สำเร็จ");
    }
  }, [equipmentId]);
  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!date) return setErr("ต้องเลือกวันที่เสนอ");
    if (date < bangkokToday()) return setErr("ห้ามเสนอวันย้อนหลัง");
    setBusy(true);
    try {
      const r = await api.proposePmMachines({ equipmentIds: [equipmentId], date, time, note, acknowledgeNoFreeEntitlement: ack });
      toast.success(`เสนอวัน PM แล้ว — คิว ${r.queue.queueNo || r.queue.id} รอ Admin รับคิว`);
      setPropose(false);
      setNeedAck(null);
      setAck(false);
      await load();
      onChanged?.();
    } catch (e) {
      if (e instanceof ApiError && e.code === "PM_ENTITLEMENT_EXHAUSTED") setNeedAck(e.message);
      else setErr(e instanceof ApiError ? e.message : "เสนอวันไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const toggleState = async () => {
    if (!info) return;
    const to = info.serviceState === "STOPPED" ? "ACTIVE" : "STOPPED";
    if (reason.trim().length < 5) return setErr("ต้องระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
    setBusy(true);
    try {
      await api.setServiceState(equipmentId, { serviceState: to, expectedServiceState: info.serviceState, reason: reason.trim() });
      toast.success(to === "STOPPED" ? "ตั้งเป็นหยุดบริการแล้ว" : "กลับมารับบริการแล้ว");
      setStateDlg(false);
      setReason("");
      setHist(null);
      await load();
      onChanged?.();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  if (!info) return err ? <Alert severity="warning" sx={{ mt: 1.5 }}>{err}</Alert> : null;
  const queues = info.related.queues ?? [];
  const jobs = info.related.jobs ?? [];
  const blockers = info.blockers.filter((b) => !((b === "NOT_CARETAKER" || b === "NOT_ROUND_TECH") && !has("svcqueue:respond")));

  return (
    <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }} data-testid="pm-work">
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: "wrap", rowGap: 1 }}>
        <Typography variant="subtitle2">งาน PM รอบนี้</Typography>
        <Chip
          size="small"
          data-testid="service-state"
          color={info.serviceState === "STOPPED" ? "error" : "default"}
          label={info.serviceState === "STOPPED" ? "หยุดบริการ" : "รับบริการ"}
        />
        {has("pm:manage") ? (
          <Button size="small" onClick={() => setStateDlg(true)} data-testid="service-state-btn">
            {info.serviceState === "STOPPED" ? "กลับมารับบริการ" : "หยุดบริการ"}
          </Button>
        ) : null}
        <Button
          size="small"
          onClick={async () => setHist(hist ? null : (await api.serviceStateHistory(equipmentId).catch(() => ({ items: [] }))).items)}
        >
          {hist ? "ซ่อนประวัติสถานะ" : "ประวัติสถานะบริการ"}
        </Button>
      </Stack>
      {err ? (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setErr(null)}>
          {err}
        </Alert>
      ) : null}
      {queues.length || jobs.length ? (
        <Alert severity="info" data-testid="pm-work-open">
          ใช้งานเดิมของรอบนี้ (ไม่สร้างซ้ำ):{" "}
          {queues.map((q) => (
            <Link key={q.queueId} href={`/service-queue/${q.queueId}`} style={{ marginRight: 8 }}>
              คิว {q.queueNo || q.queueId}
            </Link>
          ))}
          {jobs.map((j) => (
            <Link key={j.jobId} href={`/jobs/${encodeURIComponent(j.jobId)}`} style={{ marginRight: 8 }}>
              ใบงาน {j.jobId} ({j.status})
            </Link>
          ))}
        </Alert>
      ) : info.canPropose ? (
        <Button variant="outlined" onClick={() => setPropose(true)} data-testid="pm-propose-btn">
          เสนอวัน PM (เข้าคิว)
        </Button>
      ) : (
        <Typography variant="body2" color="text.secondary" data-testid="pm-work-blockers">
          ยังเสนอคิว PM ไม่ได้: {blockers.map((b) => PM_WORK_BLOCKER_TEXT[b] ?? b).join(" · ") || "ไม่มีสิทธิ์เสนอคิว"}
          {" — ใบงาน PM เปิดได้จากคิวที่ลูกค้ายืนยันแล้วเท่านั้น"}
        </Typography>
      )}
      {hist ? (
        <Box sx={{ mt: 1 }}>
          {hist.length === 0 ? (
            <Typography variant="body2" color="text.secondary">ยังไม่มีประวัติ</Typography>
          ) : (
            hist.map((h, i) => (
              <Typography key={i} variant="body2">
                {h.at.slice(0, 16).replace("T", " ")} · {h.actorName} · {h.from === "STOPPED" ? "หยุดบริการ" : "รับบริการ"} → {h.to === "STOPPED" ? "หยุดบริการ" : "รับบริการ"} · {h.reason}
              </Typography>
            ))
          )}
        </Box>
      ) : null}

      <Dialog open={propose} onClose={() => setPropose(false)} fullWidth maxWidth="xs">
        <DialogTitle>เสนอวัน PM</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField type="date" label="วันที่" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ min: bangkokToday(), "data-testid": "pm-propose-date" }} />
            <TextField type="time" label="เวลาเริ่ม" value={time} onChange={(e) => setTime(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
            {needAck ? (
              <>
                <Alert severity="warning">{needAck}</Alert>
                <FormControlLabel control={<Checkbox checked={ack} onChange={(e) => setAck(e.target.checked)} />} label="ยืนยันว่ารอบนี้ไม่ใช่สิทธิ์ PM ฟรี" />
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPropose(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={submit} disabled={busy || (!!needAck && !ack)} data-testid="pm-propose-submit">
            ส่งให้ Admin
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={stateDlg} onClose={() => setStateDlg(false)} fullWidth maxWidth="xs">
        <DialogTitle>{info.serviceState === "STOPPED" ? "กลับมารับบริการ" : "หยุดบริการ"}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            สถานะนี้แยกจากสิทธิ์ Package — เครื่องที่หยุดบริการเสนอคิว PM และเปิดใบงาน PM จากคิวไม่ได้
          </Typography>
          <TextField label="เหตุผล" required fullWidth multiline minRows={2} value={reason} onChange={(e) => setReason(e.target.value)} inputProps={{ "data-testid": "service-state-reason" }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStateDlg(false)}>ยกเลิก</Button>
          <Button variant="contained" color={info.serviceState === "STOPPED" ? "primary" : "error"} onClick={toggleState} disabled={busy} data-testid="service-state-save">
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
