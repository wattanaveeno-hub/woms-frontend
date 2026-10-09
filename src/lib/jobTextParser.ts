// JOB-01 / MCH-03 — แยกข้อความเปิดงานที่เซลล์ส่งทาง LINE ให้เป็นช่องของฟอร์ม (pure, ไม่เรียก API)
//
// รูปแบบจากตัวอย่างจริงของลูกค้า (VFB แถวคำถาม "ตัวอย่างข้อความจริง"):
//   ประเภทงาน: CM          ร้าน / ชื่อร้าน: I2228-บริษัท ดีลิคัพ จำกัด
//   ทีมช่าง: ช่างอาท        เซลล์: VP
//   รุ่น: IM-35M-2-LM       ตู้เย็น : HRW-147LS4      เครื่องกรองน้ำ: เครื่องกรองน้ำ 3 ขั้นตอน
//   SN:5198210500597        ติดต่อ: คุณนา             เบอร์: 092 279 9656
//   วันที่: 25/9/69          เวลา: 11.00 น.            โลเคชั่น: https://maps.app.goo.gl/...
//   หมายเหตุ: ...           (บรรทัดถัดไปที่ไม่มีหัวข้อ ต่อท้ายหมายเหตุ)
//
// กติกา:
//   * ไม่เดา — ค่าที่ตีความไม่ได้ชัด (เช่น ประเภทงาน "ตรวจเช็ค", "คอนเฟิร์มจัดส่งและติดตั้ง" ที่ไม่บอกเช่า/ขาย)
//     ไม่ถูกเลือกให้ แต่ขึ้นเป็นคำเตือนให้ผู้ใช้เลือกเอง
//   * วันที่ปีสองหลักเป็น พ.ศ. (69 = 2569 = ค.ศ. 2026) · ปีสี่หลัก ≥ 2400 ถือเป็น พ.ศ.
//   * ผลลัพธ์เป็น "ข้อเสนอ" ให้ผู้ใช้ตรวจก่อนใส่ฟอร์มเสมอ — ไม่บันทึกอะไรเอง

export interface ParsedJobText {
  jobType: string; // ค่า JobType ที่ตีความได้ชัด หรือ ""
  jobTypeRaw: string;
  customerCode: string; // เช่น I2160 / IR084
  shopName: string;
  technicianTeam: string;
  salesPerson: string;
  model: string;
  filterUnit: string;
  serials: string[];
  contactName: string;
  phone: string;
  jobDate: string; // YYYY-MM-DD (ค.ศ.) หรือ ""
  jobTime: string; // HH:mm หรือ ""
  mapLink: string;
  note: string;
  warnings: string[];
}

// ตัดวรรณยุกต์/สระบน-ล่างออกเพื่อเทียบหัวข้อ — ข้อความที่คัดลอกจาก PDF/LINE บางครั้งไม่มีวรรณยุกต์ ("ราน" = "ร้าน")
function keyNorm(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[ัิ-ฺ็-๎]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

type Field = "jobType" | "shop" | "team" | "sales" | "model" | "filter" | "sn" | "contact" | "phone" | "date" | "time" | "map" | "note";

// หัวข้อ (หลังตัดวรรณยุกต์) → ช่อง
const HEADINGS: [string, Field][] = [
  ["ประเภทงาน", "jobType"],
  ["ชอรน", "shop"], // ชื่อร้าน
  ["รน", "shop"], // ร้าน
  ["ทมชาง", "team"], // ทีมช่าง
  ["ชาง", "team"],
  ["เซลล", "sales"], // เซลล์
  ["sale", "sales"],
  ["รน", "model"], // รุ่น (หลังตัดสระ = "รน" ซ้ำกับร้าน — แยกด้วยตัวอักษรเดิมด้านล่าง)
  ["ตเยน", "model"], // ตู้เย็น
  ["ตแช", "model"], // ตู้แช่
  ["เครองกรองนำ", "filter"],
  ["เครองกรองนา", "filter"],
  ["เครองกรอง", "filter"],
  ["sn", "sn"],
  ["serial", "sn"],
  ["ตดตอ", "contact"], // ติดต่อ
  ["เบอร", "phone"],
  ["โทร", "phone"],
  ["วนท", "date"], // วันที่
  ["วนนด", "date"], // วันนัด
  ["เวลา", "time"],
  ["โลเคชน", "map"],
  ["location", "map"],
  ["map", "map"],
  ["หมายเหต", "note"],
];

/** "ร้าน" กับ "รุ่น" ตัดสระแล้วเหลือ "รน" เหมือนกัน — ดูตัวอักษรจริงก่อนตัด */
function fieldOf(rawKey: string): Field | null {
  const raw = rawKey.replace(/\s+/g, "");
  if (/^รุ่น|^รุน/.test(raw)) return "model";
  if (/^ร้าน|^ราน|^ชื่อร้าน|^ชื่อราน/.test(raw)) return "shop";
  const k = keyNorm(rawKey);
  for (const [h, f] of HEADINGS) if (k === h) return f;
  return null;
}

/** แปลงประเภทงานจากข้อความ — คืน "" เมื่อไม่ชัด (ไม่เดา) */
export function jobTypeFromText(text: string): string {
  const t = keyNorm(text);
  if (!t) return "";
  const hasPm = /pm/.test(t);
  const hasCm = /cm/.test(t);
  if (hasPm && hasCm) return "PM_CM";
  if (hasPm) return "PM";
  if (hasCm) return "CM";
  if (/ตดตง/.test(t)) {
    if (/เชา/.test(t)) return "INSTALL_RENT";
    if (/ขาย/.test(t)) return "INSTALL_SALE";
    return "";
  }
  if (/ยาย/.test(t)) return "MOVE";
  if (/เกบเครอง/.test(t)) return "RETRIEVE";
  if (/เปลยนอะไหล/.test(t)) return "PART_REPLACE";
  return "";
}

/** วันที่แบบไทย d/m/yy หรือ d/m/yyyy (พ.ศ.) → YYYY-MM-DD (ค.ศ.) · ไม่ใช่วันที่จริงคืน "" */
export function thaiDateToISO(text: string): string {
  const m = text.match(/(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{2,4})/);
  if (!m) return "";
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let y = Number(m[3]);
  if (m[3].length === 2) y = 2500 + y - 543; // 69 → 2569 → 2026
  else if (y >= 2400) y -= 543;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return "";
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "11.00 น." / "9:30" / "9 โมง" → HH:mm · ไม่ชัดคืน "" */
export function thaiTimeToHHMM(text: string): string {
  const m = text.match(/(\d{1,2})\s*[.:]\s*(\d{2})/) ?? text.match(/^\s*(\d{1,2})\s*(?:น|โมง)/);
  if (!m) return "";
  const h = Number(m[1]);
  const mi = m[2] !== undefined ? Number(m[2]) : 0;
  if (h > 23 || mi > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

const CODE_RE = /\b(I[A-Z]?\d{3,5})\b/;

export function parseJobText(input: string): ParsedJobText {
  const out: ParsedJobText = {
    jobType: "",
    jobTypeRaw: "",
    customerCode: "",
    shopName: "",
    technicianTeam: "",
    salesPerson: "",
    model: "",
    filterUnit: "",
    serials: [],
    contactName: "",
    phone: "",
    jobDate: "",
    jobTime: "",
    mapLink: "",
    note: "",
    warnings: [],
  };
  const noteLines: string[] = [];
  const freeLines: string[] = [];
  let last: Field | null = null;

  const lines = input.replace(/\r/g, "").split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^[-—_=*]{5,}$/.test(line)) {
      continue;
    }
    const m = line.match(/^([^:：]{1,24})\s*[:：]\s*(.*)$/);
    const field = m ? fieldOf(m[1]) : null;
    if (m && field) {
      const value = m[2].trim();
      last = field;
      apply(field, value);
      continue;
    }
    // ไม่มีหัวข้อ: ลิงก์แผนที่ / ต่อจากหัวข้อก่อน (ช่องว่างหลัง "ชื่อร้าน:") / หมายเหตุหลายบรรทัด
    if (/^https?:\/\//i.test(line) && !out.mapLink) {
      out.mapLink = line.split(/\s+/)[0];
      continue;
    }
    if (last && pendingValue(last)) {
      apply(last, line);
      continue;
    }
    if (last === "note") {
      noteLines.push(line);
      continue;
    }
    freeLines.push(line);
  }

  function pendingValue(f: Field): boolean {
    const v: Record<Field, string> = {
      jobType: out.jobTypeRaw, shop: out.shopName, team: out.technicianTeam, sales: out.salesPerson, model: out.model,
      filter: out.filterUnit, sn: out.serials.join(""), contact: out.contactName, phone: out.phone, date: out.jobDate,
      time: out.jobTime, map: out.mapLink, note: "x",
    };
    return f !== "note" && !v[f];
  }

  function apply(f: Field, value: string) {
    if (!value) return;
    switch (f) {
      case "jobType":
        out.jobTypeRaw = value;
        out.jobType = jobTypeFromText(value);
        break;
      case "shop": {
        out.shopName = value;
        const c = value.match(CODE_RE);
        if (c && !out.customerCode) out.customerCode = c[1];
        break;
      }
      case "team":
        out.technicianTeam = value;
        break;
      case "sales":
        out.salesPerson = value;
        break;
      case "model":
        out.model = value.replace(/\s*\(.*\)\s*$/, "").trim() || value;
        break;
      case "filter":
        out.filterUnit = value;
        break;
      case "sn":
        out.serials.push(...value.split(/[,\s/]+/).filter((x) => x.length >= 4));
        break;
      case "contact":
        out.contactName = value;
        break;
      case "phone":
        out.phone = value.replace(/[^\d+]/g, "");
        break;
      case "date":
        out.jobDate = thaiDateToISO(value);
        if (!out.jobDate) out.warnings.push(`อ่านวันที่ “${value}” ไม่ได้ — กรอกเอง`);
        break;
      case "time":
        out.jobTime = thaiTimeToHHMM(value);
        if (!out.jobTime) out.warnings.push(`อ่านเวลา “${value}” ไม่ได้ — กรอกเอง`);
        break;
      case "map": {
        const u = value.match(/https?:\/\/\S+/i);
        if (u) out.mapLink = u[0];
        break;
      }
      case "note":
        noteLines.push(value);
        break;
    }
  }

  // บรรทัดอิสระ: รหัสลูกค้า (I1599 บจก.โนบีฟ) / เครื่องกรองที่เขียนไว้ลอย ๆ
  for (const l of freeLines) {
    const c = l.match(CODE_RE);
    if (c && !out.customerCode) {
      out.customerCode = c[1];
      if (!out.shopName) out.shopName = l;
      continue;
    }
    if (!out.filterUnit && /เครื่องกรอง|เครองกรอง/.test(l)) {
      out.filterUnit = l;
      continue;
    }
    noteLines.push(l);
  }
  out.note = noteLines.join("\n").trim();
  out.serials = Array.from(new Set(out.serials));

  if (out.jobTypeRaw && !out.jobType) {
    out.warnings.push(`ประเภทงาน “${out.jobTypeRaw}” ตีความไม่ได้ชัด — เลือกประเภทงานเอง`);
  }
  if (!out.jobTypeRaw) out.warnings.push("ไม่พบประเภทงานในข้อความ");
  if (!out.jobDate && !out.warnings.some((w) => w.startsWith("อ่านวันที่"))) out.warnings.push("ไม่พบวันที่นัดในข้อความ");
  return out;
}
