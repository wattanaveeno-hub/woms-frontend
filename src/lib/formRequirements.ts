// ---------------------------------------------------------------------------
// UX Redesign (MoM 23/11/69 · MOM-02, MOM-10) — รายการช่องของฟอร์มเปิดคิว/เปิดงาน
// พร้อมบอกว่าช่องไหน "ต้องกรอก" ตามกติกาจริงของระบบ
//
// แหล่งความจริงของกติกา (ห้ามเพิ่มกฎใหม่ในไฟล์นี้):
//   · เปิดคิว: backend domain/serviceQueue.ts queueCompletenessIssues()
//              = frontend lib/serviceQueueRules.ts queueFormIssues() (มี test ยืนยันว่าตรงกัน)
//   · เปิดงาน: backend domain/validation.ts createJobSchema + JobForm.submit() (ที่อยู่ติดตั้ง, เซลล์)
//
// completion นับเฉพาะช่องที่ required = true ณ ค่าปัจจุบัน — ช่องไม่บังคับไม่อยู่ในตัวหาร
// ช่องที่บังคับตามเงื่อนไข (ประเภทย่อย, หมายเหตุเมื่อ "อื่น ๆ", เหตุผลอ้างอิง) จะขึ้นเมื่อเงื่อนไขเป็นจริงเท่านั้น
// ---------------------------------------------------------------------------

export type FormSectionKey = "job" | "customer" | "machines" | "schedule";

/** ลำดับส่วนตามข้อเสนอ UX: งาน → ลูกค้าและหน้างาน → เครื่อง → นัด */
export const FORM_SECTION_ORDER: FormSectionKey[] = ["job", "customer", "machines", "schedule"];
/** ลำดับการ์ดของหน้าเปิดงาน (StepCard เดิม): ลูกค้า → งาน → นัด → เครื่อง */
export const JOB_FORM_SECTION_ORDER: FormSectionKey[] = ["customer", "job", "schedule", "machines"];

export interface RequirementRow {
  /** ชื่อฟิลด์ตามที่ API ใช้ (ใช้ต่อกับ fid() เพื่อหา id ของช่อง) */
  field: string;
  label: string;
  section: FormSectionKey;
  required: boolean;
  filled: boolean;
  /** ข้อความเมื่อยังไม่ครบ — ตรงกับข้อความของ backend/หน้าจอเดิม */
  message: string;
}

export interface Completion {
  requiredTotal: number;
  requiredDone: number;
  /** 0–100 · ไม่มีช่องบังคับเลย = 100 */
  percent: number;
  missing: RequirementRow[];
}

const txt = (v: unknown) => String(v ?? "").trim();

function row(field: string, label: string, section: FormSectionKey, required: boolean, filled: boolean, message: string): RequirementRow {
  return { field, label, section, required, filled, message };
}

/** ค่าที่ฟอร์มเปิดคิวส่ง (ตรงกับ QueueFormValues + ชื่อที่เติมจากลูกค้า/สาขา) */
export interface QueueRequirementInput {
  jobType?: string;
  jobSubType?: string;
  jobName?: string;
  customerName?: string;
  storeName?: string;
  contactName?: string;
  phone?: string;
  address?: string;
  siteId?: string;
  note?: string;
  preferredDate?: string;
  preferredTime?: string;
  items?: Array<{ equipmentId?: string; model?: string; machineType?: string } | null | undefined>;
}

function identifiesMachine(it: { equipmentId?: string; model?: string; machineType?: string } | null | undefined): boolean {
  return !!it && !!(txt(it.equipmentId) || txt(it.model) || txt(it.machineType));
}

/** ช่องของฟอร์ม "ส่งคิว" (ไม่ใช่ร่าง — ร่างบังคับแค่ประเภทงาน) */
export function queueRequirements(v: QueueRequirementInput): RequirementRow[] {
  const jobType = txt(v.jobType);
  const out: RequirementRow[] = [];
  out.push(
    row(
      "jobType",
      "ประเภทงาน",
      "job",
      true,
      !!jobType && jobType !== "INSTALL",
      !jobType ? "ต้องเลือกประเภทงาน" : "งานติดตั้งต้องเลือกประเภทย่อย เช่า ขาย หรือ เช่าซื้อ"
    )
  );
  if (jobType === "REMOVE") out.push(row("jobSubType", "ประเภทย่อย", "job", true, !!txt(v.jobSubType), "งานซ่อมถอนต้องเลือกประเภทย่อย"));
  out.push(
    row("note", "อาการ / รายละเอียดงาน", "job", jobType === "OTHER", !!txt(v.note), "ประเภทงาน “อื่น ๆ” ต้องระบุรายละเอียดในหมายเหตุ")
  );
  out.push(
    row(
      "jobName",
      "ชื่อร้าน / บริษัท / สาขา",
      "customer",
      true,
      !!(txt(v.jobName) || txt(v.customerName) || txt(v.storeName)),
      "ต้องระบุชื่อร้าน/บริษัท/ลูกค้า"
    )
  );
  out.push(row("contactName", "ผู้ติดต่อหน้างาน", "customer", true, !!txt(v.contactName), "ต้องระบุผู้ติดต่อ"));
  out.push(row("phone", "เบอร์ติดต่อหน้างาน", "customer", true, !!txt(v.phone), "ต้องระบุเบอร์โทรผู้ติดต่อ"));
  out.push(
    row("address", "ที่อยู่ หรือสาขา", "customer", true, !!(txt(v.address) || txt(v.siteId)), "ต้องระบุที่อยู่ หรือเลือกสาขาจากฐานข้อมูลลูกค้า")
  );
  out.push(
    row(
      "items",
      "เครื่องที่ต้องไป",
      "machines",
      true,
      (Array.isArray(v.items) ? v.items : []).some(identifiesMachine),
      "ต้องมีเครื่องอย่างน้อยหนึ่งรายการ (เลือกจากคลัง หรือระบุรุ่น/ประเภทเครื่อง)"
    )
  );
  out.push(row("preferredDate", "วันที่ลูกค้าสะดวก", "schedule", false, !!txt(v.preferredDate), ""));
  return out;
}

/** ค่าที่ฟอร์มเปิดงานใช้ตัดสินช่องบังคับ (ตรงกับ JobFormValues บางส่วน) */
export interface JobRequirementInput {
  jobType?: string;
  jobSubType?: string;
  jobName?: string;
  technicianTeam?: string;
  jobDate?: string;
  jobTime?: string;
  installAddress?: string;
  salesPerson?: string;
  customerId?: string;
  contactName?: string;
  phone?: string;
  note?: string;
  equipmentCount?: number;
}

export interface JobRequirementContext {
  /** เปิดงานใหม่ (ที่อยู่ติดตั้งบังคับเฉพาะงานใหม่ · INSTALL เปล่าห้ามเฉพาะงานใหม่) */
  isNew: boolean;
  /** มีรายชื่อเซลล์ใน master แล้ว (เซลล์ผู้รับผิดชอบจึงบังคับ) */
  hasSalespeople: boolean;
  /** อ้างอิงงานเดิม — ต้องมีเหตุผล */
  refJobId?: string;
  refReason?: string;
}

export function jobRequirements(v: JobRequirementInput, ctx: JobRequirementContext): RequirementRow[] {
  const jobType = txt(v.jobType);
  const installBlank = ctx.isNew && jobType === "INSTALL";
  const out: RequirementRow[] = [];
  out.push(
    row(
      "jobType",
      "ประเภทงาน",
      "job",
      true,
      !!jobType && !installBlank,
      !jobType ? "ต้องเลือกประเภทงาน" : "งานติดตั้งต้องเลือกประเภทย่อย เช่า ขาย หรือ เช่าซื้อ"
    )
  );
  if (jobType === "REMOVE") out.push(row("jobSubType", "ประเภทย่อย", "job", true, !!txt(v.jobSubType), "งานซ่อมถอนต้องเลือกประเภทย่อย"));
  out.push(row("jobName", "ชื่องาน", "job", true, !!txt(v.jobName), "ต้องระบุชื่องาน"));
  out.push(row("note", "หมายเหตุ / อาการ", "job", jobType === "OTHER", !!txt(v.note), "ประเภทงาน “อื่น ๆ” ต้องระบุรายละเอียดในหมายเหตุ"));
  if (ctx.isNew && txt(ctx.refJobId)) {
    out.push(row("refReason", "เหตุผลที่อ้างอิงงานเดิม", "job", true, !!txt(ctx.refReason), "ต้องระบุเหตุผลที่อ้างอิงงานเดิม"));
  }
  out.push(row("customerId", "ลูกค้า", "customer", false, !!txt(v.customerId) || !!txt(v.contactName), ""));
  out.push(
    row(
      "installAddress",
      "ที่อยู่ติดตั้ง",
      "customer",
      ctx.isNew,
      !!txt(v.installAddress),
      "ต้องระบุที่อยู่ติดตั้ง (เลือกสาขาเพื่อเติมให้อัตโนมัติ หรือพิมพ์เอง)"
    )
  );
  out.push(row("salesPerson", "เซลล์ผู้รับผิดชอบ", "customer", ctx.hasSalespeople, !!txt(v.salesPerson), "ต้องเลือกเซลล์ผู้รับผิดชอบ"));
  out.push(row("phone", "เบอร์ติดต่อ", "customer", false, !!txt(v.phone), ""));
  out.push(row("equipment", "เครื่อง", "machines", false, (v.equipmentCount ?? 0) > 0, ""));
  out.push(row("jobDate", "วันนัด", "schedule", true, !!txt(v.jobDate), "ต้องระบุวันที่นัด"));
  out.push(row("jobTime", "เวลานัด", "schedule", false, !!txt(v.jobTime), ""));
  out.push(row("technicianTeam", "ทีมช่าง", "schedule", true, !!txt(v.technicianTeam), "ต้องระบุทีมช่าง"));
  return out;
}

export function completionOf(rows: RequirementRow[]): Completion {
  const req = rows.filter((r) => r.required);
  const missing = req.filter((r) => !r.filled);
  const done = req.length - missing.length;
  return {
    requiredTotal: req.length,
    requiredDone: done,
    percent: req.length ? Math.round((done / req.length) * 100) : 100,
    missing,
  };
}

/** ช่องบังคับที่ยังขาด เรียงตามลำดับส่วนบนหน้าจอ — ใช้หา "ช่องแรกที่ต้องแก้" */
export function missingInOrder(rows: RequirementRow[], order: FormSectionKey[] = FORM_SECTION_ORDER): RequirementRow[] {
  const rank = (s: FormSectionKey) => order.indexOf(s);
  return rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.required && !r.filled)
    .sort((a, b) => rank(a.r.section) - rank(b.r.section) || a.i - b.i)
    .map(({ r }) => r);
}

export type SectionState = "done" | "missing" | "optional";

export interface SectionSummary {
  section: FormSectionKey;
  state: SectionState;
  /** จำนวนช่องบังคับที่ยังขาดในส่วนนี้ */
  missingCount: number;
  firstMissing?: RequirementRow;
  rows: RequirementRow[];
}

/** สถานะต่อส่วนสำหรับ Form Summary: ครบ / ต้องกรอกอีก N ช่อง / ไม่บังคับ (ส่วนที่ไม่มีช่องบังคับเลย) */
export function sectionSummaries(rows: RequirementRow[], order: FormSectionKey[] = FORM_SECTION_ORDER): SectionSummary[] {
  return order.map((section) => {
    const inSec = rows.filter((r) => r.section === section);
    const req = inSec.filter((r) => r.required);
    const miss = req.filter((r) => !r.filled);
    const state: SectionState = !req.length ? "optional" : miss.length ? "missing" : "done";
    return { section, state, missingCount: miss.length, firstMissing: miss[0], rows: inSec };
  }).filter((s) => s.rows.length > 0);
}
