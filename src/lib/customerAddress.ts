// ฟอร์มลูกค้าใหม่ — ฟังก์ชันล้วนของตัวช่วยที่อยู่ (ทดสอบด้วย node --test · ห้าม import "@/")

/** ข้อความนี้น่าจะเป็นลิงก์แผนที่หรือพิกัด (ส่งไปให้ backend ดึงที่อยู่) */
export function looksLikeMapLink(s: string): boolean {
  const t = String(s ?? "").trim();
  if (!t) return false;
  if (/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(t)) return true;
  return /^https:\/\/(?:[a-z0-9-]+\.)*(?:google\.[a-z.]+|goo\.gl|g\.co)\//i.test(t);
}

export function thaiAddressLabel(e: { subdistrict: string; district: string; province: string; postcode: string }): string {
  const bkk = e.province === "กรุงเทพมหานคร";
  return [e.subdistrict && `${bkk ? "แขวง" : "ต."}${e.subdistrict}`, e.district && `${bkk ? "เขต" : "อ."}${e.district}`, e.province && (bkk ? e.province : `จ.${e.province}`), e.postcode]
    .filter(Boolean)
    .join(" ");
}

export interface AddressFields {
  address: string;
  subdistrict: string;
  district: string;
  province: string;
  postcode: string;
  lat: string;
  lng: string;
}

/**
 * ผลจากแผนที่ → ช่องในฟอร์ม
 *   overwrite=true (ผู้ใช้เพิ่งวาง/กดดึง) แทนค่าที่มี · false (เติมตอนเปิดหน้าต่าง/ออกจากช่อง) เติมเฉพาะช่องว่าง
 *   ไม่ล้างค่าที่ผู้ใช้กรอกด้วยค่าว่างจากแผนที่ · ที่อยู่ (เลขที่/ถนน) เติมเฉพาะเมื่อว่าง
 */
export function addressFromMap(
  prev: AddressFields,
  g: { lat: number | null; lng: number | null; street: string; subdistrict: string; district: string; province: string; postcode: string },
  overwrite: boolean
): Partial<AddressFields> {
  const out: Partial<AddressFields> = {};
  const put = (k: keyof AddressFields, val: string) => {
    if (!val) return;
    if (overwrite || !String(prev[k] ?? "").trim()) out[k] = val;
  };
  if (g.lat !== null && g.lng !== null) {
    put("lat", String(g.lat));
    put("lng", String(g.lng));
  }
  put("subdistrict", g.subdistrict);
  put("district", g.district);
  put("province", g.province);
  put("postcode", g.postcode);
  if (g.street && !String(prev.address ?? "").trim()) out.address = g.street;
  return out;
}
