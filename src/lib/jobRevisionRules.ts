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

export function hasRevisionChanges(c: ReturnType<typeof buildRevisionChanges>): boolean {
  return c.closeNote !== undefined || (c.lines?.length ?? 0) > 0;
}

/** ปัญหาของฟอร์มก่อนส่ง (ข้อความภาษาไทย) — null = ส่งได้ */
export function revisionFormProblem(form: RevisionForm, changes: ReturnType<typeof buildRevisionChanges>): string | null {
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
 *   ลูกค้า: ผู้มี jobs:close (ผู้บันทึกถืออุปกรณ์ให้ลูกค้าเซ็น — ชื่อกรอกโดยลูกค้า ไม่เติมให้)
 *   ช่าง:  เฉพาะช่างผู้รับผิดชอบใบงาน (หรือผู้ปิดงานเมื่อใบงานไม่ระบุช่าง) ด้วยบัญชีของตนเอง
 */
export function resignActionsFor(
  missing: SignerType[],
  job: { technicianIds?: string[]; closedById?: string },
  userId: string,
  has: (p: string) => boolean,
  /** ADV4-05: ผู้ขอแก้ไขฉบับนี้ — บันทึกลายเซ็นลูกค้าเองไม่ได้ (backend ตอบ 403) */
  requestedById = ""
): SignerType[] {
  if (!has("jobs:close")) return [];
  return missing.filter((t) => {
    if (t === "CUSTOMER") return !requestedById || requestedById !== userId;
    const ids = job.technicianIds ?? [];
    return ids.length ? ids.includes(userId) : job.closedById === userId;
  });
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
