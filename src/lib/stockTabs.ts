// Phase 7 (design note pCust: "ข้อมูลอะไหล่ + สต๊อกอะไหล่ รวมเป็นหน้าเดียวมีแท็บ") — แท็บลิงก์ /stock ↔ /parts
export const stockTabs = (has: (p: string) => boolean) => [
  { href: "/stock", label: "สต๊อกคงเหลือ", show: has("stock:view") },
  { href: "/parts", label: "ข้อมูลอะไหล่", show: has("stock:view") },
];
