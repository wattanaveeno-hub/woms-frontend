"use client";

// ---------------------------------------------------------------------------
// /pm — เลือกหน้าตาม Feature Flag ของ backend (PM_MONTHLY_ENABLED · GET /api/pm/rounds/status)
//   เปิด  = ตาราง PM รายเดือน v1.2 (แผนเดิมอยู่ที่ /pm/plans ช่วงเปลี่ยนผ่าน)
//   ปิด   = หน้าแผน PM รายเดือนเดิมทุกประการ (ค่าเริ่มต้น)
// ---------------------------------------------------------------------------
import { usePmMonthlyEnabled } from "@/lib/pmMonthlyFlag";
import { WomsLoadingState } from "@/components/woms";
import PmMonthlyView from "@/components/pm/PmMonthlyView";
import PmPlansLegacy from "@/components/pm/PmPlansLegacy";

export default function PmPage() {
  const enabled = usePmMonthlyEnabled();
  if (enabled === null) return <WomsLoadingState rows={6} />;
  return enabled ? <PmMonthlyView /> : <PmPlansLegacy />;
}
