"use client";

// ---------------------------------------------------------------------------
// แผน PM รายเดือนต่อช่าง (หน้าเดิม · ช่วงเปลี่ยนผ่าน Q-02) — เนื้อหาอยู่ที่ components/pm/PmPlansLegacy
//   ปิด PM_MONTHLY_ENABLED: หน้านี้ยังเปิดได้ และ /pm แสดงหน้าเดียวกันด้วยชื่อเดิม
// ---------------------------------------------------------------------------
import PmPlansLegacy from "@/components/pm/PmPlansLegacy";

export default function PmPlansPage() {
  return <PmPlansLegacy transition />;
}
