"use client";

// D-11 Financial Workflow v1.0 — แท็บการเงินของหน้ารายละเอียดใบเสนอราคา
// แยกส่วน: รายการรับเงิน (+ ประวัติแต่ละรายการ) / เอกสารบัญชี + การส่งลูกค้า · ปุ่มตามสิทธิ์และสถานะ
// ACC ที่ตรวจเงินและออกเอกสารภายนอกแล้ว ยืนยันรับเงินและแนบเอกสารได้ในหน้าเดียวกัน (ข้อมูลยังแยกรายการ)
import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import AddIcon from "@mui/icons-material/Add";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { bangkokDateTime } from "@/lib/date";
import { fmtMoney } from "@/lib/options";
import { WomsFormSection } from "@/components/woms";
import {
  ACC_DOC_EXTERNAL_STATUS_LABEL,
  FIN_CHANNEL_LABEL,
  FIN_EXCEPTION_LABEL,
  FIN_PAYMENT_STATE_LABEL,
  DELIVERY_CHANNEL_LABEL,
  canRecordPayment,
  canRecordReplacement,
  canRequestDocCancel,
  checkerBlockReason,
  paymentActions,
  type AccDocExternalStatus,
} from "@/lib/financeRules";
import { financeApi, type AccDocument, type FinanceDetail, type FinPayment } from "@/lib/financeApi";
import {
  AggStateChip,
  DeliveryDialog,
  DocCancelDialog,
  DocumentDialog,
  ExceptionAlerts,
  FileList,
  MoneyStat,
  PaymentDialog,
  PaymentStateChip,
} from "./FinParts";

const ACTION_LABEL: Record<string, string> = {
  RECORD: "บันทึกแจ้งชำระ",
  VERIFY: "ยืนยันรับเงิน",
  REJECT: "ไม่ผ่านการตรวจสอบ",
  RESUBMIT: "แก้ไขแล้วส่งตรวจใหม่",
  VOID: "ยกเลิกรายการ",
};

export default function QuotationFinancePanel({ qid, section, onChanged }: { qid: string; section: "payments" | "documents"; onChanged?: () => void }) {
  const { has, user } = useAuth();
  const toast = useToast();
  const dialog = useDialog();
  const [d, setD] = useState<FinanceDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [resubmit, setResubmit] = useState<FinPayment | null>(null);
  const [docOpen, setDocOpen] = useState<string[] | null>(null);
  const [delivery, setDelivery] = useState<AccDocument | null>(null);
  const [cancelDoc, setCancelDoc] = useState<AccDocument | null>(null);
  const [replaceDoc, setReplaceDoc] = useState<AccDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [openHistory, setOpenHistory] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setD(await financeApi.detail(qid));
      setErr(null);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "โหลดข้อมูลการเงินไม่สำเร็จ");
    }
  }, [qid]);
  useEffect(() => {
    load();
  }, [load]);

  const done = (msg: string) => {
    setPayOpen(false);
    setResubmit(null);
    setDocOpen(null);
    setDelivery(null);
    setCancelDoc(null);
    setReplaceDoc(null);
    toast.success(msg);
    load();
    onChanged?.();
  };

  const act = async (p: FinPayment, verb: "verify" | "reject" | "void") => {
    if (busy) return;
    let reason = "";
    if (verb === "verify") {
      const ok = await dialog.confirm({ title: `ยืนยันรับเงิน ${p.paymentNo}?`, message: `ยอด ${fmtMoney(p.amount)} บาท — ยืนยันว่าเงินเข้าบัญชีแล้ว`, confirmLabel: "ยืนยันรับเงิน" });
      if (!ok) return;
    } else {
      const v = await dialog.prompt({
        title: verb === "reject" ? `ไม่ผ่านการตรวจสอบ — ${p.paymentNo}` : `ยกเลิกรายการที่เคยยืนยัน — ${p.paymentNo}`,
        label: "เหตุผล",
        required: true,
        message: verb === "void" ? "ใช้เมื่อบันทึกผิดเท่านั้น — ไม่ใช่การคืนเงินจริง ยอดรวมจะคำนวณใหม่และเก็บประวัติไว้" : "ผู้บันทึกจะได้รับแจ้งเหตุผลเพื่อแก้ไขแล้วส่งตรวจใหม่",
        confirmLabel: verb === "reject" ? "ไม่ผ่าน" : "ยกเลิกรายการ",
        danger: true,
      });
      if (!v) return;
      reason = v.trim();
    }
    setBusy(true);
    try {
      await financeApi.act(qid, p.id, verb, reason);
      done(verb === "verify" ? `ยืนยันรับเงิน ${p.paymentNo} แล้ว` : verb === "reject" ? `บันทึกไม่ผ่าน ${p.paymentNo} แล้ว` : `ยกเลิก ${p.paymentNo} แล้ว`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ดำเนินการไม่สำเร็จ");
      load();
    } finally {
      setBusy(false);
    }
  };

  // P-03: ผู้บันทึก/ผู้ส่งตรวจใหม่ ยืนยัน/ไม่ผ่านรายการตัวเองไม่ได้ (backend ตรวจจริง)
  const blockOf = (p: FinPayment) => checkerBlockReason(p, user?.id);

  if (err) return <Alert severity="error">{err}</Alert>;
  if (!d) return <Typography>กำลังโหลดข้อมูลการเงิน…</Typography>;
  const s = d.summary;
  const q = d.quotation;

  const summaryBlock = (
    <>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }} data-testid="fin-summary">
        <MoneyStat label="ยอดที่ต้องชำระ" value={s.amountDue} testId="fin-due" />
        <MoneyStat label="ยอดยืนยันรับแล้ว" value={s.verifiedTotal} testId="fin-verified" />
        <MoneyStat label="ยอดคงเหลือ" value={s.outstanding} testId="fin-outstanding" />
        <MoneyStat label={`รอตรวจ (${s.pendingCount} รายการ)`} value={s.pendingTotal} testId="fin-pending" />
        <Box sx={{ alignSelf: "center" }}>
          <AggStateChip summary={s} />
        </Box>
      </Stack>
      <ExceptionAlerts summary={s} />
    </>
  );

  if (section === "documents") {
    return (
      <WomsFormSection title="เอกสารบัญชีและการส่งลูกค้า">
        {summaryBlock}
        <Typography variant="body2" sx={{ mb: 1 }}>
          เอกสาร {s.documentCount} ฉบับ · ส่งลูกค้าแล้ว {s.deliveredDocumentCount} ฉบับ · รายการที่ยืนยันแล้วแต่ยังไม่มีเอกสาร {s.verifiedWithoutDocCount} รายการ
          {s.cancelledDocumentCount ? ` · ยกเลิก/แก้ไขแล้ว ${s.cancelledDocumentCount} ฉบับ` : ""}
        </Typography>
        {has("accounting_docs:record") ? (
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setDocOpen([])} sx={{ mb: 2 }} data-testid="doc-add">
            บันทึกเอกสารบัญชี
          </Button>
        ) : null}
        <Stack spacing={1}>
          {d.documents.length === 0 ? <Typography variant="body2">ยังไม่มีเอกสารบัญชี (รอเอกสารบัญชี)</Typography> : null}
          {d.documents.map((doc) => {
            const cancelled = doc.status === "CANCELLED";
            const replacement = doc.replacedByDocumentId ? d.documents.find((x) => x.id === doc.replacedByDocumentId) : null;
            const replaced = doc.replacesDocumentId ? d.documents.find((x) => x.id === doc.replacesDocumentId) : null;
            return (
            <Box
              key={doc.id}
              sx={{ border: 1, borderColor: cancelled ? "warning.main" : "divider", borderRadius: 1, p: 1.5, bgcolor: cancelled ? "action.hover" : undefined }}
              data-testid="doc-row"
              data-docno={doc.docNo}
              data-status={doc.status}
            >
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography sx={{ fontWeight: 600, color: cancelled ? "text.secondary" : "text.primary", textDecoration: cancelled ? "line-through" : "none" }} data-testid="doc-title">
                  {doc.typeLabel} <span className="code">{doc.docNo}</span>
                </Typography>
                <Chip size="small" color={cancelled ? "warning" : "success"} label={doc.statusLabel} data-testid="doc-status" />
                {!cancelled ? (
                  <Chip size="small" color={doc.delivery.sent ? "success" : "default"} variant={doc.delivery.sent ? "filled" : "outlined"} label={doc.delivery.sent ? "ส่งลูกค้าแล้ว" : "ยังไม่ส่งลูกค้า"} data-testid="doc-delivery" />
                ) : null}
                {doc.pendingCancellation ? (
                  <Chip size="small" color="warning" variant="outlined" label={`รออนุมัติยกเลิก/แก้ไข (${doc.pendingCancellation.requestNo})`} data-testid="doc-pending-cancel" />
                ) : null}
              </Stack>
              {doc.pendingCancellation ? (
                <Typography variant="body2" data-testid="doc-pending-detail">
                  คำขอโดย {doc.pendingCancellation.requestedBy} {bangkokDateTime(doc.pendingCancellation.requestedAt)} · {ACC_DOC_EXTERNAL_STATUS_LABEL[doc.pendingCancellation.externalStatus as AccDocExternalStatus] ?? doc.pendingCancellation.externalStatus} · เหตุผล: {doc.pendingCancellation.reason} — เอกสารยังไม่เปลี่ยนจนกว่า Manager จะอนุมัติ
                </Typography>
              ) : null}
              {cancelled && doc.cancellation ? (
                <Alert severity="warning" sx={{ my: 0.5 }} data-testid="doc-cancellation">
                  บันทึกว่าเอกสารนี้ถูกยกเลิก/แก้ไขในระบบบัญชีภายนอกแล้ว: {ACC_DOC_EXTERNAL_STATUS_LABEL[doc.cancellation.externalStatus] ?? doc.cancellation.externalStatus}
                  {doc.cancellation.externalReference ? ` · อ้างอิง ${doc.cancellation.externalReference}` : ""} · เหตุผล: {doc.cancellation.reason} · ขอโดย {doc.cancellation.requestedBy} · อนุมัติโดย {doc.cancellation.approvedBy}{" "}
                  {bangkokDateTime(doc.cancellation.approvedAt)}
                  {doc.cancellation.requestNo ? ` (${doc.cancellation.requestNo})` : ""}
                  {replacement ? ` · เอกสารแทน: ${replacement.docNo}` : doc.cancellation.replacementPlanned ? " · รอบันทึกเอกสารแทน" : ""}
                </Alert>
              ) : null}
              {replaced ? (
                <Typography variant="body2" data-testid="doc-replaces-info">
                  บันทึกแทน {replaced.typeLabel} {replaced.docNo} ที่ยกเลิกแล้ว
                </Typography>
              ) : null}
              <Typography variant="body2">
                วันที่ <span className="mono">{doc.docDate}</span> · อ้างอิง {doc.paymentNos.length ? doc.paymentNos.join(", ") : "ทั้งใบเสนอราคา"} · บันทึกโดย {doc.recordedBy} {bangkokDateTime(doc.recordedAt)}
              </Typography>
              {doc.delivery.sent ? (
                <Typography variant="body2">
                  ส่งลูกค้า {doc.delivery.sentDate} ทาง {DELIVERY_CHANNEL_LABEL[doc.delivery.channel as keyof typeof DELIVERY_CHANNEL_LABEL] ?? doc.delivery.channel} · บันทึกโดย {doc.delivery.recordedBy}
                  {doc.delivery.note ? ` · ${doc.delivery.note}` : ""}
                </Typography>
              ) : null}
              <FileList qid={qid} ids={doc.fileIds} files={d.files} />
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                {!cancelled && !doc.delivery.sent && has("accounting_docs:record") ? (
                  <Button size="small" variant="outlined" onClick={() => setDelivery(doc)} data-testid="doc-deliver">
                    บันทึกส่งลูกค้า
                  </Button>
                ) : null}
                {canRequestDocCancel(doc, has) ? (
                  <Button size="small" color="warning" onClick={() => setCancelDoc(doc)} data-testid="doc-cancel">
                    ขอยกเลิก/แก้ไขเอกสาร
                  </Button>
                ) : null}
                {canRecordReplacement(doc, has) ? (
                  <Button size="small" variant="outlined" onClick={() => setReplaceDoc(doc)} data-testid="doc-replace">
                    บันทึกเอกสารแทน
                  </Button>
                ) : null}
              </Stack>
            </Box>
            );
          })}
        </Stack>
        {docOpen ? <DocumentDialog qid={qid} payments={d.payments} preselect={docOpen} onClose={() => setDocOpen(null)} onSaved={done} /> : null}
        {replaceDoc ? <DocumentDialog qid={qid} payments={d.payments} replaces={replaceDoc} onClose={() => setReplaceDoc(null)} onSaved={done} /> : null}
        {cancelDoc ? <DocCancelDialog qid={qid} doc={cancelDoc} isApprover={has("changes:approve")} onClose={() => setCancelDoc(null)} onSaved={done} /> : null}
        {delivery ? <DeliveryDialog qid={qid} doc={delivery} onClose={() => setDelivery(null)} onSaved={done} /> : null}
      </WomsFormSection>
    );
  }

  return (
    <WomsFormSection title="รายการรับเงิน">
      {summaryBlock}
      {canRecordPayment(q.status, has) ? (
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setPayOpen(true)} sx={{ mb: 2 }} data-testid="pay-add">
          บันทึกแจ้งชำระ
        </Button>
      ) : has("payments:record") ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          บันทึกแจ้งชำระได้เมื่อลูกค้าอนุมัติใบเสนอราคา (Revision ปัจจุบัน) แล้ว
        </Alert>
      ) : null}
      <Stack spacing={1}>
        {d.payments.length === 0 ? <Typography variant="body2">ยังไม่มีรายการรับเงิน</Typography> : null}
        {d.payments.map((p) => (
          <Box key={p.id} sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }} data-testid="payment-row" data-payno={p.paymentNo}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <span className="code">{p.paymentNo}</span>
              <Typography sx={{ fontWeight: 700, color: "text.primary" }} className="mono">
                {fmtMoney(p.amount)} บาท
              </Typography>
              <PaymentStateChip status={p.status} />
              <Chip size="small" variant="outlined" label={`Rev.${p.revision}`} />
              <Chip size="small" variant="outlined" label={p.docStatusLabel} />
            </Stack>
            <Typography variant="body2">
              รับเงิน <span className="mono">{p.receivedDate}</span> · {FIN_CHANNEL_LABEL[p.channel] ?? p.channel}
              {p.referenceNo ? ` · อ้างอิง ${p.referenceNo}` : ""} · บันทึกโดย {p.recordedBy} {bangkokDateTime(p.recordedAt)}
            </Typography>
            {p.verifiedBy ? <Typography variant="body2">ยืนยันโดย {p.verifiedBy} {bangkokDateTime(p.verifiedAt)}</Typography> : null}
            {p.status === "REJECTED" ? (
              <Alert severity="error" sx={{ my: 0.5 }} data-testid="reject-reason">
                ไม่ผ่าน: {p.rejectReason} ({p.rejectedBy} {bangkokDateTime(p.rejectedAt)})
              </Alert>
            ) : null}
            {p.status === "VOIDED" ? (
              <Alert severity="warning" sx={{ my: 0.5 }}>
                ยกเลิกรายการ (ไม่ใช่การคืนเงิน): {p.voidReason} ({p.voidedBy} {bangkokDateTime(p.voidedAt)})
              </Alert>
            ) : null}
            {p.note ? <Typography variant="body2">หมายเหตุ: {p.note}</Typography> : null}
            {(p.exceptions ?? []).includes("CONFLICTING_REFERENCE") ? (
              <Alert severity="warning" sx={{ my: 0.5 }} data-testid="pay-conflict">
                {FIN_EXCEPTION_LABEL.CONFLICTING_REFERENCE}: {(p.conflictingPayments ?? []).map((c) => `${c.paymentNo} (${c.quotationNo})`).join(", ")}
              </Alert>
            ) : null}
            <FileList qid={qid} ids={p.evidenceFileIds} files={d.files} />
            {blockOf(p) && paymentActions(p.status, has).includes("verify") ? (
              <Typography variant="body2" color="warning.main" data-testid="pay-maker-note">
                {blockOf(p)}
              </Typography>
            ) : null}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
              {paymentActions(p.status, has).map((a) =>
                a === "resubmit" ? (
                  <Button key={a} size="small" variant="outlined" onClick={() => setResubmit(p)}>
                    แก้ไขและส่งตรวจใหม่
                  </Button>
                ) : (
                  <Button
                    key={a}
                    size="small"
                    variant={a === "verify" ? "contained" : "outlined"}
                    color={a === "verify" ? "success" : "error"}
                    disabled={busy || ((a === "verify" || a === "reject") && !!blockOf(p))}
                    title={(a === "verify" || a === "reject") && blockOf(p) ? blockOf(p) ?? undefined : undefined}
                    onClick={() => act(p, a)}
                    data-testid={`pay-${a}`}
                  >
                    {a === "verify" ? "ยืนยันรับเงิน" : a === "reject" ? "ไม่ผ่าน" : "ยกเลิกรายการ"}
                  </Button>
                )
              )}
              {has("accounting_docs:record") && (p.status === "VERIFIED" || p.status === "PENDING_VERIFICATION") ? (
                <Button size="small" onClick={() => setDocOpen([p.id])}>
                  แนบเอกสารบัญชี
                </Button>
              ) : null}
              <Button size="small" onClick={() => setOpenHistory(openHistory === p.id ? null : p.id)}>
                ประวัติ ({p.history.length})
              </Button>
            </Stack>
            {openHistory === p.id ? (
              <Box sx={{ mt: 1, pl: 1, borderLeft: 2, borderColor: "divider" }} data-testid="payment-history">
                {p.history.map((h, i) => (
                  <Typography key={i} variant="body2">
                    <span className="mono">{bangkokDateTime(h.at)}</span> · {h.byName} — {ACTION_LABEL[h.action] ?? h.action} ({h.fromStatus ? `${FIN_PAYMENT_STATE_LABEL[h.fromStatus]} → ` : ""}
                    {FIN_PAYMENT_STATE_LABEL[h.toStatus]}){h.reason ? ` · ${h.reason}` : ""}
                    {h.before ? ` · ก่อนแก้: ${fmtMoney(h.before.amount)} บาท ${h.before.receivedDate} อ้างอิง ${h.before.referenceNo || "—"}` : ""}
                  </Typography>
                ))}
              </Box>
            ) : null}
          </Box>
        ))}
      </Stack>
      {payOpen || resubmit ? (
        <PaymentDialog qid={qid} quotationNo={q.quotationNo} outstanding={s.outstanding} resubmit={resubmit} onClose={() => { setPayOpen(false); setResubmit(null); }} onSaved={done} />
      ) : null}
      {docOpen ? <DocumentDialog qid={qid} payments={d.payments} preselect={docOpen} onClose={() => setDocOpen(null)} onSaved={done} /> : null}
    </WomsFormSection>
  );
}
