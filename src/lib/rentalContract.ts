// ---------------------------------------------------------------------------
// สัญญาเช่าเครื่องทำน้ำแข็ง (ต้นฉบับ / คู่ฉบับ) — แบบฟอร์มของบริษัท ENTECH ELECTRONICS CO., LTD.
// ---------------------------------------------------------------------------
// ที่มาของข้อความ: "สัญญาเช่าเครื่องทำน้ำแข็ง  ต้นฉ.docx" และ "สัญญาเช่าเครื่องทำน้ำแข็ง  คู่.docx"
//   สองไฟล์ต่างกันเฉพาะคำบนหัวกระดาษ ("ต้นฉบับ" / "คู่ฉบับ") — เนื้อหาสัญญาเหมือนกันทุกข้อ
//
// กติกาของไฟล์นี้:
//   1. ข้อความสัญญาคัดลอกตรงตัวจากไฟล์ .docx — ห้ามแก้แม้เจอคำผิด (ข้อเสนอแก้ไขอยู่ในรายงาน รอ Owner อนุมัติ)
//      scripts/rentalContract.test.ts ตรวจทุกย่อหน้าเทียบกับ scripts/fixtures/rental-contract-reference.json
//   2. ช่องข้อมูลที่ระบบไม่มี/ยังไม่ได้กรอก → เว้นเป็นเส้นจุดให้เขียนมือ และแจ้งรายการบนจอ — ห้ามเดา ห้ามใส่ค่าจำลอง
//   3. ไม่มี import ตอนรันไทม์ (import type เท่านั้น) เพื่อให้ node --test เรียกได้ตรง
// ---------------------------------------------------------------------------
import type { Contract, CustomerSite, Partner } from "./types";

export type RentalCopy = "ORIGINAL" | "DUPLICATE";
export const RENTAL_COPY_LABEL: Record<RentalCopy, string> = { ORIGINAL: "ต้นฉบับ", DUPLICATE: "คู่ฉบับ" };
export const RENTAL_CONTRACT_TITLE = "สัญญาเช่าเครื่องทำน้ำแข็ง";

/** ช่องข้อมูลในสัญญา · ref = ข้อความ placeholder ในไฟล์ต้นฉบับ (ใช้ตรวจว่าข้อความรอบ ๆ ตรงต้นฉบับ) */
export const RENTAL_FIELDS = {
  contractNo: { label: "เลขที่สัญญา", ref: "IR[รหัสลูกค้า][รหัสเซลล์]-[เลขสาขา]-[ปีที่ทำสัญญา]" },
  contractDate: { label: "วันที่ทำสัญญา (ลงวันที่)", ref: "[วัน เดือน ปี(พ.ศ.)]" },
  customerName: { label: "ชื่อบริษัทลูกค้า/บุคคล", ref: "[ชื่อ บริษัทลูกค้า/บุคคล]" },
  customerAddress: { label: "ที่อยู่ลูกค้า (สำนักงานใหญ่/ที่อยู่บุคคล/ที่อยู่เปิดบิล)", ref: "[ที่ตั้งสำนักงานใหญ่/ที่อยู่บุคคคล/ที่อยู่เปิดบิล]" },
  customerTaxId: { label: "เลขทะเบียนนิติบุคคล/บัตรประชาชน", ref: "[เลขทะเบียนนิติบุคคล/บัตรประชาชน]" },
  brand: { label: "ยี่ห้อเครื่อง", ref: "[ยี่ห้อ]" },
  model: { label: "รุ่นเครื่อง", ref: "[รุ่น]" },
  serial: { label: "หมายเลขเครื่อง (SN)", ref: "[SN]" },
  quantity: { label: "จำนวนเครื่อง", ref: "[ ]" },
  branchName: { label: "ชื่อสาขา", ref: "[ชื่อสาขา]" },
  branchAddress: { label: "ที่อยู่สาขา", ref: "[ที่อยู่สาขา]" },
  rent: { label: "ค่าเช่ารายเดือน", ref: "[ค่าเช่า 0000.00]" },
  rentText: { label: "ค่าเช่า (ตัวอักษร)", ref: "[ค่าเช่าภาษาไทย ศูนย์บาท]" },
  deposit: { label: "เงินประกัน", ref: "[เงินประกัน]" },
  depositText: { label: "เงินประกัน (ตัวอักษร)", ref: "[เงินประกันภาษาไทย ศูนย์บาท]" },
  years: { label: "อายุสัญญา (ปี)", ref: "[ ]" },
  startDate: { label: "วันที่เริ่มต้น", ref: "[วว/ดด/ปป]" },
  endDate: { label: "วันที่สิ้นสุด", ref: "[วว/ดด/ปป]" },
  signatory: { label: "ผู้มีอำนาจลงนาม (ผู้เช่า)", ref: "[ชื่อ บุคคล ผู้มีอำนาจลงนาม]" },
} as const;
export type RentalFieldKey = keyof typeof RENTAL_FIELDS;

/** ชิ้นส่วนข้อความของย่อหน้า: ข้อความคงที่ (b = ตัวหนาตามต้นฉบับ) หรือช่องข้อมูล */
export type RentalSegment = { t: string; b?: boolean } | { f: RentalFieldKey; b?: boolean };
const t = (s: string): RentalSegment => ({ t: s });
const tb = (s: string): RentalSegment => ({ t: s, b: true });
const f = (k: RentalFieldKey, b = false): RentalSegment => ({ f: k, b });

/** ย่อหน้าหน้า 1 (ข้อความตรงตัวตาม .docx ย่อหน้าที่ 3–18) · indent = ย่อหน้าบรรทัดแรก (pt) */
export interface RentalParagraph {
  id: string;
  indent?: number;
  segments: RentalSegment[];
}
export const RENTAL_PAGE1: RentalParagraph[] = [
  {
    id: "intro",
    segments: [
      t(
        "สัญญาฉบับนี้ทำขึ้นระหว่าง บริษัท เอ็นเทค อีเลคทรอนิคส์ จำกัด สำนักงานใหญ่ตั้งอยู่ ณ เลขที่ 259/22 หมู่ที่ 9 ตำบลกระทุ่มล้ม อำเภอสามพราน จังหวัดนครปฐม 73220 เลขทะเบียนนิติบุคคล0745554002483  ซึ่งต่อไปในสัญญานี้เรียกว่า “ ผู้ให้เช่า ” ฝ่ายหนึ่ง"
      ),
      f("customerName", true),
      tb(" "),
      f("customerAddress", true),
      tb(" เลขทะเบียนนิติบุคคล : "),
      f("customerTaxId", true),
      t(" ซึ่งต่อไปในสัญญานี้เรียกว่า ‘’ ผู้เช่า ‘’ อีกฝ่ายหนึ่ง ทั้งสองฝ่ายได้ตกลงทำสัญญากันดังนี้"),
    ],
  },
  {
    id: "c1",
    segments: [t("1.  ผู้ให้เช่า ตกลงจะให้ผู้เช่าเช่าเครื่องทำน้ำแข็งอัตโนมัติ ซึ่งต่อไปในสัญญานี้เรียกว่า ‘’ เครื่องทำน้ำแข็ง ‘’ตามรายละเอียดดังนี้")],
  },
  {
    id: "c1.1",
    segments: [
      t("1.1 เครื่องทำน้ำแข็งยี่ห้อ "),
      f("brand", true),
      tb(" รุ่น "),
      f("model", true),
      tb(" หมายเลขเครื่อง SN : "),
      f("serial", true),
      t(" จำนวน "),
      f("quantity"),
      t(" เครื่อง"),
    ],
  },
  { id: "c1.2", segments: [t("1.2 สถานที่ตั้งเครื่อง "), f("branchName", true), tb(" "), f("branchAddress", true)] },
  { id: "note", segments: [t("หมายเหตุ การติดตั้งจะเสร็จภายใน 7 วัน โดย ผู้ให้เช่า จะเป็นผู้รับผิดชอบค่าใช้จ่ายในการติดตั้งเฉพาะการติดตั้งครั้งแรก")] },
  { id: "c2", segments: [t("2.  ผู้เช่า ตกลงจะชำระค่าเช่าให้แก่ ผู้ให้เช่า สำหรับการเช่าใช้เครื่องทำน้ำแข็ง ตามข้อ1 ในเงื่อนไขดังต่อไปนี้")] },
  {
    id: "c2.1",
    indent: 36,
    segments: [
      t("2.1  ค่าบริการเช่าเครื่องในอัตราเดือนละ "),
      f("rent", true),
      t(" บาท ( "),
      f("rentText", true),
      t(" )  ราคานี้ยังไม่รวมภาษีมูลค่าเพิ่ม ต่อเครื่องลำดับที่ 1.1 หนึ่งเครื่อง "),
    ],
  },
  {
    id: "c2.1b",
    indent: 36,
    segments: [
      t(
        "วันติดตั้งเครื่องและทดลองเครื่องทำงานได้ ให้ถือสัญญาเช่า และการออกบิลค่าเช่าเครื่องทำน้ำแข็งจะออกทุกวันที่ 25 ของแต่ละเดือน นับค่าเช่าเฉลี่ยตามวันและจะนับรวมคิดในเดือนต่อไป"
      ),
    ],
  },
  {
    id: "c2.2",
    indent: 36,
    segments: [
      t(
        "2.2.  ค่าเช่าดังกล่าวจะเรียกเก็บเป็นรายเดือน โดยชำระเป็นเข้าบัญชีของทางผู้ให้เช่าเท่านั้น ภายในสามสิบ (30) วัน นับจากวันที่ได้รับแจ้งจากผู้ให้เช่า เดือนใดที่มีการติดตั้งหรือเคลื่อนย้ายเครื่องทำน้ำแข็ง ทำให้ใช้เครื่องทำน้ำแข็งน้อยกว่า 1 เดือน ค่าเช่าในเดือนนั้นจะคิดตามสัดส่วนจำนวนที่มีการใช้เครื่องทำน้ำแข็ง"
      ),
    ],
  },
  {
    id: "c2.3",
    indent: 36,
    segments: [
      t("2.3.  ผู้ให้เช่า เรียกเก็บเงินประกันการเช่าเครื่องเป็นเงินจำนวน "),
      f("deposit", true),
      t(" บาท ( "),
      f("depositText", true),
      t(" ) ราคานี้ยังไม่รวมภาษีมูลค่าเพิ่ม"),
    ],
  },
  {
    id: "c2.3b",
    segments: [
      t(
        "ก่อนการติดตั้งเครื่อง และเงินจำนวนนี้ผู้ให้เช่าจะคืนให้เมื่อผู้เช่าเลิกใช้บริการ แต่ทั้งนี้หากผู้เช่า ค้างชำระค่าเช่าหรือทำให้ทรัพย์สินที่เช่าเสียหาย ผู้ให้เช่ามีสิทธินำเงินประกันมาหักออกจากค่าเช่าที่ค้างชำระหรือหักจากค่าเสียหายได้"
      ),
    ],
  },
  {
    id: "c3",
    segments: [t("3. "), tb("สัญญานี้ที่อายุ  "), f("years", true), tb(" ปี เริ่มตั้งแต่ "), f("startDate", true), tb(" ถึงวันที่ "), f("endDate", true)],
  },
  {
    id: "c4",
    segments: [t("4.  ผู้เช่าต้องอำนวยความสะดวกโดยยินยอมให้ผู้ให้เช่า หรือผู้ที่ได้รับมอบหมายจากผู้ให้เช่าเข้าไปในอาคาร/บ้าน/ร้านค้า ที่ผู้เช่าครอบครอง")],
  },
  {
    id: "c4b",
    segments: [
      t(
        "อยู่ได้ตลอดเวลา เพื่อตรวจดูทรัพย์สินที่ให้เช่า หรือเพื่อทำการบำรุงรักษา หรือซ่อมแซม หรือยินยอมให้เข้าไปขนย้ายทรัพย์สินที่ให้เช่าได้ ในกรณีที่ผู้เช่าผิดสัญญาเช่า และไม่ถือว่าเป็นการบุกรุก"
      ),
    ],
  },
  { id: "c5", segments: [t("5.  ข้อตกลงและเงื่อนไขท้ายสัญญาด้านหลัง ให้ถือว่าเป็นส่วนหนึ่งของสัญญาฉบับนี้ ")] },
  {
    id: "witness",
    segments: [
      t(
        "เพื่อเป็นหลักฐานแห่งการนี้ สัญญาดังกล่าวนี้ทำขึ้นเป็นสองฉบับมีข้อความถูกต้องอย่างเดียวกัน ณ จังหวัดกรุงเทพมหานคร ประเทศไทย ตามวัน เดือน ปี ที่ปรากฏข้างต้น คู่สัญญาทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในสัญญานี้แล้วและรับรองว่าถูกต้องตามความประสงค์ทั้งสองฝ่าย จึงได้ลงนามและประทับตราไว้ต่อหน้าพยานและยึดถือไว้ฝ่ายละหนึ่งฉบับ"
      ),
    ],
  },
];

/** ส่วนคงที่ของหน้า 1 (หัว/ลายเซ็น/ท้ายกระดาษ) — ตรงตัวตาม .docx ย่อหน้าที่ 2, 19–24 */
export const RENTAL_STATIC = {
  contractNoLabel: "สัญญาเลขที่ ",
  contractDateLabel: "ลงวันที่ ",
  lessorCompany: "บริษัท เอ็นเทค อีเลคทรอนิคส์   จำกัด",
  lessorSignLine: "ลงชื่อ……………………………………ผู้ให้เช่า",
  lesseeSignLine: "ลงชื่อ……………………………..……………ผู้เช่า",
  lessorSignatory: "( นายนคร  สุวรรณบดินทร์ )",
  companySeal: "ประทับตราสำคัญของบริษัท",
  footerCompany: "ENTECH ELECTRONICS CO., LTD.",
  footerAddress: "259/22 Moo 9 Krathumlom, Samphran, Nakhonpathom 73220, THAILAND TEL. (662) 024 9152 – 3  FAX.  (662) 024 9152 – 3 ext. 108",
  termsTitle: "ข้อตกลงและเงื่อนไขให้ถือเป็นส่วนหนึ่งของสัญญา",
} as const;

/**
 * ข้อตกลงและเงื่อนไขท้ายสัญญา (หน้า 2 · .docx ย่อหน้าที่ 26–47) — ตรงตัว
 * indent = ระยะเยื้องบรรทัดแรก (pt) วัดจาก PDF อ้างอิง (ต้นฉบับใช้ช่องว่างนำหน้า)
 */
export const RENTAL_TERMS: { id: string; indent: number; text: string }[] = [
  { id: "1", indent: 0, text: "1.การให้บริการและการบำรุงรักษาเครื่องทำน้ำแข็งตามสัญญาเช่านี้จะรวมถึงการให้บริการดังนี้" },
  { id: "1.1", indent: 7.3, text: "1.1 บำรุงรักษาเครื่องทำน้ำแข็งให้อยู่ในสภาพใช้งานได้ดี ตรวจสอบ ซ่อมแซมและแก้ไขตามคู่มือบำรุงรักษา และตามมาตรฐานของผู้ให้เช่า โดยให้บริการ 3 เดือน 1 ครั้ง" },
  {
    id: "1.2",
    indent: 5.5,
    text: "1.2 ในกรณีที่เครื่องทำน้ำแข็งเสียไม่สามารถทำงานได้ตามปกติ ผู้ให้เช่าจะหักค่าเช่าเป็นรายวันชดเชยให้กับผู้เช่า โดยจะทำเครดิตโน้ตคืนให้ในเดือนนั้นๆ ทั้งนี้ไม่เกี่ยวกับระบบไฟฟ้า ระบบน้ำและระบบกรองน้ำของผู้เช่าที่ทำให้เครื่องไม่สามารถทำงานได้",
  },
  {
    id: "1.3",
    indent: 7.3,
    text: "1.3 ผู้ให้เช่าจะให้บริการตามสัญญานี้แก่ผู้เช่า เฉพาะในเวลาทำการปกติและฉุกเฉิน ตั้งแต่ 8.00 น. ถึง 17.00 น. ทุกวัน โดยไม่เว้น วันหยุดราชการ เบอร์โทรบริการฉุกเฉิน 06-2074-9998 ",
  },
  {
    id: "1.4",
    indent: 7.3,
    text: "1.4 ผู้ให้เช่าจะชดเชยค่าทำน้ำแข็งให้ผู้เช่า ในกรณีเครื่องเสียใช้งานไม่ได้เกิน 48 ชั่วโมงในเขตกรุงเทพมหานคร และเกิน 72 ชั่วโมงในเขตต่างจังหวัด โดยหักเป็นค่าเช่ารายวัน คำนวณจากราคาเช่าเครื่อง",
  },
  {
    id: "2",
    indent: 0,
    text: "2. ผู้เช่ารับว่า ผู้ให้เช่า เป็นเจ้าของเครื่องทำน้ำแข็ง และผู้เช่าจะไม่ทำการเปลี่ยนแปลงหรือแก้ไข โดยมิได้รับความยินยอม เป็นหนังสือจากผู้ให้เช่า หรือทำการใดๆกับแผ่นป้ายโลหะ หรือเคลื่อนย้าย ขาย จำนำ โอน จำนอง ให้เช่า หรือจำหน่ายเครื่องทำน้ำแข็งหรือก่อเกิดภาระผูกพัน ไม่ว่าด้วยวิธีการใดๆ",
  },
  {
    id: "3",
    indent: 0,
    text: "3.ผู้เช่าจะรักษา และใช้เครื่องทำน้ำแข็ง ด้วยความระมัดระวัง และรับประกันต่อ ผู้ให้เช่าในเรื่องความเสียหาย ถูกทำลายหรือใช้งานไม่ได้โดยเจตนา ประมาทเลินเล่อ หรือเพิกเฉยของผู้เช่าหรือลูกจ้างของผู้เช่า หรือบุคคลภายนอก ผู้เช่าจะชำระค่าซ่อมแซม และค่าวัสดุในการซ่อมแซม หรือซื้อเครื่องใหม่ในกรณีที่เครื่องเก่าอยู่ในสภาพที่ไม่อาจซ่อมแซมให้ใช้การได้เหมือนเดิม",
  },
  {
    id: "4",
    indent: 0,
    text: "4. ผู้เช่าจะจัดการเรื่องระบบไฟฟ้าและระบบน้ำให้มีอย่างเพียงพอในสถานที่ที่ผู้เช่าจัดให้ไว้และให้ความช่วยเหลืออื่นแก่ ผู้ให้เช่าในการติดตั้งเครื่องทำน้ำแข็งและผู้เช่าจะจัดหาอุปกรณ์ที่ใช้กับเครื่อง หรือมอบหมายให้ ผู้ให้เช่าเป็นผู้จัดหาอุปกรณ์ดังกล่าว และอาจให้ ผู้ให้เช่าเป็นผู้ติดตั้ง โดยผู้เช่าจะเป็นผู้รับผิดชอบค่าใช้จ่ายในการนี้ทั้งหมด",
  },
  {
    id: "5",
    indent: 0,
    text: "5. ในกรณีที่ผู้เช่าจะย้ายเครื่องทำน้ำแข็งจากสถานที่ที่ได้ระบุไว้ในสัญญาไปยังสถานที่ตั้งอื่น ผู้เช่าต้องแจ้งให้ ผู้ให้เช่าทราบล่วงหน้า 14 วัน โดยผู้เช่าเป็นผู้รับผิดชอบค่าใช้จ่ายในการติดตั้งเครื่องทำน้ำแข็ง ณ สถานที่แห่งอื่นนั้น",
  },
  {
    id: "6",
    indent: 0,
    text: "6. ผู้ให้เช่า จะไม่รับผิดชอบต่อความเสียหาย อันอาจจะเกิดแก่ผู้เช่าตามสัญญานี้เฉพาะเหตุสุดวิสัย เช่น เพลิงไหม้ น้ำท่วม หนูกัดสายไฟ การนัดหยุดงาน ฯลฯ ผลสืบเนื่องจากการใช้การไม่ได้ของเครื่องทำน้ำแข็ง ความล่าช้าในการซ่อมแซม หรือเหตุอื่นอันอยู่นอกเหนือการบังคับควบคุมของผู้ให้เช่า ",
  },
  { id: "7", indent: 0, text: "7. ผู้ให้เช่า มีสิทธิหักเงินใดๆจากเงินมัดจำตามสัญญานี้ก่อนคืนให้ผู้เช่า เนื่องจากผู้เช่าผิดสัญญาข้อใดข้อหนึ่ง" },
  {
    id: "8",
    indent: 0,
    text: "8. กรณีที่ผู้เช่าผิดนัดชำระค่าเช่าหรือชำระค่าเช่าไม่ตรงตามจำนวนที่ระบุไว้ในสัญญาบริการนี้ ยินยอมให้ผู้ให้เช่าบอกเลิกสัญญาเช่าได้ทันทีและยินยอมชดใช้ค่าเสียหายเป็นค่าปรับในอัตราร้อยละ 15 ต่อปี นับตั้งแต่วันที่ผิดนัดค้างชำระค่าเช่าดังกล่าว",
  },
  {
    id: "9",
    indent: 0,
    text: "9. ผู้ให้เช่าขอสงวนสิทธิในการเปลี่ยนแปลงค่าเช่าเมื่อมีเหตุอันควร โดย ผู้ให้เช่า จะมีหนังสือแจ้งการเปลี่ยนแปลงค่าบริการให้ผู้เช่าทราบล่วงหน้าไม่น้อยกว่า 30 วัน แต่ถ้าไม่สามารถตกลงกันได้ให้ถือว่าสัญญานี้เป็นอันสิ้นสุดลง เมื่อครบกำหนดระยะเวลาบอกกล่าว",
  },
  { id: "10", indent: 0, text: "10. เมื่อสัญญานี้สิ้นสุดลง ให้ถือว่ามีการต่ออายุสัญญาใหม่เท่ากับอายุสัญญาเดิม เว้นแต่คู่สัญญาฝ่ายใดฝ่ายหนึ่งบอกเลิกสัญญา" },
  { id: "11", indent: 0, text: "11. คู่สัญญาฝ่ายใดฝ่ายหนึ่งอาจบอกเลิกสัญญา ในกรณีดังต่อไปนี้" },
  {
    id: "11.1",
    indent: 7.2,
    text: "11.1 ในกรณีที่ไม่มีคู่สัญญาฝ่ายใดฝ่ายหนึ่งผิดสัญญา ผู้เช่ามีสิทธิบอกเลิกสัญญาในเวลาใดก็ได้ โดยผู้เช่ายินยอมให้ผู้ให้เช่า ยึดเงินมัดจำตามสัญญา",
  },
  { id: "11.1b", indent: 1.8, text: "ข้อ 2.3 ได้ ในกรณีที่ผู้เช่าบอกเลิกสัญญา โดยมีหนังสือแจ้งให้คู่สัญญาอีกฝ่ายหนึ่งทราบล่วงหน้าอย่างน้อย 30 วัน" },
  {
    id: "11.2",
    indent: 9,
    text: "11.2 สัญญานี้อาจจะระงับลงโดยไม่จำเป็นต้องบอกกล่าวในกรณีที่ผู้เช่ากลายเป็นบุคคลล้มละลายหรือมีหนี้สินล้นพ้นตัว หรือมีการกระทำผิดสัญญาข้อใดข้อหนึ่ง  ผู้ให้เช่า มีสิทธิบอกเลิกสัญญาเช่าได้",
  },
  {
    id: "12",
    indent: 0,
    text: "12. ข้อโต้แย้งใดๆ ที่เกี่ยวข้องกับสัญญานี้ ให้ระงับโดยการทำความตกลงกัน ในกรณีที่มีการฟ้องร้องกันตามสัญญานี้ ให้ใช้กฎหมายของประเทศไทยบังคับ และคู่สัญญาตกลงจะนำคดีสู่ศาลในเขตกรุงเทพมหานครเท่านั้น",
  },
  {
    id: "13",
    indent: 0,
    text: "13. การแก้ไข เพิ่มเติม หรือเปลี่ยนแปลงข้อความในสัญญาฉบับนี้ไม่สามารถทำได้ เว้นแต่จะได้มีการตกลงกันเป็นลายลักษณ์อักษร โดยลงลายมือชื่อคู่สัญญาทั้งสองฝ่ายและให้ถือเป็นส่วนหนึ่งของสัญญาฉบับนี้",
  },
  {
    id: "14",
    indent: 0,
    text: "14. ถ้าประโยค ย่อหน้า หรือข้อสัญญาใดในสัญญาฉบับนี้ หรือในหลายกรณีดังกล่าวเป็นการละเมิดต่อกฎหมาย ให้ส่วนประโยค ย่อหน้า ข้อสัญญา หรือในหลายกรณีดังกล่าวมีผลเป็นการโมฆะเฉพาะส่วน ส่วนที่เหลืออยู่ของสัญญาจะได้รับการปฏิบัติและตีความต่อไปว่ายังคงมีผลผูกพันคู่สัญญาอยู่",
  },
  {
    id: "15",
    indent: 0,
    text: "15. คำบอกกล่าวใดๆ ตามสัญญาฉบับนี้จะต้องทำเป็นหนังสือและ/หรือโดยส่งผ่านทางโทรสาร หรือจดหมายอีเล็กทรอนิกส์ และคำบอกกล่าวจะถือว่าได้ส่งแล้ว เมื่อส่งโดยไปรษณีย์ลงทะเบียนตอบรับ การส่งทางโทรสาร หรือจดหมายอีเล็กทรอนิกส์ จะถือว่าถึงมือผู้รับ ณ เวลาที่ได้รับยืนยันจากเครื่องโทรสารหรือระบบจดหมายอีเล็กทรอนิกส์ว่าได้ส่งผ่านเครื่องโทรสารหรือระบบจดหมายอีเล็กทรอนิกส์เรียบร้อยแล้ว",
  },
];

// ---------------------------------------------------------------------------
// ตัวจัดรูปแบบ
// ---------------------------------------------------------------------------
export const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function isoParts(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/** YYYY-MM-DD (ค.ศ.) → "วว/ดด/ปปปป" แบบ พ.ศ. เช่น 2026-11-01 → "01/11/2569" · รูปแบบผิด → "" */
export function thaiDateNumeric(iso: string): string {
  const p = isoParts(iso);
  if (!p) return "";
  return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y + 543}`;
}

/** YYYY-MM-DD (ค.ศ.) → "1 พฤศจิกายน 2569" · รูปแบบผิด → "" */
export function thaiDateLong(iso: string): string {
  const p = isoParts(iso);
  if (!p) return "";
  return `${p.d} ${THAI_MONTHS[p.m - 1]} ${p.y + 543}`;
}

/** จำนวนเงิน 2 ตำแหน่งทศนิยมมีจุลภาค เช่น 1500 → "1,500.00" (ต้นฉบับเว้นช่อง "0000.00") */
export function money2(n: number): string {
  const v = Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
  const [i, d] = Math.abs(v).toFixed(2).split(".");
  return `${v < 0 ? "-" : ""}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${d}`;
}

/** อายุสัญญาในต้นฉบับเป็น "ปี" — คืนจำนวนปีเมื่อหารด้วย 12 ลงตัวเท่านั้น (ไม่ปัด ไม่แปลงข้อความสัญญา) */
export function yearsFromMonths(months: number): number | null {
  const n = Math.floor(Number(months) || 0);
  if (n <= 0 || n % 12 !== 0) return null;
  return n / 12;
}

// ---------------------------------------------------------------------------
// Data mapping
// ---------------------------------------------------------------------------
export type RentalFieldValues = Record<RentalFieldKey, string>;
export interface RentalIssue {
  field: RentalFieldKey | "status" | "type" | "partner" | "site";
  level: "missing" | "warning";
  message: string;
}
export interface RentalContractView {
  values: RentalFieldValues;
  /** ช่องที่ยังไม่มีค่า → เอกสารเว้นเส้นจุดให้เขียนมือ */
  missing: RentalFieldKey[];
  issues: RentalIssue[];
  /** แหล่งข้อมูลจริงของแต่ละช่อง (แสดงบนจอเพื่อให้ตรวจย้อนได้) */
  sources: Partial<Record<RentalFieldKey, string>>;
}

export interface RentalContractInput {
  contract: Pick<
    Contract,
    | "type"
    | "status"
    | "contractNo"
    | "customerName"
    | "customerAddress"
    | "siteAddress"
    | "partnerId"
    | "siteId"
    | "serial"
    | "model"
    | "startDate"
    | "endDate"
    | "rentPerMonth"
    | "periodMonths"
    | "deposit"
  > & { equipment?: Contract["equipment"] };
  /** null = สัญญาไม่ได้ผูกลูกค้า หรืออ่านข้อมูลลูกค้าไม่ได้ (ดู partnerError) */
  partner: Pick<Partner, "name" | "address" | "taxId"> | null;
  partnerError?: string;
  site: Pick<CustomerSite, "storeName" | "branchNo" | "address" | "subdistrict" | "district" | "province" | "postcode"> | null;
  siteError?: string;
}

const clean = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

/** ที่อยู่สาขาบรรทัดเดียว (เลขที่/ถนน → ตำบล → อำเภอ → จังหวัด → รหัสไปรษณีย์) ไม่ใส่คำนำหน้าเพิ่มเอง */
export function siteAddressLine(s: RentalContractInput["site"]): string {
  if (!s) return "";
  const address = clean(s.address);
  const sub = clean(s.subdistrict);
  const parts = [address, sub && !address.includes(sub) ? sub : "", clean(s.district), clean(s.province), clean(s.postcode)];
  return parts.filter(Boolean).join(" ");
}

/**
 * แปลงข้อมูล WOMS → ค่าในช่องของสัญญา
 * - ใช้ข้อมูลที่บันทึกในสัญญา (snapshot ณ วันทำสัญญา) ก่อนข้อมูลหลักของลูกค้า/สาขา
 * - ช่องที่ระบบไม่มีฟิลด์ (ยี่ห้อ, วันที่ลงนาม, ผู้มีอำนาจลงนาม) → ว่าง + แจ้ง ไม่ดึงค่าอื่นมาแทน
 */
export function buildRentalContractView(input: RentalContractInput, toBahtText: (n: number) => string): RentalContractView {
  const { contract: c, partner, site } = input;
  const values = {} as RentalFieldValues;
  const sources: Partial<Record<RentalFieldKey, string>> = {};
  const issues: RentalIssue[] = [];
  const set = (k: RentalFieldKey, v: string, src: string) => {
    values[k] = v;
    if (v) sources[k] = src;
  };

  if (c.type !== "RENTAL") issues.push({ field: "type", level: "warning", message: "แบบฟอร์มนี้ใช้กับสัญญาเช่าเท่านั้น" });
  if (c.status === "CANCELLED") issues.push({ field: "status", level: "warning", message: "สัญญานี้ถูกยกเลิกแล้ว" });
  if (c.status === "DRAFT") issues.push({ field: "status", level: "warning", message: "สัญญายังเป็นร่าง — ตรวจข้อมูลก่อนพิมพ์ลงนาม" });

  set("contractNo", clean(c.contractNo), "contracts.contractNo");
  // ไม่มีฟิลด์วันที่ทำสัญญา/ลงนามในระบบ — ไม่ใช้วันเริ่มสัญญาหรือวันสร้างข้อมูลแทน
  set("contractDate", "", "");

  set("customerName", clean(c.customerName) || clean(partner?.name), clean(c.customerName) ? "contracts.customerName" : "partners.name");
  const custAddr = clean(c.customerAddress);
  set("customerAddress", custAddr || clean(partner?.address), custAddr ? "contracts.customerAddress" : "partners.address");
  set("customerTaxId", clean(partner?.taxId), "partners.taxId");

  set("brand", "", "");
  set("model", clean(c.model) || clean(c.equipment?.model), clean(c.model) ? "contracts.model" : "equipment.model");
  set("serial", clean(c.serial), "contracts.serial");
  // BR-04: สัญญาเช่า 1 ฉบับ = 1 เครื่อง (backend assertSingleMachine)
  set("quantity", c.type === "RENTAL" ? "1" : "", "BR-04 (1 สัญญา = 1 เครื่อง)");

  set("branchName", clean(site?.storeName), "customer_sites.storeName");
  const contractSiteAddr = clean(c.siteAddress);
  set("branchAddress", contractSiteAddr || siteAddressLine(site), contractSiteAddr ? "contracts.siteAddress" : "customer_sites (address/subdistrict/district/province/postcode)");

  const rent = Number(c.rentPerMonth) || 0;
  set("rent", rent > 0 ? money2(rent) : "", "contracts.rentPerMonth");
  set("rentText", rent > 0 ? toBahtText(rent) : "", "contracts.rentPerMonth → bahtText");

  const deposit = Number(c.deposit) || 0;
  set("deposit", money2(deposit), "contracts.deposit");
  set("depositText", toBahtText(deposit), "contracts.deposit → bahtText");
  if (deposit <= 0) issues.push({ field: "deposit", level: "warning", message: "เงินประกันในระบบเป็น 0 บาท — ตรวจว่าตรงกับที่ตกลงจริง" });

  const years = yearsFromMonths(c.periodMonths);
  set("years", years === null ? "" : String(years), "contracts.periodMonths ÷ 12");
  if (years === null && (Number(c.periodMonths) || 0) > 0) {
    issues.push({
      field: "years",
      level: "warning",
      message: `อายุสัญญาในระบบ ${c.periodMonths} เดือน ไม่ใช่จำนวนปีเต็ม — ข้อความสัญญากำหนดเป็น "ปี" จึงเว้นว่างไว้`,
    });
  }
  set("startDate", thaiDateNumeric(c.startDate), "contracts.startDate");
  set("endDate", thaiDateNumeric(c.endDate), "contracts.startDate + periodMonths (ค่า endDate ของระบบ)");
  set("signatory", "", "");

  if (!c.partnerId) issues.push({ field: "partner", level: "warning", message: "สัญญายังไม่ผูกลูกค้าในฐานข้อมูล — ไม่มีเลขทะเบียนนิติบุคคล" });
  else if (input.partnerError) issues.push({ field: "partner", level: "warning", message: `อ่านข้อมูลลูกค้าไม่ได้: ${input.partnerError}` });
  if (!c.siteId) issues.push({ field: "site", level: "warning", message: "สัญญายังไม่ผูกสาขา — ไม่มีชื่อสาขา" });
  else if (input.siteError) issues.push({ field: "site", level: "warning", message: `อ่านข้อมูลสาขาไม่ได้: ${input.siteError}` });

  const missing = (Object.keys(RENTAL_FIELDS) as RentalFieldKey[]).filter((k) => !values[k]);
  for (const k of missing) issues.push({ field: k, level: "missing", message: `ไม่มีข้อมูล "${RENTAL_FIELDS[k].label}" — เอกสารเว้นช่องให้เขียนมือ` });
  return { values, missing, issues, sources };
}

/** ข้อความของย่อหน้าเมื่อแทนช่องด้วยค่า (หรือ ref ของต้นฉบับ) — ใช้ทดสอบความครบถ้วนของข้อความ */
export function paragraphText(p: RentalParagraph, valueOf: (k: RentalFieldKey) => string): string {
  return p.segments.map((s) => ("f" in s ? valueOf(s.f) : s.t)).join("");
}
