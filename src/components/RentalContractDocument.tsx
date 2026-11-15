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
 * ฟอนต์ (D-R2-03): Sarabun ที่ฝังมากับระบบ (OFL, /public/fonts) ฟอนต์เดียวทุกเครื่อง — ไม่พึ่ง Cordia New ของเครื่อง
 *   ย่อขนาดด้วย size-adjust ให้ความกว้างตัวอักษรใกล้ Cordia New (วัดจาก PDF อ้างอิง: ปกติ 68.4% · หนา 72%)
 * กันล้นหน้า: วัดความสูงจริงหลังฟอนต์โหลด ถ้าเนื้อหาเกินพื้นที่ (เช่น ที่อยู่ยาวมาก) ลดขนาดตัวอักษรทีละ 1%
 *   (ต่ำสุด 88%) และแจ้งบนจอ — ไม่ตัดข้อความ ไม่ย้ายข้อความข้ามหน้า
 *
 * UAT2-18 ข้อกำหนดเพิ่มเติมในสัญญา (Phase 4): มีข้อกำหนด → พิมพ์หัวข้อ "ข้อกำหนดเพิ่มเติมในสัญญา" ต่อจากข้อ 5
 *   ก่อนย่อหน้า "เพื่อเป็นหลักฐาน…" และส่วนลงนาม · เลขข้อต่อจากเนื้อสัญญา (6, 7, …)
 *   จัดหน้าจากความสูงจริงที่วัดได้ (แผ่นวัดที่ซ่อนไว้): ข้อที่ไม่พอในหน้า 1 ขึ้นแผ่นต่อเนื่อง (ขนาด/ฟอนต์เดียวกับหน้า 1)
 *   ไม่ตัดข้อกลางข้อ · ส่วนลงนามอยู่หลังข้อสุดท้ายเสมอ (ไม่แยกไปอยู่หน้าเปล่า — ยกข้อสุดท้ายไปด้วย) · ไม่ย่อตัวอักษรหน้า 1
 *   ไม่มีข้อกำหนด → เส้นทางเดิมทุกประการ (หน้า 1 + หน้า 2 ต่อฉบับ)
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
import { CLAUSE_HEADING, clauseNumber, normalizeClauseText, splitClauses, type ClauseSplit } from "@/lib/contractClauses";

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

/** ส่วนท้ายเนื้อสัญญา: ย่อหน้า "เพื่อเป็นหลักฐาน…" + ลายเซ็น (ต้องอยู่หลังข้อกำหนดเพิ่มเติมข้อสุดท้าย) */
function Tail({ view }: { view: RentalContractView }) {
  return (
    <>
      {RENTAL_PAGE1.filter((p) => p.id === WITNESS_ID).map((p) => (
        <p key={p.id} className="rc-p rc-just" data-para={p.id} data-tail="1" style={p.indent ? { textIndent: `calc(${p.indent}pt * var(--rc-fit))` } : undefined}>
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
    </>
  );
}

const WITNESS_ID = "witness";

function ClauseParas({ clauses, from, to }: { clauses: string[]; from: number; to: number }) {
  return (
    <>
      {clauses.slice(from, to).map((t, k) => {
        const i = from + k;
        return (
          <p key={i} className="rc-p rc-just rc-clause" data-clause={i} data-testid="rc-clause">
            <span className="rc-clause-no">{clauseNumber(i)}.</span>
            {normalizeClauseText(t)}
          </p>
        );
      })}
    </>
  );
}

function Footer() {
  return (
    <footer className="rc-footer">
      <p className="rc-p rc-center rc-b rc-green">{RENTAL_STATIC.footerCompany}</p>
      <p className="rc-p rc-center rc-last">{RENTAL_STATIC.footerAddress}</p>
    </footer>
  );
}

/**
 * หน้า 1 เมื่อมีข้อกำหนดเพิ่มเติม — เนื้อสัญญาข้อ 1–5 + ข้อกำหนดชุดแรก (+ ส่วนท้ายถ้าเป็นแผ่นสุดท้าย)
 * measure = แผ่นวัด (ซ่อน): ใส่ข้อกำหนดทั้งหมด + ส่วนท้าย เพื่อวัดความสูงจริง
 */
function PageOneWithClauses({
  copy,
  view,
  clauses,
  count,
  withTail,
  measure,
}: {
  copy: RentalCopy;
  view: RentalContractView;
  clauses: string[];
  count: number;
  withTail: boolean;
  measure?: boolean;
}) {
  return (
    <section
      className={`rc-sheet rc-page1${measure ? " rc-measure-sheet" : ""}`}
      data-page={measure ? "m1" : "1"}
      data-copy={copy}
      data-clause-sheet="1"
      style={{ ["--rc-fit" as string]: 1 }}
      aria-hidden={measure ? true : undefined}
    >
      <div className="rc-body">
        <div className="rc-head">
          {/* eslint-disable-next-line @next/next/no-img-element -- รูปคงที่ในเอกสารพิมพ์ */}
          <img className="rc-logo" src="/contract/entech-logo.png" alt="ENTECH" />
          <p className="rc-p rc-center rc-b rc-copy" data-testid={measure ? undefined : "rc-copy-label"}>
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
        {RENTAL_PAGE1.filter((p) => p.id !== WITNESS_ID).map((p) => (
          <p key={p.id} className="rc-p rc-just" data-para={p.id} style={p.indent ? { textIndent: `calc(${p.indent}pt * var(--rc-fit))` } : undefined}>
            <Segments segments={p.segments} view={view} />
          </p>
        ))}
        {count > 0 ? (
          <p className="rc-p rc-b rc-clause-head" data-testid="rc-clause-head">
            {CLAUSE_HEADING}
          </p>
        ) : null}
        <ClauseParas clauses={clauses} from={0} to={count} />
        {withTail ? <Tail view={view} /> : null}
      </div>
      <Footer />
    </section>
  );
}

/** แผ่นต่อเนื่องของข้อกำหนดเพิ่มเติม (ขนาด/ฟอนต์/ท้ายกระดาษเดียวกับหน้า 1) */
function ClauseSheet({
  copy,
  view,
  clauses,
  from,
  to,
  continued,
  withTail,
  measure,
}: {
  copy: RentalCopy;
  view: RentalContractView;
  clauses: string[];
  from: number;
  to: number;
  continued: boolean;
  withTail: boolean;
  measure?: boolean;
}) {
  return (
    <section
      className={`rc-sheet rc-page1 rc-page1c${measure ? " rc-measure-sheet" : ""}`}
      data-page={measure ? "m1c" : "1c"}
      data-copy={copy}
      data-clause-sheet="1"
      style={{ ["--rc-fit" as string]: 1 }}
      aria-hidden={measure ? true : undefined}
    >
      <div className="rc-body">
        <p className="rc-p rc-row rc-small rc-cont-head">
          <span>
            {RENTAL_CONTRACT_TITLE} {RENTAL_STATIC.contractNoLabel}
            {view.values.contractNo || "…"} (ต่อ)
          </span>
          <span className="rc-b">{RENTAL_COPY_LABEL[copy]}</span>
        </p>
        {to > from || measure ? (
          <p className="rc-p rc-b rc-clause-head" data-testid="rc-clause-head">
            {CLAUSE_HEADING}
            {continued ? " (ต่อ)" : ""}
          </p>
        ) : null}
        <div data-probe="start" />
        <ClauseParas clauses={clauses} from={from} to={to} />
        {withTail ? <Tail view={view} /> : null}
      </div>
      <Footer />
    </section>
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

export type RentalFontState = "loading" | "bundled" | "fallback";

/**
 * แสดงเอกสารตาม copies (ต้นฉบับ/คู่ฉบับ/ทั้งสอง) — หน้าจอ = ตัวอย่างก่อนพิมพ์ (ขนาดจริง 210 × 297 มม.)
 * onLayout: แจ้งผลการจัดหน้า (ฟอนต์ที่ใช้, ต้องย่อหรือไม่, ยังล้นอยู่หรือไม่)
 */
export function RentalContractDocument({
  view,
  copies,
  canPrint,
  onLayout,
  clauses = [],
}: {
  view: RentalContractView;
  copies: RentalCopy[];
  canPrint: boolean;
  onLayout?: (s: { font: RentalFontState; fit: [number, number]; overflow: boolean; ready: boolean; sheets?: number }) => void;
  /** UAT2-18 — ข้อกำหนดเพิ่มเติม (ข้อความ เรียงตามลำดับ) · [] = แบบฟอร์มเดิม */
  clauses?: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const hasClauses = clauses.length > 0;
  const clauseKey = clauses.join("\u0000");
  const [split, setSplit] = useState<ClauseSplit | null>(null);
  const [font, setFont] = useState<RentalFontState>("loading");
  const [fit, setFit] = useState<[number, number]>([1, 1]);
  const [overflow, setOverflow] = useState(false);
  const [ready, setReady] = useState(false);

  // ฟอนต์: ตรวจว่าเครื่องนี้มี Cordia New หรือไม่ (FontFace แบบ local() ที่หาไม่เจอ = status "error")
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // D-R2-03: ใช้ฟอนต์ที่ฝังมากับระบบฟอนต์เดียว (Sarabun · OFL) ทุกเครื่อง — ไม่ใช้ฟอนต์ของเครื่อง (Cordia New)
        //   เดิมเครื่องที่มี Cordia New กับเครื่องที่ไม่มี ได้เอกสารหน้าตาต่างกัน (UAT2-17)
        const faces = await document.fonts.load('12pt "WOMS Contract TH"', "สัญญา");
        await document.fonts.load('bold 12pt "WOMS Contract TH"', "สัญญา");
        await document.fonts.ready;
        if (alive) setFont(faces.length > 0 ? "bundled" : "fallback");
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

  // UAT2-18 — วัดความสูงจริงจากแผ่นวัด (ซ่อน) แล้วจัดข้อกำหนดลงแผ่น
  useLayoutEffect(() => {
    if (!hasClauses) {
      setSplit(null);
      return;
    }
    if (font === "loading" || measureTick === 0) return;
    const root = ref.current;
    const m1 = root?.querySelector<HTMLElement>('.rc-sheet[data-page="m1"]');
    const mc = root?.querySelector<HTMLElement>('.rc-sheet[data-page="m1c"]');
    if (!m1 || !mc) return;
    const top = (el: Element | null | undefined) => (el ? el.getBoundingClientRect().top : 0);
    const limitOf = (sheet: HTMLElement) => top(sheet.querySelector(".rc-footer")) - FIT_SAFETY_PX;
    const items = Array.from(m1.querySelectorAll<HTMLElement>("[data-clause]"));
    const head = m1.querySelector<HTMLElement>(".rc-clause-head");
    const tailStart = m1.querySelector<HTMLElement>("[data-tail]");
    const sign = m1.querySelector<HTMLElement>(".rc-sign");
    if (!head || !tailStart || !sign || items.length !== clauses.length) return;
    const heights = items.map((el, i) => top(items[i + 1] ?? tailStart) - top(el));
    const headH = top(items[0]) - top(head);
    const tailH = sign.getBoundingClientRect().bottom - top(tailStart);
    const cap1 = limitOf(m1) - top(head);
    const capN = limitOf(mc) - top(mc.querySelector("[data-probe]"));
    setSplit(splitClauses(heights, cap1, capN, tailH, headH));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clauseKey แทน clauses
  }, [hasClauses, font, measureTick, clauseKey, view]);

  useLayoutEffect(() => {
    if (font === "loading" || measureTick === 0) return;
    if (hasClauses && !split) return;
    const root = ref.current;
    if (!root) return;
    if (hasClauses) {
      // มีข้อกำหนด: หน้า 1/แผ่นต่อเนื่องไม่ย่อตัวอักษร (จัดหน้าแทน) · ตรวจล้นทุกแผ่น · หน้า 2 ย่อได้เหมือนเดิม
      let stillOverflow = false;
      root.querySelectorAll<HTMLElement>('.rc-sheet[data-page="1"], .rc-sheet[data-page="1c"]').forEach((sh) => {
        if (overflowPx(sh) > 0) stillOverflow = true;
      });
      let f2 = 1;
      const sheet2 = root.querySelector<HTMLElement>('.rc-sheet[data-page="2"]');
      if (sheet2) {
        sheet2.style.setProperty("--rc-fit", "1");
        while (overflowPx(sheet2) > 0 && f2 > FIT_MIN + 1e-9) {
          f2 = Math.round((f2 - FIT_STEP) * 100) / 100;
          sheet2.style.setProperty("--rc-fit", String(f2));
        }
        if (overflowPx(sheet2) > 0) stillOverflow = true;
      }
      setFit([1, f2]);
      setOverflow(stillOverflow);
      setReady(true);
      return;
    }
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
  }, [font, view, measureTick, copies.length, hasClauses, split]);

  const sheetsPerCopy = hasClauses && split ? split.length + 1 : 2;
  useEffect(() => {
    onLayout?.({ font, fit, overflow, ready, sheets: sheetsPerCopy });
  }, [font, fit, overflow, ready, onLayout, sheetsPerCopy]);

  const renderCopy = (copy: RentalCopy) => {
    if (!hasClauses) {
      return (
        <>
          <PageOne copy={copy} view={view} fit={fit[0]} />
          <PageTwo copy={copy} fit={fit[1]} />
        </>
      );
    }
    const sp = split ?? [clauses.length];
    let from = sp[0];
    return (
      <>
        <PageOneWithClauses copy={copy} view={view} clauses={clauses} count={sp[0]} withTail={sp.length === 1} />
        {sp.slice(1).map((n, k) => {
          const f = from;
          from += n;
          return (
            <ClauseSheet
              key={k}
              copy={copy}
              view={view}
              clauses={clauses}
              from={f}
              to={f + n}
              continued={f > 0}
              withTail={k === sp.length - 2}
            />
          );
        })}
        <PageTwo copy={copy} fit={fit[1]} />
      </>
    );
  };

  return (
    <div ref={ref} className={`rc-viewer${canPrint ? "" : " rc-noprint-doc"}`} data-ready={ready ? "1" : "0"} data-font={font}>
      <style>{RENTAL_CONTRACT_CSS}</style>
      {!canPrint ? <div className="rc-print-denied">ไม่มีสิทธิ์พิมพ์สัญญา (contracts:print)</div> : null}
      {copies.map((copy) => (
        <Fragment key={copy}>{renderCopy(copy)}</Fragment>
      ))}
      {hasClauses ? (
        // แผ่นวัดความสูง (ไม่แสดง ไม่พิมพ์) — ข้อกำหนดทั้งหมด + ส่วนท้าย
        <div className="rc-measure" aria-hidden="true">
          <PageOneWithClauses copy="ORIGINAL" view={view} clauses={clauses} count={clauses.length} withTail measure />
          <ClauseSheet copy="ORIGINAL" view={view} clauses={clauses} from={0} to={0} continued withTail={false} measure />
        </div>
      ) : null}
    </div>
  );
}

/**
 * CSS ของเอกสาร — ฝังใน <style> ของคอมโพเนนต์ (มีผลเฉพาะตอนหน้านี้เปิดอยู่)
 * เหตุผล: @page { margin: 0 } ต้องไม่รั่วไปหน้าพิมพ์อื่นของระบบ (globals.css ใช้ 14mm 12mm)
 */
const RENTAL_CONTRACT_CSS = `
@font-face { font-family: "WOMS Contract TH"; src: url("/fonts/Sarabun-Regular.ttf") format("truetype"); font-weight: 400; font-style: normal; size-adjust: 68.4%; }
@font-face { font-family: "WOMS Contract TH"; src: url("/fonts/Sarabun-Bold.ttf") format("truetype"); font-weight: 700; font-style: normal; size-adjust: 72%; }

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
  font-family: "WOMS Contract TH", serif;
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
.rc-just { text-align: justify; text-align-last: left; text-justify: inter-character; } /* UAT2-17: ภาษาไทยไม่มีเว้นวรรคระหว่างคำ — justify ปกติยืดเฉพาะช่องว่างไม่กี่จุด ทำให้ช่องไฟแต่ละบรรทัดไม่เท่ากัน */
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
/* UAT2-18 ข้อกำหนดเพิ่มเติม: เลขข้อแบบแขวน · ขึ้นบรรทัดใหม่ตามที่พิมพ์ · ตัดคำยาวไม่ให้ล้นขอบ */
.rc-clause { white-space: pre-wrap; padding-left: 1.6em; text-indent: -1.6em; overflow-wrap: anywhere; }
.rc-clause-no { display: inline-block; min-width: 1.6em; text-indent: 0; }
.rc-clause-head { margin-top: calc(2pt * var(--rc-fit)); }
.rc-cont-head { color: #333; }
.rc-measure { position: absolute; left: -10000px; top: 0; visibility: hidden; pointer-events: none; }

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
  .rc-measure { display: none !important; }
  .rc-noprint-doc .rc-print-denied { display: block; padding: 20mm; font-size: 14pt; }
}
`;
