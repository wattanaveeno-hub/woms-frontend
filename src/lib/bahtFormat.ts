/** จำนวนเงินบาท 2 ตำแหน่ง · null/undefined = ผู้ใช้ไม่มีสิทธิ์เห็นต้นทุน (BUG-V2-17 — API ส่ง null ให้ช่าง) → "—" */
export const baht = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";
