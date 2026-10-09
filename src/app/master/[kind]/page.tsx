"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MasterManager from "@/components/MasterManager";
import { masterLabel } from "@/lib/options";
import type { MasterKind } from "@/lib/types";
import { WomsPageHeader, WomsPermissionGate } from "@/components/woms";

const VALID: MasterKind[] = ["team", "model", "zone", "category", "warehouse", "salesperson", "pm_package"];

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
