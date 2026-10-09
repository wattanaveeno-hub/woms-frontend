"use client";

// ---------------------------------------------------------------------------
// JOB-02 แก้ไขรายละเอียดใบงาน (Admin) — ฟอร์มเดียวกับหน้าเปิดงาน แยกจากหน้าการ์ด /jobs/[id]
// เปลี่ยนวันเวลา/รายละเอียดแล้ว backend บันทึก Audit Log และแจ้งช่าง · ใบงานยังเลขเดิม
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Job, JobEquipmentLine, JobFormValues, Options } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import JobForm from "@/components/JobForm";
import StatusBadge from "@/components/StatusBadge";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { WomsErrorState, WomsLoadingState, WomsPageHeader } from "@/components/woms";

export default function JobEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { has } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [equipment, setEquipment] = useState<JobEquipmentLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [equipmentError, setEquipmentError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setConflict(null);
    try {
      const [j, o] = await Promise.all([api.getJob(id), api.getOptions()]);
      setJob(j);
      setOptions(o);
      setEquipmentError(null);
      // D-17: โหลดรายการเครื่องไม่สำเร็จ — แจ้งผู้ใช้ และไม่ปลดล็อกช่อง Serial เดิม (ใช้จำนวนเครื่องในใบงานแทน)
      api
        .jobEquipment(id)
        .then((r) => setEquipment(r.items))
        .catch((e) => {
          setEquipment([]);
          setEquipmentError(e instanceof ApiError ? e.message : "โหลดรายการเครื่องไม่สำเร็จ");
        });
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "โหลดงานไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const back = (
    <Button component={Link} href={`/jobs/${encodeURIComponent(id)}`} startIcon={<ArrowBackIcon />}>
      กลับหน้าใบงาน
    </Button>
  );

  if (loadError) {
    return (
      <>
        <WomsPageHeader title="ไม่พบงาน" actions={back} />
        <WomsErrorState message={loadError} onRetry={load} />
      </>
    );
  }
  if (!job || !options) return <WomsLoadingState rows={6} />;

  const blocked = !has("jobs:edit")
    ? "ดูรายละเอียดใบงานได้อย่างเดียว — การแก้ไขใบงานทำได้โดยแอดมิน"
    : job.status === "CANCELLED"
      ? `ใบงาน ${job.jobId} ถูกยกเลิกแล้ว — แก้ไขไม่ได้`
      : null;

  const save = async (values: JobFormValues) => {
    setBusy(true);
    setFieldError(null);
    setConflict(null);
    try {
      // D-05: JobForm ส่งเฉพาะฟิลด์ของฟอร์ม (pickJobFormValues) — backend ปฏิเสธฟิลด์ระบบ (.strict())
      await api.patchJob(id, values, job.updatedAt);
      toast.success("บันทึกการแก้ไขใบงานแล้ว");
      router.push(`/jobs/${encodeURIComponent(id)}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setConflict(e.message);
      else if (e instanceof ApiError) setFieldError({ field: e.field, message: e.message });
      else setFieldError({ message: "บันทึกไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <WomsPageHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center" component="span" flexWrap="wrap" useFlexGap>
            <span>แก้ไขใบงาน</span>
            <Box component="span" className="code" sx={{ fontSize: 20 }}>
              {job.jobId}
            </Box>
            <StatusBadge status={job.status} />
          </Stack>
        }
        subtitle="แก้วันเวลานัดและรายละเอียดงาน/ลูกค้า — ระบบบันทึกประวัติการแก้ไขและแจ้งช่างอีกครั้ง · เลขใบงานไม่เปลี่ยน"
        actions={back}
      />
      {conflict ? (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={load}>
              โหลดข้อมูลล่าสุด
            </Button>
          }
        >
          {conflict}
        </Alert>
      ) : null}
      {equipmentError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          โหลดรายการเครื่องของใบงานไม่สำเร็จ ({equipmentError}) — แก้รายละเอียดงานได้ตามปกติ
        </Alert>
      ) : null}
      {blocked ? (
        <Alert severity="info">{blocked}</Alert>
      ) : (
        <JobForm
            key={job.updatedAt}
            options={options}
            initial={job}
            submitLabel="บันทึกการแก้ไข"
            busy={busy}
            fieldError={fieldError}
            onSubmit={save}
            equipmentLinked={equipment.length > 0 || (!!equipmentError && (job.equipmentCount ?? 0) > 0)}
            extraActions={
              <Button component={Link} href={`/jobs/${encodeURIComponent(id)}`} disabled={busy}>
                ยกเลิก
              </Button>
            }
          />
      )}
    </>
  );
}
