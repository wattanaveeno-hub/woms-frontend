// Phase 7 (design note pCust: "สต็อกรวม อยู่ในแท็บของคลังเครื่องแทน") — แท็บลิงก์ร่วมของหน้าคลังเครื่อง
export function equipmentTabs(has: (p: string) => boolean) {
  return [
    { href: "/equipment", label: "รายการเครื่อง", show: has("inventory:view") },
    { href: "/inventory", label: "สต็อกรวม", show: has("inventory:view") },
    { href: "/equipment/receive", label: "รับเครื่องเข้าคลัง", show: has("inventory:view") },
  ];
}
