import type { JobStatus } from "@/lib/types";
import { JobStatusChip } from "@/components/woms/WomsStatusChip";

// คงชื่อเดิมไว้ให้หน้าที่ยังไม่ย้าย — ใช้ชิปสถานะกลางของ MUI · holdReason (ถ้าส่ง) แยกป้ายเลื่อนวันเข้า (UAT2-14)
export default function StatusBadge({ status, holdReason }: { status: JobStatus; holdReason?: string | null }) {
  return <JobStatusChip status={status} holdReason={holdReason} />;
}
