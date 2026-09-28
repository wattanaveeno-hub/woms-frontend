import type { JobStatus } from "@/lib/types";
import { JobStatusChip } from "@/components/woms/WomsStatusChip";

// คงชื่อเดิมไว้ให้หน้าที่ยังไม่ย้าย — ใช้ชิปสถานะกลางของ MUI
export default function StatusBadge({ status }: { status: JobStatus }) {
  return <JobStatusChip status={status} />;
}
