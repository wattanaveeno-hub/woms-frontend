"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MasterManager from "@/components/MasterManager";
import { masterLabel } from "@/lib/options";
import type { MasterKind } from "@/lib/types";
import { WomsPageHeader, WomsPermissionGate } from "@/components/woms";

/**
 * Owner 10 พ.ย. 69: ซ่อน "รุ่นเครื่อง" (model) และ "หมวดหมู่เครื่อง" (category) — /master/model และ /master/category = 404
 * ข้อมูลรุ่น/หมวดหมู่จัดการที่ "รุ่นเครื่อง (ข้อมูลหลัก)" (/master/equipment-models) ซึ่งเติมค่าเข้า master เดิมให้อัตโนมัติ
 * API /api/master/model|category ยังเปิดอยู่ เพราะฟอร์มอื่นใช้เป็นตัวเลือก
 */
const HIDDEN_MASTER_KINDS: MasterKind[] = ["model", "category"];
const VALID: MasterKind[] = (["team", "model", "zone", "category", "warehouse", "salesperson", "pm_package"] as MasterKind[]).filter(
  (k) => !HIDDEN_MASTER_KINDS.includes(k)
);

export default function MasterKindPage() {
  const params = useParams<{ kind: string }>();
  if (!VALID.includes(params.kind as MasterKind)) notFound();
  const kind = params.kind as MasterKind;

  return (
    <WomsPermissionGate anyOf={["master:manage", "master:view"]}>
      <WomsPageHeader
        title={masterLabel[kind]}
        subtitle="รายการที่ใช้เป็นตัวเลือกในฟอร์ม"
        actions={
          <Button component={Link} href="/master" startIcon={<ArrowBackIcon />}>
            ข้อมูลพื้นฐาน
          </Button>
        }
      />
      <MasterManager kind={kind} />
    </WomsPermissionGate>
  );
}
