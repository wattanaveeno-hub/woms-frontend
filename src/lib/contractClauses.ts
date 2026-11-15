/**
 * ข้อกำหนดเพิ่มเติมในสัญญาเช่า (UAT2-18 · Phase 4) — ฝั่งหน้าเว็บ
 * กติกาเดียวกับ backend (woms-backend src/domain/contractClauses.ts) — backend ตรวจซ้ำเสมอ
 *  - ไม่บังคับ · เฉพาะสัญญาเช่า · แก้ได้เฉพาะสัญญาสถานะร่าง
 *  - ข้อความธรรมดาหลายบรรทัด ห้ามแท็ก HTML/สคริปต์ · แสดงผลแบบข้อความเสมอ (ไม่ใช้ innerHTML)
 *  - เลขข้อในเอกสารต่อจากข้อสุดท้ายของเนื้อสัญญาหน้า 1 (ข้อ 5) → เริ่มที่ข้อ 6
 *    ไม่ชนกับ "ข้อตกลงและเงื่อนไขท้ายสัญญา" (หน้า 2) ซึ่งเป็นชุดเลขของตัวเองภายใต้หัวข้อแยก
 */

export interface ContractClause {
  order: number;
  text: string;
}

export const CLAUSE_HEADING = "ข้อกำหนดเพิ่มเติมในสัญญา";

export const CLAUSE_LIMITS = {
  maxClauses: 20,
  maxChars: 1000,
  maxLines: 20,
  maxTotalChars: 8000,
} as const;

/**
 * เลขข้อสุดท้ายของเนื้อสัญญาหน้า 1 (ข้อ 5 "ข้อตกลงและเงื่อนไขท้ายสัญญาด้านหลัง…")
 * scripts/contractClauses.test.ts ตรวจว่าตรงกับข้อความแม่แบบ RENTAL_PAGE1 เสมอ (ถ้าแม่แบบเปลี่ยน เทสต์จะล้ม)
 */
export const MAIN_CLAUSE_LAST = 5;

export function lastMainClauseNumber(): number {
  return MAIN_CLAUSE_LAST;
}

/** เลขข้อของข้อกำหนดเพิ่มเติมลำดับที่ i (เริ่ม 0) */
export function clauseNumber(i: number): number {
  return lastMainClauseNumber() + 1 + i;
}

const TAG_LIKE = /<\s*\/?\s*[a-zA-Z!?]/;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0009\u000B-\u001F\u007F‎‏‪-‮⁦-⁩﻿]/g;

export function normalizeClauseText(raw: string): string {
  return String(raw ?? "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(CONTROL, "")
    .split("\n")
    .map((l) => l.replace(/\s+$/u, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const charCount = (s: string) => Array.from(s).length;

/** ข้อผิดพลาดของแต่ละข้อ (index ตามรายการที่แก้อยู่) + ข้อผิดพลาดรวม */
export function validateClauseTexts(texts: string[]): { perItem: (string | null)[]; overall: string | null } {
  const perItem = texts.map((raw, i) => {
    const n = i + 1;
    if (TAG_LIKE.test(raw)) return `ข้อที่ ${n}: มีแท็ก HTML/สคริปต์ — ใช้ข้อความธรรมดาเท่านั้น`;
    const t = normalizeClauseText(raw);
    if (!t) return `ข้อที่ ${n}: ว่าง — กรอกข้อความหรือลบข้อนี้`;
    const c = charCount(t);
    if (c > CLAUSE_LIMITS.maxChars) return `ข้อที่ ${n}: ยาว ${c} ตัวอักษร (สูงสุด ${CLAUSE_LIMITS.maxChars})`;
    const lines = t.split("\n").length;
    if (lines > CLAUSE_LIMITS.maxLines) return `ข้อที่ ${n}: ${lines} บรรทัด (สูงสุด ${CLAUSE_LIMITS.maxLines})`;
    return null;
  });
  let overall: string | null = null;
  if (texts.length > CLAUSE_LIMITS.maxClauses) overall = `ข้อกำหนดเพิ่มเติมได้ไม่เกิน ${CLAUSE_LIMITS.maxClauses} ข้อ`;
  const total = texts.reduce((s, t) => s + charCount(normalizeClauseText(t)), 0);
  if (!overall && total > CLAUSE_LIMITS.maxTotalChars) overall = `ข้อกำหนดเพิ่มเติมรวมกันยาว ${total} ตัวอักษร (สูงสุด ${CLAUSE_LIMITS.maxTotalChars})`;
  return { perItem, overall };
}

/** แปลงรายการข้อความที่แก้อยู่ → payload ที่ส่ง API (order 1..n ตามลำดับบนจอ) */
export function toClausePayload(texts: string[]): ContractClause[] {
  return texts.map((t, i) => ({ order: i + 1, text: normalizeClauseText(t) }));
}

/** ข้อกำหนดของสัญญา (สัญญาเดิม/ตอบกลับรุ่นเก่าที่ไม่มีฟิลด์ = []) เรียงตาม order */
export function clausesOf(c: { additionalClauses?: ContractClause[] | null } | null | undefined): ContractClause[] {
  const list = Array.isArray(c?.additionalClauses) ? c!.additionalClauses! : [];
  return [...list].sort((a, b) => a.order - b.order);
}

/** การจัดหน้า: จำนวนข้อกำหนดต่อแผ่น (แผ่นแรก = หน้า 1) · ส่วนท้ายอยู่แผ่นสุดท้ายเสมอ */
export type ClauseSplit = number[];

/**
 * จัดข้อกำหนดลงแผ่นแบบ greedy จากความสูงที่วัดได้ (px)
 * cap1 = พื้นที่ที่เหลือในหน้า 1 สำหรับหัวข้อ+ข้อกำหนด (นับหัวข้อรวมแล้ว) · capN = พื้นที่ข้อกำหนดในแผ่นต่อเนื่อง
 * tail = ความสูงส่วนท้าย (ย่อหน้าพยาน + ลายเซ็น) · heights = ความสูงของแต่ละข้อ
 * กติกา: ไม่ตัดข้อ · ส่วนท้ายต้องอยู่แผ่นเดียวกับข้อสุดท้าย (ไม่ปล่อยลายเซ็นอยู่ลำพัง ถ้ายกข้อสุดท้ายไปได้)
 */
export function splitClauses(heights: number[], cap1: number, capN: number, tail: number, headH: number): ClauseSplit {
  const pages: { n: number; used: number; cap: number }[] = [{ n: 0, used: headH, cap: cap1 }];
  for (const h of heights) {
    const cur = pages[pages.length - 1];
    if (cur.used + h <= cur.cap || (cur.n === 0 && pages.length > 1)) {
      cur.n += 1;
      cur.used += h;
    } else {
      pages.push({ n: 1, used: h, cap: capN });
    }
  }
  const last = pages[pages.length - 1];
  if (last.used + tail > last.cap) {
    if (last.n > 1) {
      // ยกข้อสุดท้ายไปแผ่นใหม่พร้อมส่วนท้าย
      last.n -= 1;
      pages.push({ n: 1, used: heights[heights.length - 1], cap: capN });
    } else if (pages.length > 1 || last.n === 1) {
      // ข้อเดียวในแผ่น → ย้ายข้อนั้นไปแผ่นใหม่พร้อมส่วนท้าย (แผ่นเดิมว่าง → ตัดทิ้ง)
      const moved = last.n;
      last.n = 0;
      pages.push({ n: moved, used: heights[heights.length - 1] ?? 0, cap: capN });
    }
  }
  const out = pages.map((p) => p.n);
  // ตัดแผ่นต่อเนื่องที่ว่าง (หน้า 1 เก็บไว้เสมอ)
  return [out[0], ...out.slice(1).filter((n, i, arr) => n > 0 || i === arr.length - 1)];
}

