// ป้ายสถานะของเครื่อง — ส่งต่อให้ชิปสถานะกลาง (components/woms/WomsStatusChip)
// ชื่อ export เดิมคงไว้ทั้งหมด หน้าที่ใช้อยู่จึงได้หน้าตา MUI โดยไม่ต้องแก้
import type { EquipmentStatus, PmStatus, WarrantyStatus } from "@/lib/types";
import {
  EquipmentStatusChip,
  NeedsSerialChip,
  NoContractChip,
  PmStatusChip,
  WarrantyStatusChip,
} from "@/components/woms/WomsStatusChip";

export function EquipmentStatusBadge({ status }: { status: EquipmentStatus }) {
  return <EquipmentStatusChip status={status} />;
}

export function WarrantyBadge({ status }: { status: WarrantyStatus }) {
  return <WarrantyStatusChip status={status} />;
}

export function NeedsSerialBadge() {
  return <NeedsSerialChip />;
}

export function NoContractBadge() {
  return <NoContractChip />;
}

export function PmBadge({ status }: { status: PmStatus }) {
  return <PmStatusChip status={status} />;
}
