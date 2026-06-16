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

  const submit = async (values: ContractFormValues) => {
    setBusy(true);
    setFieldError(null);
    try {
      const c = await api.createContract(values);
      toast.success(`สร้างสัญญา ${c.contractNo} แล้ว`);
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
          <div className="sub">เช่า / เช่าซื้อ / ขาย — ระบบจะออกเลขสัญญาและตารางงวดให้อัตโนมัติ</div>
        </div>
      </div>

      <div className="card card-pad">
        {options ? (
          <ContractForm
            options={options}
            serials={serials}
            submitLabel="สร้างสัญญา"
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
