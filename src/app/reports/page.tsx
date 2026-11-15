"use client";

// รายงาน & ส่งออก — สรุปภาพรวม กราฟ งานบำรุงรักษา และ "สรุปผล" (ตัวกรอง + Export Excel) ที่ย้ายมาจากหน้าหลัก (UAT R2 Phase 2)
// สิทธิ์: แต่ละส่วนแสดงตาม endpoint ที่บทบาทเรียกได้ (dashboardFetchPlan) เหมือนตอนอยู่หน้าหลัก · backend บังคับสิทธิ์อีกชั้นเสมอ
import DashboardOverview from "@/components/DashboardOverview";
import { WomsPageHeader } from "@/components/woms";
import { WomsPermissionGate } from "@/components/woms/WomsPermissionGate";

export default function ReportsPage() {
  return (
    <WomsPermissionGate>
      <WomsPageHeader
        title="รายงาน & ส่งออก"
        subtitle="ภาพรวมเครื่อง สัญญา เอกสาร งานบำรุงรักษา กราฟ และสรุปผลพร้อม Export Excel"
        back={{ href: "/dashboard", label: "หน้าหลัก" }}
      />
      <DashboardOverview />
    </WomsPermissionGate>
  );
}
