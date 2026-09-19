import type { ContractStatus, ContractType, InstallmentStatus } from "@/lib/types";
import { contractStatusLabel, contractTypeLabel } from "@/lib/options";

const statusClass: Record<ContractStatus, string> = {
  DRAFT: "badge-off",
  ACTIVE: "badge-active",
  COMPLETED: "badge-completed",
  EXPIRED: "badge-wexp",
  CANCELLED: "badge-cancelled",
};

// สถานะที่ผู้ใช้เห็น รวม "ใกล้หมดอายุ" ที่ backend คำนวณจากวันสิ้นสุด
const lifecycleClass: Record<string, string> = {
  ...statusClass,
  EXPIRING: "badge-wsoon",
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <span className={`badge ${statusClass[status]}`}>{contractStatusLabel[status]}</span>;
}

/** ใช้เมื่อ backend ส่ง lifecycle มาด้วย (แสดง "ใกล้หมดอายุ" ได้) */
export function ContractLifecycleBadge({ lifecycle, label }: { lifecycle?: string; label?: string }) {
  if (!lifecycle) return null;
  return <span className={`badge ${lifecycleClass[lifecycle] ?? ""}`}>{label ?? lifecycle}</span>;
}

export function ContractTypeBadge({ type }: { type: ContractType }) {
  return <span className="pill">{contractTypeLabel[type]}</span>;
}

export function InstallmentBadge({ status }: { status: InstallmentStatus }) {
  return (
    <span className={`badge ${status === "PAID" ? "badge-completed" : "badge-wsoon"}`}>
      {status === "PAID" ? "จ่ายแล้ว" : "ค้างชำระ"}
    </span>
  );
}
