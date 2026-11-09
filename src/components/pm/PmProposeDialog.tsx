"use client";

// ---------------------------------------------------------------------------
// ตาราง PM รายเดือน · 3.3 ขั้นที่ 1 — ช่างของรอบเสนอวันและเวลาเริ่ม (เข้า Flow คิวเดิม: Admin รับ → ลูกค้ายืนยัน → Admin เปิด JN)
//   ใช้ POST /api/pm/propose-machines (BD-3) · backend ตรวจผู้ดูแล/ช่างของรอบ · ถึงรอบรายเดือน · คิวซ้ำ · สิทธิ์ใช้ครบ
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { api, ApiError, PmRoundRow } from "@/lib/api";
import { bangkokToday } from "@/lib/date";
import { monthLabel } from "@/lib/pmRoundRules";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

export default function PmProposeDialog({ row, onClose, onDone }: { row: PmRoundRow | null; onClose: () => void; onDone: (msg: string) => void }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  const [needAck, setNeedAck] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setDate("");
    setTime("09:00");
    setNote("");
    setAck(false);
    setNeedAck(null);
    setErr(null);
  }, [row]);
  if (!row) return null;
  const today = bangkokToday();
  const submit = async () => {
    if (!date) return setErr("เลือกวันที่เข้าทำ");
    if (date < today) return setErr("ห้ามเสนอวันย้อนหลัง");
    if (needAck && !ack) return setErr("ยืนยันว่ารอบนี้ไม่ใช่สิทธิ์ฟรีก่อนเสนอ");
    setBusy(true);
    setErr(null);
    try {
      const r = await api.proposePmMachines({ equipmentIds: [row.equipmentId], date, time, note: note.trim(), acknowledgeNoFreeEntitlement: ack });
      onDone(`เสนอวัน PM แล้ว · คิว ${r.queue.queueNo || r.queue.id} รอ Admin รับคิว`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "PM_ENTITLEMENT_EXHAUSTED") setNeedAck(e.message);
      else setErr(e instanceof ApiError ? e.message : "เสนอวันไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby="pm-propose-title">
      <DialogTitle id="pm-propose-title" sx={{ pb: 0.5 }}>
        เสนอวันเวลา PM
        <Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
          {row.customerName} · {row.serial} · รอบ {monthLabel(row.roundMonth)}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1.5 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}
          {needAck ? (
            <Alert severity="warning">
              {needAck}
              <FormControlLabel sx={{ display: "flex", mt: 1 }} control={<Checkbox checked={ack} onChange={(e) => setAck(e.target.checked)} />} label="ยืนยัน รอบนี้ไม่ใช่สิทธิ์ฟรี" />
            </Alert>
          ) : null}
          <TextField id="pm-propose-date" type="date" label="วันที่" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ min: today }} required />
          <TextField id="pm-propose-time" type="time" label="เวลาเริ่ม" value={time} onChange={(e) => setTime(e.target.value)} InputLabelProps={{ shrink: true }} required />
          <TextField id="pm-propose-note" label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} inputProps={{ maxLength: 500 }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy}>
          เสนอวันเวลา
        </Button>
      </DialogActions>
    </Dialog>
  );
}
