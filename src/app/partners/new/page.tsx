"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { PartnerFormValues } from "@/lib/types";
import PartnerForm from "@/components/PartnerForm";
import { useToast } from "@/components/Toast";

export default function NewPartnerPage() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);

  const submit = async (values: PartnerFormValues) => {
    setBusy(true);
    setFieldError(null);
    try {
      const p = await api.createPartner(values);
      toast.success(`เพิ่มคู่ค้า ${p.name} แล้ว`);
      router.push(`/partners/${p.id}`);
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
          <h1>เพิ่มคู่ค้า</h1>
          <div className="sub">ลูกค้า / ผู้จัดจำหน่าย</div>
        </div>
      </div>

      <div className="card card-pad">
        <PartnerForm submitLabel="บันทึก" busy={busy} fieldError={fieldError} onSubmit={submit} />
      </div>
    </>
  );
}
