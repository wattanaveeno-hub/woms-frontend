"use client";

// หน้าของฟังก์ชันที่ซ่อนไว้ (HIDE-01: แชทต่องาน / คิวช่าง) — เปิด URL ตรงแล้วเห็นข้อความนี้แทน
// โค้ดหน้าเดิมยังอยู่ครบ เปิดใช้ได้ด้วย NEXT_PUBLIC_FEATURE_CHAT / NEXT_PUBLIC_FEATURE_TECH_QUEUE
// หมายเหตุ: นี่ไม่ใช่ security boundary — API ฝั่ง backend ยังบังคับสิทธิ์ตามปกติ
import Button from "@mui/material/Button";
import Link from "next/link";
import { WomsEmptyState } from "./WomsStates";

export function WomsHiddenFeature({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  if (enabled) return <>{children}</>;
  return (
    <WomsEmptyState
      title="ฟังก์ชันนี้ยังไม่เปิดใช้งาน"
      description="ฟังก์ชันนี้ถูกซ่อนไว้ตามขอบเขตงานปัจจุบัน"
      action={
        <Button component={Link} href="/dashboard" variant="outlined">
          กลับหน้าหลัก
        </Button>
      }
    />
  );
}
