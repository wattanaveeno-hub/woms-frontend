"use client";

// ---------------------------------------------------------------------------
// MOM-19 (MoM 23/11/69): เซลล์แจ้งเลื่อนงาน 2 แบบ — ระบบบันทึกในใบงาน โพสต์ลงแชทใบงานแท็ก @Admin และแจ้ง Admin
//   ไม่มีกำหนด → ขอให้ Admin พักงาน · เลื่อนไม่นาน → ขอให้ Admin เช็คคิวใหม่ (ใส่วันที่ลูกค้าต้องการได้)
//   ไม่เปลี่ยนสถานะใบงานเอง — Admin ตัดสินใจต่อด้วยปุ่มเดิม (พักงาน / แจ้งเลื่อนงาน)
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DateField from "@/components/DateField";
import { api, ApiError } from "@/lib/api";
import { bangkokTodayISO } from "@/lib/serviceQueueRules";
import type { Job, SalesPostponeKind } from "@/lib/types";

export const SALES_POSTPONE_LABEL: Record<SalesPostponeKind, string> = {
  INDEFINITE: "เลื่อนแบบไม่มีกำหนด — ขอให้ Admin พักงาน",
  SHORT: "เลื่อนไม่นาน — ขอให้ Admin เช็คคิวใหม่",
};

export default function SalesPostponeDialog({ open, job, onClose, onDone }: { open: boolean; job: Job; onClose: () => void; onDone: (job: Job) => void }) {
  const [kind, setKind] = useState<SalesPostponeKind | "">("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  useEffect(() => {
    if (!open) return;
    setKind("");
    setReason("");
    setDate("");
    setTime("");
    setErr(null);
  }, [open]);
  const submit = async () => {
    if (!kind) return setErr({ field: "kind", message: "เลือกแบบการเลื่อน" });
    if (!reason.trim()) return setErr({ field: "reason", message: "ต้องระบุเหตุผลการเลื่อน" });
    setBusy(true);
    setErr(null);
    try {
      const r = await api.salesPostponeJob(job.jobId, {
        kind,
        reason: reason.trim(),
        ...(kind === "SHORT" && date ? { preferredDate: date, preferredTime: time } : {}),
      });
      onDone(r.job);
    } catch (e) {
      setErr(e instanceof ApiError ? { field: e.field, message: e.message } : { message: "แจ้งเลื่อนไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" data-testid="sales-postpone-dialog">
      <DialogTitle>แจ้งเลื่อนงาน {job.jobId}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          ระบบบันทึกในใบงาน และโพสต์ลงแชทใบงานพร้อมแท็ก Admin · Admin เป็นผู้พักงานหรือส่งกลับเช็คคิวใหม่
        </Typography>
        <RadioGroup value={kind} onChange={(e) => setKind(e.target.value as SalesPostponeKind)} aria-label="แบบการเลื่อน">
          {(Object.keys(SALES_POSTPONE_LABEL) as SalesPostponeKind[]).map((k) => (
            <FormControlLabel key={k} value={k} control={<Radio />} label={SALES_POSTPONE_LABEL[k]} data-testid={`sales-postpone-${k}`} />
          ))}
        </RadioGroup>
        {err?.field === "kind" ? (
          <Typography variant="caption" color="error" sx={{ fontWeight: 600 }}>
            {err.message}
          </Typography>
        ) : null}
        <TextField
          fullWidth
          required
          multiline
          minRows={2}
          label="เหตุผล"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={err?.field === "reason"}
          helperText={err?.field === "reason" ? err.message : " "}
          sx={{ mt: 1.5 }}
          inputProps={{ "data-testid": "sales-postpone-reason" }}
        />
        {kind === "SHORT" ? (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <DateField
              label="วันที่ลูกค้าต้องการ (ไม่บังคับ)"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              error={err?.field === "preferredDate"}
              helperText={err?.field === "preferredDate" ? err.message : "Admin ใช้วันนี้ตอนเช็คคิวใหม่"}
              inputProps={{ min: bangkokTodayISO() }}
            />
            <TextField type="time" label="เวลาที่ลูกค้าต้องการ (ไม่บังคับ)" value={time} onChange={(e) => setTime(e.target.value)} InputLabelProps={{ shrink: true }} disabled={!date} />
          </Box>
        ) : null}
        {err && !["kind", "reason", "preferredDate"].includes(err.field ?? "") ? (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {err.message}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" color="warning" onClick={submit} disabled={busy} data-testid="sales-postpone-submit">
          {busy ? "กำลังส่ง…" : "แจ้งเลื่อนงาน"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
