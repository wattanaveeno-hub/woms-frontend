// ป้ายสัญญา — สถานะส่งต่อให้ชิปสถานะกลาง (components/woms/WomsStatusChip)
import Chip from "@mui/material/Chip";
import type { ContractStatus, ContractType, InstallmentStatus } from "@/lib/types";
import { contractTypeLabel } from "@/lib/options";
import { WomsStatusChip } from "@/components/woms/WomsStatusChip";
import { installmentChip } from "@/lib/contractRules";
import { bangkokToday } from "@/lib/date";
import {
  ContractLifecycleChip,
  ContractStatusChip,
  InstallmentStatusChip,
} from "@/components/woms/WomsStatusChip";

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <ContractStatusChip status={status} />;
}

/** ใช้เมื่อ backend ส่ง lifecycle มาด้วย (แสดง "ใกล้หมดอายุ" ได้) */
export function ContractLifecycleBadge({ lifecycle, label }: { lifecycle?: string; label?: string }) {
  return <ContractLifecycleChip lifecycle={lifecycle} label={label} />;
}

export function ContractTypeBadge({ type }: { type: ContractType }) {
  return <Chip size="small" variant="outlined" label={contractTypeLabel[type]} />;
}

/**
 * DEF-04 — ป้ายงวดตามวันครบกำหนด: จ่ายแล้ว / ค้างชำระ (เลยกำหนด) / รอชำระ (ยังไม่ถึงกำหนด)
 * ไม่ส่ง dueDate = พฤติกรรมเดิม (PENDING ทุกงวด = ค้างชำระ)
 */
export function InstallmentBadge({
  status,
  dueDate,
  contractStatus,
}: {
  status: InstallmentStatus;
  dueDate?: string;
  contractStatus?: ContractStatus;
}) {
  if (dueDate === undefined) return <InstallmentStatusChip status={status} />;
  const chip = installmentChip({ status, dueDate }, bangkokToday(), contractStatus);
  return <WomsStatusChip label={chip.label} tone={chip.tone} />;
}
