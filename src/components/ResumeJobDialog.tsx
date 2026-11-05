"use client";
// CAL-D01 (SA/PM 3 พ.ย. 69) + OD-CAL-01: กลับมาดำเนินการ = ขอรอบคิวใหม่ ใช้ JN เดิม
//   Admin เลือกช่างที่จะส่งคำขอคิว (ไม่บังคับ — ว่าง = จัดช่างในคิวภายหลัง) · ช่างเสนอวันเวลา → Admin รับคิว → ยืนยันลูกค้า
//   ระบบไม่ใช้วัน/เวลา/ช่างเดิมเอง · ใบงานคงสถานะพักงานจนยืนยันรอบใหม่ · backend ตรวจซ้ำทุกครั้ง
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { api } from "@/lib/api";

export interface ResumeInput {
  techId: string;
  reason: string;
  requestId: string;
}

export default function ResumeJobDialog({
  open,
  jobId,
  previous,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  jobId: string;
  /** นัดเดิม (ประวัติ · แสดงอ้างอิงเท่านั้น) */
  previous: { jobDate: string; jobTime: string };
  busy?: boolean;
  onClose: () => void;
  onSubmit: (v: ResumeInput) => void;
}) {
  const [techs, setTechs] = useState<{ id: string; name: string }[]>([]);
  const [v, setV] = useState<ResumeInput>({ techId: "", reason: "", requestId: "" });
  useEffect(() => {
    if (!open) return;
    // คีย์คำขอต่อการเปิด dialog หนึ่งครั้ง — กดซ้ำ/ส่งซ้ำหลัง timeout ได้ผลเดิม ไม่เกิดรอบคิวซ้อน
    setV({ techId: "", reason: "", requestId: `resume-${jobId}-${Date.now()}` });
    api
      .listTechnicians()
      .then((r) => setTechs(r.items.map((u) => ({ id: u.id, name: u.name }))))
      .catch(() => setTechs([]));
  }, [open, jobId]);
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>กลับมาดำเนินการใบงาน {jobId}</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          ระบบจะสร้างรอบคิวใหม่ด้วยเลขใบงานเดิม ให้ช่างเสนอวันเวลา แล้ว Admin รับคิวและยืนยันลูกค้า ใบงานยังเป็น “พักงาน” จนกว่าจะยืนยันรอบใหม่ ·
          นัดเดิม (ประวัติ): {previous.jobDate || "-"} {previous.jobTime}
        </Alert>
        <Stack spacing={2}>
          <TextField select label="ส่งคำขอคิวให้ช่าง (ไม่บังคับ)" value={v.techId} onChange={(e) => setV({ ...v, techId: e.target.value })} inputProps={{ "data-testid": "resume-tech" }}>
            <MenuItem value="">ยังไม่เลือก — จัดช่างในคิวภายหลัง</MenuItem>
            {techs.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="เหตุผล / หมายเหตุ" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" disabled={busy} onClick={() => onSubmit(v)}>
          ขอคิวรอบใหม่
        </Button>
      </DialogActions>
    </Dialog>
  );
}
