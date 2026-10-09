"use client";

// ---------------------------------------------------------------------------
// BR-06 / BR-07 / BR-08 — สรุปยอด + ประวัติรายการชำระ + กล่องแก้ไข (Manager เท่านั้น)
// ใช้ร่วมกันระหว่างบิลช่างและงวดสัญญา
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { parseISODate, parseMoney } from "@/components/FieldErrors";
import { EvidencePreview } from "@/components/BillEvidenceInput";
import { paymentEvidenceSrc, paymentRecordStatusLabel } from "@/lib/billingRules";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATE_LABELS,
  newRequestId,
  type CorrectionBody,
  type PaymentMethod,
  type PaymentRecord,
  type PaymentSummary,
} from "@/lib/paymentsApi";

const baht = (n: number) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dt = (iso?: string) => (iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "");

export function PaymentSummaryLine({ summary }: { summary?: PaymentSummary }) {
  if (!summary) return null;
  const color = summary.state === "PAID" ? "success" : summary.state === "PARTIAL" ? "warning" : "default";
  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
      <Chip size="small" color={color} label={PAYMENT_STATE_LABELS[summary.state]} />
      <Typography variant="body2">
        ยอดที่ต้องชำระ <strong className="mono">{baht(summary.due)}</strong> · ชำระแล้ว{" "}
        <strong className="mono">{baht(summary.paid)}</strong> · คงค้าง{" "}
        <strong className="mono">{baht(summary.outstanding)}</strong> บาท
      </Typography>
    </Stack>
  );
}

/** รายการชำระเรียงตามเวลา — รายการที่ยกเลิก (VOID) ยังแสดงพร้อมประวัติ ไม่ถูกลบ */
export function PaymentHistoryList({
  payments,
  canCorrect,
  onCorrect,
  evidenceHref,
}: {
  payments?: PaymentRecord[];
  canCorrect: boolean;
  onCorrect: (p: PaymentRecord) => void;
  evidenceHref?: (p: PaymentRecord) => string | null;
}) {
  const list = payments ?? [];
  if (!list.length) return <Typography variant="body2" color="text.secondary">ยังไม่มีรายการชำระ</Typography>;
  return (
    <Stack spacing={1} data-testid="payment-history">
      {list.map((p, i) => {
        const href = evidenceHref?.(p) ?? null;
        // BILL-06 — หลักฐานของทุกรายการ (รวมการจ่ายบางส่วนครั้งก่อน) เปิดดูได้จากประวัติ
        const evidence = href ? null : paymentEvidenceSrc(p);
        return (
          <Box key={p.paymentId} sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.25, opacity: p.status === "VOID" ? 0.7 : 1 }}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  #{i + 1} · <span className="mono">{baht(p.amount)}</span> บาท
                </Typography>
                {p.status === "VOID" ? <Chip size="small" color="error" label="ยกเลิกแล้ว" /> : null}
                {p.corrections?.length ? <Chip size="small" variant="outlined" color="warning" label={`แก้ไข ${p.corrections.length} ครั้ง`} /> : null}
                {p.legacy ? <Chip size="small" variant="outlined" label="ข้อมูลเดิม" /> : null}
              </Stack>
              {canCorrect ? (
                <Button size="small" onClick={() => onCorrect(p)} aria-label={`แก้ไขรายการชำระ ${p.paymentId}`}>
                  แก้ไข
                </Button>
              ) : null}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              วันที่ชำระ <span className="mono">{p.paidDate || "-"}</span> · {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
              {p.reference ? <> · อ้างอิง <span className="mono">{p.reference}</span></> : null}
              {href ? (
                <>
                  {" · "}
                  <a href={href} target="_blank" rel="noreferrer">
                    หลักฐาน
                  </a>
                </>
              ) : null}
            </Typography>
            {evidence ? (
              <Box sx={{ mt: 0.75 }} data-testid="payment-evidence">
                <EvidencePreview src={evidence} label={`หลักฐานการจ่าย #${i + 1}`} />
              </Box>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              บันทึกโดย {p.recordedBy || "-"} {dt(p.createdAt)} · {p.paymentId}
            </Typography>
            {(p.corrections ?? []).map((c) => (
              <Box key={c.correctionId} sx={{ mt: 0.75, pl: 1.25, borderLeft: 3, borderColor: "warning.main" }}>
                <Typography variant="caption" component="div">
                  แก้ไขโดย {c.byName} {dt(c.at)} — {c.note}
                </Typography>
                <Typography variant="caption" component="div" color="text.secondary" className="mono">
                  {baht(c.before.amount)} → {baht(c.after.amount)} · {c.before.paidDate} → {c.after.paidDate} · {paymentRecordStatusLabel(c.before.status)} → {paymentRecordStatusLabel(c.after.status)}
                  {c.before.reference !== c.after.reference ? ` · "${c.before.reference}" → "${c.after.reference}"` : ""}
                </Typography>
              </Box>
            ))}
          </Box>
        );
      })}
    </Stack>
  );
}

/** BR-08 — กล่องแก้ไขรายการชำระ (Manager) · หมายเหตุบังคับ · requestId คงที่ต่อการเปิดกล่อง */
export function CorrectPaymentDialog({
  payment,
  busy,
  onClose,
  onSubmit,
}: {
  payment: PaymentRecord | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (paymentId: string, body: CorrectionBody) => void;
}) {
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("TRANSFER");
  const [reference, setReference] = useState("");
  const [voided, setVoided] = useState(false);
  const [note, setNote] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const requestId = useRef("");

  useEffect(() => {
    if (!payment) return;
    setAmount(String(payment.amount));
    setPaidDate(payment.paidDate);
    setMethod(payment.method);
    setReference(payment.reference);
    setVoided(payment.status === "VOID");
    setNote("");
    setErrs({});
    requestId.current = newRequestId("cor");
  }, [payment]);

  if (!payment) return null;

  const submit = () => {
    const e: Record<string, string> = {};
    const m = parseMoney(amount);
    if (!m.ok) e.amount = m.message;
    else if (m.value <= 0) e.amount = "จำนวนเงินต้องมากกว่า 0";
    const d = parseISODate(paidDate);
    if (!d.ok) e.paidDate = d.message;
    if (!note.trim()) e.note = "ต้องระบุหมายเหตุการแก้ไข";
    setErrs(e);
    if (Object.keys(e).length || !m.ok) return;
    const body: CorrectionBody = { note: note.trim(), requestId: requestId.current };
    if (Math.round(m.value * 100) !== Math.round(payment.amount * 100)) body.amount = m.value;
    if (paidDate !== payment.paidDate) body.paidDate = paidDate;
    if (method !== payment.method) body.method = method;
    if (reference.trim() !== payment.reference) body.reference = reference.trim();
    if (voided !== (payment.status === "VOID")) body.void = voided;
    if (Object.keys(body).length === 2) {
      setErrs({ amount: "ยังไม่มีค่าที่เปลี่ยนแปลง" });
      return;
    }
    onSubmit(payment.paymentId, body);
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>แก้ไขรายการชำระ</DialogTitle>
      <DialogContent dividers>
        <Alert severity="warning" sx={{ mb: 2 }}>
          ระบบเก็บค่าเดิมและค่าใหม่ไว้ทั้งหมด และแจ้ง Manager ทุกคน · การยกเลิกรายการจะไม่ลบรายการออก
        </Alert>
        <Stack spacing={2}>
          <TextField
            label="จำนวนเงิน (บาท)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputProps={{ inputMode: "decimal" }}
            error={!!errs.amount}
            helperText={errs.amount}
          />
          <TextField
            label="วันที่ชำระ"
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            error={!!errs.paidDate}
            helperText={errs.paidDate}
          />
          <TextField select label="วิธีชำระ" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((k) => (
              <MenuItem key={k} value={k}>
                {PAYMENT_METHOD_LABELS[k]}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="เลขอ้างอิง" value={reference} onChange={(e) => setReference(e.target.value)} inputProps={{ maxLength: 120 }} />
          <FormControlLabel
            control={<Checkbox checked={voided} onChange={(e) => setVoided(e.target.checked)} />}
            label="ยกเลิกรายการนี้ (ไม่นับเป็นยอดชำระ)"
          />
          <TextField
            label="หมายเหตุการแก้ไข"
            required
            multiline
            minRows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            error={!!errs.note}
            helperText={errs.note || "เช่น ยอดโอนจริงตามสลิป / เช็คเด้ง"}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy}>
          บันทึกการแก้ไข
        </Button>
      </DialogActions>
    </Dialog>
  );
}
