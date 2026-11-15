// UAT2-16 ใบรับเครื่องเข้าคลัง — ฟังก์ชันล้วนของฟอร์ม (ใช้ร่วมกับ node --test · ห้าม import "@/")

export interface ReceiptLineDraft {
  model: string;
  /** ข้อความในช่องจำนวน (NumberInput) — "" = ยังไม่กรอก */
  quantityText: string;
  /** Serial บรรทัดละ 1 เครื่อง (รองรับคั่นด้วย , ; tab จากการวางจาก Excel) */
  serialsText: string;
  condition: "" | "NEW" | "USED";
  /** BD-02 ต้นทุนต่อเครื่อง (บาท) — "" = ไม่ระบุ */
  unitCostText?: string;
}

/** แยก Serial จากช่องข้อความ: บรรทัดใหม่ / , / ; / tab · ตัดช่องว่าง · ตัดบรรทัดว่าง (ไม่ตัดซ้ำ — ให้ backend แจ้ง) */
export function splitSerials(text: string): string[] {
  return String(text ?? "")
    .split(/[\r\n,;\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** ต้นทุนเป็นสตางค์ (จำนวนเต็ม) · ช่องว่าง = null (ไม่ระบุ ไม่ใช่ 0) */
export function costSatang(text: string | undefined): number | null {
  const t = String(text ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export function receiptTotals(lines: ReceiptLineDraft[]) {
  const per = lines.map((l) => {
    const quantity = Math.max(0, Math.floor(Number(l.quantityText) || 0));
    const serials = splitSerials(l.serialsText).length;
    const unit = costSatang(l.unitCostText);
    return { quantity, serials, temp: Math.max(0, quantity - serials), overflow: serials > quantity && quantity > 0, lineCostSatang: unit === null ? null : unit * quantity };
  });
  const costed = per.filter((x) => x.lineCostSatang !== null);
  return {
    lines: per,
    total: per.reduce((n, x) => n + x.quantity, 0),
    temp: per.reduce((n, x) => n + x.temp, 0),
    anyOverflow: per.some((x) => x.overflow),
    /** null = ไม่มีบรรทัดใดใส่ต้นทุน */
    totalCost: costed.length ? costed.reduce((n, x) => n + (x.lineCostSatang as number), 0) / 100 : null,
  };
}

/** BD-12: เครื่องในใบที่ยังยกเลิกได้ (ยังไม่ถูกยกเลิก) */
export function activeReceiptMachines(r: { lines: { equipmentIds: string[]; serials: string[] }[]; cancellations?: { equipmentIds: string[] }[] }) {
  const done = new Set((r.cancellations ?? []).flatMap((c) => c.equipmentIds));
  return r.lines.flatMap((l) => l.equipmentIds.map((id, k) => ({ id, serial: l.serials[k] ?? id, cancelled: done.has(id) })));
}

export const receiptStatusLabel = (s?: string) => (s === "CANCELLED" ? "ยกเลิกแล้ว" : s === "PARTIALLY_CANCELLED" ? "ยกเลิกบางเครื่อง" : "รับเข้าแล้ว");
