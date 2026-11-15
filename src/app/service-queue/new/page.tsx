"use client";

// เปิดคิวใหม่ (QUEUE 01) — เซลล์เปิดให้ตนเอง · Admin เปิดแทนโดยเลือกเซลล์เจ้าของงาน
// บันทึกแล้วได้เลขคิว (ยังไม่มี JN) และระบบส่งการ์ดคิวเข้ากลุ่มเช็คคิวให้อัตโนมัติ
// D-05: "บันทึกร่าง" (ต้องมีแค่ประเภทงาน) แยกจาก "ส่งคิว" (ต้องครบ + หน้าตรวจทานก่อนยืนยัน)
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
import { PendingSitePhotos, uploadPendingSitePhotos, type PendingPhoto } from "@/components/serviceQueue/QueueSitePhotos";

export default function NewServiceQueuePage() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  // UAT2-08: รูปหน้างาน — อัปโหลดหลังได้เลขคิว
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const afterCreate = async (id: string) => {
    const warn = await uploadPendingSitePhotos(id, photos);
    if (warn) toast.error(warn);
  };

  return (
    <WomsPermissionGate anyOf={["svcqueue:request", "svcqueue:admin"]}>
      <WomsPageHeader
        title="เปิดคิวช่าง"
        subtitle="เซลล์ส่งคำขอ แอดมินจัดช่างและนัดลูกค้าให้ · ช่องที่มี * ต้องครบก่อนส่ง · ยังไม่ต้องมี SN ช่าง หรือวันนัดจริง"
        back={{ href: "/service-queue", label: "คิวช่าง" }}
      />
      <QueueForm
        review
        submitLabel="ส่งคำขอคิว"
        busy={busy}
        error={error}
        extraSection={<PendingSitePhotos value={photos} onChange={setPhotos} disabled={busy} />}
        // D-05: บันทึกร่าง — ยังไม่ส่งเข้ากลุ่มเช็คคิว ไม่แจ้ง Admin เห็นเฉพาะผู้สร้าง
        onSaveDraft={async (values) => {
          setBusy(true);
          setError(null);
          try {
            const q = await sqApi.create(values, { draft: true });
            await afterCreate(q.id);
            toast.success("บันทึกร่างแล้ว — กลับมาแก้และส่งคิวได้จากรายการ “ร่างของฉัน”");
            router.push(`/service-queue/${q.id}`);
          } catch (e) {
            setError(e instanceof ApiError ? { field: e.field, message: e.message } : { message: "บันทึกร่างไม่สำเร็จ" });
            setBusy(false);
          }
        }}
        onSubmit={async (values) => {
          setBusy(true);
          setError(null);
          try {
            const q = await sqApi.create(values);
            await afterCreate(q.id);
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
