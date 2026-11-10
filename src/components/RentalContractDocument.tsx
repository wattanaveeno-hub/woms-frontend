"use client";

/**
 * สัญญาเช่าเครื่องทำน้ำแข็ง — แบบฟอร์มบริษัท (ต้นฉบับ / คู่ฉบับ) ขนาด A4 · 2 หน้าต่อฉบับ
 * ---------------------------------------------------------------------------
 * ยึดรูปแบบจาก "สัญญาเช่าเครื่องทำน้ำแข็ง  ต้นฉ/คู่.docx" (Word → PDF)
 *   ระยะขอบ: บน 10 มม. · ซ้าย/ขวา 20 มม. · ล่าง 4.3 มม. (567/1134/244 twips)
 *   ฟอนต์: Cordia New · หน้า 1 = 12pt · หน้า 2 (ข้อตกลง) = 10pt · ระยะบรรทัดเดี่ยว (16.6pt / 13.85pt)
 *   ระยะหลังย่อหน้า 8pt · โลโก้ 42.67 × 12.7 มม. ชิดขอบซ้ายระดับบรรทัด "ต้นฉบับ"
 *   ท้ายกระดาษ: ENTECH ELECTRONICS CO., LTD. สีเขียว #00B050 ตัวหนา + ที่อยู่ภาษาอังกฤษ
 *
 * ฟอนต์: ใช้ Cordia New ของเครื่อง (local) เหมือนต้นฉบับ · เครื่องที่ไม่มี → Sarabun (OFL, /public/fonts)
 *   ย่อขนาดด้วย size-adjust ให้ความกว้างตัวอักษรใกล้ Cordia New (วัดจาก PDF อ้างอิง: ปกติ 68.4% · หนา 72%)
 * กันล้นหน้า: วัดความสูงจริงหลังฟอนต์โหลด ถ้าเนื้อหาเกินพื้นที่ (เช่น ที่อยู่ยาวมาก) ลดขนาดตัวอักษรทีละ 1%
 *   (ต่ำสุด 88%) และแจ้งบนจอ — ไม่ตัดข้อความ ไม่ย้ายข้อความข้ามหน้า
 */

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  RENTAL_CONTRACT_TITLE,
  RENTAL_COPY_LABEL,
  RENTAL_PAGE1,
  RENTAL_STATIC,
  RENTAL_TERMS,
  type RentalContractView,
  type RentalCopy,
  type RentalFieldKey,
  type RentalSegment,
} from "@/lib/rentalContract";

const FIT_MIN = 0.88;
const FIT_STEP = 0.01;
/** ระยะเผื่อก่อนชนท้ายกระดาษ (px) — กันความต่างของการจัดบรรทัดระหว่างจอกับตอนพิมพ์ */
const FIT_SAFETY_PX = 6;

/** ความยาวเส้นจุดของช่องที่ไม่มีข้อมูล (ตัวอักษร "…") */
const BLANK_WIDTH: Partial<Record<RentalFieldKey, number>> = {
  contractDate: 10,
  quantity: 2,
  years: 2,
  startDate: 6,
  endDate: 6,
  customerAddress: 22,
  branchAddress: 22,
  rentText: 14,
  depositText: 14,
  signatory: 14,
};

function Blank({ field }: { field: RentalFieldKey }) {
  return (
    <span className="rc-blank" data-field={field} title="ยังไม่มีข้อมูลในระบบ — เขียนด้วยมือ">
      {"…".repeat(BLANK_WIDTH[field] ?? 10)}
    </span>
  );
}

function FieldValue({ field, view, bold }: { field: RentalFieldKey; view: RentalContractView; bold?: boolean }) {
  const v = view.values[field];
  if (!v) return <Blank field={field} />;
  return (
    <span className={bold ? "rc-b rc-val" : "rc-val"} data-field={field}>
      {v}
    </span>
  );
}

function Segments({ segments, view }: { segments: RentalSegment[]; view: RentalContractView }) {
  return (
    <>
      {segments.map((s, i) =>
        "f" in s ? (
          <FieldValue key={i} field={s.f} view={view} bold={s.b} />
        ) : s.b ? (
          <span key={i} className="rc-b">
            {s.t}
          </span>
        ) : (
          <Fragment key={i}>{s.t}</Fragment>
        )
      )}
    </>
  );
}

function PageOne({ copy, view, fit }: { copy: RentalCopy; view: RentalContractView; fit: number }) {
  return (
    <section className="rc-sheet rc-page1" data-page="1" data-copy={copy} style={{ ["--rc-fit" as string]: fit }}>
      <div className="rc-body">
        <div className="rc-head">
          {/* eslint-disable-next-line @next/next/no-img-element -- รูปคงที่ในเอกสารพิมพ์ ต้องโหลดตรงไม่ผ่าน image optimizer */}
          <img className="rc-logo" src="/contract/entech-logo.png" alt="ENTECH" />
          <p className="rc-p rc-center rc-b rc-copy" data-testid="rc-copy-label">
            {RENTAL_COPY_LABEL[copy]}
          </p>
          <p className="rc-p rc-center">{RENTAL_CONTRACT_TITLE}</p>
        </div>
        <p className="rc-p rc-row">
          <span>
            {RENTAL_STATIC.contractNoLabel}
            <FieldValue field="contractNo" view={view} />
          </span>
          <span>
            {RENTAL_STATIC.contractDateLabel}
            <FieldValue field="contractDate" view={view} />
          </span>
        </p>
        {RENTAL_PAGE1.map((p) => (
          <p key={p.id} className="rc-p rc-just" data-para={p.id} style={p.indent ? { textIndent: `calc(${p.indent}pt * var(--rc-fit))` } : undefined}>
            <Segments segments={p.segments} view={view} />
          </p>
        ))}
        <div className="rc-sign" data-testid="rc-sign">
          <div className="rc-sign-col rc-sign-left">
            <p className="rc-p rc-b">{RENTAL_STATIC.lessorCompany}</p>
            <p className="rc-p rc-b rc-nowrap">{RENTAL_STATIC.lessorSignLine}</p>
            <p className="rc-p">{RENTAL_STATIC.lessorSignatory}</p>
          </div>
          <div className="rc-sign-col rc-sign-right">
            <p className="rc-p">
              <FieldValue field="customerName" view={view} bold />
            </p>
            <p className="rc-p rc-b rc-nowrap">{RENTAL_STATIC.lesseeSignLine}</p>
            <p className="rc-p">
              {view.values.signatory ? <FieldValue field="signatory" view={view} bold /> : <>(<Blank field="signatory" />)</>}
            </p>
            <p className="rc-p rc-small">{RENTAL_STATIC.companySeal}</p>
          </div>
        </div>
      </div>
      <footer className="rc-footer">
        <p className="rc-p rc-center rc-b rc-green">{RENTAL_STATIC.footerCompany}</p>
        <p className="rc-p rc-center rc-last">{RENTAL_STATIC.footerAddress}</p>
      </footer>
    </section>
  );
}

function PageTwo({ copy, fit }: { copy: RentalCopy; fit: number }) {
  return (
    <section className="rc-sheet rc-page2" data-page="2" data-copy={copy} style={{ ["--rc-fit" as string]: fit }}>
      <div className="rc-body">
        <p className="rc-p rc-center rc-b">{RENTAL_STATIC.termsTitle}</p>
        {RENTAL_TERMS.map((it) => (
          <p key={it.id} className="rc-p rc-just" data-term={it.id} style={it.indent ? { textIndent: `calc(${it.indent}pt * var(--rc-fit))` } : undefined}>
            {it.text}
          </p>
        ))}
      </div>
    </section>
  );
}

/** px ที่เนื้อหาเกินพื้นที่ของแผ่น (บวก = ล้น) */
function overflowPx(sheet: HTMLElement): number {
  const body = sheet.querySelector<HTMLElement>(".rc-body");
  const last = body?.lastElementChild as HTMLElement | null;
  if (!body || !last) return 0;
  const rect = sheet.getBoundingClientRect();
  const padBottom = parseFloat(getComputedStyle(sheet).paddingBottom) || 0;
  const footer = sheet.querySelector<HTMLElement>(".rc-footer");
  const limit = footer ? footer.getBoundingClientRect().top : rect.bottom - padBottom;
  // ระยะหลังย่อหน้าสุดท้าย (margin-bottom) ไม่นับ — Word ก็ไม่นับที่ท้ายหน้า
  const lastRect = last.getBoundingClientRect();
  // ท้ายกระดาษถูกดันพ้นขอบล่าง (เกิดเมื่อเนื้อหาล้น flex container)
  const footerOut = footer ? footer.getBoundingClientRect().bottom - (rect.bottom - padBottom) : -Infinity;
  return Math.max(lastRect.bottom - limit + FIT_SAFETY_PX, footerOut > 0.5 ? footerOut : -Infinity);
}

export type RentalFontState = "loading" | "cordia" | "fallback";

/**
 * แสดงเอกสารตาม copies (ต้นฉบับ/คู่ฉบับ/ทั้งสอง) — หน้าจอ = ตัวอย่างก่อนพิมพ์ (ขนาดจริง 210 × 297 มม.)
 * onLayout: แจ้งผลการจัดหน้า (ฟอนต์ที่ใช้, ต้องย่อหรือไม่, ยังล้นอยู่หรือไม่)
 */
export function RentalContractDocument({
  view,
  copies,
  canPrint,
  onLayout,
}: {
  view: RentalContractView;
  copies: RentalCopy[];
  canPrint: boolean;
  onLayout?: (s: { font: RentalFontState; fit: [number, number]; overflow: boolean; ready: boolean }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [font, setFont] = useState<RentalFontState>("loading");
  const [fit, setFit] = useState<[number, number]>([1, 1]);
  const [overflow, setOverflow] = useState(false);
  const [ready, setReady] = useState(false);

  // ฟอนต์: ตรวจว่าเครื่องนี้มี Cordia New หรือไม่ (FontFace แบบ local() ที่หาไม่เจอ = status "error")
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const faces = await document.fonts.load('12pt "WOMS Contract TH"', "สัญญา");
        await document.fonts.load('bold 12pt "WOMS Contract TH Fallback"', "สัญญา");
        await document.fonts.load('12pt "WOMS Contract TH Fallback"', "สัญญา");
        await document.fonts.ready;
        if (alive) setFont(faces.length > 0 ? "cordia" : "fallback");
      } catch {
        if (alive) setFont("fallback");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // จัดหน้า: ลดขนาดทีละขั้นจนไม่ล้น (คำนวณใหม่เมื่อฟอนต์หรือข้อมูลเปลี่ยน)
  const [measureTick, setMeasureTick] = useState(0);
  // วัดใหม่เมื่อฟอนต์ชุดใดโหลดเสร็จภายหลัง (เช่น ตัวหนาโหลดช้ากว่าตัวปกติ)
  useEffect(() => {
    const bump = () => setMeasureTick((n) => n + 1);
    document.fonts.addEventListener("loadingdone", bump);
    return () => document.fonts.removeEventListener("loadingdone", bump);
  }, []);
  useEffect(() => {
    if (font === "loading") return;
    let alive = true;
    // รอให้ฟอนต์ถูกใช้จริงใน layout ก่อนวัด (2 เฟรม)
    document.fonts.ready.then(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => alive && setMeasureTick((n) => n + 1)))
    );
    return () => {
      alive = false;
    };
  }, [font]);

  useLayoutEffect(() => {
    if (font === "loading" || measureTick === 0) return;
    const root = ref.current;
    if (!root) return;
    const next: [number, number] = [1, 1];
    let stillOverflow = false;
    for (const page of [1, 2] as const) {
      const sheet = root.querySelector<HTMLElement>(`.rc-sheet[data-page="${page}"]`);
      if (!sheet) continue;
      let f = 1;
      sheet.style.setProperty("--rc-fit", "1");
      while (overflowPx(sheet) > 0 && f > FIT_MIN + 1e-9) {
        f = Math.round((f - FIT_STEP) * 100) / 100;
        sheet.style.setProperty("--rc-fit", String(f));
      }
      if (overflowPx(sheet) > 0) stillOverflow = true;
      next[page - 1] = f;
    }
    setFit(next);
    setOverflow(stillOverflow);
    setReady(true);
  }, [font, view, measureTick, copies.length]);

  useEffect(() => {
    onLayout?.({ font, fit, overflow, ready });
  }, [font, fit, overflow, ready, onLayout]);

  return (
    <div ref={ref} className={`rc-viewer${canPrint ? "" : " rc-noprint-doc"}`} data-ready={ready ? "1" : "0"} data-font={font}>
      <style>{RENTAL_CONTRACT_CSS}</style>
      {!canPrint ? <div className="rc-print-denied">ไม่มีสิทธิ์พิมพ์สัญญา (contracts:print)</div> : null}
      {copies.map((copy) => (
        <Fragment key={copy}>
          <PageOne copy={copy} view={view} fit={fit[0]} />
          <PageTwo copy={copy} fit={fit[1]} />
        </Fragment>
      ))}
    </div>
  );
}

/**
 * CSS ของเอกสาร — ฝังใน <style> ของคอมโพเนนต์ (มีผลเฉพาะตอนหน้านี้เปิดอยู่)
 * เหตุผล: @page { margin: 0 } ต้องไม่รั่วไปหน้าพิมพ์อื่นของระบบ (globals.css ใช้ 14mm 12mm)
 */
const RENTAL_CONTRACT_CSS = `
@font-face { font-family: "WOMS Contract TH"; src: local("Cordia New"), local("CordiaNew"); font-weight: 400; font-style: normal; }
@font-face { font-family: "WOMS Contract TH"; src: local("Cordia New Bold"), local("CordiaNew-Bold"); font-weight: 700; font-style: normal; }
@font-face { font-family: "WOMS Contract TH Fallback"; src: url("/fonts/Sarabun-Regular.ttf") format("truetype"); font-weight: 400; font-style: normal; size-adjust: 68.4%; }
@font-face { font-family: "WOMS Contract TH Fallback"; src: url("/fonts/Sarabun-Bold.ttf") format("truetype"); font-weight: 700; font-style: normal; size-adjust: 72%; }

.rc-viewer { background: #dfe3e8; padding: 16px; overflow-x: auto; border-radius: 6px; }
.rc-sheet {
  --rc-fit: 1;
  position: relative;
  width: 210mm; height: 297mm;
  margin: 0 auto 16px;
  padding: 10mm 20mm 4.3mm;
  box-sizing: border-box;
  display: flex; flex-direction: column;
  background: #fff; color: #000;
  box-shadow: 0 1px 4px rgba(0,0,0,.25);
  font-family: "WOMS Contract TH", "WOMS Contract TH Fallback", serif;
  font-weight: 400;
  line-height: 1.385;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  font-kerning: normal;
}
.rc-sheet:last-child { margin-bottom: 0; }
.rc-page1 { font-size: calc(12pt * var(--rc-fit)); }
.rc-page2 { font-size: calc(10pt * var(--rc-fit)); }
.rc-body { flex: 0 1 auto; min-height: 0; }
.rc-p { margin: 0 0 calc(8pt * var(--rc-fit)); padding: 0; white-space: normal; overflow-wrap: break-word; }
.rc-just { text-align: justify; text-align-last: left; }
.rc-center { text-align: center; }
.rc-b { font-weight: 700; }
.rc-nowrap { white-space: nowrap; }
.rc-small { font-size: calc(10pt * var(--rc-fit)); }
.rc-green { color: #00B050; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.rc-head { position: relative; }
.rc-logo { position: absolute; left: 0; top: 0.04mm; width: 42.67mm; height: 12.7mm; }
.rc-row { display: flex; justify-content: space-between; gap: 12pt; }
.rc-sign { display: flex; justify-content: space-between; align-items: flex-start; }
.rc-sign-col { text-align: center; }
.rc-sign-left { width: 157pt; }
.rc-sign-right { width: 168pt; }
.rc-footer { margin-top: auto; }
.rc-footer .rc-last { margin-bottom: 0; }
.rc-blank { letter-spacing: 0; }
.rc-print-denied { display: none; }

@media screen {
  .rc-blank { background: #fff3bf; outline: 1px dashed #c99a00; outline-offset: -1px; }
}

@media print {
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .rc-viewer { background: none; padding: 0; margin: 0; overflow: visible; border-radius: 0; }
  .rc-sheet { margin: 0; box-shadow: none; break-after: page; page-break-after: always; break-inside: avoid; }
  .rc-sheet:last-of-type { break-after: auto; page-break-after: auto; }
  .rc-noprint-doc .rc-sheet { display: none !important; }
  .rc-noprint-doc .rc-print-denied { display: block; padding: 20mm; font-size: 14pt; }
}
`;
