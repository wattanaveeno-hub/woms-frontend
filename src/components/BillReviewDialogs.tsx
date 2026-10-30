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
import type { TechBillV2 } from "@/lib/billsApi";
import MenuItem from "@mui/material/MenuItem";
import { bangkokToday } from "@/lib/date";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/paymentsApi";

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
  /** FB-15 JN ที่เลือกแก้ */
  jobId: string;
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
  // FB-15: เลือก JN ก่อน แล้วแก้รายการภายใน JN นั้นเท่านั้น
  const jobIds = [...new Set(bill.machineItems.map((m) => m.jobId))];
  const [jobId, setJobId] = useState("");

  useEffect(() => {
    if (!open) return;
    const ids = [...new Set(bill.machineItems.map((m) => m.jobId))];
    setJobId(ids.length === 1 ? ids[0] : "");
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

  // ยอด JN และยอดทั้งชุด (ก่อน → หลัง) จากตัวเลขที่กำลังแก้ — ใช้แสดงผลเท่านั้น backend คำนวณซ้ำ
  const num = (v: string | undefined, d: number) => {
    const r = parseMoney(v ?? "");
    return r.ok ? r.value : d;
  };
  const costTotal = (c: Partial<Record<CostKey, number>> | undefined) =>
    (c?.distanceKm ?? 0) * (c?.ratePerKm ?? 0) + (c?.hotel ?? 0) + (c?.parking ?? 0) + (c?.equipment ?? 0) + (c?.porter ?? 0) + (c?.other ?? 0);
  const jobTotal = (j: string, edited: boolean) => {
    const fee = bill.machineItems.filter((m) => m.jobId === j).reduce((s, m) => s + (edited ? num(fees[m.jobEquipmentId], m.serviceFee) : m.serviceFee), 0);
    const cur = bill.jobCosts.find((x) => x.jobId === j);
    const vals = edited
      ? (Object.fromEntries(COST_KEYS.map(([k]) => [k, num(costs[j]?.[k], cur?.[k] ?? 0)])) as Partial<Record<CostKey, number>>)
      : (cur as Partial<Record<CostKey, number>> | undefined);
    return Math.round((fee + costTotal(vals)) * 100) / 100;
  };
  const before = jobId ? jobTotal(jobId, false) : 0;
  const after = jobId ? jobTotal(jobId, true) : 0;
  const billBefore = bill.totals.grandTotal;
  const billAfter = Math.round((billBefore - before + after) * 100) / 100;

  const submit = () => {
    const e: Record<string, string> = {};
    if (!jobId) {
      setErrs({ form: "เลือกใบงาน (JN) ที่ต้องการแก้ก่อน" });
      return;
    }
    const machineFees: AdjustResult["machineFees"] = [];
    for (const m of bill.machineItems.filter((x) => x.jobId === jobId)) {
      const r = parseMoney(fees[m.jobEquipmentId] ?? "");
      if (!r.ok) e[`fee:${m.jobEquipmentId}`] = r.message;
      else if (r.value !== m.serviceFee) machineFees.push({ jobEquipmentId: m.jobEquipmentId, serviceFee: r.value });
    }
    const jobCosts: AdjustResult["jobCosts"] = [];
    for (const [cj, vals] of Object.entries(costs).filter(([k]) => k === jobId)) {
      const cur = bill.jobCosts.find((x) => x.jobId === cj);
      const changed: { jobId: string } & Partial<Record<CostKey, number>> = { jobId: cj };
      let any = false;
      for (const [k] of COST_KEYS) {
        const r = parseMoney(vals[k] ?? "");
        if (!r.ok) e[`cost:${cj}:${k}`] = r.message;
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
    onSubmit({ jobId, reason: reason.trim(), machineFees, jobCosts });
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
          เลือกใบงาน (JN) ก่อน แล้วแก้รายการค่าใช้จ่ายภายใน JN นั้น — รายการของ JN อื่นในชุดเดียวกันไม่เปลี่ยน · ค่าแรงยังแยกตามเครื่อง ·
          ทุกการปรับถูกบันทึกพร้อมเหตุผล ยอดก่อน–หลัง ผู้แก้ และเวลา · หลังอนุมัติแล้วจะแก้ไม่ได้
        </Typography>
        <TextField
          select
          fullWidth
          label="ใบงาน (JN) ที่ต้องการแก้"
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          sx={{ mb: 2 }}
          inputProps={{ "data-testid": "adjust-job" }}
        >
          {jobIds.map((j) => (
            <MenuItem key={j} value={j}>
              {j} · {bill.machineItems.filter((m) => m.jobId === j).length} เครื่อง · ยอด {jobTotal(j, false).toLocaleString("th-TH")} บาท
            </MenuItem>
          ))}
        </TextField>
        {jobId ? (
          <Alert severity="info" sx={{ mb: 2 }} data-testid="adjust-totals">
            ยอด {jobId}: {before.toLocaleString("th-TH")} → <strong>{after.toLocaleString("th-TH")}</strong> บาท · ยอดทั้งชุด:{" "}
            {billBefore.toLocaleString("th-TH")} → <strong>{billAfter.toLocaleString("th-TH")}</strong> บาท
          </Alert>
        ) : null}
        {jobIds.filter((j) => j === jobId).map((jobId) => (
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
export interface BillPaymentForm {
  amount: number;
  paidDate: string;
  method: PaymentMethod;
  reference: string;
  evidence: string;
}

/** BR-06 / BR-07 — บันทึกการจ่าย 1 รายการ (จ่ายบางส่วนได้ · ค่าเริ่มต้น = ยอดคงค้าง) */
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
  onSubmit: (p: BillPaymentForm) => void;
}) {
  const outstanding = bill.payment?.outstanding ?? bill.approvedTotal ?? bill.totals.grandTotal;
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("TRANSFER");
  const [paymentRef, setPaymentRef] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setAmount(String(outstanding));
    setPaidDate(bangkokToday());
    setMethod("TRANSFER");
    setPaymentRef("");
    setEvidence([]);
    setErrs({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = () => {
    const e: Record<string, string> = {};
    const m = parseMoney(amount);
    if (!m.ok) e.amount = m.message;
    else if (m.value <= 0) e.amount = "จำนวนเงินต้องมากกว่า 0";
    else if (Math.round(m.value * 100) > Math.round(outstanding * 100)) e.amount = `เกินยอดคงค้าง (${outstanding.toLocaleString("th-TH")} บาท)`;
    const d = parseISODate(paidDate);
    if (!d.ok) e.paidDate = d.message;
    else if (paidDate > bangkokToday()) e.paidDate = "วันที่จ่ายต้องไม่อยู่ในอนาคต";
    if (!paymentRef.trim()) e.paymentRef = "ต้องระบุเลขอ้างอิงการโอน";
    if (!evidence[0]) e.evidence = "ต้องแนบหลักฐานการจ่าย";
    setErrs(e);
    if (Object.keys(e).length || !m.ok) return;
    onSubmit({ amount: m.value, paidDate, method, reference: paymentRef.trim(), evidence: evidence[0] });
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>บันทึกการจ่ายเงิน — {bill.billNo}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>
          ยอดอนุมัติ {(bill.payment?.due ?? bill.totals.grandTotal).toLocaleString("th-TH")} บาท · จ่ายแล้ว{" "}
          {(bill.payment?.paid ?? 0).toLocaleString("th-TH")} · คงค้าง <strong>{outstanding.toLocaleString("th-TH")}</strong> บาท ·{" "}
          {bill.technicianName}
        </Typography>
        <Stack spacing={2}>
          <TextField
            label="จำนวนเงินที่จ่ายครั้งนี้ (บาท)"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputProps={{ inputMode: "decimal" }}
            error={!!errs.amount}
            helperText={errs.amount || "จ่ายบางส่วนได้ — บิลเป็น \"จ่ายแล้ว\" เมื่อยอดคงค้างเป็น 0"}
          />
          <TextField
            label="วันที่จ่าย"
            type="date"
            required
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ max: bangkokToday() }}
            error={!!errs.paidDate}
            helperText={errs.paidDate}
          />
          <TextField select label="วิธีจ่าย" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((k) => (
              <MenuItem key={k} value={k}>
                {PAYMENT_METHOD_LABELS[k]}
              </MenuItem>
            ))}
          </TextField>
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
          บันทึกการจ่าย
        </Button>
      </DialogActions>
    </Dialog>
  );
}
