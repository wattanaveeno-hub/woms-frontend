"use client";

/**
 * ตัวช่วยกลางสำหรับ "ข้อความผิดพลาดที่ผูกกับช่องกรอก"
 * ---------------------------------------------------------------------------
 * ก่อนหน้านี้มีแต่ `EquipmentForm` ที่ทำครบตามเกณฑ์ B-05/B-06 (label ถาวรผูกกับ
 * ช่องกรอก · `.field-error` มี id · input มี aria-invalid + aria-describedby)
 * ส่วนฟอร์มอื่น (PartnerForm, สต๊อก, การเงินใบงาน ฯลฯ) ไม่มีเลย และโยนทุกอย่าง
 * ออกเป็น toast อย่างเดียว ผู้ใช้จึงไม่รู้ว่าช่องไหนผิด — QA BUG-001/002/022
 *
 * ไฟล์นี้ยก pattern เดิมของ EquipmentForm ออกมาเป็นของใช้ร่วม ไม่ได้เปลี่ยนวิธีทำ
 * และไม่ได้เพิ่ม dependency ใด ๆ — ยังเป็น React + CSS ของโปรเจกต์เหมือนเดิม
 */

import { useCallback, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";

export interface FieldIssue {
  field: string;
  message: string;
}

export interface FieldErrorHelpers {
  /** ข้อผิดพลาดที่ค้างอยู่ตอนนี้ (null = ไม่มี) */
  issue: FieldIssue | null;
  /** id ของช่องกรอก — ใช้กับ label[for] และ input id */
  fid: (field: string) => string;
  /** ช่องข้อความผิดพลาดใต้ field (คืน null เมื่อช่องนี้ไม่ผิด) */
  errFor: (field: string) => JSX.Element | null;
  /** props ที่บอก screen reader ว่าช่องนี้ผิด และข้อความอยู่ที่ไหน */
  aria: (field: string) => { "aria-invalid"?: true; "aria-describedby"?: string };
  /** ตั้งข้อผิดพลาดเอง (client-side validation) */
  setIssue: (field: string, message: string) => void;
  /** ล้างข้อผิดพลาด — เรียกก่อนส่งฟอร์มทุกครั้ง */
  clear: () => void;
  /**
   * รับ error จาก API แล้วเอาไปแปะที่ช่องถ้ารู้ว่าเป็นช่องไหน
   * คืน `true` เมื่อแปะที่ช่องได้ (ผู้เรียกจะได้ไม่ต้องขึ้น toast ซ้ำ)
   */
  fromApi: (e: unknown, knownFields: readonly string[]) => boolean;
}

/** prefix ต้องไม่ซ้ำกันในหน้าเดียวกัน เช่น "ptn", "loc", "fin" */
export function useFieldErrors(prefix: string): FieldErrorHelpers {
  const [issue, setIssueState] = useState<FieldIssue | null>(null);

  const fid = useCallback((field: string) => `${prefix}-${field}`, [prefix]);
  const errId = useCallback((field: string) => `${prefix}-${field}-error`, [prefix]);

  const errFor = useCallback(
    (field: string) =>
      issue && issue.field === field ? (
        <span className="field-error" id={errId(field)} role="alert">
          {issue.message}
        </span>
      ) : null,
    [issue, errId]
  );

  const aria = useCallback(
    (field: string) =>
      issue && issue.field === field
        ? { "aria-invalid": true as const, "aria-describedby": errId(field) }
        : {},
    [issue, errId]
  );

  const setIssue = useCallback((field: string, message: string) => setIssueState({ field, message }), []);
  const clear = useCallback(() => setIssueState(null), []);

  const fromApi = useCallback((e: unknown, knownFields: readonly string[]) => {
    if (!(e instanceof ApiError) || !e.field) return false;
    // backend ส่ง field เป็น path เช่น "items.0.qty" — เทียบที่ส่วนท้ายด้วย
    const tail = e.field.split(".").pop() ?? e.field;
    const match = knownFields.find((f) => f === e.field || f === tail);
    if (!match) return false;
    setIssueState({ field: match, message: e.message });
    return true;
  }, []);

  return useMemo(
    () => ({ issue, fid, errFor, aria, setIssue, clear, fromApi }),
    [issue, fid, errFor, aria, setIssue, clear, fromApi]
  );
}

/**
 * ช่องกรอกจำนวนเงิน — QA BUG-011
 * เดิมเป็น `<input type="text">` ที่ไม่ตรวจอะไรเลย: `abc` กลายเป็น 0 เงียบ ๆ
 * และ `1e5` กลายเป็น 100,000 บาท เงียบ ๆ (Number() รับ exponent notation)
 * ฟังก์ชันนี้คือกติกาเดียวที่ทุกช่องเงินในระบบใช้ร่วมกัน
 */
export const MONEY_MAX = 1_000_000_000; // หนึ่งพันล้านบาท — กันพิมพ์ผิดจนล้น

export function parseMoney(raw: string): { ok: true; value: number } | { ok: false; message: string } {
  const s = raw.trim();
  if (s === "") return { ok: true, value: 0 };
  // ยอมรับเฉพาะเลขฐานสิบล้วน (มีจุดทศนิยมได้) — ปฏิเสธ 1e5, 0x10, Infinity, ช่องว่างใน
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(s.replace(/,/g, ""))) {
    return { ok: false, message: "กรอกเป็นตัวเลขเท่านั้น (ไม่เกิน 2 ตำแหน่งทศนิยม) เช่น 1500 หรือ 1500.50" };
  }
  const n = Number(s.replace(/,/g, ""));
  if (!Number.isFinite(n)) return { ok: false, message: "กรอกเป็นตัวเลขเท่านั้น" };
  if (n < 0) return { ok: false, message: "ต้องไม่ติดลบ" };
  if (n > MONEY_MAX) return { ok: false, message: `ยอดต้องไม่เกิน ${MONEY_MAX.toLocaleString("th-TH")} บาท` };
  return { ok: true, value: n };
}

/**
 * วันที่แบบ date-only — QA BUG-019
 * เดิมตรวจแค่รูปแบบสตริงด้วย regex จึงรับ `2026-13-45` ซึ่งเป็นวันที่ที่ไม่มีอยู่จริง
 * ที่นี่ตรวจว่า parse กลับมาแล้วได้วันเดิมจริง ๆ
 */
export function parseISODate(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return { ok: false, message: "วันที่ต้องเป็นรูปแบบ YYYY-MM-DD" };
  }
  const t = Date.parse(`${s}T00:00:00Z`);
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== s) {
    return { ok: false, message: `ไม่มีวันที่ ${s} อยู่จริงในปฏิทิน` };
  }
  return { ok: true, value: s };
}
