import type { EquipmentStatus, PmStatus, WarrantyStatus } from "@/lib/types";
import { equipmentStatusLabel, pmStatusLabel, warrantyStatusLabel } from "@/lib/options";

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

// ป้ายสถานะ PM — ใช้สีชุดเดียวกับป้ายประกัน ไม่เพิ่ม CSS ใหม่
const pmClass: Record<PmStatus, string> = {
  NOT_CONFIGURED: "badge-wnone",
  ON_SCHEDULE: "badge-wok",
  DUE_SOON: "badge-wsoon",
  OVERDUE: "badge-wexp",
};

export function PmBadge({ status }: { status: PmStatus }) {
  return <span className={`badge ${pmClass[status] ?? "badge-wnone"}`}>{pmStatusLabel[status] ?? status}</span>;
}
