"use client";

import { WomsPermissionGate } from "@/components/woms/WomsPermissionGate";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Partner, QuotationFormValues } from "@/lib/types";
import QuotationForm from "@/components/QuotationForm";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { WomsPageHeader } from "@/components/woms";

function NewQuotationPageInner() {
  const router = useRouter();
  const toast = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);

  useEffect(() => {
    api.listPartners().then((r) => setPartners(r.items)).catch(() => setPartners([]));
  }, []);

  const submit = async (values: QuotationFormValues) => {
    setBusy(true);
    setFieldError(null);
    try {
      const x = await api.createQuotation(values);
      toast.success(`สร้างใบเสนอราคา ${x.quotationNo} แล้ว`);
      router.push(`/quotations/${x.id}`);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldError({ field: e.field, message: e.message });
        toast.error(e.message);
      } else {
        setFieldError({ message: "บันทึกไม่สำเร็จ" });
        toast.error("บันทึกไม่สำเร็จ");
      }
      setBusy(false);
    }
  };

  return (
    <>
      <WomsPageHeader
        title="สร้างใบเสนอราคา"
        subtitle="ระบบจะออกเลขที่และคำนวณ VAT/ยอดรวมให้อัตโนมัติ"
        actions={
          <Button component={Link} href="/quotations" startIcon={<ArrowBackIcon />}>
            รายการใบเสนอราคา
          </Button>
        }
      />
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <QuotationForm partners={partners} submitLabel="สร้างใบเสนอราคา" busy={busy} fieldError={fieldError} onSubmit={submit} />
      </Paper>
    </>
  );
}

// เปิด URL ตรงโดยไม่มีสิทธิ์ → แสดงข้อความแทนฟอร์มที่บันทึกไม่ได้ (backend บังคับสิทธิ์อีกชั้นเสมอ)
export default function NewQuotationPage() {
  return (
    <WomsPermissionGate perm="quotations:create" backHref="/quotations">
      <NewQuotationPageInner />
    </WomsPermissionGate>
  );
}
