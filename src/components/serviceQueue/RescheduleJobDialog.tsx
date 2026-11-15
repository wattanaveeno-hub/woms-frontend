"use client";
// UAT2-14 / RESCHEDULE 01 — แจ้งเลื่อนงาน: ส่งใบงานกลับเข้าเช็คคิวทันที (JN เดิม) ไม่ต้องกดพักงานก่อน
//   ใช้ API เดิม POST /api/service-queue/jobs/:jobId/reschedule (Admin) — backend ตรวจสิทธิ์/สถานะ/คิวซ้อนทุกครั้ง
//   ค่าเริ่มต้น "กลับไปเลือกช่าง" (techId ว่าง) ตามที่ลูกค้าขอ · เลือกช่างเดิม/ช่างใหม่ได้
import { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { api, ApiError } from "@/lib/api";
import type { AuthUser } from "@/lib/types";
import { sqApi, type ServiceQueue } from "@/lib/serviceQueueApi";

export default function RescheduleJobDialog({
  open,
  jobId,
  currentTechId = "",
  defaultTechId = "",
  onClose,
  onDone,
}: {
  open: boolean;
  jobId: string;
  currentTechId?: string;
  /** "" = กลับไปรอเลือกช่าง */
  defaultTechId?: string;
  onClose: () => void;
  onDone: (q: ServiceQueue) => void;
}) {
  const [techs, setTechs] = useState<AuthUser[]>([]);
  const [reason, setReason] = useState("");
  const [techId, setTechId] = useState(defaultTechId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setTechId(defaultTechId);
    setErr(null);
    api
      .listTechnicians()
      .then((r) => setTechs(r.items.filter((t) => t.active !== false)))
      .catch(() => setTechs([]));
  }, [open, defaultTechId]);

  const submit = async () => {
    if (!reason.trim()) return setErr("ต้องระบุเหตุผลการเลื่อนงาน");
    setBusy(true);
    try {
      const q = await sqApi.rescheduleJob(jobId, reason.trim(), techId);
      window.dispatchEvent(new Event("woms:queue-changed"));
      onDone(q);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "เลื่อนงานไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>แจ้งเลื่อนงาน {jobId}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          ส่งใบงานกลับเข้าเช็คคิวทันทีโดยใช้ JN เดิม — เก็บข้อมูลลูกค้า เครื่อง SN เอกสาร และประวัติเดิมทั้งหมด · วันนัดเดิมย้ายไปอยู่ในประวัติ ·
          ใบงานแสดงเป็น “เลื่อนวันเข้า · รอเช็คคิวใหม่” (แยกจากพักงาน) จนกว่าจะยืนยันนัดใหม่
        </Typography>
        <TextField
          fullWidth
          required
          multiline
          minRows={2}
          label="เหตุผลการเลื่อน"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={!!err}
          helperText={err ?? "แสดงให้ทุกคนที่เกี่ยวข้องเห็นในใบงานและคิว"}
          sx={{ mb: 2 }}
          inputProps={{ "data-testid": "reschedule-reason" }}
        />
        <TextField
          select
          fullWidth
          label="ช่างสำหรับนัดใหม่"
          value={techId}
          onChange={(e) => setTechId(e.target.value)}
          helperText="ค่าเริ่มต้น: กลับไปขั้นเลือกช่าง · หรือเลือกช่างเดิม/ช่างใหม่เพื่อรอเสนอวันใหม่"
        >
          <MenuItem value="">— กลับไปเลือกช่าง —</MenuItem>
          {techs.map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.name}
              {t.id === currentTechId ? " (ช่างเดิม)" : ""}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" disabled={busy} onClick={() => void submit()} data-testid="reschedule-submit">
          {busy ? "กำลังส่ง…" : "แจ้งเลื่อนงาน"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
