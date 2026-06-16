"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Partner, QuotationFormValues } from "@/lib/types";
import QuotationForm from "@/components/QuotationForm";
import { useToast } from "@/components/Toast";

export default function NewQuotationPage() {
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
      <div className="page-head">
        <div>
          <h1>สร้างใบเสนอราคา</h1>
          <div className="sub">ระบบจะออกเลขที่และคำนวณ VAT/ยอดรวมให้อัตโนมัติ</div>
        </div>
      </div>
      <div className="card card-pad">
        <QuotationForm partners={partners} submitLabel="สร้างใบเสนอราคา" busy={busy} fieldError={fieldError} onSubmit={submit} />
      </div>
    </>
  );
}
