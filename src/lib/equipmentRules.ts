// กติกาหน้าเครื่อง (Audit A) — pure functions ไม่เรียก API · ทดสอบใน scripts/equipmentRules.test.ts
//   D-02 MCH-03 วางข้อความ → ช่องของฟอร์มเพิ่มเครื่อง
//   D-03 MCH-02 การ์ด PM: ประเภท PM / ระยะสัญญา / รอบ Package
//   D-13 MCH-01 คอลัมน์ "แจ้งเตือน" ต้องรวม PM ใกล้ถึง/เกินกำหนด
import type { ParsedJobText } from "./jobTextParser";

// ---------------------------------------------------------------------------
// D-02 วางข้อความเพิ่มเครื่อง
// ---------------------------------------------------------------------------

/** ค่าที่ได้จากข้อความ — เป็น "ข้อเสนอ" ให้ผู้ใช้ตรวจก่อนใส่ฟอร์ม ไม่บันทึกอะไรเอง */
export interface PastedEquipment {
  serial: string;
  model: string;
  filterUnit: string;
  /** รหัสลูกค้า (เช่น I2228) ใช้ค้นลูกค้าในฐานข้อมูล — หาไม่เจอให้ผู้ใช้เลือกเอง */
  customerCode: string;
  shopName: string;
  /** ลิงก์แผนที่ตามที่วางมา */
  mapLink: string;
  lat: number;
  lng: number;
  /** ติดต่อ/เบอร์/หมายเหตุ/บรรทัดที่ระบบไม่รู้จัก — รวมเป็นหมายเหตุของเครื่อง */
  note: string;
  /** SN ที่เกินมา (ข้อความมีหลาย SN — ฟอร์มรับได้ทีละเครื่อง) */
  extraSerials: string[];
  warnings: string[];
}

/** ดึงพิกัดจากลิงก์ Google Maps / "lat,lng" · ไม่มีพิกัดในลิงก์คืน null (ลิงก์ย่อ maps.app.goo.gl ไม่มีพิกัด) */
export function parseLatLng(s: string): { lat: number; lng: number } | null {
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/,
  ];
  for (const re of patterns) {
    const m = (s ?? "").match(re);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  }
  return null;
}

/**
 * ข้อความจาก LINE บางครั้งเขียนหลายหัวข้อในบรรทัดเดียวคั่นด้วย " / "
 * เช่น "รุ่น: KM-40C / เครื่องกรองน้ำ: 3 ขั้นตอน / SN:5198210500597" → แยกเป็นหลายบรรทัดก่อนส่งให้ตัวแยก
 * (แยกเฉพาะเมื่อส่วนถัดไปขึ้นต้นด้วย "หัวข้อ:" — ค่าที่มี "/" ในตัว เช่น วันที่ 25/9/69 ไม่ถูกแยก)
 */
export function splitInlineHeadings(text: string): string {
  return (text ?? "").replace(/\s+\/\s+(?=[^/\n:：]{1,24}[:：])/g, "\n");
}

/**
 * ผลจาก parseJobText(splitInlineHeadings(text)) → ช่องของฟอร์มเพิ่มเครื่อง
 * (รับผลที่แยกแล้ว เพื่อให้ไฟล์นี้ไม่ผูกกับตัวแยก และทดสอบด้วย node --test ได้)
 */
export function equipmentFromParsed(
  p: Pick<ParsedJobText, "serials" | "model" | "filterUnit" | "customerCode" | "shopName" | "mapLink" | "contactName" | "phone" | "note">
): PastedEquipment {
  const pos = p.mapLink ? parseLatLng(p.mapLink) : null;
  const noteParts = [
    p.contactName ? `ติดต่อ: ${p.contactName}` : "",
    p.phone ? `เบอร์: ${p.phone}` : "",
    p.note,
  ].filter(Boolean);
  const warnings: string[] = [];
  if (!p.serials.length) warnings.push("ไม่พบ SN ในข้อความ — เว้นว่างได้ ระบบจะออกเลขชั่วคราวให้");
  if (!p.model) warnings.push("ไม่พบรุ่นเครื่องในข้อความ — กรอกเอง");
  if (p.serials.length > 1) warnings.push(`พบ SN ${p.serials.length} ตัว — ใส่ตัวแรกให้ ที่เหลือเพิ่มเป็นเครื่องแยกทีละเครื่อง`);
  if (p.mapLink && !pos) warnings.push("ลิงก์แผนที่ไม่มีพิกัดในตัว — เก็บลิงก์ไว้ในหมายเหตุ ใส่พิกัดเองได้ที่ “ข้อมูลเพิ่มเติม”");
  if (p.mapLink && !pos) noteParts.push(`แผนที่: ${p.mapLink}`);
  return {
    serial: p.serials[0] ?? "",
    model: p.model,
    filterUnit: p.filterUnit,
    customerCode: p.customerCode,
    shopName: p.shopName,
    mapLink: p.mapLink,
    lat: pos?.lat ?? 0,
    lng: pos?.lng ?? 0,
    note: noteParts.join("\n").trim(),
    extraSerials: p.serials.slice(1),
    warnings,
  };
}

// ---------------------------------------------------------------------------
// D-03 การ์ด PM
// ---------------------------------------------------------------------------

export interface PmPlanInput {
  pmIntervalMonths?: number;
  pmMode?: "" | "RENTAL" | "PACKAGE";
  pmRentalYears?: number;
  pmPackageRoundsTotal?: number;
  pmPackageRemaining?: number;
}

/** แถว [ป้าย, ค่า] ของการ์ด PM ตาม MCH-02 — ค่าทั้งหมดมาจาก backend หน้าเว็บแค่จัดรูป */
export function pmPlanRows(e: PmPlanInput): [string, string][] {
  const rows: [string, string][] = [];
  const mode = e.pmMode ?? "";
  rows.push(["ประเภท PM", mode === "RENTAL" ? "เช่า" : mode === "PACKAGE" ? "Package" : "ไม่ระบุ"]);
  if (mode === "RENTAL") {
    rows.push(["ระยะสัญญา (ปี)", e.pmRentalYears ? `${e.pmRentalYears} ปี` : "—"]);
  }
  if (mode === "PACKAGE") {
    rows.push(["จำนวนรอบ", `${e.pmPackageRoundsTotal ?? 0} รอบ`]);
    rows.push(["รอบคงเหลือ", `${e.pmPackageRemaining ?? 0} รอบ`]);
  }
  rows.push(["รอบ PM", (e.pmIntervalMonths ?? 0) > 0 ? `ทุก ${e.pmIntervalMonths} เดือน` : "ยังไม่ตั้ง"]);
  return rows;
}

/** สรุปบรรทัดเดียว เช่น "Package · 4 รอบ · เหลือ 3" */
export function pmPlanSummary(e: PmPlanInput): string {
  if (e.pmMode === "PACKAGE") return `Package · ${e.pmPackageRoundsTotal ?? 0} รอบ · เหลือ ${e.pmPackageRemaining ?? 0}`;
  if (e.pmMode === "RENTAL") return `เช่า${e.pmRentalYears ? ` · ${e.pmRentalYears} ปี` : ""}`;
  return "";
}

// ---------------------------------------------------------------------------
// D-13 คอลัมน์แจ้งเตือนในรายการเครื่อง
// ---------------------------------------------------------------------------

export interface AlertInput {
  needsSerial?: boolean;
  rentalWithoutContract?: boolean;
  pmStatus?: string;
}

/** PM ที่ต้องแจ้งเตือนในรายการ: ใกล้ถึง/เกินกำหนดเท่านั้น */
export function pmNeedsAlert(pmStatus: string | undefined): boolean {
  return pmStatus === "DUE_SOON" || pmStatus === "OVERDUE";
}

/** คะแนนเรียงคอลัมน์แจ้งเตือน (มาก = เร่งกว่า) */
export function alertSortValue(e: AlertInput): number {
  return (
    (e.rentalWithoutContract ? 8 : 0) +
    (e.pmStatus === "OVERDUE" ? 4 : e.pmStatus === "DUE_SOON" ? 2 : 0) +
    (e.needsSerial ? 1 : 0)
  );
}
