"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError, downloadFile } from "@/lib/api";
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
import QuotationOpenJobDialog from "@/components/QuotationOpenJobDialog";
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
  SENT: "ทำเป็นส่งแล้ว",
  ACCEPTED: "ลูกค้าตอบรับ",
  REJECTED: "ลูกค้าปฏิเสธ",
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
  // QUO-01 — เปิดงานได้เมื่อมีทั้งสิทธิ์เปิดใบงานและสิทธิ์จัดการสถานะใบเสนอราคา (ตรงกับ backend)
  const canOpenJob = has("jobs:create") && has("quotations:status");
  const [openJob, setOpenJob] = useState(false);

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

  const changeStatus = async (status: QuotationStatus) => {
    if (!x || acting) return;
    // การยกเลิกใบเสนอราคาเป็นทางตัน (CANCELLED ไม่มีทางออก) จึงต้องยืนยันก่อน
    if (status === "CANCELLED") {
      const ok = await dialog.confirm({
        title: `ยกเลิกใบเสนอราคา ${x.quotationNo}?`,
        message: "ใบที่ยกเลิกแล้วเปลี่ยนสถานะต่อไม่ได้อีก",
        confirmLabel: "ยืนยันยกเลิก",
        danger: true,
      });
      if (!ok) return;
    }
    setActing(true);
    try {
      const updated = await api.setQuotationStatus(id, status, x.updatedAt);
      setX(updated);
      toast.success("อัปเดตสถานะแล้ว");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error(e.message);
        load();
      } else {
        toast.error(e instanceof ApiError ? e.message : "อัปเดตไม่สำเร็จ");
      }
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
          เปิดงานจากใบเสนอราคานี้แล้ว: <Link href={`/jobs/${encodeURIComponent(x.jobId)}`} className="code">{x.jobId}</Link>
        </Alert>
      ) : null}
      {x.status === "ACCEPTED" ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          ใบที่ลูกค้าตอบรับแล้วแก้ไขไม่ได้ — การแก้หรือถอนตอบรับย้อนหลังรอยืนยันกติกา (Q-07)
        </Alert>
      ) : null}

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

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
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
        {canDelete ? (
          <Button color="error" onClick={remove} disabled={acting}>
            ลบ
          </Button>
        ) : null}
      </Stack>
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
