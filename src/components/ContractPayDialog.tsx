"use client";

// Round 8 — CON-01 "ปุ่มบันทึกจ่ายแล้ว และหลักฐานชำระ"
// BR-06/07 — รับชำระทีละรายการ จ่ายบางส่วนได้ (ค่าเริ่มต้น = ยอดคงค้างของงวด) · ห้ามเกินยอดคงค้าง
// ผู้บันทึกมาจาก token ฝั่งเซิร์ฟเวอร์ · requestId คงที่ต่อการเปิดกล่อง (กดซ้ำ/ลองใหม่ไม่บันทึกซ้ำ)
// การแก้ไขรายการที่บันทึกแล้วเป็นสิทธิ์ Manager (BR-08) — ทำที่ประวัติการชำระ
import { useRef, useState } from "react";
import MenuItem from "@mui/material/MenuItem";
import { parseMoney } from "@/components/FieldErrors";
import { PAYMENT_METHOD_LABELS, newRequestId, paymentsApi, type PaymentMethod } from "@/lib/paymentsApi";
import { ApiError } from "@/lib/api";
import {
  ACCEPT_FILE_TYPES,
  MAX_EVIDENCE_BYTES,
  contractQuoApi,
  fileToDataUrl,
} from "@/lib/contractQuoApi";
import type { Contract } from "@/lib/types";
import { fmtMoney } from "@/lib/options";
import { bangkokToday } from "@/lib/date";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AttachFileIcon from "@mui/icons-material/AttachFile";

export default function ContractPayDialog({
  contract,
  no,
  onClose,
  onPaid,
}: {
  contract: Contract;
  no: number;
  onClose: () => void;
  onPaid: (updated: Contract) => void;
}) {
  const it = contract.installments.find((x) => x.no === no);
  const outstanding = it?.payment?.outstanding ?? it?.amount ?? 0;
  const today = bangkokToday();
  const [amount, setAmount] = useState(String(outstanding));
  const [method, setMethod] = useState<PaymentMethod>("TRANSFER");
  const requestId = useRef(newRequestId("inst"));
  const [paidDate, setPaidDate] = useState(today);
  const [paymentRef, setPaymentRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);

  const pick = (f: File | null) => {
    setErr(null);
    if (f && f.size > MAX_EVIDENCE_BYTES) {
      setErr({ field: "evidence", message: `ไฟล์ใหญ่เกินไป (ไม่เกิน ${(MAX_EVIDENCE_BYTES / 1_000_000).toFixed(1)} MB)` });
      return;
    }
    setFile(f);
  };

  const submit = async () => {
    setErr(null);
    if (!paidDate) return setErr({ field: "paidDate", message: "ต้องระบุวันที่ชำระ" });
    if (paidDate > today) return setErr({ field: "paidDate", message: "วันที่ชำระต้องไม่เป็นวันในอนาคต" });
    const m = parseMoney(amount);
    if (!m.ok) return setErr({ field: "amount", message: m.message });
    if (m.value <= 0) return setErr({ field: "amount", message: "จำนวนเงินต้องมากกว่า 0" });
    if (Math.round(m.value * 100) > Math.round(outstanding * 100)) {
      return setErr({ field: "amount", message: `เกินยอดคงค้างของงวด (${fmtMoney(outstanding)} บาท)` });
    }
    // BR-06.2: บันทึกชำระต้องมีหลักฐาน (ไฟล์ หรือเลขอ้างอิง) — backend ตรวจซ้ำ
    if (!file && !paymentRef.trim()) {
      setErr({ field: "evidence", message: "แนบหลักฐานการชำระ หรือระบุเลขอ้างอิงการชำระก่อนบันทึก" });
      return;
    }
    setBusy(true);
    try {
      const evidence = file ? { name: file.name, dataUrl: await fileToDataUrl(file) } : null;
      const r = await paymentsApi.recordInstallmentPayment(contract.id, no, {
        amount: m.value,
        paidDate,
        method,
        reference: paymentRef.trim(),
        evidence,
        requestId: requestId.current,
      });
      onPaid(r.contract);
    } catch (e) {
      setErr(e instanceof ApiError ? { field: e.field?.split(".")[0], message: e.message } : { message: "บันทึกไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  const fe = (k: string) => (err?.field === k ? { error: true, helperText: err.message } : {});

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>บันทึกชำระงวดที่ {no}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2">
            สัญญา {contract.contractNo} · ครบกำหนด <span className="mono">{it?.dueDate}</span> · ยอดงวด{" "}
            <strong className="mono">{fmtMoney(it?.amount ?? 0)}</strong> · ชำระแล้ว{" "}
            <span className="mono">{fmtMoney(it?.payment?.paid ?? 0)}</span> · คงค้าง{" "}
            <strong className="mono">{fmtMoney(outstanding)}</strong> บาท
          </Typography>
          {err && (!err.field || !["amount", "paidDate", "paymentRef", "evidence"].includes(err.field)) ? (
            <Alert severity="error">{err.message}</Alert>
          ) : null}
          <TextField
            required
            label="จำนวนเงินที่รับครั้งนี้ (บาท)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputProps={{ inputMode: "decimal" }}
            helperText={err?.field === "amount" ? err.message : "รับบางส่วนได้ — งวดเป็น \"ชำระแล้ว\" เมื่อคงค้างเป็น 0"}
            error={err?.field === "amount"}
          />
          <TextField select label="วิธีชำระ" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((k) => (
              <MenuItem key={k} value={k}>
                {PAYMENT_METHOD_LABELS[k]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            required
            label="วันที่ชำระ"
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ max: today }}
            {...fe("paidDate")}
          />
          <TextField
            label="เลขอ้างอิงการชำระ"
            placeholder="เช่น เลขที่โอน / เลขเช็ค"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            inputProps={{ maxLength: 120 }}
            {...fe("paymentRef")}
          />
          <Stack spacing={0.5}>
            <Button component="label" variant="outlined" startIcon={<AttachFileIcon />}>
              {file ? "เปลี่ยนไฟล์หลักฐาน" : "แนบหลักฐานการชำระ"}
              <input hidden type="file" accept={ACCEPT_FILE_TYPES} onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            </Button>
            <Typography variant="body2" color={err?.field === "evidence" ? "error" : undefined}>
              {err?.field === "evidence"
                ? err.message
                : file
                  ? file.name
                  : "รูปภาพ (PNG/JPEG/WEBP) หรือ PDF ไม่เกิน 1.5 MB — ต้องแนบหลักฐาน หรือระบุเลขอ้างอิงการชำระอย่างใดอย่างหนึ่ง"}
            </Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy}>
          {busy ? "กำลังบันทึก…" : "บันทึกชำระ"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
