"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { JobFormValues, Options } from "@/lib/types";
import JobForm from "@/components/JobForm";
import JobEquipmentSection, { PendingItem } from "@/components/JobEquipmentSection";
import { takeJobPrefill } from "@/lib/jobPrefill";

let seq = 0;
const nextKey = () => `n${++seq}`;

export default function NewJobPage() {
  const router = useRouter();
  const { has } = useAuth();
  const [options, setOptions] = useState<Options | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);

  // เครื่องที่จะผูกกับใบงาน — ยังไม่ถูกเขียนลงฐานข้อมูลจนกว่าจะกดบันทึก
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [prefillType, setPrefillType] = useState("");
  const [prefillReady, setPrefillReady] = useState(false);
  const consumed = useRef(false);

  useEffect(() => {
    api
      .getOptions()
      .then(setOptions)
      .catch((e) =>
        setFieldError({ message: e instanceof ApiError ? e.message : "โหลดตัวเลือกไม่สำเร็จ" })
      );
  }, []);

  // รับเครื่องที่เลือกมาจากหน้าคลัง (Phase 4) — เก็บแค่ id แล้วดึงข้อมูลล่าสุดจาก backend เสมอ
  useEffect(() => {
    if (consumed.current) return; // React StrictMode ใน dev เรียก effect ซ้ำ
    consumed.current = true;

    const prefill = takeJobPrefill();
    if (!prefill) {
      setPrefillReady(true);
      return;
    }
    setPrefillType(prefill.jobType);
    (async () => {
      const items: PendingItem[] = [];
      const gone: string[] = [];
      for (const id of prefill.equipmentIds) {
        try {
          const e = await api.getEquipment(id);
          items.push({
            key: nextKey(),
            equipmentId: e.id,
            displaySerial: e.serial,
            displayModel: e.model,
            hasRealSerial: e.hasRealSerial,
          });
        } catch {
          gone.push(id); // ถูกลบไปแล้ว หรือไม่มีสิทธิ์ดู → ตัดออกและแจ้งให้เห็น
        }
      }
      setPending(items);
      setMissing(gone);
      setPrefillReady(true);
    })();
  }, []);

  const first = pending[0];

  // ใส่เฉพาะคีย์ที่มีค่าจริง — key ที่เป็น undefined จะไปทับค่าเริ่มต้นของฟอร์ม
  const initial: Partial<JobFormValues> | undefined =
    pending.length || prefillType
      ? {
          ...(prefillType ? { jobType: prefillType as JobFormValues["jobType"] } : {}),
          ...(first?.displayModel ? { model: first.displayModel } : {}),
        }
      : undefined;

  const submit = async (values: JobFormValues) => {
    setBusy(true);
    setFieldError(null);
    try {
      // backend เป็นผู้ตั้ง filterUnit / equipmentCount / เลข TMP / ประวัติ ทั้งหมดใน transaction เดียว
      const job = await api.createJob(
        values,
        pending.map(({ equipmentId, serial, model, note }) => ({ equipmentId, serial, model, note }))
      );
      router.push(`/jobs/${job.jobId}`);
    } catch (e) {
      if (e instanceof ApiError) setFieldError({ field: e.field, message: e.message });
      else setFieldError({ message: "บันทึกไม่สำเร็จ" });
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>เปิดงาน</h1>
          <div className="sub">กรอกข้อมูลแล้วบันทึก — ระบบจะออกรหัสงานให้อัตโนมัติ</div>
        </div>
      </div>

      {missing.length ? (
        <div className="alert alert-error">
          มี {missing.length} เครื่องที่เลือกไว้ไม่พบในระบบแล้ว — ระบบตัดออกให้ กรุณาตรวจรายการอีกครั้ง
        </div>
      ) : null}

      <div className="card card-pad">
        {options && prefillReady ? (
          <JobForm
            // remount เมื่อค่าเริ่มต้นเปลี่ยน เพื่อให้ prefill ถูกเติมจริง (ฟอร์มอ่าน initial ตอน mount)
            key={pending.map((p) => p.key).join(",") || "plain"}
            options={options}
            initial={initial}
            submitLabel="บันทึกเปิดงาน"
            busy={busy}
            fieldError={fieldError}
            onSubmit={submit}
            equipmentLinked={pending.length > 0}
          />
        ) : (
          <div className="state">{fieldError ? fieldError.message : "กำลังโหลด…"}</div>
        )}
      </div>

      {options ? (
        <JobEquipmentSection
          mode="create"
          options={options}
          canEdit={has("jobs:create")}
          pending={pending}
          onPendingChange={setPending}
        />
      ) : null}
    </>
  );
}
