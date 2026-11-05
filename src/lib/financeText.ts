// ---------------------------------------------------------------------------
// ข้อความ Service Margin สำหรับผู้ใช้ (UAT-UX-01)
//   backend ส่งคำอธิบายที่มีรหัสอ้างอิงภายใน (ADV3-01, Q-06, MAR-03, CURRENT_IMPLEMENTATION_ASSUMPTION ฯลฯ)
//   ไว้สำหรับทีมพัฒนา/QA — หน้าจอแสดงเป็นภาษาผู้ใช้ โดยไม่เปลี่ยนตัวเลข สูตร หรือคำเตือนที่มีผลต่อความถูกต้อง
//   รหัสอ้างอิงและกติกาเต็มอยู่ในเอกสาร (domain/equipmentFinance.ts ฝั่ง backend)
// ---------------------------------------------------------------------------

/** ตัดรหัสอ้างอิงภายในออกจากข้อความที่มาจาก backend — เนื้อความอื่นคงเดิม */
export function toUserText(s: string | null | undefined): string {
  let t = String(s ?? "");
  t = t.replace(/CURRENT_IMPLEMENTATION_ASSUMPTION\s*(\([^)]*\))?\s*:?\s*/g, "");
  // ป้ายรหัสในวงเล็บ เช่น (ADV3-01) (Q-06 / Q-07) (IDX-01/MAR-01) (D-11) (owner decision 30 ต.ค. 2569)
  t = t.replace(/\s*\((?:\s*(?:ADV\d+[A-Z]?-\d+|Q(?:-R\d+)?-\d+|IDX-\d+|MAR-\d+(?:\.\.\d+)?|D-\d+[A-Z]?|AT-\d+|QUO-\d+|PART-\d+|BR-[\d.]+)\s*[/,·]?\s*)+\)/g, "");
  t = t.replace(/\s*\(owner decision[^)]*\)/gi, "");
  // รหัสนำหน้าประโยค เช่น "ADV3-01: …" "MAR-03 — …"
  t = t.replace(/(^|[\s·])(?:ADV\d+[A-Z]?-\d+|MAR-\d+(?:\.\.\d+)?)\s*[:—-]\s*/g, "$1");
  t = t.replace(/สูตร\s+MAR-01\.\.03/g, "สูตร Service Margin").replace(/\bMAR-01\.\.03\b/g, "สูตร Service Margin");
  t = t.replace(/ใช้\s+MAR-01\b/g, "ใช้ราคาค่าติดตั้งของรุ่นแล้ว");
  t = t.replace(/\s*\bMAR-\d+(?:\.\.\d+)?\b/g, "");
  t = t.replace(/\(job_equipment\)/g, "").replace(/\bjob_equipment\b/g, "เครื่องในใบงาน");
  return t.replace(/\s{2,}/g, " ").replace(/\s+([,)])/g, "$1").trim();
}

const BILL_STATUS_TH: Record<string, string> = {
  APPROVED: "อนุมัติแล้ว",
  PRINTED: "พิมพ์แล้ว",
  PAYMENT_PENDING: "รอจ่าย",
  PAID: "จ่ายแล้ว",
};

/** เกณฑ์รับรู้รายจ่าย — ประโยคเดียวที่ผู้ใช้เข้าใจ (สถานะมาจาก backend จริง ไม่ hardcode) */
export function costBasisText(recognizedStatuses: string[]): string {
  const names = recognizedStatuses.map((s) => BILL_STATUS_TH[s] ?? s).join(" / ");
  return `ระบบนับรายจ่ายเมื่อบิลช่างได้รับการอนุมัติแล้ว (${names}) · บิลที่ยังไม่อนุมัติแสดงเป็นยอดรอ · บิลที่ยกเลิกไม่นับ`;
}

/** ข้อความคงที่ของ backend → ประโยคผู้ใช้ (ข้อความอื่นใช้ toUserText) */
const KNOWN: Array<[RegExp, string]> = [
  [/^CURRENT_IMPLEMENTATION_ASSUMPTION \(Q-07\): "ยืนยันงานติดตั้ง"/, "รายรับติดตั้งนับเมื่อใบงานติดตั้งปิดงานแล้ว · ส่วนลดรายเครื่องคิดเป็นบาท"],
  [/^รายรับติดตั้ง = ราคาค่าติดตั้งจาก Model Index/, "รายรับติดตั้ง = ราคาค่าติดตั้งของรุ่นใน Model Index − ส่วนลดรายเครื่อง · เครื่องที่เพิ่มเข้าใบงานหลังมีราคา ใช้ราคา ณ วันที่เพิ่ม · ข้อมูลเดิมใช้ราคาปัจจุบัน"],
  [/^ต้นทุนมาตรฐานใน Equipment Model Master/, "ต้นทุนมาตรฐานของรุ่นเป็นค่าอ้างอิงเพื่อเปรียบเทียบ ไม่นับเป็นรายรับ และไม่รวมในต้นทุนหรือกำไร"],
  [/^CURRENT_IMPLEMENTATION_ASSUMPTION \(Q-08\)/, "ค่าใช้จ่ายร่วมของใบงานหารเท่ากันตามจำนวนเครื่องในใบงาน · เศษสตางค์อยู่ที่เครื่องสุดท้าย เพื่อให้รวมแล้วเท่ายอดจริง"],
  [/^รายรับจาก QUO = /, "รายรับจากใบเสนอราคา = จำนวน × ราคาต่อหน่วย − ส่วนลดรายบรรทัด (ก่อน VAT) · ส่วนลดท้ายใบและ VAT ไม่กระจายลงรายเครื่อง"],
];
export function assumptionText(s: string): string {
  for (const [re, out] of KNOWN) if (re.test(s)) return out;
  return toUserText(s);
}
