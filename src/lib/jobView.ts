// ---------------------------------------------------------------------------
// ตรรกะล้วนของหน้าใบงาน (ไม่มี React) — ทดสอบด้วย node --test (scripts/jobView.test.ts)
// ---------------------------------------------------------------------------
import type { CustomerSite, Job, JobFormValues, Partner } from "./types";

/**
 * D-05: ฟิลด์ที่ฟอร์มใบงานส่งไป backend ได้ (ตรงกับ backend patchJobSchema ที่เป็น .strict())
 * หน้าแก้ใบงานได้ initial = ใบงานทั้งก้อน — ต้องตัดฟิลด์ระบบ (equipmentCount, branchNo, queueId, …) ออกก่อนส่ง
 */
export const JOB_FORM_KEYS = [
  "jobType",
  "jobSubType",
  "jobName",
  "technicianTeam",
  "salesPerson",
  "model",
  "filterUnit",
  "contactName",
  "phone",
  "jobDate",
  "jobTime",
  "mapLink",
  "note",
  "customerType",
  "customerId",
  "siteId",
  "installAddress",
  "technicianIds",
] as const satisfies readonly (keyof JobFormValues)[];

export function pickJobFormValues(v: Partial<Record<string, unknown>>): JobFormValues {
  const out: Record<string, unknown> = {};
  for (const k of JOB_FORM_KEYS) if (v[k] !== undefined) out[k] = v[k];
  return out as unknown as JobFormValues;
}

/**
 * D-03: การ์ดรายละเอียดลูกค้า — ใช้ snapshot ในใบงานก่อน (ช่างอ่านได้ / ชื่อ ณ วันที่ทำรายการ)
 * ค่าจากฐานข้อมูลลูกค้า (โหลดสด) เป็น fallback สำหรับใบงานเก่าที่ยังไม่มี snapshot
 */
export function customerCardFields(
  job: Pick<Job, "customerCode" | "customerName" | "storeName" | "branchNo" | "installAddress" | "siteLat" | "siteLng">,
  partner?: Pick<Partner, "customerCode" | "name"> | null,
  site?: Pick<CustomerSite, "branchNo" | "storeName" | "addressFull" | "lat" | "lng"> | null
): { customerCode: string; customerName: string; branchNo: string; storeName: string; address: string; lat: number; lng: number } {
  const pick = (...vals: (string | undefined | null)[]) => vals.find((x) => x && String(x).trim()) ?? "";
  const lat = Number(job.siteLat) || Number(site?.lat) || 0;
  const lng = Number(job.siteLng) || Number(site?.lng) || 0;
  return {
    customerCode: pick(job.customerCode, partner?.customerCode),
    customerName: pick(job.customerName, partner?.name),
    branchNo: pick(job.branchNo, site?.branchNo),
    storeName: pick(job.storeName, site?.storeName),
    address: pick(job.installAddress, site?.addressFull),
    lat,
    lng,
  };
}

/**
 * D-16: ข้อความ LINE ที่ไม่มีช่องรองรับในฟอร์ม → ต่อท้ายหมายเหตุเสมอ (เดิมทิ้งข้อมูลเครื่องกรองเงียบ ๆ เมื่อมีเครื่องในรายการแล้ว)
 */
export function pasteExtraNote(p: { customerCode?: string; filterUnit?: string; note?: string }): string {
  return [p.customerCode ? `รหัสลูกค้า ${p.customerCode}` : "", p.filterUnit ? `เครื่องกรอง: ${p.filterUnit}` : "", p.note ?? ""]
    .filter(Boolean)
    .join("\n");
}

/** D-01: แสดงข้อความรุ่น/serial เดิมของใบงานเมื่อยังไม่มีแถวเครื่อง — รุ่นอย่างเดียวก็ต้องแสดง */
export function legacyMachineShown(lineCount: number, legacy?: { filterUnit?: string; model?: string } | null): boolean {
  return lineCount === 0 && !!(legacy?.filterUnit || legacy?.model);
}
