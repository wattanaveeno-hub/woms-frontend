"use client";

// WS-02 / RBAC-PAGE: โหมดมือถือช่าง (/m และทุกหน้าลูก) — ด่านสิทธิ์ระดับหน้า
// ใช้สิทธิ์ svcqueue:respond ชุดเดียวกับเมนู "โหมดมือถือช่าง" (navMenu) และ ROLE_PERMISSIONS ของ backend
//   ปัจจุบัน = ช่าง + Manager (Manager มีทุกสิทธิ์) — ไม่ได้เพิ่มหรือลดสิทธิ์ของบทบาทใด
// เป็นการแสดงผลเท่านั้น: ข้อมูลใบงาน/คิวถูกจำกัดที่ backend ทุก endpoint (jobVisibleTo / canViewQueue)
import { WomsPermissionGate } from "@/components/woms/WomsPermissionGate";
import { useAuth } from "@/lib/AuthContext";
import { landingPath } from "@/lib/financeRules";
import { TECH_MODE_PERMISSION } from "@/lib/navRules";

export default function TechModeLayout({ children }: { children: React.ReactNode }) {
  const { has } = useAuth();
  return (
    <WomsPermissionGate perm={TECH_MODE_PERMISSION} backHref={landingPath(has)}>
      {children}
    </WomsPermissionGate>
  );
}
