// Q-R3-14 / ADV3-01 — ป้ายและข้อความของ "ราคาติดตั้งมาตรฐาน" (pure — ใช้ทั้งหน้าและเทสต์)
// ราคาใน Equipment Model Master = ราคาค่าติดตั้งมาตรฐาน (ไม่ใช่ราคาขายเครื่อง) · ใช้คิดรายรับเฉพาะเมื่อ Manager อนุมัติแล้ว
// งานใหม่ใช้ snapshot ที่เก็บตอนเพิ่มเครื่องเข้าใบงาน · งานเดิม (ไม่มี snapshot) ยังคิดจาก Model Index — ติดป้าย "ข้อมูลเดิม"

export const MISSING_APPROVED_PRICE = "ยังไม่มีราคาติดตั้งมาตรฐานที่อนุมัติ";
export const INSTALL_PRICE_LABEL = "ราคาติดตั้งมาตรฐาน";

export type PriceStatus = "APPROVED" | "UNAPPROVED";
export type SnapshotStatus = "APPROVED" | "UNAPPROVED" | "NO_MASTER" | "AMBIGUOUS";

export interface PriceSnapshot {
  status: SnapshotStatus;
  source: "MASTER";
  masterId: string;
  type: string;
  category: string;
  model: string;
  /** null = ยังไม่มีราคาที่อนุมัติ หรือผู้ใช้ไม่มีสิทธิ์เห็นยอดเงิน (D-22) */
  standardPrice: number | null;
  priceVersion: number;
  priceApprovedAt: string;
  priceApprovedBy: string;
  appliedAt: string;
  appliedBy?: string;
  message: string;
  candidates?: Array<{ id: string; type: string; category: string; model: string }>;
}

export function priceStatusLabel(s: PriceStatus | undefined): string {
  return s === "APPROVED" ? "อนุมัติแล้ว" : "ยังไม่อนุมัติ — ไม่ใช้คิดรายรับ";
}

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 2 });

/** ข้อความสั้นใต้รายการเครื่องในใบงาน · undefined = รายการเดิม (ไม่มี snapshot) */
export function priceSnapshotText(s: PriceSnapshot | null | undefined): string {
  if (!s) return "";
  if (s.status === "APPROVED") {
    const who = s.priceApprovedBy ? ` อนุมัติโดย ${s.priceApprovedBy}` : "";
    const price = typeof s.standardPrice === "number" ? `${baht(s.standardPrice)} บาท ` : "";
    return `${INSTALL_PRICE_LABEL} ${price}(${s.type} / ${s.category} ฉบับที่ ${s.priceVersion}${who})`.replace(/\s+\(/, " (");
  }
  if (s.status === "AMBIGUOUS") return `${MISSING_APPROVED_PRICE} — รุ่นนี้อยู่หลายหมวดหมู่ ต้องเลือกรายการในข้อมูลหลัก`;
  if (s.status === "NO_MASTER") return `${MISSING_APPROVED_PRICE} — รุ่นนี้ไม่อยู่ในข้อมูลหลักรุ่นเครื่อง`;
  return `${MISSING_APPROVED_PRICE} (${s.type} / ${s.category})`;
}

/** snapshot นี้ยังต้องให้ Manager ใช้ราคาที่อนุมัติ (ปุ่ม "ใช้ราคาที่อนุมัติ") */
export function snapshotNeedsPrice(s: PriceSnapshot | null | undefined): boolean {
  return !!s && s.status !== "APPROVED";
}
