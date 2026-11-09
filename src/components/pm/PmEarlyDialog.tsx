"use client";

// ---------------------------------------------------------------------------
// ตาราง PM รายเดือน v1.2 · PM-07 นัด PM ก่อนรอบ (Admin · pm:manage)
//   ไม่มีวันเวลา — ดึงงานมาเดือนนี้เท่านั้น · ช่างของรอบเป็นผู้เสนอวันเวลาเอง · ยังไม่สร้างคิว/JN
//   ใช้แทนรอบเดิม: คงรอบตามแผน / ขยับตามวันที่ทำจริง · PM นอกแผน: เพิ่มแถวเดือนนี้ รอบตามแผนและยอดสิทธิ์คงเดิม
//   แสดงผลต่อรอบถัดไปก่อนยืนยัน (สูตรเดียวกับ backend)
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { api, ApiError, PmRoundRow } from "@/lib/api";
import { REASSIGN_REASON_MAX, earlyFormError, earlyPreviewOf, monthLabel, type EarlyForm } from "@/lib/pmRoundRules";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import FormLabel from "@mui/material/FormLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

type Choice<T extends string> = { value: T; title: string; hint: string };

function ChoiceGroup<T extends string>({ name, legend, value, onChange, choices, error }: { name: string; legend: string; value: string; onChange: (v: T) => void; choices: Choice<T>[]; error?: string }) {
  return (
    <FormControl component="fieldset" error={!!error}>
      <FormLabel component="legend" sx={{ mb: 1, fontSize: 13, fontWeight: 600, color: "text.primary" }}>
        {legend}
      </FormLabel>
      <RadioGroup name={name} value={value} onChange={(e) => onChange(e.target.value as T)} sx={{ gap: 1 }}>
        {choices.map((c) => (
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
              borderColor: value === c.value ? "primary.main" : "divider",
              bgcolor: value === c.value ? "primary.light" : "background.paper",
            }}
          >
            <Radio value={c.value} size="small" sx={{ p: 0.5, mt: -0.25 }} inputProps={{ "aria-describedby": `${name}-${c.value}` }} />
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: "text.primary" }}>{c.title}</Typography>
              <Typography id={`${name}-${c.value}`} variant="body2" sx={{ fontSize: 13 }}>
                {c.hint}
              </Typography>
            </Box>
          </Box>
        ))}
      </RadioGroup>
      {error ? <FormHelperText>{error}</FormHelperText> : null}
    </FormControl>
  );
}

export default function PmEarlyDialog({ row, currentMonth, onClose, onDone }: { row: PmRoundRow | null; currentMonth: string; onClose: () => void; onDone: (msg: string) => void }) {
  const [form, setForm] = useState<EarlyForm>({ requestType: "", planMode: "", reason: "" });
  const [quotationNo, setQuotationNo] = useState("");
  const [fieldErr, setFieldErr] = useState<{ field: string; message: string } | null>(null);
  const [apiErr, setApiErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setForm({ requestType: "", planMode: "", reason: "" });
    setQuotationNo("");
    setFieldErr(null);
    setApiErr(null);
  }, [row]);
  if (!row) return null;
  const planned = row.plannedMonth || row.roundMonth;
  const pv = earlyPreviewOf({ plannedMonth: planned, dueDate: row.dueDate, intervalMonths: row.intervalMonths, currentMonth });
  const entitlementEnded = row.entitlementEnded;
  const set = (patch: Partial<EarlyForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setFieldErr(null);
  };
  const save = async () => {
    const e = earlyFormError(form);
    setFieldErr(e);
    if (e) return;
    setBusy(true);
    setApiErr(null);
    try {
      const r = await api.pmEarly({
        equipmentId: row.equipmentId,
        requestType: form.requestType as "REPLACE" | "UNSCHEDULED",
        ...(form.requestType === "REPLACE" ? { planMode: form.planMode as "KEEP_PLAN" | "SHIFT_ACTUAL" } : {}),
        reason: form.reason.trim(),
        ...(form.requestType === "UNSCHEDULED" && quotationNo.trim() ? { quotationNo: quotationNo.trim() } : {}),
      });
      onDone(
        r.already
          ? `${r.serial} อยู่ในเดือน ${monthLabel(r.workMonth)} แล้ว — ใช้รายการเดิม`
          : r.requestType === "REPLACE"
            ? `ย้ายงานมาเดือนนี้แล้ว · ${r.serial} · แผนเดิม ${monthLabel(r.plannedMonth)} · ให้ช่างเสนอคิวจากตาราง`
            : `แสดง PM นอกแผนในเดือนนี้แล้ว · ${r.serial} · คงรอบ ${monthLabel(r.plannedMonth)} และยอดสิทธิ์เดิม`
      );
    } catch (x) {
      setApiErr(x instanceof ApiError ? x.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  };
  const reasonErr = fieldErr?.field === "reason" ? fieldErr.message : "";
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="pm-early-title">
      <DialogTitle id="pm-early-title" sx={{ pb: 0.5 }}>
        นัด PM ก่อนรอบ
        <Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
          {row.customerName}
          {row.serial ? ` · ${row.serial}` : ""} · รอบตามแผน {monthLabel(planned)}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1.5 }}>
          {apiErr ? <Alert severity="error">{apiErr}</Alert> : null}
          <Typography variant="body2">ดึงงานมาไว้เดือน {monthLabel(currentMonth, true)} · ไม่ต้องกรอกวันเวลา ช่างของรอบจะเสนอวันเวลาเอง และยังไม่สร้างคิวหรือใบงาน</Typography>
          <ChoiceGroup
            name="pm-early-type"
            legend="ประเภทคำขอ"
            value={form.requestType}
            onChange={(v) => set({ requestType: v, planMode: v === "UNSCHEDULED" ? "" : form.planMode })}
            error={fieldErr?.field === "requestType" ? fieldErr.message : undefined}
            choices={[
              ...(entitlementEnded ? [] : [{ value: "REPLACE" as const, title: "ใช้แทนรอบเดิม", hint: "ปิดรอบเดิมเมื่อทำสำเร็จ และตัดสิทธิ์ถ้าใช้แพ็กเกจ" }]),
              { value: "UNSCHEDULED" as const, title: "PM นอกแผน", hint: "บันทึกเป็นงานเพิ่ม คงรอบเดิมและยอดสิทธิ์ไว้" },
            ]}
          />
          {entitlementEnded ? <Alert severity="info">ใช้สิทธิ์แพ็กเกจครบแล้ว จึงเลือกได้เฉพาะ PM นอกแผน</Alert> : null}
          {form.requestType === "REPLACE" ? (
            <ChoiceGroup
              name="pm-early-mode"
              legend="วิธีวางแผนรอบถัดไป"
              value={form.planMode}
              onChange={(v) => set({ planMode: v })}
              error={fieldErr?.field === "planMode" ? fieldErr.message : undefined}
              choices={[
                { value: "KEEP_PLAN", title: "คงรอบตามแผน", hint: "นับความถี่จากเดือนรอบเดิม" },
                { value: "SHIFT_ACTUAL", title: "ขยับตามวันที่ทำจริง", hint: "นับความถี่จากเดือนที่ทำ PM สำเร็จ" },
              ]}
            />
          ) : null}
          {form.requestType === "UNSCHEDULED" ? (
            <TextField id="pm-early-quotation" label="เลขใบเสนอราคา (ถ้ามีค่าบริการ)" value={quotationNo} onChange={(e) => setQuotationNo(e.target.value)} inputProps={{ maxLength: 40 }} />
          ) : null}
          <TextField
            id="pm-early-reason"
            label="เหตุผลที่ขอเข้าก่อน"
            required
            value={form.reason}
            onChange={(e) => set({ reason: e.target.value })}
            placeholder="เช่น ลูกค้าปิดร้านช่วงเดือนรอบเดิม"
            inputProps={{ maxLength: REASSIGN_REASON_MAX }}
            error={!!reasonErr}
            helperText={reasonErr || "บันทึกเดือนตามแผน เดือนจัดงาน เหตุผล ผู้บันทึก และเวลา"}
          />
          {form.requestType ? (
            <Box sx={{ px: 1.5, py: 1, borderRadius: 1, bgcolor: "neutral.light" }} data-testid="pm-early-preview">
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "text.primary" }}>
                จัดงานใน {monthLabel(currentMonth)} · แผนเดิม {monthLabel(planned)} · ทุก {row.intervalMonths} เดือน
              </Typography>
              <Typography variant="body2">
                {form.requestType === "UNSCHEDULED"
                  ? `คงรอบ ${monthLabel(pv.unscheduledKeepsPlan)} และยอดสิทธิ์เดิม`
                  : form.planMode === "KEEP_PLAN"
                    ? `รอบถัดไปเมื่อทำสำเร็จ: ${monthLabel(pv.keepPlanNext)}`
                    : form.planMode === "SHIFT_ACTUAL"
                      ? `ถ้าทำในเดือนนี้ รอบถัดไป: ${monthLabel(pv.shiftActualNextIfDoneInWorkMonth)} (ยึดเดือนที่ทำจริง)`
                      : "เลือกวิธีวางแผนรอบถัดไป"}
              </Typography>
            </Box>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={save} disabled={busy} data-testid="pm-early-save">
          {busy ? "กำลังบันทึก…" : "ย้ายมาเดือนนี้"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
