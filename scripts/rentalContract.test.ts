/** สัญญาเช่าเครื่องทำน้ำแข็ง (ต้นฉบับ/คู่ฉบับ) — ข้อความตรงต้นฉบับ + Data Mapping (src/lib/rentalContract.ts) */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  RENTAL_CONTRACT_TITLE,
  RENTAL_COPY_LABEL,
  RENTAL_FIELDS,
  RENTAL_PAGE1,
  RENTAL_STATIC,
  RENTAL_TERMS,
  buildRentalContractView,
  money2,
  paragraphText,
  siteAddressLine,
  thaiDateLong,
  thaiDateNumeric,
  yearsFromMonths,
  type RentalContractInput,
} from "../src/lib/rentalContract.ts";
import { bahtText } from "../src/lib/baht.ts";

const ref = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/rental-contract-reference.json"), "utf8")) as {
  original: string[];
  duplicate: string[];
};
/** เทียบแบบไม่สนช่องว่างซ้ำ/หัวท้าย (HTML ยุบช่องว่างอยู่แล้ว) — ตัวอักษรอื่นต้องตรงทุกตัว */
const norm = (s: string) => s.replace(/[\t ]+/g, " ").trim();
const refOf = (k: keyof typeof RENTAL_FIELDS) => RENTAL_FIELDS[k].ref;

test("ต้นฉบับ/คู่ฉบับ ต่างกันเฉพาะคำบนหัวกระดาษ (ไฟล์อ้างอิง)", () => {
  assert.equal(ref.original[0], RENTAL_COPY_LABEL.ORIGINAL);
  assert.equal(ref.duplicate[0], RENTAL_COPY_LABEL.DUPLICATE);
  assert.equal(ref.original.length, ref.duplicate.length);
  for (let i = 1; i < ref.original.length; i++) assert.equal(norm(ref.original[i]), norm(ref.duplicate[i]), `ย่อหน้า ${i}`);
});

test("หน้า 1: ข้อความทุกย่อหน้าตรงต้นฉบับเมื่อแทนช่องด้วย placeholder ของต้นฉบับ", () => {
  assert.equal(RENTAL_CONTRACT_TITLE, ref.original[1]);
  // ย่อหน้า 2: เลขที่สัญญา + ลงวันที่
  assert.equal(
    norm(`${RENTAL_STATIC.contractNoLabel}${refOf("contractNo")} ${RENTAL_STATIC.contractDateLabel}${refOf("contractDate")}`),
    norm(ref.original[2])
  );
  // ย่อหน้า 3–18 ตามลำดับ
  const body = ref.original.slice(3, 19);
  assert.equal(RENTAL_PAGE1.length, body.length);
  RENTAL_PAGE1.forEach((p, i) => assert.equal(norm(paragraphText(p, refOf)), norm(body[i]), `ย่อหน้า ${p.id}`));
});

test("หน้า 1: ลายเซ็น / ตราประทับ / ท้ายกระดาษ ตรงต้นฉบับ", () => {
  assert.equal(norm(`${RENTAL_STATIC.lessorCompany} ${refOf("customerName")}`), norm(ref.original[19]));
  assert.equal(norm(`${RENTAL_STATIC.lessorSignLine} ${RENTAL_STATIC.lesseeSignLine}`), norm(ref.original[20]));
  assert.equal(norm(`${RENTAL_STATIC.lessorSignatory} ${refOf("signatory")}`), norm(ref.original[21]));
  assert.equal(norm(RENTAL_STATIC.companySeal), norm(ref.original[22]));
  assert.equal(norm(RENTAL_STATIC.footerCompany), norm(ref.original[23]));
  assert.equal(norm(RENTAL_STATIC.footerAddress), norm(ref.original[24]));
});

test("หน้า 2: ข้อตกลงและเงื่อนไขท้ายสัญญาครบ 15 ข้อ ตรงตัวตามลำดับ", () => {
  assert.equal(RENTAL_STATIC.termsTitle, ref.original[25]);
  const terms = ref.original.slice(26, 48);
  assert.equal(RENTAL_TERMS.length, terms.length);
  RENTAL_TERMS.forEach((it, i) => assert.equal(norm(it.text), norm(terms[i]), `ข้อ ${it.id}`));
  const main = RENTAL_TERMS.map((x) => x.id).filter((id) => /^\d+$/.test(id));
  assert.deepEqual(main, Array.from({ length: 15 }, (_, i) => String(i + 1)));
  // หลังข้อ 15 มีแต่ย่อหน้าว่าง
  assert.ok(ref.original.slice(48).every((s) => !s.trim()));
});

test("รูปแบบวันที่ พ.ศ. และจำนวนเงิน", () => {
  assert.equal(thaiDateNumeric("2026-11-01"), "01/11/2569");
  assert.equal(thaiDateNumeric("2027-02-28"), "28/02/2570");
  assert.equal(thaiDateNumeric(""), "");
  assert.equal(thaiDateNumeric("01/11/2026"), "");
  assert.equal(thaiDateLong("2026-11-10"), "10 พฤศจิกายน 2569");
  assert.equal(money2(1500), "1,500.00");
  assert.equal(money2(1234567.5), "1,234,567.50");
  assert.equal(money2(0), "0.00");
  assert.equal(yearsFromMonths(12), 1);
  assert.equal(yearsFromMonths(36), 3);
  assert.equal(yearsFromMonths(18), null);
  assert.equal(yearsFromMonths(0), null);
});

const base: RentalContractInput = {
  contract: {
    type: "RENTAL",
    status: "ACTIVE",
    contractNo: "CT-2026-0007",
    customerName: "บริษัท ทดสอบ จำกัด",
    customerAddress: "99 ถนนทดสอบ เขตบางรัก กรุงเทพมหานคร 10500",
    siteAddress: "",
    partnerId: "p1",
    siteId: "s1",
    serial: "SN-001",
    model: "IM-100",
    startDate: "2026-11-01",
    endDate: "2027-11-01",
    rentPerMonth: 2500,
    periodMonths: 12,
    deposit: 5000,
    equipment: null,
  },
  partner: { name: "บริษัท ทดสอบ จำกัด", address: "ที่อยู่ในฐานลูกค้า", taxId: "0105555000001" },
  site: { storeName: "สาขาสีลม", branchNo: "01", address: "1 ถนนสีลม", subdistrict: "สุริยวงศ์", district: "บางรัก", province: "กรุงเทพมหานคร", postcode: "10500" },
};

test("Data Mapping: ใช้ข้อมูลจริงจากสัญญา/ลูกค้า/สาขา · ช่องที่ระบบไม่มีเว้นว่าง ไม่เดา", () => {
  const v = buildRentalContractView(base, bahtText);
  assert.equal(v.values.contractNo, "CT-2026-0007");
  assert.equal(v.values.customerName, "บริษัท ทดสอบ จำกัด");
  assert.equal(v.values.customerAddress, "99 ถนนทดสอบ เขตบางรัก กรุงเทพมหานคร 10500"); // snapshot ในสัญญามาก่อน
  assert.equal(v.values.customerTaxId, "0105555000001");
  assert.equal(v.values.model, "IM-100");
  assert.equal(v.values.serial, "SN-001");
  assert.equal(v.values.quantity, "1");
  assert.equal(v.values.branchName, "สาขาสีลม");
  assert.equal(v.values.branchAddress, "1 ถนนสีลม สุริยวงศ์ บางรัก กรุงเทพมหานคร 10500");
  assert.equal(v.values.rent, "2,500.00");
  assert.equal(v.values.rentText, "สองพันห้าร้อยบาทถ้วน");
  assert.equal(v.values.deposit, "5,000.00");
  assert.equal(v.values.depositText, "ห้าพันบาทถ้วน");
  assert.equal(v.values.years, "1");
  assert.equal(v.values.startDate, "01/11/2569");
  assert.equal(v.values.endDate, "01/11/2570");
  // ไม่มีฟิลด์ในระบบ → ว่าง
  assert.deepEqual(v.missing.sort(), ["brand", "contractDate", "signatory"].sort());
  assert.ok(v.issues.every((i) => i.level === "missing"));
});

test("Data Mapping: ไม่มีข้อมูลในสัญญา → ใช้ข้อมูลหลัก · ไม่มีทั้งคู่ → เว้นว่าง + แจ้ง", () => {
  const v = buildRentalContractView(
    { ...base, contract: { ...base.contract, customerAddress: "", siteAddress: "88 ที่อยู่ติดตั้งตามสัญญา", model: "", equipment: { id: "e", serial: "SN-001", model: "EQ-MODEL", status: "RENTED" } } },
    bahtText
  );
  assert.equal(v.values.customerAddress, "ที่อยู่ในฐานลูกค้า");
  assert.equal(v.values.branchAddress, "88 ที่อยู่ติดตั้งตามสัญญา");
  assert.equal(v.values.model, "EQ-MODEL");

  const none = buildRentalContractView(
    { ...base, partner: null, partnerError: "ไม่มีสิทธิ์อ่านข้อมูล", site: null, siteError: "ไม่มีสิทธิ์อ่านข้อมูล", contract: { ...base.contract, customerAddress: "", serial: "", rentPerMonth: 0, periodMonths: 18, deposit: 0 } },
    bahtText
  );
  for (const k of ["customerAddress", "customerTaxId", "branchName", "branchAddress", "serial", "rent", "rentText", "years"] as const) {
    assert.ok(none.missing.includes(k), k);
  }
  assert.equal(none.values.deposit, "0.00"); // ค่าที่บันทึกจริง (0) แสดงตามจริง แต่เตือน
  assert.ok(none.issues.some((i) => i.field === "deposit" && i.level === "warning"));
  assert.ok(none.issues.some((i) => i.field === "years" && /18 เดือน/.test(i.message)));
  assert.ok(none.issues.some((i) => i.field === "partner" && /ไม่มีสิทธิ์/.test(i.message)));
});

test("Data Mapping: สถานะร่าง/ยกเลิก ได้คำเตือน", () => {
  const d = buildRentalContractView({ ...base, contract: { ...base.contract, status: "DRAFT" } }, bahtText);
  assert.ok(d.issues.some((i) => i.field === "status"));
  const c = buildRentalContractView({ ...base, contract: { ...base.contract, status: "CANCELLED" } }, bahtText);
  assert.ok(c.issues.some((i) => i.field === "status" && /ยกเลิก/.test(i.message)));
});

test("ที่อยู่สาขา: ไม่ใส่ตำบลซ้ำถ้าอยู่ในบรรทัดที่อยู่แล้ว", () => {
  assert.equal(
    siteAddressLine({ storeName: "", branchNo: "", address: "1 ถนนสีลม แขวงสุริยวงศ์", subdistrict: "สุริยวงศ์", district: "บางรัก", province: "กรุงเทพมหานคร", postcode: "10500" }),
    "1 ถนนสีลม แขวงสุริยวงศ์ บางรัก กรุงเทพมหานคร 10500"
  );
  assert.equal(siteAddressLine(null), "");
});
