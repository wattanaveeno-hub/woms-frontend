"use client";

// ---------------------------------------------------------------------------
// สถานะทุกโมดูลแสดงผ่านคอมโพเนนต์เดียว — สี + ข้อความเสมอ (ไม่ใช้สีอย่างเดียว)
// ---------------------------------------------------------------------------
// การจับคู่ "สถานะ → โทนสี" อยู่ในไฟล์นี้ที่เดียว หน้าไหนก็ห้ามคิดสีสถานะเอง
import Chip, { ChipProps } from "@mui/material/Chip";
import type {
  BillStatus,
  ContractStatus,
  EquipmentStatus,
  InstallmentStatus,
  JobStatus,
  PmItemStatus,
  PmPlanStatus,
  PmStatus,
  QuotationStatus,
  WarrantyStatus,
} from "@/lib/types";
import { BILL_STATUS_LABEL, PM_ITEM_STATUS_LABEL, PM_PLAN_STATUS_LABEL } from "@/lib/types";
import {
  contractStatusLabel,
  equipmentStatusLabel,
  pmStatusLabel,
  quotationStatusLabel,
  statusLabel as jobStatusLabel,
  warrantyStatusLabel,
} from "@/lib/options";

export type StatusTone = "success" | "warning" | "error" | "info" | "primary" | "neutral";

export interface WomsStatusChipProps {
  label: string;
  tone?: StatusTone;
  size?: ChipProps["size"];
  /** ข้อความเต็มเมื่อชี้ (ใช้เมื่อป้ายถูกย่อ) */
  title?: string;
}

/** ชิปสถานะแบบพื้นอ่อน + ตัวอักษรเข้ม (คอนทราสต์ผ่าน AA บนพื้นขาว) */
export function WomsStatusChip({ label, tone = "neutral", size = "small", title }: WomsStatusChipProps) {
  return (
    <Chip
      label={label}
      size={size}
      title={title ?? label}
      sx={{
        bgcolor: `${tone}.light`,
        color: tone === "neutral" ? "neutral.dark" : `${tone}.dark`,
        border: 1,
        borderColor: "transparent",
        fontWeight: 600,
        maxWidth: "100%",
      }}
    />
  );
}

// ---- ใบงาน ----
const JOB_TONE: Record<JobStatus, StatusTone> = {
  OPEN: "warning",
  HOLD: "info",
  CLOSED: "success",
  CANCELLED: "neutral",
};
export function JobStatusChip({ status, size }: { status: JobStatus; size?: ChipProps["size"] }) {
  return <WomsStatusChip label={jobStatusLabel[status] ?? status} tone={JOB_TONE[status] ?? "neutral"} size={size} />;
}

// ---- เครื่อง ----
const EQUIPMENT_TONE: Record<EquipmentStatus, StatusTone> = {
  IN_STOCK: "neutral",
  RESERVED: "info",
  RENTED: "primary",
  SOLD: "success",
  REPAIR: "warning",
  RETIRED: "neutral",
};
export function EquipmentStatusChip({ status }: { status: EquipmentStatus }) {
  return <WomsStatusChip label={equipmentStatusLabel[status] ?? status} tone={EQUIPMENT_TONE[status] ?? "neutral"} />;
}

const WARRANTY_TONE: Record<WarrantyStatus, StatusTone> = {
  NONE: "neutral",
  ACTIVE: "success",
  EXPIRING: "warning",
  EXPIRED: "error",
};
export function WarrantyStatusChip({ status }: { status: WarrantyStatus }) {
  return <WomsStatusChip label={warrantyStatusLabel[status] ?? status} tone={WARRANTY_TONE[status] ?? "neutral"} />;
}

const PM_TONE: Record<PmStatus, StatusTone> = {
  NOT_CONFIGURED: "neutral",
  ON_SCHEDULE: "success",
  DUE_SOON: "warning",
  OVERDUE: "error",
};
export function PmStatusChip({ status }: { status: PmStatus }) {
  return <WomsStatusChip label={pmStatusLabel[status] ?? status} tone={PM_TONE[status] ?? "neutral"} />;
}

/** เครื่องยังไม่มี SN จริง (ใช้เลขชั่วคราว) */
export function NeedsSerialChip() {
  return <WomsStatusChip label="ยังไม่มี SN" tone="error" />;
}
/** MCH-02 เครื่องเช่ายังไม่ผูกสัญญา */
export function NoContractChip() {
  return <WomsStatusChip label="เช่า · ยังไม่ผูกสัญญา" tone="error" />;
}

// ---- วางบิลช่าง ----
const BILL_TONE: Record<BillStatus, StatusTone> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  RETURNED: "warning",
  APPROVED: "primary",
  PAID: "success",
  CANCELLED: "neutral",
};
export function BillingStatusChip({ status, label }: { status: BillStatus; label?: string }) {
  return <WomsStatusChip label={label ?? BILL_STATUS_LABEL[status] ?? status} tone={BILL_TONE[status] ?? "neutral"} />;
}

// ---- สัญญา ----
const CONTRACT_TONE: Record<string, StatusTone> = {
  DRAFT: "neutral",
  ACTIVE: "primary",
  EXPIRING: "warning",
  COMPLETED: "success",
  EXPIRED: "error",
  CANCELLED: "neutral",
};
export function ContractStatusChip({ status }: { status: ContractStatus }) {
  return <WomsStatusChip label={contractStatusLabel[status] ?? status} tone={CONTRACT_TONE[status] ?? "neutral"} />;
}
/** lifecycle จาก backend (รวม "ใกล้หมดอายุ") */
export function ContractLifecycleChip({ lifecycle, label }: { lifecycle?: string; label?: string }) {
  if (!lifecycle) return null;
  return <WomsStatusChip label={label ?? lifecycle} tone={CONTRACT_TONE[lifecycle] ?? "neutral"} />;
}
export function InstallmentStatusChip({ status }: { status: InstallmentStatus }) {
  return (
    <WomsStatusChip label={status === "PAID" ? "จ่ายแล้ว" : "ค้างชำระ"} tone={status === "PAID" ? "success" : "warning"} />
  );
}

const PM_PLAN_TONE: Record<PmPlanStatus, StatusTone> = {
  DRAFT: "neutral",
  APPROVED: "info",
  SENT: "primary",
  CLOSED: "success",
  CANCELLED: "neutral",
};
export function PmPlanStatusChip({ status }: { status: PmPlanStatus }) {
  return <WomsStatusChip label={PM_PLAN_STATUS_LABEL[status] ?? status} tone={PM_PLAN_TONE[status] ?? "neutral"} />;
}

const PM_ITEM_TONE: Record<PmItemStatus, StatusTone> = {
  PLANNED: "warning",
  JOB_CREATED: "info",
  DONE: "success",
  SKIPPED: "neutral",
};
export function PmItemStatusChip({ status }: { status: PmItemStatus }) {
  return <WomsStatusChip label={PM_ITEM_STATUS_LABEL[status] ?? status} tone={PM_ITEM_TONE[status] ?? "neutral"} />;
}

const QUO_TONE: Record<QuotationStatus, StatusTone> = {
  DRAFT: "neutral",
  SENT: "info",
  ACCEPTED: "success",
  REJECTED: "error",
  EXPIRED: "warning",
  CANCELLED: "neutral",
};
export function QuotationStatusChip({ status }: { status: QuotationStatus }) {
  return <WomsStatusChip label={quotationStatusLabel[status] ?? status} tone={QUO_TONE[status] ?? "neutral"} />;
}
