"use client";

// กล่องโต้ตอบของผู้ตรวจบิล: ปรับราคาพร้อมเหตุผล (BILL-05) และบันทึกการจ่ายพร้อมหลักฐาน (BILL-06)
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { parseMoney, parseISODate } from "@/components/FieldErrors";
import BillEvidenceInput from "@/components/BillEvidenceInput";
import type { PaymentInput, TechBillV2 } from "@/lib/billsApi";

const COST_KEYS = [
  ["distanceKm", "ระยะทาง (กม.)"],
  ["ratePerKm", "ราคาต่อ กม."],
  ["hotel", "โรงแรม"],
  ["parking", "จอดรถ"],
  ["equipment", "อุปกรณ์"],
  ["porter", "คนยก"],
  ["other", "อื่น ๆ"],
] as const;
type CostKey = (typeof COST_KEYS)[number][0];

export interface AdjustResult {
  reason: string;
  machineFees: Array<{ jobEquipmentId: string; serviceFee: number }>;
  jobCosts: Array<{ jobId: string } & Partial<Record<CostKey, number>>>;
}

/** BILL-05 ปรับราคาระหว่างตรวจ — ส่งเฉพาะตัวเลขที่เปลี่ยน พร้อมเหตุผล (บังคับ) */
export function BillAdjustDialog({
  bill,
  open,
  busy,
  onClose,
  onSubmit,
}: {
  bill: TechBillV2;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (r: AdjustResult) => void;
}) {
  const [fees, setFees] = useState<Record<string, string>>({});
  const [costs, setCosts] = useState<Record<string, Record<CostKey, string>>>({});
  const [reason, setReason] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setFees(Object.fromEntries(bill.machineItems.map((m) => [m.jobEquipmentId, String(m.serviceFee)])));
    setCosts(
      Object.fromEntries(
        [...new Set(bill.machineItems.map((m) => m.jobId))].map((jobId) => {
          const c = bill.jobCosts.find((x) => x.jobId === jobId);
          return [jobId, Object.fromEntries(COST_KEYS.map(([k]) => [k, String(c?.[k] ?? 0)])) as Record<CostKey, string>];
        })
      )
    );
    setReason("");
    setErrs({});
  }, [open, bill]);

  const submit = () => {
    const e: Record<string, string> = {};
    const machineFees: AdjustResult["machineFees"] = [];
    for (const m of bill.machineItems) {
      const r = parseMoney(fees[m.jobEquipmentId] ?? "");
      if (!r.ok) e[`fee:${m.jobEquipmentId}`] = r.message;
      else if (r.value !== m.serviceFee) machineFees.push({ jobEquipmentId: m.jobEquipmentId, serviceFee: r.value });
    }
    const jobCosts: AdjustResult["jobCosts"] = [];
    for (const [jobId, vals] of Object.entries(costs)) {
      const cur = bill.jobCosts.find((x) => x.jobId === jobId);
      const changed: { jobId: string } & Partial<Record<CostKey, number>> = { jobId };
      let any = false;
      for (const [k] of COST_KEYS) {
        const r = parseMoney(vals[k] ?? "");
        if (!r.ok) e[`cost:${jobId}:${k}`] = r.message;
        else if (r.value !== (cur?.[k] ?? 0)) {
          changed[k] = r.value;
          any = true;
        }
      }
      if (any) jobCosts.push(changed);
    }
    if (!reason.trim()) e.reason = "ต้องระบุเหตุผลที่ปรับราคา";
    if (!machineFees.length && !jobCosts.length) e.form = "ยังไม่มีตัวเลขที่เปลี่ยน";
    setErrs(e);
    if (Object.keys(e).length) return;
    onSubmit({ reason: reason.trim(), machineFees, jobCosts });
  };

  const field = (key: string, label: string, value: string, set: (v: string) => void) => (
    <TextField
      size="small"
      label={label}
      value={value}
      onChange={(ev) => set(ev.target.value)}
      inputProps={{ inputMode: "decimal" }}
      error={!!errs[key]}
      helperText={errs[key]}
      sx={{ width: { xs: "100%", sm: 130 } }}
    />
  );

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>ปรับราคาระหว่างตรวจ — {bill.billNo}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>
          ปรับได้เฉพาะตัวเลข ไม่เพิ่มหรือลดเครื่อง · ทุกการปรับถูกบันทึกพร้อมเหตุผลใน Audit Log และประวัติของบิล · หลังอนุมัติแล้วจะแก้ไม่ได้
        </Typography>
        {[...new Set(bill.machineItems.map((m) => m.jobId))].map((jobId) => (
          <Box key={jobId} sx={{ mb: 2, p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}>
            <Typography sx={{ fontWeight: 600, mb: 1 }}>{jobId}</Typography>
            <Stack spacing={1}>
              {bill.machineItems
                .filter((m) => m.jobId === jobId)
                .map((m) => (
                  <Stack key={m.jobEquipmentId} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                    <Typography variant="body2" sx={{ minWidth: 180 }}>
                      SN {m.serial || "—"} (เดิม {m.serviceFee.toLocaleString("th-TH")})
                    </Typography>
                    {field(`fee:${m.jobEquipmentId}`, "ค่าบริการ", fees[m.jobEquipmentId] ?? "", (v) => setFees((p) => ({ ...p, [m.jobEquipmentId]: v })))}
                  </Stack>
                ))}
            </Stack>
            <Typography variant="body2" sx={{ mt: 1.5, mb: 1 }}>
              ค่าใช้จ่ายร่วม
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
              {COST_KEYS.map(([k, label]) => (
                <Box key={k}>
                  {field(`cost:${jobId}:${k}`, label, costs[jobId]?.[k] ?? "", (v) =>
                    setCosts((p) => ({ ...p, [jobId]: { ...(p[jobId] ?? ({} as Record<CostKey, string>)), [k]: v } }))
                  )}
                </Box>
              ))}
            </Stack>
          </Box>
        ))}
        <TextField
          label="เหตุผลที่ปรับราคา"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={!!errs.reason}
          helperText={errs.reason ?? "ช่างจะเห็นเหตุผลนี้ในประวัติการปรับราคา"}
          fullWidth
          multiline
          minRows={2}
        />
        {errs.form ? (
          <Alert severity="warning" sx={{ mt: 1 }}>
            {errs.form}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy}>
          บันทึกการปรับราคา
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** BILL-06 บันทึกการจ่าย — ต้องมีวันที่จ่าย เลขอ้างอิงการโอน และหลักฐาน (ผู้บันทึกมาจากบัญชีที่ล็อกอิน) */
export function BillPaymentDialog({
  bill,
  open,
  busy,
  onClose,
  onSubmit,
}: {
  bill: TechBillV2;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (p: PaymentInput) => void;
}) {
  const [paidDate, setPaidDate] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setPaidDate(new Date().toISOString().slice(0, 10));
    setPaymentRef("");
    setEvidence([]);
    setErrs({});
  }, [open]);

  const submit = () => {
    const e: Record<string, string> = {};
    const d = parseISODate(paidDate);
    if (!d.ok) e.paidDate = d.message;
    if (!paymentRef.trim()) e.paymentRef = "ต้องระบุเลขอ้างอิงการโอน";
    if (!evidence[0]) e.evidence = "ต้องแนบหลักฐานการจ่าย";
    setErrs(e);
    if (Object.keys(e).length) return;
    onSubmit({ paidDate, paymentRef: paymentRef.trim(), paymentEvidence: evidence[0] });
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>บันทึกการจ่ายเงิน — {bill.billNo}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>
          ยอด {bill.totals.grandTotal.toLocaleString("th-TH")} บาท · {bill.technicianName}
        </Typography>
        <Stack spacing={2}>
          <TextField
            label="วันที่จ่าย"
            type="date"
            required
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            error={!!errs.paidDate}
            helperText={errs.paidDate}
          />
          <TextField
            label="เลขอ้างอิงการโอน"
            required
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            error={!!errs.paymentRef}
            helperText={errs.paymentRef}
          />
          <BillEvidenceInput value={evidence} onChange={setEvidence} max={1} label="แนบสลิป/หลักฐานการจ่าย" error={errs.evidence} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy}>
          บันทึกว่าจ่ายแล้ว
        </Button>
      </DialogActions>
    </Dialog>
  );
}
