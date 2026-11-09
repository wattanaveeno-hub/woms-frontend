// ---------------------------------------------------------------------------
// ตาราง PM รายเดือน v1.2 — สถานะ Feature Flag จาก backend (PM_MONTHLY_ENABLED) แหล่งเดียว
//   null = กำลังโหลด · false = หน้าเดิม (แผน PM ที่ /pm · Dashboard PM สถานะรายวัน) · true = ตาราง PM รายเดือน
//   โหลดครั้งเดียวต่อการเปิดหน้าเว็บ · โหลดไม่สำเร็จ = false (พฤติกรรมเดิม)
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

let cached: Promise<boolean> | null = null;

export function loadPmMonthlyEnabled(): Promise<boolean> {
  if (!cached)
    cached = api
      .pmRoundsStatus()
      .then((r) => r.enabled === true)
      .catch(() => {
        cached = null; // ลองใหม่ครั้งถัดไป
        return false;
      });
  return cached;
}

/** สำหรับทดสอบ */
export function __resetPmMonthlyFlag() {
  cached = null;
}

export function usePmMonthlyEnabled(): boolean | null {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void loadPmMonthlyEnabled().then((x) => alive && setV(x));
    return () => {
      alive = false;
    };
  }, []);
  return v;
}
