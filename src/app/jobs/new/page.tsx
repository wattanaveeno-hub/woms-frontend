"use client";

import { WomsPermissionGate } from "@/components/woms/WomsPermissionGate";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { JobFormValues, Options } from "@/lib/types";
import JobForm from "@/components/JobForm";
import JobEquipmentSection, { PendingItem } from "@/components/JobEquipmentSection";
import { takeJobPrefill } from "@/lib/jobPrefill";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { WomsErrorState, WomsLoadingState, WomsPageHeader } from "@/components/woms";

let seq = 0;
const nextKey = () => `n${++seq}`;

function NewJobPageInner() {
  const router = useRouter();
  const { has } = useAuth();
  const [options, setOptions] = useState<Options | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);

  // เครื่องที่จะผูกกับใบงาน — ยังไม่ถูกเขียนลงฐานข้อมูลจนกว่าจะกดบันทึก
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [prefillReady, setPrefillReady] = useState(false);
  const consumed = useRef(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const loadOptions = () => {
    setLoadError(null);
    api
      .getOptions()
      .then(setOptions)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "โหลดตัวเลือกไม่สำเร็จ"));
  };
  useEffect(loadOptions, []);
  // ค่าเริ่มต้นของฟอร์มจาก prefill — คำนวณครั้งเดียวตอน prefill พร้อม
  const [initial, setInitial] = useState<Partial<JobFormValues> | undefined>(undefined);

  // รับเครื่องที่เลือกมาจากหน้าคลัง (Phase 4) — เก็บแค่ id แล้วดึงข้อมูลล่าสุดจาก backend เสมอ
  useEffect(() => {
    if (consumed.current) return; // React StrictMode ใน dev เรียก effect ซ้ำ
    consumed.current = true;

    const prefill = takeJobPrefill();
    if (!prefill) {
      setPrefillReady(true);
      return;
    }
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
      // ใส่เฉพาะคีย์ที่มีค่าจริง — key ที่เป็น undefined จะไปทับค่าเริ่มต้นของฟอร์ม
      setInitial({
        ...(prefill.jobType ? { jobType: prefill.jobType as JobFormValues["jobType"] } : {}),
        ...(items[0]?.displayModel ? { model: items[0].displayModel } : {}),
      });
      setPrefillReady(true);
    })();
  }, []);

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
      <WomsPageHeader
        title="เปิดงาน"
        subtitle="กรอกข้อมูลแล้วบันทึก — ระบบจะออกรหัสงานให้อัตโนมัติ"
        actions={
          <Button component={Link} href="/jobs" startIcon={<ArrowBackIcon />}>
            รายการงาน
          </Button>
        }
      />

      {missing.length ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          มี {missing.length} เครื่องที่เลือกไว้ไม่พบในระบบแล้ว — ระบบตัดออกให้ กรุณาตรวจรายการอีกครั้ง
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
        {options && prefillReady ? (
          <JobForm
            // ไม่ remount เมื่อเพิ่ม/เอาเครื่องออก — เดิมใช้ key ตามรายการเครื่อง ทำให้ค่าที่พิมพ์ไว้หายทั้งฟอร์ม
            options={options}
            initial={initial}
            submitLabel="บันทึกเปิดงาน"
            busy={busy}
            fieldError={fieldError}
            onSubmit={submit}
            equipmentLinked={pending.length > 0}
          />
        ) : loadError ? (
          <WomsErrorState message={loadError} onRetry={loadOptions} />
        ) : (
          <WomsLoadingState rows={5} />
        )}
      </Paper>

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

// เปิด URL ตรงโดยไม่มีสิทธิ์ → แสดงข้อความแทนฟอร์มที่บันทึกไม่ได้ (backend บังคับสิทธิ์อีกชั้นเสมอ)
export default function NewJobPage() {
  return (
    <WomsPermissionGate perm="jobs:create" backHref="/jobs">
      <NewJobPageInner />
    </WomsPermissionGate>
  );
}
