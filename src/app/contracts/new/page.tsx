"use client";

import { WomsPermissionGate } from "@/components/woms/WomsPermissionGate";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { ContractFormValues, Options } from "@/lib/types";
import ContractForm from "@/components/ContractForm";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { WomsErrorState, WomsLoadingState, WomsPageHeader } from "@/components/woms";

function NewContractPageInner() {
  const router = useRouter();
  const toast = useToast();
  const [options, setOptions] = useState<Options | null>(null);
  const [serials, setSerials] = useState<{ serial: string; model: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  // A D-04 / DEF-01 — "สร้างสัญญาให้เครื่องนี้" จากหน้าเครื่อง: /contracts/new?serial=<SN>
  // อ่านจาก window แทน useSearchParams เพื่อไม่ต้องมี <Suspense> ตอน prerender (แบบเดียวกับ jobs/new)
  const [initialSerial, setInitialSerial] = useState("");
  const loadOptions = () => {
    setLoadError(null);
    api
      .getOptions()
      .then(setOptions)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "โหลดตัวเลือกไม่สำเร็จ"));
  };
  useEffect(() => {
    setInitialSerial((new URLSearchParams(window.location.search).get("serial") ?? "").trim());
    loadOptions();
    // offer in-stock units first for quick selection, but allow any
    api
      .listEquipment()
      .then((res) => setSerials(res.items.map((e) => ({ serial: e.serial, model: e.model }))))
      .catch(() => setSerials([]));
  }, []);

  const submit = async (values: ContractFormValues, activate: boolean) => {
    setBusy(true);
    setFieldError(null);
    try {
      const c = await api.createContract(values, activate ? "ACTIVE" : "DRAFT");
      /*
       * ข้อความยืนยันต้องสะท้อน "สถานะที่เซิร์ฟเวอร์คืนมาจริง" ไม่ใช่สถานะที่เราขอไป
       * เหตุผล: เซิร์ฟเวอร์รุ่นก่อนหน้าไม่รู้จักฟิลด์ status และ zod จะ strip ทิ้งเงียบ ๆ
       * แล้วสร้างสัญญาเป็น ACTIVE ทันที ถ้าเราขึ้นว่า "บันทึกร่างสัญญาแล้ว" ตามที่ขอไป
       * ผู้ใช้จะเชื่อว่าสัญญายังไม่มีผล ทั้งที่ยอดค้างชำระเข้ารายงานไปแล้ว
       */
      if (c.status === "DRAFT") {
        toast.success(
          `บันทึกร่างสัญญา ${c.contractNo} แล้ว — กด “เปิดใช้งานสัญญา” เมื่อพร้อมให้มีผลจริง`
        );
      } else if (activate) {
        toast.success(`สร้างสัญญา ${c.contractNo} และเปิดใช้งานแล้ว`);
      } else {
        toast.warning(
          `สร้างสัญญา ${c.contractNo} แล้ว แต่ระบบบันทึกเป็น “${c.statusLabel ?? c.status}” ไม่ใช่ร่างสัญญา — ` +
            "เซิร์ฟเวอร์รุ่นที่ใช้อยู่ยังไม่รองรับสถานะร่าง กรุณาตรวจสถานะบนหน้ารายละเอียด"
        );
      }
      router.push(`/contracts/${c.id}`);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldError({ field: e.field, message: e.message });
        toast.error(e.message);
      } else {
        setFieldError({ message: "บันทึกไม่สำเร็จ" });
        toast.error("บันทึกไม่สำเร็จ");
      }
      setBusy(false);
    }
  };

  return (
    <>
      <WomsPageHeader
        title="สร้างสัญญา"
        subtitle="เช่า / เช่าซื้อ / ขาย — ระบบจะออกเลขสัญญาและตารางงวดให้อัตโนมัติ · สัญญาใหม่เริ่มต้นเป็น “ร่างสัญญา”"
        actions={
          <Button component={Link} href="/contracts" startIcon={<ArrowBackIcon />}>
            รายการสัญญา
          </Button>
        }
      />
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        {options ? (
          <ContractForm
            options={options}
            serials={serials}
            initial={initialSerial ? { serial: initialSerial, model: serials.find((x) => x.serial === initialSerial)?.model ?? "" } : undefined}
            submitLabel="บันทึกร่างสัญญา"
            isNew
            busy={busy}
            fieldError={fieldError}
            onSubmit={submit}
          />
        ) : loadError ? (
          <WomsErrorState message={loadError} onRetry={loadOptions} />
        ) : (
          <WomsLoadingState rows={5} />
        )}
      </Paper>
    </>
  );
}

// เปิด URL ตรงโดยไม่มีสิทธิ์ → แสดงข้อความแทนฟอร์มที่บันทึกไม่ได้ (backend บังคับสิทธิ์อีกชั้นเสมอ)
export default function NewContractPage() {
  return (
    <WomsPermissionGate perm="contracts:create" backHref="/contracts">
      <NewContractPageInner />
    </WomsPermissionGate>
  );
}
