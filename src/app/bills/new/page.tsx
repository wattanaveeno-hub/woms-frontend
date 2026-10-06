"use client";

// ---------------------------------------------------------------------------
// ทำรายการวางบิล (BILL-01..03) — เลือก Job Machine จากใบงานที่ปิดแล้ว
// ค่าบริการรายเครื่อง + ค่าใช้จ่ายร่วมหนึ่งชุดต่อใบงาน → Summary → บันทึกร่าง / ส่งตรวจ
// ---------------------------------------------------------------------------
import Link from "next/link";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { WomsPermissionGate } from "@/components/woms/WomsPermissionGate";
import { WomsPageHeader } from "@/components/woms";
import BillMachineForm from "@/components/BillMachineForm";

export default function NewBillPage() {
  return (
    <WomsPermissionGate perm="bill:create" backHref="/bills">
      <WomsPageHeader
        title="ทำรายการวางบิล"
        subtitle="ค่าบริการผูกกับเครื่องในใบงาน (Job Machine) · ค่าใช้จ่ายร่วมกรอกครั้งเดียวต่อใบงาน"
        actions={
          <Button component={Link} href="/bills" startIcon={<ArrowBackIcon />}>
            รายการวางบิล
          </Button>
        }
      />
      <BillMachineForm />
    </WomsPermissionGate>
  );
}
