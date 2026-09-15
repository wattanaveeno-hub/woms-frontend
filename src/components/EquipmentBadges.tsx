import type { EquipmentStatus, WarrantyStatus } from "@/lib/types";
import { equipmentStatusLabel, warrantyStatusLabel } from "@/lib/options";

const statusClass: Record<EquipmentStatus, string> = {
  IN_STOCK: "badge-stock",
  RESERVED: "badge-reserved",
  RENTED: "badge-rented",
  SOLD: "badge-sold",
  REPAIR: "badge-repair",
  RETIRED: "badge-retired",
};

export function EquipmentStatusBadge({ status }: { status: EquipmentStatus }) {
  return <span className={`badge ${statusClass[status]}`}>{equipmentStatusLabel[status]}</span>;
}

const warrantyClass: Record<WarrantyStatus, string> = {
  NONE: "badge-wnone",
  ACTIVE: "badge-wok",
  EXPIRING: "badge-wsoon",
  EXPIRED: "badge-wexp",
};

export function WarrantyBadge({ status }: { status: WarrantyStatus }) {
  return <span className={`badge ${warrantyClass[status]}`}>{warrantyStatusLabel[status]}</span>;
}

// ป้ายเตือนเครื่องที่ยังไม่ได้ลง Serial จริง (ใช้เลขชั่วคราว TMP-)
export function NeedsSerialBadge() {
  return <span className="badge badge-wexp">ยังไม่มี SN</span>;
}
