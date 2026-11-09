// ---------------------------------------------------------------------------
// การแบ่งกลุ่มแถวของ WomsDataTable (prop groupBy) — ฟังก์ชันบริสุทธิ์ ทดสอบด้วย node --test
//   order = ลำดับกลุ่มที่ผู้เรียกกำหนด (เช่น ช่างตามรายชื่อ แล้ว "ยังไม่ระบุช่าง") · กลุ่มที่ไม่อยู่ใน order ต่อท้ายตามลำดับที่พบ
//   ในแต่ละกลุ่มคงลำดับแถวเดิม (stable) — การเรียงคอลัมน์จึงเรียงภายในกลุ่ม
// ---------------------------------------------------------------------------
export interface RowGroup<T> {
  key: string;
  rows: T[];
}

export function groupRows<T>(rows: T[], keyOf: (row: T) => string, order?: string[]): RowGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = keyOf(r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  const keys = [...map.keys()];
  if (order?.length) {
    const rank = (k: string) => {
      const i = order.indexOf(k);
      return i === -1 ? order.length + keys.indexOf(k) : i;
    };
    keys.sort((a, b) => rank(a) - rank(b));
  }
  return keys.map((key) => ({ key, rows: map.get(key)! }));
}

/** แถวเรียงตามกลุ่ม + จำนวนต่อกลุ่ม (นับจากทุกแถว ไม่ใช่เฉพาะหน้าที่แสดง) */
export function flattenGroups<T>(groups: RowGroup<T>[]): { rows: T[]; counts: Map<string, number> } {
  return { rows: groups.flatMap((g) => g.rows), counts: new Map(groups.map((g) => [g.key, g.rows.length])) };
}

/** แถวในหน้าหนึ่ง → แทรกหัวกลุ่มเมื่อกลุ่มเปลี่ยน (หน้าถัดไปที่เริ่มกลางกลุ่มจะมีหัวกลุ่มซ้ำ) */
export function withGroupHeaders<T>(pageRows: T[], keyOf: (row: T) => string): Array<{ header: string } | { row: T }> {
  const out: Array<{ header: string } | { row: T }> = [];
  let last: string | null = null;
  for (const r of pageRows) {
    const k = keyOf(r);
    if (k !== last) {
      out.push({ header: k });
      last = k;
    }
    out.push({ row: r });
  }
  return out;
}
