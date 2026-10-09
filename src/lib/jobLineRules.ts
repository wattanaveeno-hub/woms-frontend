// กติกาข้ามฟิลด์ของข้อมูลรายเครื่องในใบงาน (JOB-01 / AT-04) — ตรงกับ backend domain/jobEquipment.ts lineFieldIssues
// หน้าเว็บใช้ซ่อนช่องที่ไม่เกี่ยวข้องและเตือนก่อนส่ง · backend ตรวจซ้ำเสมอ (แหล่งความจริง)

/** ประเภทงานที่กรอกประกันบริษัทได้ — INSTALL = ค่าเดิมก่อนแยกติดตั้งเช่า/ขาย */
export const WARRANTY_JOB_TYPES: readonly string[] = ["INSTALL_SALE", "INSTALL"];

export function warrantyAllowed(jobType: string): boolean {
  return WARRANTY_JOB_TYPES.includes(jobType);
}

export interface LineRuleFields {
  warrantyMonths?: number;
  warrantyStart?: string;
  pmMode?: string;
  pmRounds?: number;
  pmEveryMonths?: number;
  pmYears?: number;
}

export function lineFieldIssues(jobType: string, f: LineRuleFields): { field: string; message: string }[] {
  const out: { field: string; message: string }[] = [];
  const months = Number(f.warrantyMonths ?? 0) || 0;
  const start = (f.warrantyStart ?? "").trim();
  if ((months > 0 || start) && !warrantyAllowed(jobType)) {
    out.push({ field: "warrantyMonths", message: "ประกันบริษัทกรอกได้เฉพาะงานติดตั้งขาย" });
  } else if (start && months <= 0) {
    out.push({ field: "warrantyMonths", message: "ระบุวันเริ่มประกันแล้ว ต้องระบุจำนวนเดือนประกันด้วย" });
  }
  const every = Number(f.pmEveryMonths ?? 0) || 0;
  if (f.pmMode === "PACKAGE") {
    if (!(Number(f.pmRounds ?? 0) >= 1)) out.push({ field: "pmRounds", message: "PM แบบ Package ต้องระบุจำนวนรอบอย่างน้อย 1 รอบ" });
    if (!(every >= 1)) out.push({ field: "pmEveryMonths", message: "PM แบบ Package ต้องระบุความถี่ (ทุกกี่เดือน)" });
  } else if (f.pmMode === "RENTAL") {
    if (!(Number(f.pmYears ?? 0) >= 1)) out.push({ field: "pmYears", message: "PM แบบเช่าต้องระบุระยะสัญญาอย่างน้อย 1 ปี" });
    if (!(every >= 1)) out.push({ field: "pmEveryMonths", message: "PM แบบเช่าต้องระบุความถี่ (ทุกกี่เดือน)" });
  }
  return out;
}
