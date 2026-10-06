"use client";

// แก้ไขบิลที่ยังเป็นร่างหรือถูกส่งกลับ (BILL-03) — บิลรูปแบบรายเครื่องเท่านั้น
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { ApiError } from "@/lib/api";
import { billsApi, type TechBillV2 } from "@/lib/billsApi";
import { WomsPermissionGate } from "@/components/woms/WomsPermissionGate";
import { WomsErrorState, WomsLoadingState, WomsPageHeader } from "@/components/woms";
import BillMachineForm from "@/components/BillMachineForm";

function EditInner() {
  const { id } = useParams<{ id: string }>();
  const [bill, setBill] = useState<TechBillV2 | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBill(await billsApi.get(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดบิลไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const back = (
    <Button component={Link} href={`/bills/${id}`} startIcon={<ArrowBackIcon />}>
      กลับไปที่บิล
    </Button>
  );
  if (error)
    return (
      <>
        <WomsPageHeader title="แก้ไขรายการวางบิล" actions={back} />
        <WomsErrorState message={error} onRetry={load} />
      </>
    );
  if (!bill) return <WomsLoadingState rows={5} />;

  return (
    <>
      <WomsPageHeader title={`แก้ไขบิล ${bill.billNo}`} subtitle={`${bill.technicianName} · ${bill.statusLabel}`} actions={back} />
      {!bill.editable ? (
        <Alert severity="warning">บิลสถานะ “{bill.statusLabel}” แก้ไขไม่ได้ — แก้ได้เฉพาะร่างหรือบิลที่ถูกส่งกลับ</Alert>
      ) : bill.format !== "MACHINE" ? (
        <Alert severity="info">
          บิลนี้เป็นรูปแบบเดิม (ค่าแรงรายใบงาน + ค่าเดินทางรายวัน) ซึ่งแก้บนหน้าจอใหม่ไม่ได้ — ยกเลิกบิลนี้แล้วทำรายการใหม่แบบรายเครื่อง
        </Alert>
      ) : (
        <BillMachineForm bill={bill} />
      )}
    </>
  );
}

export default function EditBillPage() {
  return (
    <WomsPermissionGate perm="bill:create" backHref="/bills">
      <EditInner />
    </WomsPermissionGate>
  );
}
