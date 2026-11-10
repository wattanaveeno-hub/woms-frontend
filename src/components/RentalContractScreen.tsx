"use client";

/**
 * หน้าตัวอย่าง/พิมพ์ สัญญาเช่าเครื่องทำน้ำแข็ง (แบบฟอร์มบริษัท) — ใช้ใน /contracts/[id]/document เมื่อสัญญาเป็นประเภทเช่า
 * - ตัวอย่าง: ต้นฉบับ / คู่ฉบับ / ทั้งสองฉบับ (?copy=original|duplicate|both)
 * - พิมพ์: แต่ละฉบับ หรือทั้งสองฉบับ · บันทึก PDF = เลือก "Save as PDF" ในหน้าต่างพิมพ์ของเบราว์เซอร์
 *   (ระบบไม่มีตัวสร้าง PDF ฝั่งเซิร์ฟเวอร์ที่จัดสระ/วรรณยุกต์ไทยได้ถูกต้อง — /document.pdf เดิมใช้ pdfkit)
 * - สิทธิ์: ดูได้ตาม contracts:view (backend) · ปุ่มพิมพ์/PDF เฉพาะ contracts:print ตาม RBAC Matrix
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { bahtText } from "@/lib/baht";
import type { Contract, CustomerSite, Partner } from "@/lib/types";
import {
  RENTAL_COPY_LABEL,
  RENTAL_FIELDS,
  buildRentalContractView,
  type RentalContractInput,
  type RentalCopy,
} from "@/lib/rentalContract";
import { RentalContractDocument, type RentalFontState } from "./RentalContractDocument";

type CopySet = "original" | "duplicate" | "both";
const COPY_SETS: Record<CopySet, { label: string; copies: RentalCopy[] }> = {
  original: { label: RENTAL_COPY_LABEL.ORIGINAL, copies: ["ORIGINAL"] },
  duplicate: { label: RENTAL_COPY_LABEL.DUPLICATE, copies: ["DUPLICATE"] },
  both: { label: "ทั้งสองฉบับ", copies: ["ORIGINAL", "DUPLICATE"] },
};

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.status === 403 ? "ไม่มีสิทธิ์อ่านข้อมูล" : e.message;
  return "โหลดข้อมูลไม่สำเร็จ";
}

export function RentalContractScreen({ contract, backHref }: { contract: Contract; backHref: string }) {
  const { has } = useAuth();
  const canPrint = has("contracts:print");
  const [partner, setPartner] = useState<Partner | null>(null);
  const [site, setSite] = useState<CustomerSite | null>(null);
  const [partnerError, setPartnerError] = useState("");
  const [siteError, setSiteError] = useState("");
  const [related, setRelated] = useState(false);
  const [set, setSet] = useState<CopySet>("original");
  const [pendingPrint, setPendingPrint] = useState(false);
  const [layout, setLayout] = useState<{ font: RentalFontState; fit: [number, number]; overflow: boolean; ready: boolean }>({
    font: "loading",
    fit: [1, 1],
    overflow: false,
    ready: false,
  });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("copy");
    if (q === "original" || q === "duplicate" || q === "both") setSet(q);
  }, []);

  // ข้อมูลลูกค้า/สาขาจริงจากฐานข้อมูล (ใช้ API เดิม: GET /api/partners/:id และ /sites)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (contract.partnerId) {
        try {
          const p = await api.getPartner(contract.partnerId);
          if (alive) setPartner(p);
        } catch (e) {
          if (alive) setPartnerError(errMsg(e));
        }
        if (contract.siteId) {
          try {
            const r = await api.listCustomerSites(contract.partnerId);
            const s = r.items.find((x) => x.id === contract.siteId) ?? null;
            if (alive) {
              setSite(s);
              if (!s) setSiteError("ไม่พบสาขาที่ผูกกับสัญญา");
            }
          } catch (e) {
            if (alive) setSiteError(errMsg(e));
          }
        }
      }
      if (alive) setRelated(true);
    })();
    return () => {
      alive = false;
    };
  }, [contract.partnerId, contract.siteId]);

  const view = useMemo(() => {
    const input: RentalContractInput = { contract, partner, partnerError, site, siteError };
    return buildRentalContractView(input, bahtText);
  }, [contract, partner, partnerError, site, siteError]);

  const onLayout = useCallback((s: typeof layout) => setLayout(s), []);

  const print = (s: CopySet) => {
    setSet(s);
    setPendingPrint(true);
  };

  // สั่งพิมพ์หลังเอกสารชุดที่เลือกแสดงและจัดหน้าเสร็จแล้ว · ชื่อไฟล์ PDF ตั้งต้นมาจาก document.title
  useEffect(() => {
    if (!pendingPrint || !layout.ready) return;
    const prev = document.title;
    document.title = `สัญญาเช่า-${contract.contractNo}-${COPY_SETS[set].label}`;
    const t = window.setTimeout(() => {
      window.print();
      document.title = prev;
      setPendingPrint(false);
    }, 50);
    return () => window.clearTimeout(t);
  }, [pendingPrint, layout.ready, set, contract.contractNo]);

  const missing = view.issues.filter((i) => i.level === "missing");
  const warnings = view.issues.filter((i) => i.level === "warning");

  return (
    <div className="rc-screen">
      <div className="no-print rc-toolbar">
        <div className="rc-toolbar-row">
          <Link href={backHref} className="btn">
            ← กลับ
          </Link>
          <div className="rc-tabs" role="tablist" aria-label="เลือกฉบับที่แสดง">
            {(Object.keys(COPY_SETS) as CopySet[]).map((k) => (
              <button key={k} role="tab" aria-selected={set === k} className={`btn btn-sm${set === k ? " btn-primary" : ""}`} onClick={() => setSet(k)}>
                {COPY_SETS[k].label}
              </button>
            ))}
          </div>
          {canPrint ? (
            <div className="rc-tabs">
              <button className="btn btn-sm" onClick={() => print("original")} disabled={!related}>
                พิมพ์ต้นฉบับ
              </button>
              <button className="btn btn-sm" onClick={() => print("duplicate")} disabled={!related}>
                พิมพ์คู่ฉบับ
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => print("both")} disabled={!related}>
                พิมพ์ทั้งสองฉบับ / บันทึก PDF
              </button>
            </div>
          ) : (
            <span className="rc-hint">บัญชีนี้ดูตัวอย่างได้ แต่ไม่มีสิทธิ์พิมพ์สัญญา</span>
          )}
        </div>
        <div className="rc-hint">
          บันทึกเป็น PDF: กดพิมพ์ แล้วเลือกปลายทาง “Save as PDF / บันทึกเป็น PDF” · ขนาดกระดาษ A4 · ระยะขอบ “ไม่มี/Default” · ปิด “Headers and footers”
          {layout.font === "fallback" ? " · เครื่องนี้ไม่มีฟอนต์ Cordia New ระบบใช้ฟอนต์สำรอง (Sarabun) ที่ปรับขนาดให้ใกล้เคียง" : ""}
          {layout.fit[0] < 1 || layout.fit[1] < 1 ? ` · ข้อความยาวกว่าแบบฟอร์ม ระบบย่อตัวอักษรเหลือ ${Math.round(Math.min(...layout.fit) * 100)}% เพื่อไม่ให้ล้นหน้า` : ""}
        </div>
        {layout.overflow ? (
          <div className="alert alert-error">ข้อความยาวเกินพื้นที่กระดาษแม้ย่อแล้ว — ตรวจข้อมูลที่อยู่/ชื่อที่ยาวผิดปกติก่อนพิมพ์</div>
        ) : null}
        {warnings.length || missing.length ? (
          <div className="rc-issues" role="status">
            {warnings.map((w, i) => (
              <div key={`w${i}`}>⚠ {w.message}</div>
            ))}
            {missing.length ? (
              <div>
                ช่องที่ระบบยังไม่มีข้อมูล (เว้นเส้นจุดให้เขียนมือ · ไฮไลต์สีเหลืองเฉพาะบนจอ):{" "}
                <b>{missing.map((m) => RENTAL_FIELDS[m.field as keyof typeof RENTAL_FIELDS].label).join(" · ")}</b>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {related ? (
        <RentalContractDocument view={view} copies={COPY_SETS[set].copies} canPrint={canPrint} onLayout={onLayout} />
      ) : (
        <div className="state">กำลังโหลดข้อมูลลูกค้า/สาขา…</div>
      )}
      <style>{SCREEN_CSS}</style>
    </div>
  );
}

const SCREEN_CSS = `
.rc-screen { max-width: calc(210mm + 32px); margin: 0 auto; }
.rc-toolbar { display: flex; flex-direction: column; gap: 8px; margin: 12px 0; }
.rc-toolbar-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
.rc-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.rc-hint { font-size: 12.5px; color: var(--slate-2, #555); }
.rc-issues { font-size: 13px; padding: 8px 12px; border: 1px solid #e0c36a; background: #fff8e1; border-radius: 6px; display: flex; flex-direction: column; gap: 2px; }
@media print { .rc-screen { max-width: none; margin: 0; } }
`;
