"use client";

// FB-21 — แก้ไขใบเสนอราคาตามสิทธิ์และสถานะที่ตกลง (ไม่เปิดสิทธิ์เกินกฎเดิม)
//   สิทธิ์: quotations:edit (Admin แก้แล้วเป็นคำขออนุมัติตามกติกาเดิม VFB แถว 21 · Manager แก้ได้ทันที)
//   สถานะที่แก้ได้: ร่าง / รอตอบรับ / ปฏิเสธ / หมดอายุ · ตอบรับแล้วและยกเลิกแล้วแก้ไม่ได้
//   ทุกการแก้บันทึกประวัติ (ค่าก่อน–หลัง ผู้แก้ เวลา) — ดูได้ที่หน้าใบเสนอราคา
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { api, ApiError, ApprovalPendingError } from "@/lib/api";
import type { Partner, Quotation, QuotationFormValues } from "@/lib/types";
import QuotationForm from "@/components/QuotationForm";
import { useToast } from "@/components/Toast";
import { WomsErrorState, WomsLoadingState, WomsPageHeader } from "@/components/woms";
import { WomsPermissionGate } from "@/components/woms/WomsPermissionGate";
import { quotationEditable, quotationEditCreatesRevision } from "@/lib/quotationRules";

function EditQuotationInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [x, setX] = useState<Quotation | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);

  const load = useCallback(() => {
    setErr(null);
    api
      .getQuotation(id)
      .then(setX)
      .catch((e) => setErr(e instanceof ApiError ? e.message : "โหลดใบเสนอราคาไม่สำเร็จ"));
  }, [id]);
  useEffect(() => {
    load();
    api.listPartners().then((r) => setPartners(r.items)).catch(() => setPartners([]));
  }, [load]);

  if (err && !x) return <WomsErrorState message={err} onRetry={load} />;
  if (!x) return <WomsLoadingState rows={5} />;

  const editable = quotationEditable(x.status);
  const initial: Partial<QuotationFormValues> = {
    partnerId: x.partnerId ?? "",
    siteId: (x as any).siteId ?? "",
    customerName: x.customerName,
    customerPhone: x.customerPhone,
    customerAddress: x.customerAddress,
    issueDate: x.issueDate,
    validUntil: x.validUntil,
    lines: x.lines,
    vatRate: x.vatRate,
    discount: (x as any).discount ?? 0,
    externalCustomer: (x as any).externalCustomer ?? false,
    note: x.note,
  };

  const submit = async (values: QuotationFormValues) => {
    setBusy(true);
    setFieldError(null);
    try {
      await api.patchQuotation(id, values, x.updatedAt);
      toast.success(`บันทึกการแก้ไข ${x.quotationNo} แล้ว`);
      router.push(`/quotations/${id}`);
    } catch (e) {
      if (e instanceof ApprovalPendingError) {
        toast.info(e.message);
        router.push(`/quotations/${id}`);
        return;
      }
      if (e instanceof ApiError) {
        setFieldError({ field: e.field, message: e.message });
        toast.error(e.message);
        if (e.status === 409) load();
      } else {
        setFieldError({ message: "บันทึกไม่สำเร็จ" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <WomsPageHeader
        title={`แก้ไขใบเสนอราคา ${x.quotationNo}`}
        subtitle="ระบบคำนวณ VAT/ยอดรวมใหม่ และบันทึกประวัติการแก้ไขให้อัตโนมัติ"
        actions={
          <Button component={Link} href={`/quotations/${id}`} startIcon={<ArrowBackIcon />}>
            กลับไปใบเสนอราคา
          </Button>
        }
      />
      {!editable ? (
        <Alert severity="warning">ใบเสนอราคาที่ยกเลิกแล้วแก้ไขไม่ได้</Alert>
      ) : (
        <>
        {quotationEditCreatesRevision(x.status) ? (
          <Alert severity="info" sx={{ mb: 2 }} data-testid="revision-notice">
            ฉบับ Rev.{x.revision ?? 1} ส่งลูกค้าแล้ว — บันทึกการแก้ไขจะสร้าง Revision {(x.revision ?? 1) + 1} (สถานะร่าง) ฉบับเดิมเก็บไว้ไม่แก้ทับ
            และต้องส่งให้ลูกค้าอนุมัติใหม่ · รายการรับเงินเดิมยังอ้างอิงฉบับเดิม (D-11)
          </Alert>
        ) : null}
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <QuotationForm key={x.updatedAt} partners={partners} initial={initial} submitLabel="บันทึกการแก้ไข" busy={busy} fieldError={fieldError} onSubmit={submit} />
        </Paper>
        </>
      )}
    </>
  );
}

export default function EditQuotationPage() {
  const params = useParams<{ id: string }>();
  return (
    <WomsPermissionGate perm="quotations:edit" backHref={`/quotations/${params.id}`}>
      <EditQuotationInner />
    </WomsPermissionGate>
  );
}
