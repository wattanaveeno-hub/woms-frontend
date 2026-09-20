"use client";

// ---------------------------------------------------------------------------
// หัวกระดาษของเอกสารที่พิมพ์จากหน้าเว็บ (สัญญา / ใบเสร็จงวด / ใบเสนอราคา / เอกสารการขาย)
// ---------------------------------------------------------------------------
// ประวัติของไฟล์นี้ และกติกาที่ห้ามละเมิด:
//
// รอบแรก  หน้าเอกสาร HTML ทั้ง 4 หน้าพิมพ์ค่าคงที่ในโค้ดเสมอ ไม่เคยเรียก API เลย
//         ("บริษัท วอเตอร์ โซลูชัน จำกัด", เลขผู้เสียภาษี "0-0000-00000-00-0")  → QA BUG-046
// รอบสอง  เปลี่ยนมาอ่าน GET /api/settings/company แต่ยัง "ตกค่าสำรอง" เป็นค่าคงที่ชุดเดิม
//         เมื่ออ่านไม่สำเร็จ → เอกสารยังพิมพ์เลขผู้เสียภาษีที่แต่งขึ้นออกมาเงียบ ๆ
//
// **กติกาที่ใช้ตอนนี้: ห้ามแต่งข้อมูลบริษัทขึ้นเองเด็ดขาด**
// ถ้าระบบไม่รู้ว่าบริษัทชื่ออะไร เอกสารต้องบอกว่า "ยังไม่ได้ตั้งค่า" ไม่ใช่เดาให้
// โดยเฉพาะ `name` และ `taxId` ซึ่งเป็นสองอย่างที่ทำให้เอกสารดูเหมือนออกโดยนิติบุคคลจริง
// การพิมพ์เลขประจำตัวผู้เสียภาษีที่แต่งขึ้นลงบนเอกสารที่คนเอาไปลงนาม
// คือการสร้างข้อมูลปลอมในเอกสารทางการ ไม่ใช่แค่เรื่องหน้าตาของ UI
//
// จึงไม่มีค่าคงที่สำรองในไฟล์นี้อีกแล้ว (ของเดิมถูกลบทิ้ง ไม่ได้แค่เลิกใช้)
//
// สิทธิ์อ่าน: backend เปิดให้ผู้ที่ออก/พิมพ์เอกสารได้อ่านหัวกระดาษแล้ว
// (documents:view / contracts:print / quotations:print / master:manage)
// role tech ยังอ่านไม่ได้ → จะเข้าทาง "ยังไม่ได้ตั้งค่า" ซึ่งเตือนชัดเจนบนเอกสาร

import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { CompanyProfile } from "@/lib/types";

/** ข้อความแทนค่าที่ระบบยังไม่รู้ — ต้องอ่านออกว่าไม่ใช่ข้อมูลจริง และต้องไม่ใช่ตัวเลข */
export const NOT_SET = "— ยังไม่ได้ตั้งค่า —";

/**
 * ทำไมหัวกระดาษถึงว่าง — ต้องแยกให้ออก เพราะข้อความที่ผู้ใช้เห็นต่างกันคนละเรื่อง
 *   "unset"     = ระบบอ่านโปรไฟล์ได้ แต่ยังไม่ได้ตั้งค่าชื่อบริษัทไว้ → ผู้ดูแลต้องไปตั้งค่า
 *   "forbidden" = อ่านได้แต่ **บัญชีนี้ไม่มีสิทธิ์** → ข้อมูลบริษัทอาจครบอยู่แล้ว
 *                 ห้ามเขียนว่า "ยังไม่ได้ตั้งค่า" เพราะเป็นการกล่าวหาผิด
 *   "error"     = API ล่ม/เครือข่ายมีปัญหา → ลองใหม่ได้
 * ทุกกรณียังอยู่ใต้กติกาเดิม: ห้ามพิมพ์ชื่อบริษัทหรือเลขผู้เสียภาษีที่แต่งขึ้น
 */
export type LetterheadGap = "none" | "unset" | "forbidden" | "error";

export interface Letterhead {
  /** ค่าที่พิมพ์ได้จริง — เป็น "" เมื่อระบบยังไม่รู้ (ห้ามเติมค่าที่แต่งขึ้น) */
  name: string;
  address: string;
  phone: string;
  taxId: string;
  /**
   * true = ยังไม่มีข้อมูลบริษัทจริงให้พิมพ์ (อ่าน API ไม่สำเร็จ หรือยังไม่ได้ตั้งค่าชื่อบริษัท)
   * หน้าเอกสารต้องขึ้นคำเตือนที่เห็นได้ทั้งบนจอและตอนพิมพ์
   */
  isFallback: boolean;
  /** โปรไฟล์ที่อ่านได้ (null เมื่ออ่านไม่สำเร็จ) — ผู้ที่ไม่ใช่ผู้ดูแลจะได้เฉพาะฟิลด์บนหัวกระดาษ */
  profile: Partial<CompanyProfile> | null;
  /** สิ่งที่ยังขาดก่อนออกเอกสารตามแบบบริษัท — มาจาก companyIncomplete() ของ backend */
  missing: string[];
  /** เหตุผลที่หัวกระดาษใช้ไม่ได้ (ดู LetterheadGap) — "none" เมื่อใช้ได้ปกติ */
  gap: LetterheadGap;
  /** true = ยังอ่านไม่เสร็จ · ระหว่างนี้ห้ามพิมพ์หัวกระดาษออกมา */
  loading: boolean;
}

/**
 * อ่านโปรไฟล์บริษัทสำหรับหัวกระดาษ
 * อ่านไม่ได้ = คืนค่าว่างพร้อม isFallback = true — **ไม่แทนที่ด้วยค่าที่แต่งขึ้น**
 */
export function useLetterhead(): Letterhead {
  const [profile, setProfile] = useState<Partial<CompanyProfile> | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [denied, setDenied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getCompany()
      .then((r) => {
        if (cancelled) return;
        setProfile(r.company ?? null);
        setMissing(r.missing ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        // ไม่มีสิทธิ์ / API ล่ม — ปล่อยให้ว่างไว้ ไม่เติมค่าสมมติ ไม่ว่ากรณีไหน
        // แต่ต้องจำไว้ว่าเป็นกรณีไหน เพื่อไม่ให้ข้อความไปกล่าวหาผิดคน
        setProfile(null);
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setDenied(true);
        else setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const name = profile?.name ?? "";
  // ไม่มีชื่อบริษัท = ไม่มีหัวกระดาษที่ใช้ได้จริง ต่อให้ฟิลด์อื่นจะมีค่าอยู่บ้าง
  const isFallback = !name;
  const gap: LetterheadGap = !isFallback
    ? "none"
    : denied
      ? "forbidden"
      : failed
        ? "error"
        : "unset";
  return {
    name,
    address: profile?.address ?? "",
    phone: profile?.phone ?? "",
    taxId: profile?.taxId ?? "",
    isFallback,
    profile,
    missing,
    gap,
    loading,
  };
}
