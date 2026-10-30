"use client";

// D-11 Financial Workflow v1.0 หัวข้อ 6 — หน้ารอตรวจสอบสำหรับบัญชี
// แสดง PENDING_VERIFICATION · เปิดดูหลักฐานและใบเสนอราคาที่อ้างอิงได้ · ปุ่ม "ยืนยันรับเงิน" และ "ไม่ผ่าน" (ต้องระบุเหตุผล)
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { bangkokDateTime } from "@/lib/date";
import { fmtMoney } from "@/lib/options";
import { FIN_CHANNEL_LABEL } from "@/lib/financeRules";
import { financeApi, type FinFileMeta, type FinPayment, type FinanceRow } from "@/lib/financeApi";
import { AggStateChip, FileList } from "@/components/finance/FinParts";
import { WomsEmptyState, WomsErrorState, WomsLoadingState, WomsPageHeader } from "@/components/woms";
import { WomsPermissionGate } from "@/components/woms/WomsPermissionGate";

function QueueInner() {
  const { has } = useAuth();
  const toast = useToast();
  const dialog = useDialog();
  const canVerify = has("payments:verify");
  const [items, setItems] = useState<{ payment: FinPayment; quotation: FinanceRow | null }[] | null>(null);
  const [files, setFiles] = useState<FinFileMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await financeApi.queue();
      setItems(r.items);
      setFiles(r.files);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const decide = async (p: FinPayment, verb: "verify" | "reject") => {
    if (busy) return;
    let reason = "";
    if (verb === "verify") {
      if (!(await dialog.confirm({ title: `ยืนยันรับเงิน ${p.paymentNo}?`, message: `${p.quotationNo} · ${fmtMoney(p.amount)} บาท — ยืนยันว่าเงินเข้าบัญชีแล้ว`, confirmLabel: "ยืนยันรับเงิน" }))) return;
    } else {
      const v = await dialog.prompt({ title: `ไม่ผ่านการตรวจสอบ — ${p.paymentNo}`, label: "เหตุผล", required: true, confirmLabel: "ไม่ผ่าน", danger: true, message: "ผู้บันทึกและ Admin ผู้รับผิดชอบจะได้รับแจ้งเหตุผล" });
      if (!v) return;
      reason = v.trim();
    }
    setBusy(p.id);
    try {
      await financeApi.act(p.quotationId, p.id, verb, reason);
      toast.success(verb === "verify" ? `ยืนยันรับเงิน ${p.paymentNo} แล้ว` : `บันทึกไม่ผ่าน ${p.paymentNo} แล้ว`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy(null);
      load();
    }
  };

  return (
    <>
      <WomsPageHeader
        title="รอตรวจสอบเงินเข้า"
        subtitle={items ? `${items.length} รายการรอบัญชีตรวจสอบ` : "กำลังโหลด…"}
        actions={
          <Button component={Link} href="/finance" variant="outlined">
            สถานะรับชำระทั้งหมด
          </Button>
        }
      />
      {!canVerify ? <Alert severity="info" sx={{ mb: 2 }}>ดูได้อย่างเดียว — การยืนยัน/ไม่ผ่าน ทำได้เฉพาะบัญชี (ACC) และผู้มีสิทธิ์</Alert> : null}
      {error ? <WomsErrorState message={error} onRetry={load} /> : null}
      {!items && !error ? <WomsLoadingState rows={4} /> : null}
      {items && items.length === 0 ? <WomsEmptyState title="ไม่มีรายการรอตรวจสอบ" /> : null}
      <Stack spacing={1.5}>
        {(items ?? []).map(({ payment: p, quotation: q }) => (
          <Box key={p.id} sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2 }} data-testid="queue-row" data-payno={p.paymentNo}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
              <Box>
                <Typography sx={{ fontWeight: 700, color: "text.primary" }}>
                  <span className="code">{p.paymentNo}</span> · <span className="mono">{fmtMoney(p.amount)}</span> บาท
                </Typography>
                <Typography variant="body2">
                  ใบเสนอราคา{" "}
                  <Link href={`/quotations/${p.quotationId}?tab=payments`} className="code" data-testid="queue-quotation-link">
                    {p.quotationNo}
                  </Link>{" "}
                  Rev.{p.revision} · {q?.customerName ?? ""}
                </Typography>
                <Typography variant="body2">
                  รับเงิน <span className="mono">{p.receivedDate}</span> · {FIN_CHANNEL_LABEL[p.channel]}
                  {p.referenceNo ? ` · อ้างอิง ${p.referenceNo}` : ""} · บันทึกโดย {p.recordedBy} {bangkokDateTime(p.recordedAt)}
                </Typography>
                {p.note ? <Typography variant="body2">หมายเหตุ: {p.note}</Typography> : null}
                {q ? (
                  <Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
                    ต้องชำระ {fmtMoney(q.summary.amountDue)} · ยืนยันแล้ว {fmtMoney(q.summary.verifiedTotal)} · คงเหลือ {fmtMoney(q.summary.outstanding)} <AggStateChip summary={q.summary} />
                  </Typography>
                ) : null}
                <Box sx={{ mt: 0.5 }}>
                  <FileList qid={p.quotationId} ids={p.evidenceFileIds} files={files} />
                </Box>
              </Box>
              {canVerify ? (
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Button variant="contained" color="success" disabled={!!busy} onClick={() => decide(p, "verify")} data-testid="queue-verify">
                    ยืนยันรับเงิน
                  </Button>
                  <Button variant="outlined" color="error" disabled={!!busy} onClick={() => decide(p, "reject")} data-testid="queue-reject">
                    ไม่ผ่าน
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          </Box>
        ))}
      </Stack>
    </>
  );
}

export default function FinanceQueuePage() {
  return (
    <WomsPermissionGate perm="finance:view">
      <QueueInner />
    </WomsPermissionGate>
  );
}
