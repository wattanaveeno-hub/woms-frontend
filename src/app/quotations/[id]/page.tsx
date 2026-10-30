"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError, downloadFile, request } from "@/lib/api";
import { quotationEditable } from "@/lib/quotationRules";
import { bangkokDateTime } from "@/lib/date";
import EditIcon from "@mui/icons-material/Edit";
import type { Quotation, QuotationStatus } from "@/lib/types";
import { quotationStatusLabel, quotationTransitions, fmtMoney } from "@/lib/options";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { useAuth } from "@/lib/AuthContext";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import QuotationOpenJobDialog from "@/components/QuotationOpenJobDialog";
import QuotationFinancePanel from "@/components/finance/QuotationFinancePanel";
import { ApprovalDialog, FinFileButton } from "@/components/finance/FinParts";
import { financeApi } from "@/lib/financeApi";
import { quotationStatusNeedsInput } from "@/lib/financeRules";
import { ApprovalPendingError } from "@/lib/api";
import { QUOTATION_LINE_KIND_LABEL, quotationLineText } from "@/lib/contractQuoApi";
import {
  QuotationStatusChip,
  WomsDataTable,
  WomsErrorState,
  WomsFormSection,
  WomsLoadingState,
  WomsPageHeader,
  WomsStatCard,
  WomsStatGrid,
  type WomsColumn,
} from "@/components/woms";

type QLine = Quotation["lines"][number] & { _total: number };

/** ข้อความบนปุ่มของแต่ละสถานะปลายทาง */
const STATUS_ACTION_LABEL: Record<QuotationStatus, string> = {
  DRAFT: "กลับเป็นร่าง",
  SENT: "ยืนยันส่งลูกค้าแล้ว",
  ACCEPTED: "บันทึกลูกค้าอนุมัติ",
  REJECTED: "บันทึกลูกค้าไม่อนุมัติ",
  EXPIRED: "หมดอายุ",
  CANCELLED: "ยกเลิกใบเสนอราคา",
};

export default function QuotationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();
  // ปุ่มแสดงตามสิทธิ์เดียวกับที่ backend บังคับ (เดิมแสดงปุ่มเปลี่ยนสถานะ/ลบ/PDF ให้ทุกคน แล้วไปโดน 403)
  const { has } = useAuth();
  const canStatus = has("quotations:status");
  const canDelete = has("quotations:delete");
  const canPrint = has("quotations:print");
  // FB-21 แก้ไขตามสิทธิ์และสถานะที่ตกลง
  const canEdit = has("quotations:edit");
  const [history, setHistory] = useState<{ at: string; actorName: string; action: string; summary: string; changes: { field: string; before: string; after: string }[] }[]>([]);
  // QUO-01 — เปิดงานได้เมื่อมีทั้งสิทธิ์เปิดใบงานและสิทธิ์จัดการสถานะใบเสนอราคา (ตรงกับ backend)
  const canOpenJob = has("jobs:create") && has("quotations:status");
  const [openJob, setOpenJob] = useState(false);
  // สัญญาที่ทำจากใบนี้ — ใบเสนอราคาเช่า/ขายที่ตอบรับแล้วต้องไปต่อเป็นสัญญาได้ และลิงก์ถึงกัน
  const canContract = has("contracts:create");
  const [contracts, setContracts] = useState<{ id: string; contractNo: string; statusLabel?: string; status: string }[]>([]);
  useEffect(() => {
    if (!has("contracts:view")) return;
    api
      .listContracts({ quotationId: id })
      .then((r) => setContracts(r.items))
      .catch(() => setContracts([]));
  }, [id, has]);

  // D-11: แยกส่วน ใบเสนอราคา / ผลอนุมัติ / รายการรับเงิน / เอกสารบัญชี / ประวัติ — แท็บการเงินเฉพาะผู้มี finance:view
  const canFinance = has("finance:view");
  type TabKey = "quote" | "approval" | "payments" | "documents" | "history";
  const [tab, setTab] = useState<TabKey>("quote");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && ["quote", "approval", "payments", "documents", "history"].includes(t)) setTab(t as TabKey);
  }, []);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [x, setX] = useState<Quotation | null>(null);
  const [acting, setActing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setX(await api.getQuotation(id));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const [finTick, setFinTick] = useState(0);
  useEffect(() => {
    // ผู้มี finance:view เห็นประวัติรวม (ใบเสนอราคา + รายการรับเงิน + เอกสารบัญชี)
    (canFinance
      ? financeApi.history(id)
      : request<{ items: typeof history }>(`/api/quotations/${encodeURIComponent(id)}/history`)
    )
      .then((r) => setHistory(r.items))
      .catch(() => setHistory([]));
  }, [id, x?.updatedAt, canFinance, finTick]);

  const changeStatus = async (status: QuotationStatus, extra: { reason?: string; approvalDate?: string; evidence?: { name: string; dataUrl: string }[] } = {}) => {
    if (!x || acting) return;
    const need = quotationStatusNeedsInput(status);
    // D-11 4.1: ลูกค้าอนุมัติต้องมีหลักฐาน/หมายเหตุ → กล่องบันทึกผล
    if (need === "approval" && !extra.reason && !extra.evidence?.length) {
      setApprovalOpen(true);
      return;
    }
    // D-11 4.1: ไม่อนุมัติ / ยกเลิก ต้องมีเหตุผล
    if (need === "reason" && !extra.reason) {
      const reason = await dialog.prompt({
        title: status === "CANCELLED" ? `ยกเลิกใบเสนอราคา ${x.quotationNo}?` : `บันทึกลูกค้าไม่อนุมัติ ${x.quotationNo}`,
        label: "เหตุผล",
        required: true,
        message: status === "CANCELLED" ? "ใบที่ยกเลิกแล้วเปลี่ยนสถานะต่อไม่ได้อีก · รายการรับเงินที่มีอยู่ไม่ถูกยกเลิกตาม" : "เสนอใหม่ได้โดยสร้าง Revision ใหม่",
        confirmLabel: status === "CANCELLED" ? "ยืนยันยกเลิก" : "บันทึก",
        danger: status === "CANCELLED",
      });
      if (!reason) return;
      extra = { ...extra, reason: reason.trim() };
    }
    if (status === "SENT") {
      const ok = await dialog.confirm({ title: `ยืนยันว่าส่ง ${x.quotationNo} Rev.${x.revision ?? 1} ให้ลูกค้าแล้ว?`, message: "ระบบเก็บฉบับที่ส่งไว้ · การแก้ไขหลังส่งจะสร้าง Revision ใหม่", confirmLabel: "ยืนยันส่งแล้ว" });
      if (!ok) return;
    }
    setActing(true);
    try {
      const updated = await financeApi.setStatus(id, { status, updatedAt: x.updatedAt, ...extra });
      setX(updated);
      setApprovalOpen(false);
      toast.success("อัปเดตสถานะแล้ว");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error(e.message);
        load();
      } else {
        toast.error(e instanceof ApiError ? e.message : "อัปเดตไม่สำเร็จ");
      }
      if (need === "approval") throw e;
    } finally {
      setActing(false);
    }
  };

  const revise = async () => {
    if (!x || acting) return;
    const ok = await dialog.confirm({
      title: `สร้าง Revision ${(x.revision ?? 1) + 1} ของ ${x.quotationNo}?`,
      message: "ฉบับปัจจุบันถูกเก็บไว้ไม่แก้ทับ · Revision ใหม่เป็นร่าง ต้องส่งให้ลูกค้าอนุมัติใหม่ · รายการรับเงินเดิมยังอ้างอิงฉบับเดิม",
      confirmLabel: "สร้าง Revision",
    });
    if (!ok) return;
    setActing(true);
    try {
      setX(await financeApi.revise(id, x.updatedAt));
      toast.success("สร้าง Revision ใหม่แล้ว");
    } catch (e) {
      if (e instanceof ApprovalPendingError) toast.info(e.message);
      else toast.error(e instanceof ApiError ? e.message : "สร้าง Revision ไม่สำเร็จ");
    } finally {
      setActing(false);
    }
  };

  const unlinkJob = async () => {
    if (!x || acting || !x.jobId) return;
    const reason = await dialog.prompt({
      title: `ปลดการผูกใบงาน ${x.jobId}`,
      label: "เหตุผล",
      required: true,
      message: "ใบงานไม่ถูกยกเลิกหรือเปลี่ยนสถานะ · ประวัติการผูกถูกเก็บไว้ · Admin = ส่งคำขอให้ Manager อนุมัติ (Q-R3-11)",
      confirmLabel: "ปลดการผูก",
      danger: true,
    });
    if (!reason) return;
    setActing(true);
    try {
      setX(await financeApi.unlinkJob(id, { jobId: x.jobId, reason: reason.trim(), updatedAt: x.updatedAt }));
      toast.success("ปลดการผูกใบงานแล้ว");
    } catch (e) {
      if (e instanceof ApprovalPendingError) toast.info(e.message);
      else toast.error(e instanceof ApiError ? e.message : "ปลดการผูกไม่สำเร็จ");
    } finally {
      setActing(false);
    }
  };

  const remove = async () => {
    if (!x || acting) return;
    if (
      !(await dialog.confirm({
        title: `ลบใบเสนอราคา ${x.quotationNo}?`,
        message: "การลบย้อนกลับไม่ได้",
        confirmLabel: "ยืนยันลบ",
        danger: true,
      }))
    )
      return;
    setActing(true);
    try {
      await api.deleteQuotation(id);
      toast.success(`ลบ ${x.quotationNo} แล้ว`);
      router.push("/quotations");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ลบไม่สำเร็จ");
      setActing(false);
    }
  };

  const back = (
    <Button component={Link} href="/quotations" startIcon={<ArrowBackIcon />}>
      รายการ
    </Button>
  );
  if (loadError) {
    return (
      <>
        <WomsPageHeader title="ไม่พบใบเสนอราคา" actions={back} />
        <WomsErrorState message={loadError} onRetry={load} />
      </>
    );
  }
  if (!x) return <WomsLoadingState rows={5} />;

  const next = quotationTransitions[x.status] ?? [];
  const lines: QLine[] = x.lines.map((l, i) => ({ ...l, _total: x.lineTotals[i] ?? 0 }));
  const cols: WomsColumn<QLine>[] = [
    { key: "no", label: "#", width: 40, render: (l) => <span className="code">{l.no}</span> },
    { key: "desc", label: "รายการ", render: (l) => quotationLineText(l) || "—" },
    { key: "kind", label: "ชนิด", hideBelowLg: true, render: (l) => (l.kind ? QUOTATION_LINE_KIND_LABEL[l.kind] : "—") },
    { key: "eq", label: "เครื่อง", render: (l) => <span className="mono">{l.serial || "—"}</span> },
    { key: "qty", label: "จำนวน", align: "right", render: (l) => <span className="mono">{l.qty}</span> },
    { key: "price", label: "ราคา/หน่วย", align: "right", render: (l) => <span className="mono">{fmtMoney(l.unitPrice)}</span> },
    { key: "total", label: "รวม", align: "right", render: (l) => <span className="mono">{fmtMoney(l._total)}</span> },
  ];

  return (
    <>
      <WomsPageHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center" component="span" flexWrap="wrap" useFlexGap>
            <Box component="span" className="code" sx={{ fontSize: 20 }}>
              {x.quotationNo}
            </Box>
            <Chip size="small" variant="outlined" label={`Rev.${x.revision ?? 1}`} data-testid="quotation-revision" />
            <QuotationStatusChip status={x.status} />
          </Stack>
        }
        subtitle={
          <>
            {x.customerName} · ออก <span className="mono">{x.issueDate}</span>
            {x.validUntil ? (
              <>
                {" "}
                · ใช้ได้ถึง <span className="mono">{x.validUntil}</span>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            {canEdit && quotationEditable(x.status) ? (
              <Button component={Link} href={`/quotations/${id}/edit`} variant="outlined" startIcon={<EditIcon />} data-testid="quotation-edit">
                แก้ไข
              </Button>
            ) : null}
            {canPrint ? (
              <>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={() =>
                    downloadFile(`/api/quotations/${encodeURIComponent(id)}/document.pdf`, `quotation-${id}.pdf`).catch((e) =>
                      // เดิมกลืน error เงียบ ๆ — ผู้ใช้กดแล้วไม่มีอะไรเกิดขึ้น
                      toast.error(e?.message ?? "ดาวน์โหลด PDF ไม่สำเร็จ")
                    )
                  }
                >
                  PDF
                </Button>
                <Button
                  component={Link}
                  href={`/quotations/${id}/document`}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="contained"
                  startIcon={<PrintIcon />}
                >
                  พิมพ์ / PDF
                </Button>
              </>
            ) : null}
            {back}
          </>
        }
      />

      {x.jobId && !x.jobId.startsWith("PENDING:") ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          {x.jobLinkedAt ? "ผูกกับใบงาน" : "เปิดงานจากใบเสนอราคานี้แล้ว"}: <Link href={`/jobs/${encodeURIComponent(x.jobId)}`} className="code">{x.jobId}</Link>
        </Alert>
      ) : null}
      {contracts.length ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          ทำสัญญาจากใบเสนอราคานี้แล้ว:{" "}
          {contracts.map((c, i) => (
            <span key={c.id}>
              {i ? ", " : ""}
              <Link href={`/contracts/${c.id}`} className="code">{c.contractNo}</Link>
              {c.statusLabel ? ` (${c.statusLabel})` : ""}
            </span>
          ))}
        </Alert>
      ) : null}
      {canEdit && x.status !== "DRAFT" && x.status !== "CANCELLED" ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          ฉบับนี้ส่งลูกค้าแล้ว — การแก้ไขจะสร้าง Revision ใหม่ (ฉบับเดิมเก็บไว้ไม่แก้ทับ) และต้องส่งให้ลูกค้าอนุมัติใหม่
        </Alert>
      ) : null}
      {x.statusReason && (x.status === "REJECTED" || x.status === "CANCELLED") ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          เหตุผล{x.status === "CANCELLED" ? "ที่ยกเลิก" : "ที่ลูกค้าไม่อนุมัติ"}: {x.statusReason}
        </Alert>
      ) : null}

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
        <Tab value="quote" label="ใบเสนอราคา" data-testid="tab-quote" />
        <Tab value="approval" label="ผลอนุมัติลูกค้า" data-testid="tab-approval" />
        {canFinance ? <Tab value="payments" label="รายการรับเงิน" data-testid="tab-payments" /> : null}
        {canFinance ? <Tab value="documents" label="เอกสารบัญชี" data-testid="tab-documents" /> : null}
        <Tab value="history" label="ประวัติ" data-testid="tab-history" />
      </Tabs>

      {tab === "approval" ? (
        <WomsFormSection title="การส่งลูกค้าและผลอนุมัติ">
          <Stack spacing={1} data-testid="approval-section">
            <Typography variant="body2">
              ผู้จัดทำ: {x.createdBy || "—"} · ส่งลูกค้า: {x.sentAt ? `${bangkokDateTime(x.sentAt)} โดย ${x.sentBy || "—"}` : "ยังไม่ส่ง"}
            </Typography>
            {x.approval ? (
              <>
                <Typography sx={{ color: "text.primary", fontWeight: 600 }}>
                  ผลจากลูกค้า: {x.approval.result === "ACCEPTED" ? "อนุมัติ" : "ไม่อนุมัติ"} · วันที่ <span className="mono">{x.approval.date}</span>
                </Typography>
                <Typography variant="body2">
                  {x.approval.result === "ACCEPTED" ? "หมายเหตุ" : "เหตุผล"}: {x.approval.note || "—"} · บันทึกโดย {x.approval.recordedBy} {bangkokDateTime(x.approval.recordedAt)}
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {(x.approval.evidenceFileIds ?? []).map((fid, i) => (
                    <FinFileButton key={fid} qid={x.id} file={{ id: fid, quotationId: x.id, kind: "APPROVAL_EVIDENCE", name: `หลักฐานอนุมัติ ${i + 1}`, mimeType: "", size: 0, uploadedBy: "", uploadedAt: "" }} />
                  ))}
                </Stack>
              </>
            ) : (
              <Typography variant="body2">ยังไม่มีผลอนุมัติของ Revision นี้</Typography>
            )}
            {(x.revisionHistory ?? []).length ? (
              <Box sx={{ mt: 1 }} data-testid="revision-history">
                <Typography sx={{ fontWeight: 600, color: "text.primary" }}>ฉบับก่อนหน้า (เก็บไว้ไม่แก้ทับ)</Typography>
                {[...(x.revisionHistory ?? [])].reverse().map((r) => (
                  <Typography key={r.revision} variant="body2">
                    Rev.{r.revision} · {quotationStatusLabel[r.status]} · ยอด {fmtMoney(r.total)} บาท · {r.lines.length} รายการ
                    {r.sentAt ? ` · ส่ง ${bangkokDateTime(r.sentAt)}` : ""}
                    {r.approval ? ` · ลูกค้า${r.approval.result === "ACCEPTED" ? "อนุมัติ" : "ไม่อนุมัติ"} ${r.approval.date}` : ""}
                    {r.statusReason ? ` · ${r.statusReason}` : ""} · เก็บเมื่อ {bangkokDateTime(r.archivedAt)} โดย {r.archivedBy || "—"}
                  </Typography>
                ))}
              </Box>
            ) : null}
            {(x.jobLinkHistory ?? []).length ? (
              <Box sx={{ mt: 1 }}>
                <Typography sx={{ fontWeight: 600, color: "text.primary" }}>ประวัติการผูกใบงาน</Typography>
                {(x.jobLinkHistory ?? []).map((h, i) => (
                  <Typography key={i} variant="body2">
                    ปลดการผูก {h.jobId} · {bangkokDateTime(h.at)} โดย {h.byName} · เหตุผล: {h.reason}
                  </Typography>
                ))}
              </Box>
            ) : null}
          </Stack>
        </WomsFormSection>
      ) : null}

      {tab === "payments" && canFinance ? <QuotationFinancePanel qid={x.id} section="payments" onChanged={() => setFinTick((t) => t + 1)} /> : null}
      {tab === "documents" && canFinance ? <QuotationFinancePanel qid={x.id} section="documents" onChanged={() => setFinTick((t) => t + 1)} /> : null}

      {tab === "quote" ? (
      <>
      <WomsStatGrid max={3}>
        <WomsStatCard value={fmtMoney(x.subtotal)} label="ก่อน VAT" />
        <WomsStatCard value={fmtMoney(x.vatAmount)} label={`VAT ${x.vatRate}%`} />
        <WomsStatCard value={fmtMoney(x.total)} label="ยอดสุทธิ" tone="primary" />
      </WomsStatGrid>

      <WomsFormSection title="รายการ">
        <WomsDataTable
          caption="รายการในใบเสนอราคา"
          rows={lines}
          columns={cols}
          rowKey={(l) => String(l.no)}
          pageSize={50}
          renderCard={(l) => (
            <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
              <Typography sx={{ color: "text.primary" }}>
                {l.no}. {quotationLineText(l) || "—"}
                {l.serial ? ` · เครื่อง ${l.serial}` : ""}
              </Typography>
              <Typography variant="body2">
                {l.qty} × {fmtMoney(l.unitPrice)} = <strong>{fmtMoney(l._total)}</strong>
              </Typography>
            </Box>
          )}
        />
      </WomsFormSection>
      {x.note ? (
        <WomsFormSection title="หมายเหตุ">
          <Typography sx={{ color: "text.primary", whiteSpace: "pre-wrap" }}>{x.note}</Typography>
        </WomsFormSection>
      ) : null}
      </>
      ) : null}

      {tab === "history" && history.length === 0 ? <Typography variant="body2">ยังไม่มีประวัติ</Typography> : null}
      {tab === "history" && history.length ? (
        <WomsFormSection title="ประวัติการเปลี่ยนแปลง">
          <Stack spacing={1}>
            {history.map((h, i) => (
              <Box key={i} sx={{ borderBottom: 1, borderColor: "divider", pb: 0.75 }} data-testid="quotation-history-row">
                <Typography variant="body2">
                  <span className="mono">{bangkokDateTime(h.at)}</span> · {h.actorName} — {h.summary}
                </Typography>
                {h.changes.slice(0, 20).map((c, j) => (
                  <Typography key={j} variant="caption" component="div" className="mono">
                    {c.field}: {String(c.before ?? "").slice(0, 120) || "—"} → {String(c.after ?? "").slice(0, 120) || "—"}
                  </Typography>
                ))}
              </Box>
            ))}
          </Stack>
        </WomsFormSection>
      ) : null}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mt: 2 }}>
        {/* QA BUG-029 — เสนอเฉพาะสถานะที่เดินต่อได้จริงตาม QUOTATION_TRANSITIONS */}
        {canStatus
          ? next.map((n) => (
              <Button
                key={n}
                variant={n === "CANCELLED" ? "outlined" : "outlined"}
                color={n === "CANCELLED" ? "error" : "primary"}
                onClick={() => changeStatus(n)}
                disabled={acting}
              >
                {STATUS_ACTION_LABEL[n]}
              </Button>
            ))
          : null}
        {canStatus && next.length === 0 ? (
          <Typography variant="body2">ใบเสนอราคาที่สถานะ “{quotationStatusLabel[x.status]}” เปลี่ยนสถานะต่อไม่ได้แล้ว</Typography>
        ) : null}
        {canOpenJob && x.status === "ACCEPTED" && !x.jobId ? (
          <Button variant="contained" startIcon={<WorkOutlineIcon />} onClick={() => setOpenJob(true)} disabled={acting}>
            เปิดงานจาก QUO
          </Button>
        ) : null}
        {canStatus && !x.jobId && x.status !== "CANCELLED" && x.status !== "REJECTED" ? (
          <Button
            variant="outlined"
            disabled={acting}
            data-testid="quotation-link-job"
            onClick={async () => {
              const jobId = await dialog.prompt({
                title: "ผูกกับใบงานที่มีอยู่",
                label: "เลขใบงาน (JN)",
                required: true,
                message: "ใช้กับงานที่เปิดไว้แล้ว — ระบบไม่สร้าง JN ใหม่ ผูกได้ครั้งเดียว",
                confirmLabel: "ผูกใบงาน",
              });
              if (!jobId) return;
              try {
                await api.linkQuotationJob(x.id, jobId.trim());
                toast.success(`ผูกกับใบงาน ${jobId.trim()} แล้ว`);
                load();
              } catch (e) {
                toast.error(e instanceof ApiError ? e.message : "ผูกใบงานไม่สำเร็จ");
              }
            }}
          >
            ผูกกับใบงานที่มีอยู่
          </Button>
        ) : null}
        {canStatus && x.jobId && !x.jobId.startsWith("PENDING:") ? (
          <Button variant="outlined" color="warning" disabled={acting} onClick={unlinkJob} data-testid="quotation-unlink-job">
            ปลดการผูกใบงาน
          </Button>
        ) : null}
        {canEdit && ["SENT", "ACCEPTED", "REJECTED", "EXPIRED"].includes(x.status) ? (
          <Button variant="outlined" disabled={acting} onClick={revise} data-testid="quotation-revise">
            สร้าง Revision ใหม่
          </Button>
        ) : null}
        {canContract && x.status === "ACCEPTED" ? (
          <Button component={Link} href={`/contracts/new?quotationId=${encodeURIComponent(x.id)}`} variant={contracts.length ? "outlined" : "contained"} disabled={acting}>
            ทำสัญญาจากใบนี้
          </Button>
        ) : null}
        {canDelete ? (
          <Button color="error" onClick={remove} disabled={acting}>
            ลบ
          </Button>
        ) : null}
      </Stack>
      {approvalOpen ? (
        <ApprovalDialog
          title={`บันทึกลูกค้าอนุมัติ ${x.quotationNo} Rev.${x.revision ?? 1}`}
          onClose={() => setApprovalOpen(false)}
          onSubmit={(v) => changeStatus("ACCEPTED", v)}
        />
      ) : null}
      {openJob ? (
        <QuotationOpenJobDialog
          quotation={x}
          open={openJob}
          onClose={() => setOpenJob(false)}
          onOpened={(jobId) => {
            setOpenJob(false);
            toast.success(`เปิดงาน ${jobId} แล้ว`);
            load();
          }}
        />
      ) : null}
    </>
  );
}
