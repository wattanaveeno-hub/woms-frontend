"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { ContractFormValues, Options } from "@/lib/types";
import ContractForm from "@/components/ContractForm";
import { useToast } from "@/components/Toast";

export default function NewContractPage() {
  const router = useRouter();
  const toast = useToast();
  const [options, setOptions] = useState<Options | null>(null);
  const [serials, setSerials] = useState<{ serial: string; model: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);

  useEffect(() => {
    api
      .getOptions()
      .then(setOptions)
      .catch((e) => setFieldError({ message: e instanceof ApiError ? e.message : "โหลดตัวเลือกไม่สำเร็จ" }));
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
      <div className="page-head">
        <div>
          <h1>สร้างสัญญา</h1>
          <div className="sub">เช่า / เช่าซื้อ / ขาย — ระบบจะออกเลขสัญญาและตารางงวดให้อัตโนมัติ · สัญญาใหม่เริ่มต้นเป็น “ร่างสัญญา”</div>
        </div>
      </div>

      <div className="card card-pad">
        {options ? (
          <ContractForm
            options={options}
            serials={serials}
            submitLabel="บันทึกร่างสัญญา"
            isNew
            busy={busy}
            fieldError={fieldError}
            onSubmit={submit}
          />
        ) : (
          <div className="state">{fieldError ? fieldError.message : "กำลังโหลด…"}</div>
        )}
      </div>
    </>
  );
}
