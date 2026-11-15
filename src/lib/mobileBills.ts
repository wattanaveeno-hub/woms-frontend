// BD-10 — หน้าวางบิลของช่างบนมือถือ (ENTECH design "MBills") · ฟังก์ชันล้วน ทดสอบด้วย node --test (ห้าม import "@/")
//   ใช้ข้อมูลบิลเดิม (GET /api/bills — backend คืนเฉพาะบิลของช่างเอง) · ไม่มีการอนุมัติหรือออกเอกสารบัญชีจากหน้านี้
export type MobileBillTab = "all" | "draft" | "returned" | "review" | "approved";

export const MOBILE_BILL_TABS: { value: MobileBillTab; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "draft", label: "ร่าง" },
  { value: "returned", label: "ตีกลับ" },
  { value: "review", label: "รอตรวจ" },
  { value: "approved", label: "อนุมัติ" },
];

const GROUP: Record<string, MobileBillTab> = {
  DRAFT: "draft",
  RETURNED: "returned",
  ON_HOLD: "returned",
  SUBMITTED: "review",
  UNDER_REVIEW: "review",
  APPROVED: "approved",
  PRINTED: "approved",
  PAYMENT_PENDING: "approved",
  PAID: "approved",
};

export const mobileBillGroup = (status: string): MobileBillTab | "" => GROUP[status] ?? "";

export interface MobileBillLike {
  status: string;
  totals: { grandTotal: number };
}

export function mobileBillSummary(bills: MobileBillLike[]) {
  const satang = (n: number) => Math.round((Number(n) || 0) * 100);
  const sum = (tab: MobileBillTab) => bills.filter((b) => mobileBillGroup(b.status) === tab).reduce((s, b) => s + satang(b.totals.grandTotal), 0) / 100;
  const count = (tab: MobileBillTab) => (tab === "all" ? bills.filter((b) => b.status !== "CANCELLED").length : bills.filter((b) => mobileBillGroup(b.status) === tab).length);
  return {
    counts: Object.fromEntries(MOBILE_BILL_TABS.map((t) => [t.value, count(t.value)])) as Record<MobileBillTab, number>,
    approved: sum("approved"),
    review: sum("review"),
    total: Math.round((sum("approved") * 100 + sum("review") * 100)) / 100,
  };
}

export function filterMobileBills<T extends MobileBillLike>(bills: T[], tab: MobileBillTab): T[] {
  return tab === "all" ? bills.filter((b) => b.status !== "CANCELLED") : bills.filter((b) => mobileBillGroup(b.status) === tab);
}

/** ช่างต้องทำอะไรต่อกับบิลนี้ (ข้อความสั้นบนแถว) */
export function mobileBillAction(status: string): string {
  if (status === "DRAFT") return "ร่าง · ตรวจแล้วเซ็นส่ง";
  if (status === "RETURNED") return "ตีกลับ · แก้แล้วส่งใหม่";
  if (status === "ON_HOLD") return "พักรอข้อมูล · ตอบผู้ตรวจ";
  if (status === "PAID") return "จ่ายแล้ว · ยืนยันรับเงิน";
  return "";
}
