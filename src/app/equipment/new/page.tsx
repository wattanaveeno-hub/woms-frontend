"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { EquipmentFormValues, Options } from "@/lib/types";
import EquipmentForm from "@/components/EquipmentForm";
import { useToast } from "@/components/Toast";

export default function NewEquipmentPage() {
  const router = useRouter();
  const toast = useToast();
  const [options, setOptions] = useState<Options | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);

  useEffect(() => {
    api
      .getOptions()
      .then(setOptions)
      .catch((e) =>
        setFieldError({ message: e instanceof ApiError ? e.message : "โหลดตัวเลือกไม่สำเร็จ" })
      );
  }, []);

  const submit = async (values: EquipmentFormValues) => {
    setBusy(true);
    setFieldError(null);
    try {
      const eq = await api.createEquipment(values);
      toast.success(`เพิ่มเครื่อง ${eq.serial} แล้ว`);
      router.push(`/equipment/${eq.id}`);
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
          <h1>เพิ่มเครื่องเข้าคลัง</h1>
          <div className="sub">บันทึก serial, รุ่น และข้อมูลรับประกัน</div>
        </div>
      </div>

      <div className="card card-pad">
        {options ? (
          <EquipmentForm
            options={options}
            submitLabel="บันทึก"
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
