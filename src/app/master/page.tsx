"use client";

// Phase 7 (ENTECH design "Master"): หน้าข้อมูลพื้นฐาน = รายการชนิดด้านซ้าย + รายการของชนิดแรก (ทีมช่าง) ด้านขวา
//   เดิมเป็นการ์ดลิงก์ — ลิงก์ทุกชนิดยังอยู่ครบในรายการด้านซ้าย (รวมรุ่นเครื่อง/โปรไฟล์ประกัน)
import MasterManager from "@/components/MasterManager";
import { MasterLayout } from "@/components/MasterSideList";
import { WomsPageHeader, WomsPermissionGate } from "@/components/woms";

export default function MasterHubPage() {
  return (
    <WomsPermissionGate anyOf={["master:manage", "master:view"]}>
      <WomsPageHeader title="ข้อมูลพื้นฐาน" subtitle="ตัวเลือกที่ใช้ในฟอร์มต่าง ๆ" back={{ href: "/settings", label: "ตั้งค่า" }} />
      <MasterLayout current="/master/team">
        <MasterManager kind="team" />
      </MasterLayout>
    </WomsPermissionGate>
  );
}
