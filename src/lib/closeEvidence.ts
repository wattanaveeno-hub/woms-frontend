// ---------------------------------------------------------------------------
// Phase 3 (ENTECH design JobDetail): การ์ด "หลักฐานปิดงาน" ในแท็บภาพรวม
// ---------------------------------------------------------------------------
// ไม่สร้างเกณฑ์เอง — สถานะของแต่ละข้อมาจากผล GET /api/jobs/:id/close-check (closeBlockers ของ backend)
// โดยจัดกลุ่มเหตุผลตามข้อความที่ backend สร้าง (domain/jobEquipment.ts) · เหตุผลที่จัดกลุ่มไม่ได้แสดงเป็นข้ออื่น ๆ ตามจริง
// ลายเซ็นลูกค้าและลายเซ็นช่างเก็บตอนกดปิดงานเท่านั้น (close-check ตัดเรื่องลายเซ็นออก) → ใบงานที่ยังเปิด = "ต้องเซ็นตอนปิดงาน"

export interface CloseCheckResult {
  canClose: boolean;
  reasons: string[];
  machines: number;
  done: number;
  signatureRequired: boolean;
}

export type EvidenceState = "ok" | "missing" | "at-close";
export interface EvidenceItem {
  key: "lines-done" | "photos" | "install-date" | "customer-signature" | "tech-signature" | "other";
  label: string;
  state: EvidenceState;
  detail?: string;
}

const PREFIX = {
  photos: "ปิดงานไม่ได้ — หลักฐานรายเครื่องยังไม่ครบ",
  pending: "ปิดใบงานไม่ได้ — ยังมีเครื่องที่ยังไม่บันทึกว่าเสร็จ",
  installDate: "ปิดใบงานไม่ได้ — ยังไม่ระบุวันที่ติดตั้งเสร็จจริง",
};

export function closeEvidenceItems(
  job: { status: string; signature?: string; closeSignoffId?: string; closedByName?: string; jobType?: string },
  check: CloseCheckResult | null
): EvidenceItem[] {
  const closed = job.status === "CLOSED";
  const reasons = closed ? [] : check?.reasons ?? [];
  const find = (p: string) => reasons.find((r) => r.startsWith(p));
  const items: EvidenceItem[] = [];
  if (closed || (check && check.machines > 0)) {
    const pending = find(PREFIX.pending);
    items.push({
      key: "lines-done",
      label: check && !closed ? `บันทึกเสร็จทุกเครื่อง (${check.done}/${check.machines})` : "บันทึกเสร็จทุกเครื่อง",
      state: pending ? "missing" : "ok",
      detail: pending,
    });
    const photos = find(PREFIX.photos);
    items.push({ key: "photos", label: "รูปป้าย SN และรูปงานครบทุกเครื่อง", state: photos ? "missing" : "ok", detail: photos });
    const inst = find(PREFIX.installDate);
    if (inst || (closed && String(job.jobType ?? "").startsWith("INSTALL"))) {
      items.push({ key: "install-date", label: "วันที่ติดตั้งเสร็จจริงครบทุกเครื่อง", state: inst ? "missing" : "ok", detail: inst });
    }
  }
  items.push({
    key: "customer-signature",
    label: "ลายเซ็นลูกค้า (ผู้ตรวจรับ)",
    state: closed ? (job.signature ? "ok" : "missing") : "at-close",
  });
  items.push({
    key: "tech-signature",
    label: "ลายเซ็นช่าง (ผู้ปิดงาน)",
    state: closed ? (job.closeSignoffId || job.closedByName ? "ok" : "missing") : "at-close",
  });
  const known = Object.values(PREFIX);
  for (const r of reasons) {
    if (!known.some((p) => r.startsWith(p))) items.push({ key: "other", label: r, state: "missing" });
  }
  return items;
}
