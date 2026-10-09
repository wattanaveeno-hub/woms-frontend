// ---------------------------------------------------------------------------
// กติกาการแสดงผลของ "สรุปผล" บนแดชบอร์ด — ฟังก์ชันบริสุทธิ์ ทดสอบได้ด้วย node --test
// ---------------------------------------------------------------------------
// ไม่มี import จาก React/MUI เพื่อให้ scripts/*.test.ts เรียกตรงได้

export type ValuationStatus = "OK" | "METHOD_UNSET" | "COST_INCOMPLETE" | "ERROR";

export interface StockLike {
  valuationMethod: string;
  valuationStatus?: ValuationStatus;
  totalValue: number | null;
}

/** สถานะมูลค่าสต๊อก — รองรับ response รุ่นก่อนที่ยังไม่มี valuationStatus */
export function stockValuationStatus(s: StockLike): ValuationStatus {
  if (s.valuationStatus) return s.valuationStatus;
  if (!s.valuationMethod) return "METHOD_UNSET";
  return s.totalValue === null ? "COST_INCOMPLETE" : "OK";
}

export interface ValuationMessage {
  /** ข้อความหลักที่แสดงแทนตัวเลข */
  text: string;
  /** แสดงลิงก์ไปหน้าตั้งค่า (เฉพาะผู้มีสิทธิ์ stock:manage) */
  settingsLink: boolean;
  severity: "info" | "warning" | "error";
}

/**
 * ข้อความเมื่อยังแสดงมูลค่าไม่ได้ — แยก 4 กรณี ห้ามแสดงเป็น 0
 * คืน null เมื่อสถานะ OK (ให้แสดงตัวเลขจริง แม้จะเป็น 0)
 */
export function valuationMessage(
  status: ValuationStatus,
  canManageStock: boolean,
  partsMissingCost = 0
): ValuationMessage | null {
  switch (status) {
    case "OK":
      return null;
    case "METHOD_UNSET":
      return canManageStock
        ? { text: "ยังไม่ได้กำหนดวิธีคิดมูลค่าสต๊อก", settingsLink: true, severity: "warning" }
        : { text: "ยังไม่ได้กำหนดวิธีคิดมูลค่าสต๊อก กรุณาติดต่อผู้ดูแลระบบ", settingsLink: false, severity: "warning" };
    case "COST_INCOMPLETE":
      return {
        text:
          partsMissingCost > 0
            ? `ยังสรุปมูลค่ารวมไม่ได้ — อะไหล่ ${partsMissingCost.toLocaleString("th-TH")} รายการที่มีของคงเหลือยังไม่มีต้นทุน`
            : "ยังสรุปมูลค่ารวมไม่ได้ — อะไหล่บางรายการยังไม่มีต้นทุน",
        settingsLink: false,
        severity: "warning",
      };
    case "ERROR":
    default:
      return { text: "คำนวณมูลค่าสต๊อกไม่สำเร็จ กรุณาลองใหม่ภายหลัง", settingsLink: false, severity: "error" };
  }
}

/** ตรวจช่วงวันที่ก่อนส่งคำขอ — คืนข้อความผิดพลาด หรือ "" ถ้าใช้ได้ */
export function dateRangeError(from: string, to: string): string {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (from && !re.test(from)) return "วันที่เริ่มต้นไม่ถูกต้อง";
  if (to && !re.test(to)) return "วันที่สิ้นสุดไม่ถูกต้อง";
  if (from && to && from > to) return "วันที่เริ่มต้องไม่มากกว่าวันที่สิ้นสุด";
  return "";
}

/** query string ของตัวกรอง — ใช้ชุดเดียวกันทั้งการโหลดสรุปและ Export */
export function summaryQuery(f: { from?: string; to?: string; jobType?: string; team?: string; technicianId?: string }): string {
  const p = new URLSearchParams();
  for (const k of ["from", "to", "jobType", "team", "technicianId"] as const) {
    const v = (f[k] ?? "").trim();
    if (v) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/**
 * ตัวกันผลลัพธ์เก่าทับผลใหม่ — เรียก next() ก่อนยิงคำขอ แล้วใช้ isLatest(id) ก่อน setState
 * (ไม่พึ่ง AbortController เพราะ request() กลางของระบบยังไม่รับ signal)
 */
export function createLatestGuard() {
  let seq = 0;
  return {
    next: () => ++seq,
    isLatest: (id: number) => id === seq,
  };
}
