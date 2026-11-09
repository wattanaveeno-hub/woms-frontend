"use client";

// ---------------------------------------------------------------------------
// ตาราง PM รายเดือน v1.2 · PM-20 หมายเหตุความสะดวกของลูกค้ารายเครื่อง (Admin · pm:manage)
//   เก็บที่เครื่อง · ใช้ซ้ำทุกรอบ · ส่งไปคิว/JN เป็นสำเนา ณ เวลาเสนอคิว (แก้ภายหลังไม่ย้อนแก้คิว/JN)
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { api, ApiError, PmRoundRow } from "@/lib/api";
import { PM_NOTE_MAX, noteFormError } from "@/lib/pmRoundRules";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

export default function PmNoteDialog({ row, onClose, onDone }: { row: PmRoundRow | null; onClose: () => void; onDone: (msg: string) => void }) {
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setNote(row?.customerNote ?? "");
    setErr(null);
  }, [row]);
  if (!row) return null;
  const save = async () => {
    const e = noteFormError(note);
    if (e) return setErr(e);
    setBusy(true);
    setErr(null);
    try {
      await api.pmCustomerNote({ equipmentId: row.equipmentId, note: note.trim(), expectedNote: row.customerNote ?? "" });
      onDone(`บันทึกหมายเหตุ ${row.serial} แล้ว · ใช้กับคิวที่เสนอหลังจากนี้`);
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="pm-note-title">
      <DialogTitle id="pm-note-title" sx={{ pb: 0.5 }}>
        หมายเหตุความสะดวกของลูกค้า
        <Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
          {row.customerName}
          {row.serial ? ` · ${row.serial}` : ""}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {err ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            {err}
          </Alert>
        ) : null}
        <TextField
          id="pm-note-text"
          label="หมายเหตุรายเครื่อง"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="เช่น สะดวกวันธรรมดาหลัง 13:00 น."
          multiline
          minRows={2}
          fullWidth
          sx={{ mt: 1.5 }}
          inputProps={{ maxLength: PM_NOTE_MAX }}
          helperText={`แสดงใน PM รอบถัดไปด้วย และติดไปกับคิวเมื่อช่างกดส่ง · ${note.trim().length}/${PM_NOTE_MAX}`}
        />
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={save} disabled={busy} data-testid="pm-note-save">
          {busy ? "กำลังบันทึก…" : "บันทึกหมายเหตุ"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
