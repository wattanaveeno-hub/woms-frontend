"use client";

// Round 8 — QUO-01 "เมื่อตอบรับจึงเปิดงาน"
// ระบบไม่มีประเภทงาน "PM/CM เปลี่ยนอะไหล่" — ไม่สร้างประเภทใหม่ ให้ Admin เลือกประเภทงานเอง
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { contractQuoApi } from "@/lib/contractQuoApi";
import type { Options, Quotation } from "@/lib/types";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

export default function QuotationOpenJobDialog({
  quotation,
  open,
  onClose,
  onOpened,
}: {
  quotation: Quotation;
  open: boolean;
  onClose: () => void;
  onOpened: (jobId: string) => void;
}) {
  const [options, setOptions] = useState<Options | null>(null);
  const [f, setF] = useState({ jobType: "", jobSubType: "", technicianTeam: "", jobDate: "", jobTime: "", jobName: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);

  useEffect(() => {
    if (!open || options) return;
    api
      .getOptions()
      .then(setOptions)
      .catch(() => setErr({ message: "โหลดตัวเลือกประเภทงาน/ทีมช่างไม่สำเร็จ" }));
  }, [open, options]);

  const machines = Array.from(new Set(quotation.lines.map((l) => l.serial || "").filter(Boolean)));
  const fe = (k: string) => (err?.field === k ? { error: true, helperText: err.message } : {});

  const submit = async () => {
    setErr(null);
    if (!f.jobType) return setErr({ field: "jobType", message: "ต้องเลือกประเภทงาน" });
    if (!f.technicianTeam) return setErr({ field: "technicianTeam", message: "ต้องระบุทีมช่าง" });
    if (!f.jobDate) return setErr({ field: "jobDate", message: "ต้องระบุวันนัด" });
    setBusy(true);
    try {
      const r = await contractQuoApi.openJobFromQuotation(quotation.id, {
        jobType: f.jobType,
        jobSubType: f.jobSubType,
        technicianTeam: f.technicianTeam,
        jobDate: f.jobDate,
        jobTime: f.jobTime,
        jobName: f.jobName.trim() || undefined,
        note: f.note,
      });
      onOpened(r.job.jobId);
    } catch (e) {
      setErr(e instanceof ApiError ? { field: e.field, message: e.message } : { message: "เปิดงานไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>เปิดงานจาก {quotation.quotationNo}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2">
            ลูกค้า {quotation.customerName}
            {machines.length ? ` · เครื่อง ${machines.join(", ")}` : " · ไม่มีรายการที่เลือกเครื่อง (ใบงานจะไม่มีเครื่องผูก)"}
          </Typography>
          {err && !err.field ? <Alert severity="error">{err.message}</Alert> : null}
          <TextField select required label="ประเภทงาน" value={f.jobType} onChange={(e) => setF({ ...f, jobType: e.target.value })} {...fe("jobType")}>
            {(options?.jobTypes ?? []).map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          {f.jobType === "REMOVE" ? (
            <TextField select required label="ประเภทย่อย" value={f.jobSubType} onChange={(e) => setF({ ...f, jobSubType: e.target.value })} {...fe("jobSubType")}>
              {(options?.jobSubTypes ?? []).map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          {options?.teams.length ? (
            <TextField select required label="ทีมช่าง" value={f.technicianTeam} onChange={(e) => setF({ ...f, technicianTeam: e.target.value })} {...fe("technicianTeam")}>
              {options.teams.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField required label="ทีมช่าง" value={f.technicianTeam} onChange={(e) => setF({ ...f, technicianTeam: e.target.value })} {...fe("technicianTeam")} />
          )}
          <Stack direction="row" spacing={1}>
            <TextField required label="วันนัด" type="date" value={f.jobDate} onChange={(e) => setF({ ...f, jobDate: e.target.value })} InputLabelProps={{ shrink: true }} {...fe("jobDate")} />
            <TextField label="เวลา" type="time" value={f.jobTime} onChange={(e) => setF({ ...f, jobTime: e.target.value })} InputLabelProps={{ shrink: true }} {...fe("jobTime")} />
          </Stack>
          <TextField label="ชื่องาน" placeholder={`${quotation.customerName} — ตาม ${quotation.quotationNo}`} value={f.jobName} onChange={(e) => setF({ ...f, jobName: e.target.value })} {...fe("jobName")} />
          <TextField label="หมายเหตุ" multiline minRows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy}>
          {busy ? "กำลังเปิดงาน…" : "เปิดงาน"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
