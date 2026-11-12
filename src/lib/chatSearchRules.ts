// CHAT-SR02 ค้นข้อความแบบ LINE + CHAT-AV01 รูปโปรไฟล์ — ฟังก์ชันบริสุทธิ์ (ทดสอบด้วย node --test)

/** คำค้นที่ใช้ได้ (ตัดช่องว่างหัวท้าย · อย่างน้อย 2 ตัวอักษร · ยาวไม่เกิน 100 — ตรงกับ backend) */
export const SEARCH_MIN_CHARS = 2;
export function normalizeTerm(q: string): string {
  const t = String(q ?? "").trim().slice(0, 100);
  return t.length >= SEARCH_MIN_CHARS ? t : "";
}

export interface TextPart {
  text: string;
  hit: boolean;
}

/** แยกข้อความเป็นช่วงที่ตรง/ไม่ตรงคำค้น (ไม่สนตัวพิมพ์ · ไม่ตีความ regex) */
export function splitHighlight(text: string, term: string): TextPart[] {
  const s = String(text ?? "");
  const t = String(term ?? "").trim();
  if (!t || !s) return s ? [{ text: s, hit: false }] : [];
  const lower = s.toLowerCase();
  const needle = t.toLowerCase();
  const out: TextPart[] = [];
  let i = 0;
  while (i < s.length) {
    const j = lower.indexOf(needle, i);
    if (j < 0) break;
    if (j > i) out.push({ text: s.slice(i, j), hit: false });
    out.push({ text: s.slice(j, j + needle.length), hit: true });
    i = j + needle.length;
  }
  if (i < s.length) out.push({ text: s.slice(i), hit: false });
  return out;
}

/**
 * ข้อความย่อในรายการผล (บรรทัดเดียว) — ถ้าคำที่ตรงอยู่ท้ายข้อความยาว ให้ตัดหัวแล้วใส่ "…" เพื่อให้เห็นคำที่ตรงเสมอ
 * (dialog เดิมตัดท้ายด้วย noWrap ทำให้คำที่ค้นหาหายไปจากรายการ)
 */
export function snippetAround(text: string, term: string, max = 60): string {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const t = String(term ?? "").trim().toLowerCase();
  const j = t ? s.toLowerCase().indexOf(t) : -1;
  if (j < 0) return s.slice(0, max - 1) + "…";
  const lead = Math.min(20, Math.floor((max - t.length) / 3));
  let start = Math.max(0, j - lead);
  if (start + max > s.length) start = Math.max(0, s.length - max);
  const body = s.slice(start, start + max);
  return (start > 0 ? "…" : "") + body + (start + max < s.length ? "…" : "");
}

/** ข้อความที่ใช้แสดง/ไฮไลต์ของผลค้นหา — ตามลำดับที่ backend ค้น (ข้อความ → เลขคิว/JN → ไฟล์แนบ → ข้อความที่ Reply) */
export function searchableTextOf(m: {
  text?: string;
  ref?: { queueNo?: string; jobId?: string } | null;
  jobCard?: { jobId?: string } | null;
  attachments?: { name: string }[];
  replyTo?: { excerpt?: string; cancelled?: boolean } | null;
  cardMatch?: { label: string; value: string } | null;
}, term: string): string {
  const t = String(term ?? "").trim().toLowerCase();
  const has = (v?: string) => !!v && (!t || v.toLowerCase().includes(t));
  if (has(m.text)) return m.text!;
  if (has(m.ref?.queueNo)) return `${m.ref!.queueNo}${m.ref?.jobId ? ` / ${m.ref.jobId}` : ""}`;
  if (has(m.ref?.jobId)) return m.ref!.jobId!;
  if (has(m.jobCard?.jobId)) return m.jobCard!.jobId!;
  const file = (m.attachments ?? []).find((a) => has(a.name));
  if (file) return `📎 ${file.name}`;
  if (!m.replyTo?.cancelled && has(m.replyTo?.excerpt)) return `↩ ${m.replyTo!.excerpt}`;
  // CHAT-SR03: ตรงในรายละเอียดการ์ดคิว (ร้าน/เซลล์/ช่าง/รุ่น/ที่อยู่/หมายเหตุ …)
  if (m.cardMatch && has(m.cardMatch.value)) return `🗂 ${m.cardMatch.label}: ${m.cardMatch.value}`;
  return m.text || m.ref?.queueNo || m.ref?.jobId || (m.attachments?.length ? `ไฟล์แนบ ${m.attachments.length} ไฟล์` : "(ไม่มีข้อความ)");
}

/** สมาชิกที่ชื่อตรงคำค้น (แท็บ "สมาชิก") */
export function filterMembers<T extends { name: string }>(members: T[], term: string): T[] {
  const t = String(term ?? "").trim().toLowerCase();
  if (!t) return [];
  return members.filter((m) => m.name.toLowerCase().includes(t));
}

/**
 * ปุ่ม ▲▼ ใต้ห้องแชท — ผลเรียง ใหม่ → เก่า (index 0 = ล่าสุด)
 *   ▲ = ผลที่เก่ากว่า (index + 1) · ▼ = ผลที่ใหม่กว่า (index − 1)
 *   ▲ ที่ผลสุดท้ายแต่ยังมีหน้าถัดไป → "LOAD" (โหลดหน้าถัดไปแล้วไปผลถัดไป)
 */
export type SearchStep = { kind: "GO"; index: number } | { kind: "LOAD" } | { kind: "NONE" };
export function stepResult(index: number, total: number, dir: "older" | "newer", hasMore: boolean): SearchStep {
  if (total <= 0) return hasMore && dir === "older" ? { kind: "LOAD" } : { kind: "NONE" };
  if (dir === "newer") return index > 0 ? { kind: "GO", index: Math.min(index - 1, total - 1) } : { kind: "NONE" };
  if (index < total - 1) return { kind: "GO", index: index + 1 };
  return hasMore ? { kind: "LOAD" } : { kind: "NONE" };
}

/** ป้ายลำดับผล "3/65" · มีหน้าถัดไป = "3/65+" */
export function positionLabel(index: number, total: number, hasMore: boolean): string {
  if (total <= 0 || index < 0) return `0/${total}${hasMore ? "+" : ""}`;
  return `${index + 1}/${total}${hasMore ? "+" : ""}`;
}

/** วันที่ในรายการผลแบบ LINE (เวลาไทย) — วันนี้ = HH:mm · ปีเดียวกัน = d MMM · อื่น ๆ = d/M/yy (พ.ศ.) */
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export function resultDateLabel(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t + 7 * 3600_000);
  const n = new Date(now.getTime() + 7 * 3600_000);
  const sameDay = d.toISOString().slice(0, 10) === n.toISOString().slice(0, 10);
  if (sameDay) return d.toISOString().slice(11, 16);
  if (d.getUTCFullYear() === n.getUTCFullYear()) return `${d.getUTCDate()} ${TH_MONTHS[d.getUTCMonth()]}`;
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${String((d.getUTCFullYear() + 543) % 100).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// CHAT-AV01 รูปโปรไฟล์สำรอง (ไม่มีรูป / โหลดไม่ได้): วงกลมสี + อักษรแรกของชื่อ
// ---------------------------------------------------------------------------
const THAI_LEADING_VOWELS = /^[เ-ไ]/; // เ แ โ ใ ไ (สระหน้า) — ข้ามไปพยัญชนะ
export function initialsOf(name: string): string {
  const s = String(name ?? "").trim();
  if (!s) return "?";
  const first = s.split(/\s+/)[0];
  const body = first.replace(THAI_LEADING_VOWELS, "") || first;
  const ch = Array.from(body)[0] ?? "?";
  return /[a-z]/i.test(ch) ? ch.toUpperCase() : ch;
}
const AVATAR_COLORS = ["#2e7d32", "#1565c0", "#6a1b9a", "#c62828", "#ef6c00", "#00838f", "#4527a0", "#ad1457", "#558b2f", "#37474f"];
export function avatarColorOf(id: string): string {
  let h = 0;
  for (const c of String(id ?? "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** รูปที่ cache ไว้ใช้ได้ถึงเมื่อไร — presigned URL ของ R2 อายุ 1 ชม. → รีเฟรชก่อนหมด (45 นาที) · data URL ไม่หมดอายุ */
export const AVATAR_TTL_MS = 45 * 60 * 1000;
export function avatarStale(entry: { url: string | null; at: number } | undefined, now: number): boolean {
  if (!entry) return true;
  if (entry.url && entry.url.startsWith("data:")) return false;
  return now - entry.at > AVATAR_TTL_MS;
}

/** ขนาดรูปโปรไฟล์หลังย่อ (สี่เหลี่ยมจัตุรัส ตัดกลาง) */
export const AVATAR_SIZE_PX = 256;
export function centerSquare(w: number, h: number): { sx: number; sy: number; size: number } {
  const size = Math.min(w, h);
  return { sx: Math.floor((w - size) / 2), sy: Math.floor((h - size) / 2), size };
}
