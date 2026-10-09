"use client";

import { FEATURES } from "@/lib/features";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError, downloadFile } from "@/lib/api";
import type { Job, JobEquipmentLine, Options } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { CustomerInfoCard, JobInfoCard } from "@/components/JobDetailCards";
import JobEquipmentSection from "@/components/JobEquipmentSection";
import StatusBadge from "@/components/StatusBadge";
import JobCloseForm, { JobCloseValues } from "@/components/JobCloseForm";
import JobWorkflowPanel from "@/components/JobWorkflowPanel";
import JobPartsCard from "@/components/JobPartsCard";
import JobQueuePanel from "@/components/serviceQueue/JobQueuePanel";
import { bangkokDateTime } from "@/lib/date";
import { useDialog } from "@/components/Dialog";
import { jobCloseSection } from "@/lib/uiRules";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import EditIcon from "@mui/icons-material/Edit";
import { WomsErrorState, WomsFormSection, WomsKeyValue, WomsLoadingState, WomsPageHeader } from "@/components/woms";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { has } = useAuth();

  const dialog = useDialog();
  const [job, setJob] = useState<Job | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  // เครื่องในใบงาน — อ่านจาก API เสมอ ไม่เดาจาก filterUnit
  const [equipment, setEquipment] = useState<JobEquipmentLine[]>([]);
  const [technicianNames, setTechnicianNames] = useState<string[]>([]);
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [j, o] = await Promise.all([api.getJob(id), api.getOptions()]);
      setJob(j);
      setOptions(o);
      // ชื่อช่างผู้รับผิดชอบ — ผู้ไม่มีสิทธิ์ดูรายชื่อช่างเห็นเป็นจำนวนแทน
      const ids = j.technicianIds ?? [];
      if (ids.length) {
        api
          .listTechnicians()
          .then((r) => setTechnicianNames(ids.map((tid) => r.items.find((u) => u.id === tid)?.name ?? "ช่าง (ไม่พบชื่อ)")))
          .catch(() => setTechnicianNames([`${ids.length} คน`]));
      } else setTechnicianNames([]);
      try {
        const eq = await api.jobEquipment(id);
        setEquipment(eq.items);
      } catch {
        // เซิร์ฟเวอร์รุ่นเก่าที่ยังไม่มี endpoint นี้ → แสดงใบงานได้ตามปกติ
        setEquipment([]);
      }
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "โหลดงานไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const close = async (ev: JobCloseValues) => {
    if (!job) return;
    if (
      !(await dialog.confirm({
        title: `ยืนยันปิดงาน ${job.jobId}?`,
        message: "ลูกค้าเซ็นรับงานแล้ว — เมื่อปิดงานจะแก้รายการอุปกรณ์ไม่ได้อีก",
        confirmLabel: "ปิดงาน",
      }))
    )
      return;
    setClosing(true);
    setNotice(null);
    try {
      const updated = await api.closeJob(id, job.updatedAt, ev);
      setJob(updated);
      // โหลดรายการเครื่องใหม่ — ผลรายเครื่อง (เสร็จ) และรูปที่บันทึกไว้
      api.jobEquipment(id).then((r) => setEquipment(r.items)).catch(() => {});
      // งาน PM/PM_CM: backend จะเลื่อนวัน PM ของเครื่องที่ผูกไว้ให้ในทรานแซกชันเดียวกัน
      // pmHistorical = เครื่องที่ปิดงาน PM ย้อนหลังให้ แต่ไม่เลื่อนวัน เพราะมี PM ที่ใหม่กว่าแล้ว
      const pm = updated as unknown as {
        pmUpdated?: { serial: string }[];
        pmHistorical?: { serial: string; lastPmDate: string }[];
      };
      const parts = ["ปิดงานและบันทึกหลักฐานแล้ว"];
      if (pm.pmUpdated?.length) {
        parts.push(
          `อัปเดตวัน PM ให้ ${pm.pmUpdated.length} เครื่อง (${pm.pmUpdated.map((p) => p.serial).join(", ")})`
        );
      }
      if (pm.pmHistorical?.length) {
        parts.push(
          `บันทึกเป็น PM ย้อนหลัง ${pm.pmHistorical.length} เครื่อง ไม่เลื่อนรอบ PM เพราะมี PM ที่ใหม่กว่าแล้ว (${pm.pmHistorical
            .map((p) => `${p.serial} · ${p.lastPmDate}`)
            .join(", ")})`
        );
      }
      setNotice({ kind: "ok", text: parts.join(" · ") });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setNotice({ kind: "warn", text: e.message });
        load();
      } else {
        setNotice({ kind: "warn", text: e instanceof ApiError ? e.message : "ปิดงานไม่สำเร็จ" });
      }
    } finally {
      setClosing(false);
    }
  };

  const back = (
    <Button component={Link} href="/jobs" startIcon={<ArrowBackIcon />}>
      รายการงาน
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

  const section = jobCloseSection(job.status);
  const equipmentReadOnly =
    job.status === "CLOSED"
      ? "ใบงานนี้ปิดแล้ว — รายการอุปกรณ์เป็นประวัติ ดูได้อย่างเดียว"
      : job.status === "HOLD"
        ? "ใบงานนี้พักอยู่ — แก้รายการอุปกรณ์ได้หลังกลับมาดำเนินการ"
        : job.status === "CANCELLED"
          ? "ใบงานนี้ถูกยกเลิกแล้ว — ดูได้อย่างเดียว"
          : undefined;

  return (
    <>
      <WomsPageHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center" component="span" flexWrap="wrap" useFlexGap>
            <Box component="span" className="code" sx={{ fontSize: 20 }}>
              {job.jobId}
            </Box>
            <StatusBadge status={job.status} />
          </Stack>
        }
        subtitle={
          <>
            สร้าง <span className="mono">{bangkokDateTime(job.createdAt)}</span> · แก้ล่าสุด{" "}
            <span className="mono">{bangkokDateTime(job.updatedAt)}</span>
            {job.closedAt ? (
              <>
                {" "}
                · ปิดเมื่อ <span className="mono">{bangkokDateTime(job.closedAt)}</span>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            {FEATURES.chat ? (
              <Button component={Link} href={`/jobs/${id}/chat`} variant="contained" startIcon={<ChatBubbleOutlineIcon />}>
                แชท / ส่งงาน
              </Button>
            ) : null}
            {/* ใบงาน PDF จากเซิร์ฟเวอร์ (ฝังฟอนต์ไทย) — RPT-FN-002/004 */}
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={() =>
                downloadFile(`/api/jobs/${encodeURIComponent(id)}/report.pdf`, `${id}.pdf`).catch((err) =>
                  setNotice({ kind: "warn", text: err?.message ?? "ดาวน์โหลด PDF ไม่สำเร็จ" })
                )
              }
            >
              ใบงาน PDF
            </Button>
            {/* JOB-02 — Admin แก้วันเวลา/รายละเอียดที่ฟอร์มแยก · ช่างไม่มีปุ่มนี้ (backend ตอบ 403 อยู่แล้ว) */}
            {has("jobs:edit") && job.status !== "CANCELLED" ? (
              <Button component={Link} href={`/jobs/${encodeURIComponent(id)}/edit`} variant="contained" startIcon={<EditIcon />}>
                แก้ไขรายละเอียดงาน
              </Button>
            ) : null}
            {back}
          </>
        }
      />

      {notice ? (
        <Alert
          severity={notice.kind === "ok" ? "success" : "warning"}
          sx={{ mb: 2 }}
          onClose={() => setNotice(null)}
          action={
            notice.kind === "warn" ? (
              <Button color="inherit" size="small" onClick={load}>
                รีเฟรช
              </Button>
            ) : undefined
          }
        >
          {notice.text}
        </Alert>
      ) : null}

      {/* JOB-02 — การ์ดรายละเอียดงาน / ลูกค้า / เครื่อง (อ่านอย่างเดียว) · แก้ไขที่หน้า /jobs/[id]/edit */}
      <JobInfoCard job={job} technicianNames={technicianNames} />
      <CustomerInfoCard job={job} />

      <JobEquipmentSection
        mode="edit"
        title="รายละเอียดเครื่อง"
        jobType={job.jobType}
        options={options}
        // แก้รายการเครื่องได้เฉพาะใบงานที่เปิดอยู่ (backend บังคับอีกชั้นอยู่แล้ว)
        canEdit={has("jobs:edit") && job.status === "OPEN"}
        readOnlyReason={equipmentReadOnly}
        jobId={job.jobId}
        lines={equipment}
        legacy={{ filterUnit: job.filterUnit, model: job.model }}
        onChanged={load}
      />

      <JobWorkflowPanel job={job} onChanged={(j) => setJob(j)} />
      <JobQueuePanel jobId={job.jobId} onChanged={() => void load()} />
      <JobPartsCard jobId={job.jobId} closed={job.status !== "OPEN"} />


      {section === "close-form" ? (
        <WomsFormSection title="ปิดงาน + แนบหลักฐาน (ถ่ายรูป + ลูกค้าเซ็น)">
          {/* JOB-03: แต่ละเครื่องแนบรูป SN และรูปงานแยกกัน — ครบทุกเครื่องจึงปิดได้ */}
          <JobCloseForm
            key={equipment.map((e) => e.id).join(",")}
            busy={closing}
            onSubmit={close}
            onError={(m) => setNotice({ kind: "warn", text: m })}
            jobId={job.jobId}
            lines={equipment}
          />
        </WomsFormSection>
      ) : section === "closed" ? (
        <WomsFormSection title="หลักฐานการปิดงาน">
          <WomsKeyValue
            items={[
              ["ผู้เซ็นรับงาน", job.signerName || "—"],
              job.closedAt ? ["ปิดเมื่อ", <span key="c" className="mono">{bangkokDateTime(job.closedAt)}</span>] : null,
              job.closeNote ? ["หมายเหตุ", job.closeNote] : null,
            ]}
          />
          {job.signature ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                ลายเซ็นลูกค้า
              </Typography>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <Box
                component="img"
                src={job.signature}
                alt="ลายเซ็นลูกค้า"
                sx={{ maxWidth: 340, width: "100%", border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "#fff" }}
              />
            </Box>
          ) : null}
          {equipment.some((e) => (e.snPhotos?.length ?? 0) + (e.workPhotos?.length ?? 0) > 0) ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                หลักฐานรายเครื่อง
              </Typography>
              <Stack spacing={1.5}>
                {equipment.map((e) => (
                  <Box key={e.id} sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.25 }}>
                    <Typography variant="body2" sx={{ mb: 0.75 }}>
                      <span className="code">{e.serial}</span>
                      {e.result === "DONE" ? " · เสร็จ" : ""}
                    </Typography>
                    {(["snPhotos", "workPhotos"] as const).map((part) => (
                      <Box key={part} sx={{ mb: 0.75 }}>
                        <Typography variant="body2">
                          {part === "snPhotos" ? "รูป SN" : "รูปงานที่ทำ"} ({e[part]?.length ?? 0})
                        </Typography>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(4, 1fr)", sm: "repeat(8, 1fr)" }, gap: 0.75 }}>
                          {(e[part] ?? []).map((src, i) => (
                            <Box
                              key={i}
                              component="a"
                              href={src}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`เปิด${part === "snPhotos" ? "รูป SN" : "รูปงาน"} ${e.serial} ${i + 1}`}
                              sx={{ display: "block", aspectRatio: "1", borderRadius: 1, overflow: "hidden", border: 1, borderColor: "divider" }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ))}
              </Stack>
            </Box>
          ) : null}
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              รูปหน้างาน ({job.photos?.length ?? 0})
            </Typography>
            {job.photos && job.photos.length ? (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(3, 1fr)", sm: "repeat(5, 1fr)" }, gap: 1 }}>
                {job.photos.map((src, i) => (
                  <Box
                    key={i}
                    component="a"
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`เปิดรูปหน้างาน ${i + 1}`}
                    sx={{ display: "block", aspectRatio: "1", borderRadius: 1, overflow: "hidden", border: 1, borderColor: "divider" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`รูปหน้างาน ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2">— ไม่มีรูปแนบ —</Typography>
            )}
          </Box>
        </WomsFormSection>
      ) : section === "hold" ? (
        // เดิมใบงานที่พักอยู่แสดงหัวข้อ "หลักฐานการปิดงาน" ที่ว่างเปล่า ชวนให้เข้าใจว่าปิดแล้ว
        <Alert severity="info">ใบงานนี้พักอยู่ — ปิดงานได้หลังกลับมาดำเนินการ</Alert>
      ) : null}
    </>
  );
}
