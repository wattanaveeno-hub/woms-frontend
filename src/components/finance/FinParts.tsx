"use client";

// D-11 Financial Workflow v1.0 — ชิ้นส่วนร่วมของหน้าการเงิน (ชิปสถานะ / ไฟล์แนบ / แบบฟอร์ม)
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
import AttachFileIcon from "@mui/icons-material/AttachFile";
import BillEvidenceInput from "@/components/BillEvidenceInput";
import { ApiError } from "@/lib/api";
import { bangkokToday } from "@/lib/date";
import { fmtMoney } from "@/lib/options";
import {
  ACC_DOC_TYPE_LABEL,
  DELIVERY_CHANNEL_LABEL,
  FIN_AGG_STATE_LABEL,
  FIN_CHANNEL_LABEL,
  FIN_EXCEPTION_LABEL,
  FIN_PAYMENT_STATE_LABEL,
  aggStateTone,
  newIdempotencyKey,
  parseFinAmount,
  paymentStateTone,
  type AccDocType,
  type DeliveryChannel,
  type FinAggState,
  type FinPaymentChannel,
  type FinPaymentState,
} from "@/lib/financeRules";
import {
  fetchFileObjectUrl,
  financeApi,
  finFilePath,
  type AccDocument,
  type FinFileMeta,
  type FinPayment,
  type FinanceSummary,
} from "@/lib/financeApi";

export function PaymentStateChip({ status }: { status: FinPaymentState }) {
  return <Chip size="small" color={paymentStateTone(status)} label={FIN_PAYMENT_STATE_LABEL[status] ?? status} data-testid="payment-state" />;
}

export function AggStateChip({ summary }: { summary: Pick<FinanceSummary, "paymentStatus" | "displayLabel" | "pendingCount"> }) {
  return (
    <Chip
      size="small"
      variant={summary.pendingCount ? "outlined" : "filled"}
      color={aggStateTone(summary.paymentStatus as FinAggState)}
      label={summary.displayLabel || FIN_AGG_STATE_LABEL[summary.paymentStatus as FinAggState]}
      data-testid="agg-state"
      data-state={summary.paymentStatus}
    />
  );
}

export function ExceptionAlerts({ summary }: { summary: FinanceSummary }) {
  if (!summary.exceptions?.length) return null;
  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      {summary.exceptions.map((x) => (
        <Alert key={x} severity="warning" data-testid="fin-exception">
          {FIN_EXCEPTION_LABEL[x] ?? x}
        </Alert>
      ))}
    </Stack>
  );
}

/** ปุ่มเปิดไฟล์แนบ — โหลดผ่าน token แล้วแสดงในกล่อง (รูป / PDF) */
export function FinFileButton({ qid, file }: { qid: string; file: FinFileMeta }) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<{ url: string; type: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => () => (src ? URL.revokeObjectURL(src.url) : undefined), [src]);
  const show = async () => {
    setOpen(true);
    setErr(null);
    if (src) return;
    try {
      setSrc(await fetchFileObjectUrl(finFilePath(qid, file.id, file.kind)));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "เปิดไฟล์ไม่สำเร็จ");
    }
  };
  return (
    <>
      <Button size="small" startIcon={<AttachFileIcon />} onClick={show} data-testid="fin-file">
        {file.name || "ไฟล์แนบ"}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{file.name}</DialogTitle>
        <DialogContent>
          {err ? <Alert severity="error">{err}</Alert> : null}
          {!src && !err ? <Typography>กำลังโหลด…</Typography> : null}
          {src && src.type.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src.url} alt={file.name} style={{ maxWidth: "100%" }} data-testid="fin-file-preview" />
          ) : null}
          {src && !src.type.startsWith("image/") ? (
            <Box component="iframe" src={src.url} title={file.name} sx={{ width: "100%", height: "70vh", border: 0 }} data-testid="fin-file-preview" />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>ปิด</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export function FileList({ qid, ids, files }: { qid: string; ids: string[]; files: FinFileMeta[] }) {
  const list = ids.map((id) => files.find((f) => f.id === id)).filter(Boolean) as FinFileMeta[];
  if (!list.length) return <Typography variant="body2">—</Typography>;
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {list.map((f) => (
        <FinFileButton key={f.id} qid={qid} file={f} />
      ))}
    </Stack>
  );
}

const toUploads = (urls: string[], prefix: string) =>
  urls.map((dataUrl, i) => ({ name: `${prefix}-${i + 1}.${dataUrl.startsWith("data:application/pdf") ? "pdf" : "jpg"}`, dataUrl }));

// ---------------------------------------------------------------------------
// แบบฟอร์มแจ้งชำระ / แก้ไขแล้วส่งตรวจใหม่
// ---------------------------------------------------------------------------
export function PaymentDialog({
  qid,
  quotationNo,
  outstanding,
  resubmit,
  onClose,
  onSaved,
}: {
  qid: string;
  quotationNo: string;
  outstanding: number;
  /** ส่ง = แก้ไขรายการที่ไม่ผ่านแล้วส่งตรวจใหม่ */
  resubmit?: FinPayment | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const today = bangkokToday();
  const idem = useRef(newIdempotencyKey("pay"));
  const [amount, setAmount] = useState(resubmit ? String(resubmit.amount) : outstanding > 0 ? String(outstanding) : "");
  const [receivedDate, setReceivedDate] = useState(resubmit?.receivedDate ?? today);
  const [channel, setChannel] = useState<FinPaymentChannel>(resubmit?.channel ?? "TRANSFER");
  const [referenceNo, setReferenceNo] = useState(resubmit?.referenceNo ?? "");
  const [note, setNote] = useState(resubmit?.note ?? "");
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    const n = parseFinAmount(amount);
    if (n === null) return setErr("จำนวนเงินต้องมากกว่า 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง");
    if (!files.length && !referenceNo.trim() && !(resubmit?.evidenceFileIds?.length)) return setErr("ต้องแนบหลักฐานการชำระ หรือระบุเลขอ้างอิงการชำระ");
    setBusy(true);
    setErr(null);
    try {
      if (resubmit) {
        await financeApi.resubmit(qid, resubmit.id, {
          amount: n, receivedDate, channel, referenceNo: referenceNo.trim(), note: note.trim(), evidence: toUploads(files, "evidence"), keepEvidence: true, reason: reason.trim(),
        });
        onSaved(`ส่ง ${resubmit.paymentNo} ตรวจใหม่แล้ว`);
      } else {
        const r = await financeApi.recordPayment(qid, {
          amount: n, receivedDate, channel, referenceNo: referenceNo.trim(), note: note.trim(), evidence: toUploads(files, "evidence"), idempotencyKey: idem.current,
        });
        onSaved(`บันทึกแจ้งชำระ ${r.payment.paymentNo} แล้ว — รอบัญชีตรวจสอบ${r.warnings.length ? ` · ${r.warnings[0]}` : ""}`);
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{resubmit ? `แก้ไขและส่งตรวจใหม่ — ${resubmit.paymentNo}` : `บันทึกแจ้งชำระ — ${quotationNo}`}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {resubmit?.rejectReason ? <Alert severity="error">เหตุผลที่ไม่ผ่าน: {resubmit.rejectReason}</Alert> : null}
          <Typography variant="body2">ยอดคงเหลือตามยอดที่ยืนยันแล้ว: {fmtMoney(outstanding)} บาท · การบันทึกนี้ยังไม่นับเป็นยอดรับเงินจนกว่าบัญชีจะยืนยัน</Typography>
          <TextField label="จำนวนเงิน (บาท)" value={amount} onChange={(e) => setAmount(e.target.value)} inputProps={{ inputMode: "decimal", "data-testid": "pay-amount" }} required />
          <TextField label="วันที่รับเงิน" type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} inputProps={{ max: today, "data-testid": "pay-date" }} InputLabelProps={{ shrink: true }} required />
          <TextField select label="ช่องทาง" value={channel} onChange={(e) => setChannel(e.target.value as FinPaymentChannel)} SelectProps={{ inputProps: { "data-testid": "pay-channel" } }}>
            {(Object.keys(FIN_CHANNEL_LABEL) as FinPaymentChannel[]).map((c) => (
              <MenuItem key={c} value={c}>
                {FIN_CHANNEL_LABEL[c]}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="เลขอ้างอิง (เลขที่โอน / เลขเช็ค)" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} inputProps={{ "data-testid": "pay-ref" }} />
          <TextField label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
          {resubmit ? <TextField label="สิ่งที่แก้ไข" value={reason} onChange={(e) => setReason(e.target.value)} /> : null}
          <Box data-testid="pay-evidence">
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              หลักฐานการชำระ (สลิป / รูป / PDF){resubmit?.evidenceFileIds?.length ? ` — ไฟล์เดิม ${resubmit.evidenceFileIds.length} ไฟล์ยังเก็บไว้` : ""}
            </Typography>
            <BillEvidenceInput value={files} onChange={setFiles} max={5} label="แนบหลักฐาน" />
          </Box>
          {err ? <Alert severity="error">{err}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={save} disabled={busy} data-testid="pay-save">
          {busy ? "กำลังบันทึก…" : resubmit ? "ส่งตรวจใหม่" : "บันทึกแจ้งชำระ"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// บันทึกเอกสารบัญชีภายนอก
// ---------------------------------------------------------------------------
export function DocumentDialog({
  qid,
  payments,
  preselect,
  onClose,
  onSaved,
}: {
  qid: string;
  payments: FinPayment[];
  preselect?: string[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const today = bangkokToday();
  const idem = useRef(newIdempotencyKey("doc"));
  const [type, setType] = useState<AccDocType>("RECEIPT_TAX_INVOICE");
  const [docNo, setDocNo] = useState("");
  const [docDate, setDocDate] = useState(today);
  const [selected, setSelected] = useState<string[]>(preselect ?? []);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const eligible = payments.filter((p) => p.status === "VERIFIED" || p.status === "PENDING_VERIFICATION");

  const save = async () => {
    if (busy) return;
    if (!docNo.trim()) return setErr("ต้องระบุเลขที่เอกสาร");
    if (!files.length) return setErr("ต้องแนบไฟล์เอกสาร");
    setBusy(true);
    setErr(null);
    try {
      const r = await financeApi.recordDocument(qid, { type, docNo: docNo.trim(), docDate, paymentIds: selected, note: note.trim(), files: toUploads(files, "doc"), idempotencyKey: idem.current });
      onSaved(`บันทึก${ACC_DOC_TYPE_LABEL[r.document.type]} ${r.document.docNo} แล้ว (ยังไม่ส่งลูกค้า)`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>บันทึกเอกสารบัญชี (ออกนอก WOMS)</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">WOMS ไม่ออกใบเสร็จ/ใบกำกับภาษี — บันทึกเลขที่ วันที่ และไฟล์ที่ออกจากระบบบัญชี · การบันทึกไม่ยืนยันเงินและไม่ถือว่าส่งลูกค้าแล้ว</Alert>
          <TextField select label="ประเภทเอกสาร" value={type} onChange={(e) => setType(e.target.value as AccDocType)} SelectProps={{ inputProps: { "data-testid": "doc-type" } }}>
            {(Object.keys(ACC_DOC_TYPE_LABEL) as AccDocType[]).map((t) => (
              <MenuItem key={t} value={t}>
                {ACC_DOC_TYPE_LABEL[t]}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="เลขที่เอกสาร" value={docNo} onChange={(e) => setDocNo(e.target.value)} inputProps={{ "data-testid": "doc-no" }} required />
          <TextField label="วันที่เอกสาร" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} InputLabelProps={{ shrink: true }} required />
          <Box>
            <Typography variant="body2">รายการรับเงินที่เอกสารนี้อ้างอิง</Typography>
            {eligible.length ? (
              eligible.map((p) => (
                <FormControlLabel
                  key={p.id}
                  control={
                    <Checkbox
                      checked={selected.includes(p.id)}
                      onChange={(e) => setSelected(e.target.checked ? [...selected, p.id] : selected.filter((x) => x !== p.id))}
                      inputProps={{ "data-testid": `doc-pay-${p.paymentNo}` } as any}
                    />
                  }
                  label={`${p.paymentNo} · ${fmtMoney(p.amount)} บาท · ${FIN_PAYMENT_STATE_LABEL[p.status]}`}
                  sx={{ display: "flex" }}
                />
              ))
            ) : (
              <Typography variant="body2">— ไม่มีรายการที่อ้างอิงได้ (เอกสารระดับใบเสนอราคา)</Typography>
            )}
          </Box>
          <TextField label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} />
          <Box data-testid="doc-files">
            <BillEvidenceInput value={files} onChange={setFiles} max={5} label="แนบไฟล์เอกสาร" />
          </Box>
          {err ? <Alert severity="error">{err}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={save} disabled={busy} data-testid="doc-save">
          {busy ? "กำลังบันทึก…" : "บันทึกเอกสาร"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function DeliveryDialog({ qid, doc, onClose, onSaved }: { qid: string; doc: AccDocument; onClose: () => void; onSaved: (msg: string) => void }) {
  const today = bangkokToday();
  const [sentDate, setSentDate] = useState(today);
  const [channel, setChannel] = useState<DeliveryChannel>("EMAIL");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await financeApi.recordDelivery(qid, doc.id, { sentDate, channel, note: note.trim() });
      onSaved(`บันทึกส่ง ${doc.docNo} ให้ลูกค้าแล้ว`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>บันทึกการส่งเอกสาร {doc.docNo} ให้ลูกค้า</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2">ระบบไม่ส่งเอกสารให้ลูกค้าเอง — บันทึกว่าส่งแล้วทางใด เมื่อใด</Typography>
          <TextField label="วันที่ส่ง" type="date" value={sentDate} onChange={(e) => setSentDate(e.target.value)} inputProps={{ max: today }} InputLabelProps={{ shrink: true }} />
          <TextField select label="ช่องทาง" value={channel} onChange={(e) => setChannel(e.target.value as DeliveryChannel)} SelectProps={{ inputProps: { "data-testid": "delivery-channel" } }}>
            {(Object.keys(DELIVERY_CHANNEL_LABEL) as DeliveryChannel[]).map((c) => (
              <MenuItem key={c} value={c}>
                {DELIVERY_CHANNEL_LABEL[c]}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="หมายเหตุ (เช่น อีเมลผู้รับ)" value={note} onChange={(e) => setNote(e.target.value)} />
          {err ? <Alert severity="error">{err}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={save} disabled={busy} data-testid="delivery-save">
          บันทึกการส่ง
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// บันทึกผลลูกค้า (อนุมัติ) — หลักฐานหรือหมายเหตุ
// ---------------------------------------------------------------------------
export function ApprovalDialog({
  title,
  onClose,
  onSubmit,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (v: { reason: string; approvalDate: string; evidence: { name: string; dataUrl: string }[] }) => Promise<void>;
}) {
  const today = bangkokToday();
  const [reason, setReason] = useState("");
  const [approvalDate, setApprovalDate] = useState(today);
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!reason.trim() && !files.length) return setErr("ต้องแนบหลักฐาน หรือระบุหมายเหตุ (ช่องทางและผู้แจ้งผล)");
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({ reason: reason.trim(), approvalDate, evidence: toUploads(files, "approval") });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2">ลูกค้าไม่มีบัญชีใน WOMS — บันทึกผลที่ได้รับทางช่องทางภายนอก พร้อมหลักฐานหรือหมายเหตุ</Typography>
          <TextField label="วันที่ลูกค้าแจ้งผล" type="date" value={approvalDate} onChange={(e) => setApprovalDate(e.target.value)} inputProps={{ max: today }} InputLabelProps={{ shrink: true }} />
          <TextField label="หมายเหตุ (ช่องทาง / ผู้แจ้ง)" value={reason} onChange={(e) => setReason(e.target.value)} multiline minRows={2} inputProps={{ "data-testid": "approval-note" }} />
          <BillEvidenceInput value={files} onChange={setFiles} max={5} label="แนบหลักฐานการอนุมัติ" />
          {err ? <Alert severity="error">{err}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={save} disabled={busy} data-testid="approval-save">
          บันทึกลูกค้าอนุมัติ
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function MoneyStat({ label, value, testId }: { label: string; value: number; testId?: string }) {
  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5, minWidth: 140 }}>
      <Typography variant="caption">{label}</Typography>
      <Typography sx={{ fontWeight: 700, color: "text.primary" }} className="mono" data-testid={testId}>
        {fmtMoney(value)}
      </Typography>
    </Box>
  );
}
