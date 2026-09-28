"use client";

import { WomsPermissionGate } from "@/components/woms/WomsPermissionGate";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { PartnerFormValues } from "@/lib/types";
import PartnerForm from "@/components/PartnerForm";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { WomsPageHeader } from "@/components/woms";

function NewPartnerPageInner() {
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
      <WomsPageHeader
        title="เพิ่มคู่ค้า"
        subtitle="ลูกค้า / ผู้จัดจำหน่าย"
        actions={
          <Button component={Link} href="/partners" startIcon={<ArrowBackIcon />}>
            รายการคู่ค้า
          </Button>
        }
      />
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <PartnerForm submitLabel="บันทึก" busy={busy} fieldError={fieldError} onSubmit={submit} />
      </Paper>
    </>
  );
}

// เปิด URL ตรงโดยไม่มีสิทธิ์ → แสดงข้อความแทนฟอร์มที่บันทึกไม่ได้ (backend บังคับสิทธิ์อีกชั้นเสมอ)
export default function NewPartnerPage() {
  return (
    <WomsPermissionGate perm="partners:create" backHref="/partners">
      <NewPartnerPageInner />
    </WomsPermissionGate>
  );
}
