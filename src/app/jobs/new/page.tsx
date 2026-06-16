"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { JobFormValues, Options } from "@/lib/types";
import JobForm from "@/components/JobForm";

export default function NewJobPage() {
  const router = useRouter();
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

  const submit = async (values: JobFormValues) => {
    setBusy(true);
    setFieldError(null);
    try {
      const job = await api.createJob(values);
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

      <div className="card card-pad">
        {options ? (
          <JobForm
            options={options}
            submitLabel="บันทึกเปิดงาน"
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
