"use client";
// OD-PM-02 / Q-R7-02 (รอบ 8) — ตั้ง/เปลี่ยนผู้ดูแลถาวรของเครื่อง
//   ผู้ดูแลถาวร ≠ ช่างรอบนี้ · ข้อเสนอจากประวัติงานแสดงที่มาและวันที่ · ระบบไม่ตั้งให้เอง — Admin ต้องกดยืนยันพร้อมเหตุผล
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { api, ApiError, type CaretakerChange, type CaretakerSuggestion } from "@/lib/api";
import { bangkokTime } from "@/lib/serviceQueueRules";

const BASIS: Record<string, string> = { LINE_COMPLETED_BY: "ผู้บันทึกเครื่องเสร็จ", SOLE_JOB_TECHNICIAN: "ช่างคนเดียวของใบงาน" };

export default function CaretakerDialog(props: {
  open: boolean;
  equipmentId: string;
  serial: string;
  current: { id: string; name: string } | null;
  techs: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { open, equipmentId, serial, current, techs, onClose, onSaved } = props;
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [sg, setSg] = useState<CaretakerSuggestion | null>(null);
  const [useSg, setUseSg] = useState(false);
  const [history, setHistory] = useState<CaretakerChange[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTo(current?.id ?? "");
    setReason("");
    setUseSg(false);
    setErr(null);
    api.caretakerHistory(equipmentId).then((r) => setHistory(r.items)).catch(() => setHistory([]));
    if (!current) api.caretakerSuggestions([equipmentId]).then((r) => setSg(r.items[0] ?? null)).catch(() => setSg(null));
    else setSg(null);
  }, [open, equipmentId, current]);

  const save = async () => {
    if (!reason.trim()) return setErr("ต้องระบุเหตุผล");
    setBusy(true);
    setErr(null);
    try {
      await api.setCaretaker(equipmentId, {
        caretakerId: to,
        expectedCaretakerId: current?.id ?? "",
        reason: reason.trim(),
        fromSuggestionJobId: useSg && sg?.suggestion && sg.suggestion.userId === to ? sg.suggestion.source.jobId : undefined,
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>ผู้ดูแลเครื่อง {serial}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1 }}>
          ผู้ดูแลถาวรปัจจุบัน: <strong>{current ? current.name || current.id : "ยังไม่กำหนด"}</strong>
          <Typography component="span" variant="caption" color="text.secondary"> · ไม่ใช่ช่างของรอบ PM นี้ — การเปลี่ยนไม่ย้ายงานที่เปิดอยู่</Typography>
        </Typography>
        {sg?.suggestion ? (
          <Alert severity="info" sx={{ mb: 1 }} data-testid="caretaker-suggestion"
            action={<Button size="small" onClick={() => { setTo(sg.suggestion!.userId); setUseSg(true); }}>ใช้ข้อเสนอนี้</Button>}>
            ข้อเสนอจากประวัติงาน: <strong>{sg.suggestion.name}</strong> · {BASIS[sg.suggestion.basis]} · {sg.suggestion.source.jobId} ({sg.suggestion.source.jobType}) ปิดเมื่อ {bangkokTime(sg.suggestion.source.closedAt)}
            <br />ระบบไม่ตั้งให้เอง — ตรวจแล้วกดยืนยันพร้อมเหตุผล
          </Alert>
        ) : !current && sg ? (
          <Alert severity="warning" sx={{ mb: 1 }} data-testid="caretaker-no-suggestion">
            ไม่พบผู้ดูแลที่สามารถแนะนำได้{sg.reason ? ` (${sg.reason})` : ""} — เลือกผู้ดูแลเองได้ พร้อมระบุเหตุผล
          </Alert>
        ) : null}
        <TextField select fullWidth size="small" label="ผู้ดูแลใหม่" value={to} onChange={(e) => { setTo(e.target.value); setUseSg(false); }} sx={{ mt: 1 }}>
          <MenuItem value="">ยังไม่กำหนด (ยกเลิกผู้ดูแล)</MenuItem>
          {techs.map((t) => (
            <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
          ))}
        </TextField>
        <TextField fullWidth multiline minRows={2} size="small" label="เหตุผล (บังคับ)" value={reason} onChange={(e) => setReason(e.target.value)} sx={{ mt: 2 }} inputProps={{ maxLength: 300, "data-testid": "caretaker-reason" }} />
        {err ? <Alert severity="error" sx={{ mt: 1 }}>{err}</Alert> : null}
        <Typography variant="subtitle2" sx={{ mt: 2 }}>ประวัติผู้ดูแล</Typography>
        {history.length ? (
          history.map((h, i) => (
            <Box key={i} sx={{ py: 0.5, borderTop: 1, borderColor: "divider" }} data-testid="caretaker-history-row">
              <Typography variant="body2">{h.fromName || "ยังไม่กำหนด"} → {h.toName || "ยังไม่กำหนด"}{h.fromSuggestion ? " (จากข้อเสนอ)" : ""}</Typography>
              <Typography variant="caption" color="text.secondary">{bangkokTime(h.at)} · {h.actorName} · {h.reason}</Typography>
            </Box>
          ))
        ) : (
          <Typography variant="caption" color="text.secondary">ยังไม่มีประวัติ</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ปิด</Button>
        <Button variant="contained" onClick={save} disabled={busy || to === (current?.id ?? "")} data-testid="caretaker-save">บันทึก</Button>
      </DialogActions>
    </Dialog>
  );
}
