// Owner decision 30 ต.ค. 2569 — ป้าย/ข้อความของ "ต้นทุนมาตรฐาน" และ "ราคาค่าติดตั้ง" (pure — ใช้ทั้งหน้าและเทสต์)
//   ค่าเงินใน Equipment Model Master = ต้นทุนมาตรฐาน (ค่าอ้างอิงเปรียบเทียบ) — ไม่ใช่ค่าติดตั้ง ไม่ใช่ราคาขาย ไม่ใช่รายรับ
//   ไม่รวมในต้นทุน/กำไร · เห็นได้เฉพาะผู้มีสิทธิ์ดูต้นทุน (Admin/Manager)
//   รายรับติดตั้ง = ราคาค่าติดตั้งจาก Model Index − ส่วนลด — ยังไม่ยืนยันกับลูกค้า (ADV3-01)

export const STANDARD_COST_LABEL = "ต้นทุนมาตรฐาน";
export const STANDARD_COST_FIELD_LABEL = "ต้นทุนมาตรฐาน (บาท)";
export const MISSING_APPROVED_COST = "ยังไม่มีต้นทุนมาตรฐานที่อนุมัติ";
export const STANDARD_COST_NOT_IN_PROFIT = "ค่าอ้างอิงเพื่อเปรียบเทียบ — ไม่รวมในต้นทุน/กำไร และไม่ใช่รายรับ";
export const MISSING_INSTALL_CHARGE = "ยังไม่มีราคาค่าติดตั้งใน Model Index";
export const INSTALL_CHARGE_UNVERIFIED_LABEL = "ยังไม่ยืนยันราคาค่าติดตั้ง (ADV3-01)";

export type CostStatus = "APPROVED" | "UNAPPROVED";
export type SnapshotStatus = "APPROVED" | "UNAPPROVED" | "NO_MASTER" | "AMBIGUOUS";

/** job_equipment.standardCostSnapshot — standardCost null = ยังไม่อนุมัติ หรือผู้ใช้ไม่มีสิทธิ์ดูต้นทุน */
export interface StandardCostSnapshot {
  status: SnapshotStatus;
  source: "MASTER";
  masterId: string;
  type: string;
  category: string;
  model: string;
  standardCost: number | null;
  version: number;
  approvedAt: string;
  approvedBy: string;
  appliedAt: string;
  appliedBy?: string;
  message: string;
  candidates?: Array<{ id: string; type: string; category: string; model: string }>;
  legacyAlias?: boolean;
}

/** job_equipment.installChargeSnapshot — ราคาค่าติดตั้งจาก Model Index ณ ตอนเพิ่มเครื่อง */
export interface InstallChargeSnapshot {
  source: "MODEL_INDEX";
  modelIndexId: string;
  modelIndexValue: string;
  model: string;
  installCharge: number | null;
  /** MISSING = ตอนเพิ่มเครื่องยังไม่มีราคา · ERROR = อ่าน Model Index ไม่ได้ตอนเพิ่มเครื่อง (ทั้งสองแบบ = ยังไม่ได้บันทึกราคา ADV11A-02) */
  status: "OK" | "MISSING" | "ERROR";
  capturedAt: string;
  verified: false;
  message: string;
  capturedBy?: string;
}

export function costStatusLabel(s: CostStatus | undefined): string {
  return s === "APPROVED" ? "อนุมัติเป็นต้นทุนมาตรฐานแล้ว" : "ยังไม่อนุมัติ";
}

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 2 });

/** ข้อความสั้นใต้รายการเครื่องในใบงาน (แสดงเฉพาะผู้มีสิทธิ์ดูต้นทุน) · undefined = ไม่มี snapshot */
export function costSnapshotText(s: StandardCostSnapshot | null | undefined): string {
  if (!s) return "";
  if (s.status === "APPROVED") {
    const who = s.approvedBy ? ` อนุมัติโดย ${s.approvedBy}` : "";
    const v = typeof s.standardCost === "number" ? `${baht(s.standardCost)} บาท ` : "";
    return `${STANDARD_COST_LABEL} ${v}(${s.type} / ${s.category} ฉบับที่ ${s.version}${who}) — ${STANDARD_COST_NOT_IN_PROFIT}`.replace(/\s+\(/, " (");
  }
  if (s.status === "AMBIGUOUS") return `${MISSING_APPROVED_COST} — รุ่นนี้อยู่หลายหมวดหมู่ ต้องเลือกรายการในข้อมูลหลัก`;
  if (s.status === "NO_MASTER") return `${MISSING_APPROVED_COST} — รุ่นนี้ไม่อยู่ในข้อมูลหลักรุ่นเครื่อง`;
  return `${MISSING_APPROVED_COST} (${s.type} / ${s.category})`;
}

/** snapshot นี้ยังไม่มีต้นทุนที่อนุมัติ (ปุ่ม "เติมต้นทุนมาตรฐาน" ของ Manager) */
export function costSnapshotNeedsValue(s: StandardCostSnapshot | null | undefined): boolean {
  return !!s && s.status !== "APPROVED";
}

/** ข้อความราคาค่าติดตั้งของรายการ (รายรับ — ยังไม่ยืนยัน) */
export function installChargeText(s: InstallChargeSnapshot | null | undefined): string {
  if (!s) return "";
  if (s.status === "ERROR") return "ยังไม่ได้บันทึกราคาค่าติดตั้ง (อ่าน Model Index ไม่ได้ตอนเพิ่มเครื่อง)";
  if (s.status !== "OK") return MISSING_INSTALL_CHARGE;
  const v = typeof s.installCharge === "number" ? ` ${baht(s.installCharge)} บาท` : "";
  return `ราคาค่าติดตั้ง (Model Index)${v} — ${INSTALL_CHARGE_UNVERIFIED_LABEL}`;
}

/** ADV11A-02: รายการที่ยังไม่ได้บันทึกราคาค่าติดตั้ง (MISSING/ERROR) — Manager กดบันทึกจาก Model Index ปัจจุบันได้ */
export function installChargeNeedsCapture(s: InstallChargeSnapshot | null | undefined): boolean {
  return !!s && s.status !== "OK";
}
