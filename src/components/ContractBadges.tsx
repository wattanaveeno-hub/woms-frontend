import type { ContractStatus, ContractType, InstallmentStatus } from "@/lib/types";
import { contractStatusLabel, contractTypeLabel } from "@/lib/options";

const statusClass: Record<ContractStatus, string> = {
  ACTIVE: "badge-active",
  COMPLETED: "badge-completed",
  CANCELLED: "badge-cancelled",
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <span className={`badge ${statusClass[status]}`}>{contractStatusLabel[status]}</span>;
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
