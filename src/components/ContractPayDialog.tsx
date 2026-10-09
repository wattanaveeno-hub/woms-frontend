"use client";

// Round 8 — CON-01 "ปุ่มบันทึกจ่ายแล้ว และหลักฐานชำระ"
// ผู้บันทึกมาจาก token ฝั่งเซิร์ฟเวอร์ · จ่ายบางส่วน/เกินยอด และการแก้หลักฐานย้อนหลังรอยืนยัน Q-14
import { useState } from "react";
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
  const today = bangkokToday();
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
    // BR-06.2: บันทึกชำระต้องมีหลักฐาน (ไฟล์ หรือเลขอ้างอิง) — backend ตรวจซ้ำ
    if (!file && !paymentRef.trim()) {
      setErr({ field: "evidence", message: "แนบหลักฐานการชำระ หรือระบุเลขอ้างอิงการชำระก่อนบันทึก" });
      return;
    }
    setBusy(true);
    try {
      const evidence = file ? { name: file.name, dataUrl: await fileToDataUrl(file) } : null;
      const updated = await contractQuoApi.payInstallment(contract.id, {
        no,
        paid: true,
        updatedAt: contract.updatedAt,
        paidDate,
        paymentRef: paymentRef.trim(),
        evidence,
      });
      onPaid(updated);
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
            สัญญา {contract.contractNo} · ครบกำหนด <span className="mono">{it?.dueDate}</span> · ยอด{" "}
            <strong className="mono">{fmtMoney(it?.amount ?? 0)}</strong> บาท (บันทึกเต็มจำนวนของงวด)
          </Typography>
          {err && (!err.field || !["paidDate", "paymentRef", "evidence"].includes(err.field)) ? (
            <Alert severity="error">{err.message}</Alert>
          ) : null}
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
