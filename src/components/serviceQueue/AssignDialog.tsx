"use client";
// หน้าต่างจัดช่าง / เปลี่ยนช่าง — ใช้ทั้งหน้ารายละเอียดคิวและบอร์ดคิวช่าง (UAT 2026-11-16: กดจัดช่างจากบอร์ดได้เลย)
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
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

export default function AssignDialog({
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
