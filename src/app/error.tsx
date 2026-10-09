"use client";

// ---------------------------------------------------------------------------
// Error boundary ของทุกหน้าภายใน Root Layout
// ---------------------------------------------------------------------------
// เดิมไม่มีไฟล์นี้: ถ้าหน้าใดเกิด exception ระหว่าง render Next.js จะแทนทั้งแอป (รวม Sidebar
// และ Header) ด้วย "Application error" ผู้ใช้จึงเห็นเมนูหายและไปหน้าอื่นไม่ได้
// ไฟล์นี้อยู่ใต้ app/layout.tsx → แสดงข้อผิดพลาดเฉพาะพื้นที่เนื้อหา App Shell ยังอยู่ครบ
import { useEffect } from "react";
import Link from "next/link";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { WomsErrorState } from "@/components/woms";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // ให้ทีมพัฒนาเห็นสาเหตุใน console โดยไม่แสดงรายละเอียดทางเทคนิคต่อผู้ใช้
    console.error(error);
  }, [error]);

  return (
    <Stack spacing={2} sx={{ py: 3 }}>
      <WomsErrorState message="หน้านี้แสดงผลไม่สำเร็จ กรุณาลองใหม่ หรือกลับไปหน้าหลัก" onRetry={reset} />
      <div>
        <Button component={Link} href="/dashboard" variant="outlined">
          กลับหน้าแดชบอร์ด
        </Button>
      </div>
    </Stack>
  );
}
