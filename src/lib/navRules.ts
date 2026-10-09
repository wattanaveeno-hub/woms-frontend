// ---------------------------------------------------------------------------
// กติกาของ Navigation หลัก — ฟังก์ชันบริสุทธิ์ ทดสอบได้ด้วย node --test (scripts/navRules.test.ts)
// ---------------------------------------------------------------------------

/**
 * หน้าโหมดช่างมือถือ (/m และหน้าลูก /m/...) ใช้เลย์เอาต์แบบแอป ไม่มีเมนูข้าง — ตั้งใจแยก
 *
 * บั๊กเดิม: Nav/Header ใช้ path.startsWith("/m") ซึ่งจับ "/map" และ "/master..." ไปด้วย
 * ทำให้หน้าแผนที่และข้อมูลพื้นฐาน (รวม /master/team, /master/model, /master/warranty-presets)
 * ไม่มีเมนูข้างบน Desktop และไม่มีปุ่มเปิดเมนูบนมือถือ — ต้องเทียบทั้ง segment เสมอ
 */
export function isTechModePath(path: string): boolean {
  return path === "/m" || path.startsWith("/m/");
}

/** path อยู่ใต้ href (ตรงทั้ง segment) เช่น /jobs/J01 อยู่ใต้ /jobs แต่ /jobsx ไม่ใช่ */
export function isUnder(path: string, href: string): boolean {
  return path === href || path.startsWith(href.endsWith("/") ? href : href + "/");
}

/**
 * เมนูที่ Active สำหรับ path นี้ — เลือก href ที่ "ยาวที่สุด" ที่ครอบ path อยู่ จึงมีได้รายการเดียว
 * เช่น /documents/new → "ออกเอกสาร" (ไม่ใช่ทั้ง "เอกสารการขาย" และ "ออกเอกสาร")
 *      /jobs/J01      → "งานทั้งหมด" (หน้าลูกของรายการ)
 * hrefs = เฉพาะเมนูที่ผู้ใช้เห็น (ผ่านสิทธิ์แล้ว) · ไม่มีรายการที่ครอบ → null
 */
export function activeHref(path: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const h of hrefs) {
    if (isUnder(path, h) && (best === null || h.length > best.length)) best = h;
  }
  return best;
}
