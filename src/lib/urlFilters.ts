"use client";

/**
 * ตัวกรองของหน้ารายการ ↔ query string ของ URL — QA BUG-009
 * ---------------------------------------------------------------------------
 * เดิมตัวกรองทุกตัวเก็บอยู่ใน state ของ React อย่างเดียว ผลคือ:
 *   - ส่งลิงก์ผลการกรองให้คนอื่นไม่ได้ · bookmark ไม่ได้
 *   - กด Back ของเบราว์เซอร์แล้วเด้งออกจากหน้าไปเลย ไม่ได้ย้อนตัวกรอง
 *   - กด F5 แล้วตัวกรองหายทั้งหมด
 *
 * ทำไมไม่ใช้ `useSearchParams()` ของ Next:
 *   ใน App Router การเรียก useSearchParams() ในคอมโพเนนต์ฝั่ง client
 *   บังคับให้ต้องมี <Suspense> ครอบตอน prerender ไม่งั้น build ล้ม
 *   หน้ารายการทั้งหมดของโปรเจกต์นี้เป็น "use client" ล้วนและไม่มี Suspense
 *   จึงอ่าน/เขียน query string ตรง ๆ ผ่าน History API ซึ่งไม่แตะโครงสร้างเดิมเลย
 *
 * ค่าที่เท่ากับค่าตั้งต้นจะ **ไม่** ถูกใส่ลง URL เพื่อให้ URL สะอาด
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type FilterValues = Record<string, string>;

function readFromSearch<T extends FilterValues>(defaults: T): T {
  if (typeof window === "undefined") return { ...defaults };
  const sp = new URLSearchParams(window.location.search);
  const out = { ...defaults };
  for (const k of Object.keys(defaults)) {
    const v = sp.get(k);
    if (v !== null) (out as FilterValues)[k] = v;
  }
  return out;
}

/**
 * คืน [ค่าปัจจุบัน, ตัวตั้งค่า] — ตัวตั้งค่ารับ patch บางส่วนได้
 * การเปลี่ยนตัวกรองใช้ `replaceState` (ไม่เพิ่มรายการใน history ทุกตัวอักษรที่พิมพ์)
 * และรับ popstate เพื่อให้ปุ่ม Back/Forward ย้อนตัวกรองได้จริง
 */
export function useUrlFilters<T extends FilterValues>(defaults: T): [T, (patch: Partial<T>) => void] {
  const defaultsRef = useRef(defaults);
  // hydration: เรนเดอร์ครั้งแรกต้องตรงกับฝั่งเซิร์ฟเวอร์ แล้วค่อยอ่าน URL ใน effect
  const [values, setValues] = useState<T>(defaultsRef.current);

  useEffect(() => {
    setValues(readFromSearch(defaultsRef.current));
    const onPop = () => setValues(readFromSearch(defaultsRef.current));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const set = useCallback((patch: Partial<T>) => {
    setValues((prev) => {
      const next = { ...prev, ...patch };
      if (typeof window !== "undefined") {
        const sp = new URLSearchParams(window.location.search);
        for (const [k, v] of Object.entries(next)) {
          if (v === "" || v === defaultsRef.current[k]) sp.delete(k);
          else sp.set(k, String(v));
        }
        const qs = sp.toString();
        window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
      }
      return next;
    });
  }, []);

  return [values, set];
}
