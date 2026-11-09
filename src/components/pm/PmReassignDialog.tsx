"use client";

// ---------------------------------------------------------------------------
// ตาราง PM รายเดือน · PM-04 Dialog เปลี่ยนช่าง (Handoff ส่วนที่ 2)
//   ย้ายเฉพาะรอบนี้ (ผู้ดูแลประจำคงเดิม · ค่าเริ่มต้น) / เปลี่ยนผู้ดูแลประจำตั้งแต่รอบถัดไป (ช่างของรอบนี้คงเดิม)
//   เหตุผลบังคับ ≤160 ตัว · backend ตรวจสิทธิ์ (PM-11 pm:manage) และตรวจซ้ำทุกช่อง
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { api, ApiError, PmReassignResult, PmRoundRow } from "@/lib/api";
import { monthLabel, reassignFormError, REASSIGN_REASON_MAX } from "@/lib/pmRoundRules";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";

type Scope = "ROUND_ONLY" | "OWNER_FROM_NEXT";
const CHOICES: { value: Scope; title: string; hint: string }[] = [
  { value: "ROUND_ONLY", title: "ย้ายเฉพาะรอบนี้", hint: "ผู้ดูแลประจำคงเดิม" },
  { value: "OWNER_FROM_NEXT", title: "เปลี่ยนผู้ดูแลประจำตั้งแต่รอบถัดไป", hint: "ช่างของรอบนี้ยังคงเดิม" },
];
const HELP = "บันทึกพร้อมชื่อช่างก่อนและหลัง แล้วแจ้งช่างที่เกี่ยวข้อง";

export default function PmReassignDialog({
  row,
  technicians,
  onClose,
  onDone,
}: {
  row: PmRoundRow | null;
  technicians: { id: string; name: string }[];
  onClose: () => void;
  onDone: (r: PmReassignResult) => void;
}) {
  const [tech, setTech] = useState("");
  const [scope, setScope] = useState<Scope>("ROUND_ONLY");
  const [reason, setReason] = useState("");
  const [fieldErr, setFieldErr] = useState<{ field: string; message: string } | null>(null);
  const [apiErr, setApiErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTech(row?.roundTech?.id ?? "");
    setScope("ROUND_ONLY");
    setReason("");
    setFieldErr(null);
    setApiErr(null);
  }, [row]);

  if (!row) return null;
  const save = async () => {
    const err = reassignFormError({ scope, technicianId: tech, reason });
    setFieldErr(err);
    if (err) return;
    setBusy(true);
    setApiErr(null);
    try {
      const r = await api.pmReassign({
        equipmentId: row.equipmentId,
        scope,
        technicianId: tech,
        expectedTechId: row.roundTech?.id ?? "",
        reason: reason.trim(),
        ...(row.kind === "UNSCHEDULED" ? { extraId: row.extraId } : {}),
      });
      onDone(r);
    } catch (e) {
      if (e instanceof ApiError && (e.field === "reason" || e.field === "technicianId")) setFieldErr({ field: e.field, message: e.message });
      else setApiErr(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  };
  const reasonErr = fieldErr?.field === "reason" ? fieldErr.message : "";
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="pm-reassign-title">
      <DialogTitle id="pm-reassign-title" sx={{ pb: 0.5 }}>
        เปลี่ยนช่าง
        <Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
          {row.customerName}
          {row.serial ? ` · ${row.serial}` : ""} · {row.kind === "UNSCHEDULED" ? "PM นอกแผน" : "รอบ"} {monthLabel(row.roundMonth)}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1.5 }}>
          {apiErr ? <Alert severity="error">{apiErr}</Alert> : null}
          <TextField
            select
            id="pm-reassign-tech"
            label="เลือกช่าง"
            value={tech}
            onChange={(e) => setTech(e.target.value)}
            error={fieldErr?.field === "technicianId"}
            helperText={fieldErr?.field === "technicianId" ? fieldErr.message : undefined}
          >
            {technicians.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
            <MenuItem value="">ยังไม่ระบุช่าง</MenuItem>
          </TextField>
          <FormControl component="fieldset">
            <FormLabel component="legend" sx={{ mb: 1, fontSize: 13, fontWeight: 600, color: "text.primary" }}>
              ให้มีผลกับ
            </FormLabel>
            <RadioGroup value={scope} onChange={(e) => setScope(e.target.value as Scope)} sx={{ gap: 1 }}>
              {CHOICES.filter((c) => row.kind !== "UNSCHEDULED" || c.value === "ROUND_ONLY").map((c) => (
                <Box
                  key={c.value}
                  component="label"
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1,
                    minHeight: 44,
                    px: 1.5,
                    py: 1,
                    border: 1,
                    borderRadius: 1,
                    cursor: "pointer",
                    borderColor: scope === c.value ? "primary.main" : "divider",
                    bgcolor: scope === c.value ? "primary.light" : "background.paper",
                  }}
                >
                  <Radio value={c.value} size="small" sx={{ p: 0.5, mt: -0.25 }} inputProps={{ "aria-describedby": `pm-scope-${c.value}` }} />
                  <Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: "text.primary" }}>{c.title}</Typography>
                    <Typography id={`pm-scope-${c.value}`} variant="body2" sx={{ fontSize: 13 }}>
                      {c.hint}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </RadioGroup>
          </FormControl>
          <TextField
            id="pm-reassign-reason"
            label="เหตุผลที่เปลี่ยนช่าง"
            required
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (fieldErr?.field === "reason") setFieldErr(null);
            }}
            placeholder="เช่น ช่างเดิมติดงานในพื้นที่อื่น"
            inputProps={{ maxLength: REASSIGN_REASON_MAX }}
            error={!!reasonErr}
            helperText={reasonErr || HELP}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={save} disabled={busy} data-testid="pm-reassign-save">
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
