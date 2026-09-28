// ป้ายสัญญา — สถานะส่งต่อให้ชิปสถานะกลาง (components/woms/WomsStatusChip)
import Chip from "@mui/material/Chip";
import type { ContractStatus, ContractType, InstallmentStatus } from "@/lib/types";
import { contractTypeLabel } from "@/lib/options";
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

export function InstallmentBadge({ status }: { status: InstallmentStatus }) {
  return <InstallmentStatusChip status={status} />;
}
