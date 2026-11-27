"use client";

// ในหน้าใบงาน: ประวัติคิว/รอบนัด และปุ่ม "เลื่อนงาน (ส่งกลับเข้าคิว)" ของ Admin (RESCHEDULE 01)
// เลื่อนได้แม้เลยวันหรือเวลาเข้างานแล้ว · ใช้ JN เดิม · งานปิด/ยกเลิก/วางบิล/เริ่มทำแล้ว ปุ่มปิดพร้อมเหตุผล
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/lib/AuthContext";
import { FEATURES } from "@/lib/features";
import { useToast } from "@/components/Toast";
import { WomsFormSection } from "@/components/woms";
import { QueueStatusChip, apptText } from "./QueueBits";
import { QueueSitePhotosPanel } from "./QueueSitePhotos";
import { sqApi, type ServiceQueue } from "@/lib/serviceQueueApi";
import RescheduleJobDialog from "./RescheduleJobDialog";

export default function JobQueuePanel({
  jobId,
  onChanged,
  salesPostpone,
}: {
  jobId: string;
  onChanged?: () => void;
  /** MOM-19/20: การแจ้งเลื่อนแบบ "เลื่อนไม่นาน" ล่าสุดของเซลล์ — ใช้เติมเหตุผลและวันที่ลูกค้าต้องการ */
  salesPostpone?: { reason: string; preferredDate: string; preferredTime: string } | null;
}) {
  const { has } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<ServiceQueue[] | null>(null);
  const [canReschedule, setCanReschedule] = useState(false);
  const [blocker, setBlocker] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const enabled = FEATURES.serviceQueue && has("svcqueue:view");
  const admin = has("svcqueue:admin");

  const load = useCallback(() => {
    if (!enabled) return;
    sqApi
      .forJob(jobId)
      .then((r) => {
        setItems(r.items);
        setCanReschedule(r.canReschedule);
        setBlocker(r.rescheduleBlocker);
      })
      .catch(() => setItems([]));
  }, [enabled, jobId]);
  useEffect(load, [load]);

  if (!enabled || items === null) return null;
  if (!items.length && !admin) return null;
  const active = items.find((q) => q.status !== "RELEASED" && q.status !== "CANCELLED");
  const current = items.find((q) => q.techId) ?? null;

  return (
    <>
    <WomsFormSection
      title="คิวช่าง / รอบนัด"
      actions={
        admin ? (
          <Button
            size="small"
            variant="outlined"
            disabled={!canReschedule}
            onClick={() => setOpen(true)}
          >
            เลื่อนงาน (ส่งกลับเข้าคิว)
          </Button>
        ) : null
      }
    >
      {admin && !canReschedule && (blocker || active) ? (
        <Alert severity="info" sx={{ mb: 1 }}>
          {blocker ?? `มีคิวนัดใหม่ ${active?.queueNo} ที่ยังดำเนินการอยู่`}
        </Alert>
      ) : null}
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          ใบงานนี้ไม่ได้เปิดผ่านคิวช่าง — กดเลื่อนงานเพื่อนำกลับเข้าคิวโดยใช้ JN เดิม
        </Typography>
      ) : (
        <Stack spacing={1}>
          {items.map((q) => (
            <Stack key={q.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Link href={`/service-queue/${q.id}`} style={{ fontWeight: 600 }}>
                {q.queueNo}
              </Link>
              <QueueStatusChip status={q.status} mode={q.mode} />
              <Typography variant="body2" color="text.secondary">
                ช่าง {q.techName || "ยังไม่จัด"} · {apptText(q.current?.date ?? "", q.current?.time ?? "", q.current?.period ?? "")} · {q.rounds.length} รอบนัด
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}

      {/* MOM-20 (ทดสอบ 27 พ.ย.): ใช้ Dialog เลื่อนงานตัวเดียวกับแผงขั้นงาน — มีช่องวัน/เวลาที่ลูกค้าต้องการ และเติมจากการแจ้งเลื่อนของเซลล์ */}
      <RescheduleJobDialog
        open={open}
        jobId={jobId}
        currentTechId={current?.techId ?? ""}
        defaultTechId={current?.techId ?? ""}
        defaultReason={salesPostpone?.reason ? `เซลล์แจ้งเลื่อน: ${salesPostpone.reason}` : ""}
        defaultPreferredDate={salesPostpone?.preferredDate ?? ""}
        defaultPreferredTime={salesPostpone?.preferredTime ?? ""}
        onClose={() => setOpen(false)}
        onDone={(q) => {
          toast.success(`ส่ง ${jobId} กลับเข้าคิว ${q.queueNo} แล้ว`);
          setOpen(false);
          load();
          onChanged?.();
        }}
      />
    </WomsFormSection>
    {/* UAT2-15: รูปหน้างานที่แนบตอนเปิดคิว เก็บคู่กับใบงานที่เปิดจากคิว (ดูอย่างเดียวที่ใบงาน) */}
    {items.map((q) => (
      <QueueSitePhotosPanel key={`sp-${q.id}`} queueId={q.id} title={`รูปหน้างาน · คิว ${q.queueNo}`} />
    ))}
    </>
  );
}
