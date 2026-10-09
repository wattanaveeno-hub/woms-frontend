"use client";

// เปิดคิวใหม่ (QUEUE 01) — เซลล์เปิดให้ตนเอง · Admin เปิดแทนโดยเลือกเซลล์เจ้าของงาน
// บันทึกแล้วได้เลขคิว (ยังไม่มี JN) และระบบส่งการ์ดคิวเข้ากลุ่มเช็คคิวให้อัตโนมัติ
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { WomsPageHeader, WomsPermissionGate } from "@/components/woms";
import QueueForm from "@/components/serviceQueue/QueueForm";
import { sqApi } from "@/lib/serviceQueueApi";

export default function NewServiceQueuePage() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);

  return (
    <WomsPermissionGate anyOf={["svcqueue:request", "svcqueue:admin"]}>
      <WomsPageHeader
        title="เปิดคิวช่าง"
        subtitle="กรอกรายละเอียดแบบใบงาน — ยังไม่ต้องมี SN ช่าง หรือวันนัดจริง"
        actions={
          <Button component={Link} href="/service-queue" startIcon={<ArrowBackIcon />}>
            กลับ
          </Button>
        }
      />
      <QueueForm
        submitLabel="บันทึกและส่งเข้ากลุ่มเช็คคิว"
        busy={busy}
        error={error}
        onSubmit={async (values) => {
          setBusy(true);
          setError(null);
          try {
            const q = await sqApi.create(values);
            toast.success(`เปิดคิว ${q.queueNo} แล้ว — รอ Admin จัดช่าง`);
            window.dispatchEvent(new Event("woms:queue-changed"));
            router.push(`/service-queue/${q.id}`);
          } catch (e) {
            setError(e instanceof ApiError ? { field: e.field, message: e.message } : { message: "บันทึกไม่สำเร็จ" });
            setBusy(false);
          }
        }}
      />
    </WomsPermissionGate>
  );
}
