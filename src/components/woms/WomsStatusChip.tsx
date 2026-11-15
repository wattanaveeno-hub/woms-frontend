"use client";
import { holdKindOf } from "@/lib/holdKind";

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

import { PM_ROUND_STATUS_LABEL, PM_ROUND_STATUS_TONE, type PmRoundStatus } from "@/lib/pmRoundRules";

export type StatusTone = "success" | "warning" | "error" | "info" | "primary" | "neutral";

export interface WomsStatusChipProps {
  label: string;
  tone?: StatusTone;
  size?: ChipProps["size"];
  /** ข้อความเต็มเมื่อชี้ (ใช้เมื่อป้ายถูกย่อ) */
  title?: string;
}

const CHIP_DS: Record<StatusTone, { bg: string; ink: string }> = {
  warning: { bg: "#fdf3e2", ink: "#8a5606" },
  success: { bg: "#eef3ec", ink: "#3d6340" },
  error: { bg: "#fbeceb", ink: "#b3261e" },
  info: { bg: "#e6f1f8", ink: "#0b6aa2" },
  neutral: { bg: "#eef2f5", ink: "#51626f" },
  primary: { bg: "#e1f1e4", ink: "#14432a" },
};

/** ชิปสถานะแบบพื้นอ่อน + ตัวอักษรเข้ม (คอนทราสต์ผ่าน AA บนพื้นขาว) */
export function WomsStatusChip({ label, tone = "neutral", size = "small", title }: WomsStatusChipProps) {
  return (
    <Chip
      label={label}
      size={size}
      title={title ?? label}
      sx={{
        // ENTECH DS badge: พื้นอ่อน + ตัวอักษรเข้ม + จุดสีหน้าป้าย
        bgcolor: CHIP_DS[tone].bg,
        color: CHIP_DS[tone].ink,
        border: 1,
        borderColor: "transparent",
        fontWeight: 600,
        fontSize: 12,
        maxWidth: "100%",
        "& .MuiChip-label": { display: "inline-flex", alignItems: "center", gap: "5px", px: 1.125 },
        "& .MuiChip-label::before": { content: '""', width: 6, height: 6, borderRadius: 999, bgcolor: "currentColor", flex: "none" },
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
export function JobStatusChip({ status, size, holdReason }: { status: JobStatus; size?: ChipProps["size"]; holdReason?: string | null }) {
  // UAT2-14: ส่ง holdReason มาด้วย = แยกป้าย "เลื่อนวันเข้า" ออกจาก "พักงาน" (ไม่ส่ง = ป้ายเดิม)
  if (holdReason !== undefined && holdKindOf({ status, holdReason }) === "RESCHEDULE") {
    return <WomsStatusChip label="เลื่อนวันเข้า" tone="warning" size={size} />;
  }
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
  EXTERNAL: "info",
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
  UNDER_REVIEW: "info",
  ON_HOLD: "warning",
  RETURNED: "warning",
  APPROVED: "primary",
  PRINTED: "primary",
  PAYMENT_PENDING: "warning",
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

// ---- ตาราง PM รายเดือน (Handoff ส่วนที่ 2) ----
// โทน: ค้าง error · เดือนนี้ warning · ใกล้ถึง info · ยังไม่ถึง/รอตรวจ neutral · ทำแล้ว success (PM_ROUND_STATUS_TONE)
/** label (optional) ใช้แทนป้ายมาตรฐาน เช่น "ทำแล้ว · เข้าก่อนรอบ" — โทนสียังตามสถานะ */
export function PmRoundStatusChip({ status, size, label }: { status: PmRoundStatus; size?: ChipProps["size"]; label?: string }) {
  return <WomsStatusChip label={label || PM_ROUND_STATUS_LABEL[status] || status} tone={PM_ROUND_STATUS_TONE[status] ?? "neutral"} size={size} />;
}
