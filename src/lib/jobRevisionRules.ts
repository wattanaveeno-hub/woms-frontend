// ---------------------------------------------------------------------------
// Q-R3-13 แก้ไขหลังปิดงาน · Q-R3-03 ใบงานที่ยกเลิก · Q-R3-12 รายการติดตาม — ตรรกะล้วน (ไม่มี React)
// ทดสอบด้วย node --test (scripts/jobRevisionRules.test.ts) · กติกาจริงตรวจที่ backend เสมอ
// ---------------------------------------------------------------------------

export type RevisionStatus = "ORIGINAL" | "REQUESTED" | "APPROVED" | "REJECTED" | "WITHDRAWN";
export type RevisionSignatureStatus = "NOT_REQUIRED" | "PENDING_RESIGN" | "RESIGNED";
export type SignerType = "CUSTOMER" | "TECHNICIAN";

export const REVISION_STATUS_LABELS: Record<RevisionStatus, string> = {
  ORIGINAL: "ฉบับปิดงาน (ต้นฉบับ)",
  REQUESTED: "รอ Manager พิจารณา",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
  WITHDRAWN: "ผู้ขอยกเลิกคำขอ",
};
export const SIGNATURE_STATUS_LABELS: Record<RevisionSignatureStatus, string> = {
  NOT_REQUIRED: "ไม่ต้องลงนามใหม่",
  PENDING_RESIGN: "รอลงนามใหม่",
  RESIGNED: "ลงนามใหม่ครบแล้ว",
};
export const SIGNER_TYPE_LABELS: Record<SignerType, string> = { CUSTOMER: "ลูกค้า (ผู้ตรวจรับ)", TECHNICIAN: "ช่างผู้รับผิดชอบ" };

export interface RevisionLineForm {
  lineId: string;
  serial: string;
  resultNote: string;
  installedOn: string;
}
export interface RevisionForm {
  reason: string;
  closeNote: string;
  lines: RevisionLineForm[];
}
export interface RevisionLineCurrent {
  id: string;
  serial: string;
  resultNote?: string;
  installedOn?: string;
  result?: string;
}

/** ฟอร์มเริ่มต้น = ค่าปัจจุบันของใบงาน (เฉพาะเครื่องที่บันทึกเสร็จ) */
export function initialRevisionForm(job: { closeNote?: string }, lines: RevisionLineCurrent[]): RevisionForm {
  return {
    reason: "",
    closeNote: job.closeNote ?? "",
    lines: lines
      .filter((l) => (l.result ?? "") === "DONE")
      .map((l) => ({ lineId: l.id, serial: l.serial, resultNote: l.resultNote ?? "", installedOn: l.installedOn ?? "" })),
  };
}

/**
 * แปลงฟอร์มเป็น payload ของ API — ส่งเฉพาะช่องที่เปลี่ยนจริง (backend ปฏิเสธคำขอที่ไม่มีอะไรเปลี่ยน)
 * installedOn ส่งเฉพาะงานติดตั้ง
 */
export function buildRevisionChanges(
  form: RevisionForm,
  job: { closeNote?: string },
  lines: RevisionLineCurrent[],
  installJob: boolean
): { closeNote?: string; lines?: Array<{ lineId: string; resultNote?: string; installedOn?: string }> } {
  const out: { closeNote?: string; lines?: Array<{ lineId: string; resultNote?: string; installedOn?: string }> } = {};
  if (form.closeNote !== (job.closeNote ?? "")) out.closeNote = form.closeNote;
  const ls: Array<{ lineId: string; resultNote?: string; installedOn?: string }> = [];
  for (const f of form.lines) {
    const cur = lines.find((l) => l.id === f.lineId);
    if (!cur) continue;
    const ch: { lineId: string; resultNote?: string; installedOn?: string } = { lineId: f.lineId };
    if (f.resultNote.trim() !== (cur.resultNote ?? "")) ch.resultNote = f.resultNote.trim();
    if (installJob && f.installedOn && f.installedOn !== (cur.installedOn ?? "")) ch.installedOn = f.installedOn;
    if (Object.keys(ch).length > 1) ls.push(ch);
  }
  if (ls.length) out.lines = ls;
  return out;
}

export function hasRevisionChanges(c: ReturnType<typeof buildRevisionChanges> & { partsChanges?: PartsChange[] }): boolean {
  return c.closeNote !== undefined || (c.lines?.length ?? 0) > 0 || (c.partsChanges?.length ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// P-07 — อะไหล่ที่ใช้หลังปิดงาน (เพิ่ม / แก้ qty-unit-unitCost-note / ลบ รายเครื่อง)
// ---------------------------------------------------------------------------
export type PartsChangeOp = "ADD" | "UPDATE" | "REMOVE";
export interface PartsChange {
  op: PartsChangeOp;
  lineId: string;
  useId?: string;
  partId?: string;
  qty?: number;
  unit?: string;
  unitCost?: number;
  note?: string;
}
/** รายการอะไหล่เดิมในฟอร์ม — ค่าเป็นข้อความตามช่องกรอก · unitCost "" = ไม่แตะต้นทุน */
export interface PartUseDraft {
  useId: string;
  partCode: string;
  partName: string;
  qty: string;
  unit: string;
  unitCost: string;
  note: string;
  remove: boolean;
}
export interface PartAddDraft {
  key: string;
  partId: string;
  qty: string;
  unit: string;
  unitCost: string;
  note: string;
}
export interface PartsLineDraft {
  lineId: string;
  serial: string;
  uses: PartUseDraft[];
  adds: PartAddDraft[];
}
export interface PartUseCurrent {
  id: string;
  partCode: string;
  partName: string;
  qty: number;
  unit: string;
  unitCost: number | null;
  note: string;
}

/** ฟอร์มอะไหล่เริ่มต้น = รายการปัจจุบัน (ต้นทุนแสดงเฉพาะผู้มีสิทธิ์ — API ส่ง null ให้ผู้อื่น) */
export function initialPartsDraft(lines: Array<{ lineId: string; serial: string; partsUsed: PartUseCurrent[] }>): PartsLineDraft[] {
  return lines.map((l) => ({
    lineId: l.lineId,
    serial: l.serial,
    uses: l.partsUsed.map((u) => ({
      useId: u.id,
      partCode: u.partCode,
      partName: u.partName,
      qty: String(u.qty),
      unit: u.unit,
      unitCost: u.unitCost === null || u.unitCost === undefined ? "" : String(u.unitCost),
      note: u.note ?? "",
      remove: false,
    })),
    adds: [],
  }));
}

const numOrNull = (s: string): number | null => {
  const v = String(s ?? "").trim().replace(/,/g, "");
  if (!v || !/^\d+(\.\d+)?$/.test(v)) return null;
  return Number(v);
};

/**
 * แปลงฟอร์มอะไหล่เป็น partsChanges — ส่งเฉพาะที่เปลี่ยนจริง
 * ต้นทุนส่งเฉพาะเมื่อผู้ใช้มี parts:cost_edit (canEditCost) — backend ตอบ 403 ถ้าผู้อื่นส่ง
 * คืน { changes, problem } — problem = ข้อความภาษาไทยเมื่อกรอกไม่ถูกต้อง
 */
export function buildPartsChanges(
  drafts: PartsLineDraft[],
  current: Array<{ lineId: string; partsUsed: PartUseCurrent[] }>,
  canEditCost: boolean
): { changes: PartsChange[]; problem: string | null } {
  const out: PartsChange[] = [];
  for (const d of drafts) {
    const cur = current.find((c) => c.lineId === d.lineId);
    if (!cur) continue;
    for (const u of d.uses) {
      const was = cur.partsUsed.find((x) => x.id === u.useId);
      if (!was) continue;
      if (u.remove) {
        out.push({ op: "REMOVE", lineId: d.lineId, useId: u.useId });
        continue;
      }
      const ch: PartsChange = { op: "UPDATE", lineId: d.lineId, useId: u.useId };
      const qty = numOrNull(u.qty);
      if (qty === null || qty <= 0) return { changes: [], problem: `เครื่อง ${d.serial}: จำนวนของ ${u.partCode} ต้องมากกว่า 0` };
      if (qty !== was.qty) ch.qty = qty;
      if (u.unit.trim() && u.unit.trim() !== was.unit) ch.unit = u.unit.trim();
      if (u.note.trim() !== (was.note ?? "")) ch.note = u.note.trim();
      if (canEditCost && u.unitCost.trim() !== "") {
        const c = numOrNull(u.unitCost);
        if (c === null) return { changes: [], problem: `เครื่อง ${d.serial}: ต้นทุนของ ${u.partCode} ต้องเป็นตัวเลข` };
        if (c !== was.unitCost) ch.unitCost = c;
      }
      if (Object.keys(ch).length > 3) out.push(ch);
    }
    for (const a of d.adds) {
      if (!a.partId) return { changes: [], problem: `เครื่อง ${d.serial}: เลือกอะไหล่ที่จะเพิ่ม` };
      const qty = numOrNull(a.qty);
      if (qty === null || qty <= 0) return { changes: [], problem: `เครื่อง ${d.serial}: จำนวนอะไหล่ที่เพิ่มต้องมากกว่า 0` };
      const ch: PartsChange = { op: "ADD", lineId: d.lineId, partId: a.partId, qty };
      if (a.unit.trim()) ch.unit = a.unit.trim();
      if (a.note.trim()) ch.note = a.note.trim();
      if (canEditCost && a.unitCost.trim() !== "") {
        const c = numOrNull(a.unitCost);
        if (c === null) return { changes: [], problem: `เครื่อง ${d.serial}: ต้นทุนอะไหล่ที่เพิ่มต้องเป็นตัวเลข` };
        ch.unitCost = c;
      }
      out.push(ch);
    }
  }
  return { changes: out, problem: null };
}

/** ชื่อช่องในผลต่างที่อ่านง่าย — partsUsed[SN] → "อะไหล่ที่ใช้ [SN]" */
export function revisionFieldLabel(field: string): string {
  const m = /^(\w+)\[(.*)\]$/.exec(field);
  const names: Record<string, string> = {
    partsUsed: "อะไหล่ที่ใช้",
    resultNote: "รายละเอียดงาน",
    installedOn: "วันที่ติดตั้ง",
    snPhotos: "รูป SN",
    workPhotos: "รูปงาน",
  };
  if (m) return `${names[m[1]] ?? m[1]} [${m[2]}]`;
  return ({ closeNote: "หมายเหตุปิดงาน", photos: "รูปหน้างาน" } as Record<string, string>)[field] ?? field;
}

// ---------------------------------------------------------------------------
// P-08 — ช่างเก็บลายเซ็น
// ---------------------------------------------------------------------------
/** ปุ่ม "มอบหมายช่างเก็บลายเซ็น": Manager (changes:approve) บนฉบับปัจจุบันที่รอลงนามใหม่ */
export function canDesignateCollector(rev: { status: string; signatureStatus: string } | null | undefined, has: (p: string) => boolean): boolean {
  return !!rev && rev.status === "APPROVED" && rev.signatureStatus === "PENDING_RESIGN" && has("changes:approve");
}

/** ปัญหาของฟอร์มมอบหมาย — null = ส่งได้ */
export function collectorFormProblem(technicianId: string, reason: string): string | null {
  if (!technicianId) return "เลือกช่างที่จะเก็บลายเซ็น";
  if (reason.trim().length < 5) return "ต้องระบุเหตุผลการมอบหมาย (อย่างน้อย 5 ตัวอักษร)";
  return null;
}

/** ปัญหาของฟอร์มก่อนส่ง (ข้อความภาษาไทย) — null = ส่งได้ */
export function revisionFormProblem(form: RevisionForm, changes: ReturnType<typeof buildRevisionChanges> & { partsChanges?: PartsChange[] }): string | null {
  if (form.reason.trim().length < 5) return "ต้องระบุเหตุผลการขอแก้ไข (อย่างน้อย 5 ตัวอักษร)";
  if (!hasRevisionChanges(changes)) return "ยังไม่ได้แก้ข้อมูลใด — แก้อย่างน้อยหนึ่งช่องก่อนส่งคำขอ";
  return null;
}

/** ปุ่ม "ขอแก้ไขหลังปิดงาน": ใบงานปิดแล้ว + มีสิทธิ์ jobs:close + ไม่มีคำขอรอพิจารณา */
export function canRequestRevision(status: string, has: (p: string) => boolean, hasPending: boolean): boolean {
  return status === "CLOSED" && has("jobs:close") && !hasPending;
}

/** Manager พิจารณาได้: มี changes:approve และไม่ใช่คำขอของตนเอง */
export function canDecideRevision(rev: { status: string; requestedById: string }, userId: string, has: (p: string) => boolean): boolean {
  return rev.status === "REQUESTED" && has("changes:approve") && rev.requestedById !== userId;
}

/** ผู้ลงนามที่ยังขาดของฉบับปัจจุบัน */
export function missingSigners(rev: { status: string; signatureStatus: string; requiredSigners: SignerType[]; resigns: Array<{ signerType: SignerType }> }): SignerType[] {
  if (rev.status !== "APPROVED" || rev.signatureStatus !== "PENDING_RESIGN") return [];
  return rev.requiredSigners.filter((t) => !rev.resigns.some((r) => r.signerType === t));
}

/**
 * ปุ่มลงนามใหม่ที่ผู้ใช้คนนี้กดได้
 *   ลูกค้า: ADV5-01 — ลูกค้าเซ็นที่หน้างาน → เฉพาะช่าง (role tech) ที่ได้รับมอบหมายในใบงานนี้ (รวมช่างที่เป็นผู้ขอแก้ไข)
 *          Admin/Manager (รวมผู้อนุมัติ)/CEO/Sale/ACC/Viewer และช่างที่ไม่ได้รับมอบหมายไม่เห็นปุ่ม (backend ตอบ 403)
 *   ช่าง:  เฉพาะช่างผู้รับผิดชอบใบงาน (หรือผู้ปิดงานเมื่อใบงานไม่ระบุช่าง) ด้วยบัญชีของตนเอง
 */
export function resignActionsFor(
  missing: SignerType[],
  job: { technicianIds?: string[]; closedById?: string },
  userId: string,
  has: (p: string) => boolean,
  ctx: { role?: string; decidedById?: string; collectorId?: string } = {}
): SignerType[] {
  if (!has("jobs:close")) return [];
  const ids = job.technicianIds ?? [];
  // P-08: ช่างเก็บลายเซ็นที่ Manager มอบหมาย ลงนามฝั่งช่างในนามตนเองได้
  const isCollector = !!ctx.collectorId && ctx.collectorId === userId && ctx.role === "tech";
  return missing.filter((t) => {
    if (t === "CUSTOMER") return canCaptureCustomerResign(job, { id: userId, role: ctx.role ?? "" }, ctx.decidedById, ctx.collectorId);
    return (ids.length ? ids.includes(userId) : job.closedById === userId) || isCollector;
  });
}

/** ADV5-01 + P-08: กฎเดียวกับ backend customerResignCapturerAllowed */
export function canCaptureCustomerResign(job: { technicianIds?: string[] }, user: { id: string; role: string }, decidedById = "", collectorId = ""): boolean {
  if (!user?.id || user.role !== "tech") return false;
  if (decidedById && decidedById === user.id) return false;
  if (collectorId && collectorId === user.id) return true;
  return (job.technicianIds ?? []).includes(user.id);
}

/** ตรวจชื่อลูกค้าฝั่งหน้าเว็บ (เหมือน backend) — ห้ามว่าง ห้ามเป็นชื่อผู้บันทึก/ช่าง */
// ADV4-05: เทียบชื่อแบบเดียวกับ backend (domain/jobRevision normalizeSignerName) — ไม่สนตัวพิมพ์/ช่องว่าง/เครื่องหมาย/
//   วรรณยุกต์ไทย/คำนำหน้า (นาย นาง นางสาว น.ส. คุณ ด.ช. ด.ญ. ดร. Mr Mrs Ms Miss Dr) · ชื่อต้องห้ามยาว ≥ 4 ตัวที่อยู่ในชื่อทั้งก้อนก็ไม่ผ่าน
const SIGNER_PREFIXES = ["เด็กหญิง", "เด็กชาย", "นางสาว", "นาง", "นาย", "นส", "คุณ", "ดช", "ดญ", "ดร", "mrs", "miss", "mr", "ms", "dr"];
export function normalizeSignerName(raw: string): string {
  let v = String(raw ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{Cc}\p{Cf}\p{Z}\s\p{P}\p{S}]+/gu, "")
    .replace(/[\u0E47-\u0E4E\u0E2F\u0E46]/g, "");
  for (let changed = true; changed; ) {
    changed = false;
    for (const p of SIGNER_PREFIXES) {
      if (v.startsWith(p) && v.length - p.length >= 2) {
        v = v.slice(p.length);
        changed = true;
        break;
      }
    }
  }
  return v;
}
export function signerNameMatches(signerName: string, forbidden: string): boolean {
  const a = normalizeSignerName(signerName);
  const b = normalizeSignerName(forbidden);
  if (!a || !b) return false;
  return a === b || (b.length >= 4 && a.includes(b));
}

export function customerNameProblem(name: string, forbidden: string[]): string | null {
  const v = name.trim();
  if (v.length < 2 || normalizeSignerName(v).length < 2) return "กรอกชื่อลูกค้า/ผู้ตรวจรับที่ลงนาม";
  if (forbidden.filter(Boolean).some((n) => signerNameMatches(v, n))) return "ชื่อนี้เป็นชื่อช่าง/ผู้ขอแก้ไข/ผู้บันทึก — ช่างลงนามแทนลูกค้าไม่ได้";
  return null;
}

/** ป้ายสถานะลายเซ็นของใบงาน (แสดงบนหัวหน้าใบงาน) — "" = ไม่ต้องแสดง */
export function jobSignatureBadge(job: { status: string; currentRevisionNo?: number; revisionSignatureStatus?: string }): { label: string; tone: "warning" | "success" | "info" } | null {
  if (job.status !== "CLOSED" || !job.currentRevisionNo) return null;
  if (job.revisionSignatureStatus === "PENDING_RESIGN") return { label: `ฉบับแก้ไข r${job.currentRevisionNo} · รอลงนามใหม่`, tone: "warning" };
  if (job.revisionSignatureStatus === "RESIGNED") return { label: `ฉบับแก้ไข r${job.currentRevisionNo} · ลงนามใหม่ครบแล้ว`, tone: "success" };
  return { label: `ฉบับแก้ไข r${job.currentRevisionNo}`, tone: "info" };
}

// ---- Q-R3-03 ----
/** ใบงานที่ API ส่งมาแบบประวัติย่อ (ช่าง + ใบงานยกเลิก) — ไม่เรียกข้อมูลเครื่อง/ลิงก์/PDF */
export function isRestrictedJob(job: { restricted?: boolean } | null | undefined): boolean {
  return !!job?.restricted;
}
