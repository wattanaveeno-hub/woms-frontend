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
import JobAllocationPanel from "@/components/JobAllocationPanel";
import JobDeliveryPanel from "@/components/JobDeliveryPanel";
import JobPackageChoicePanel from "@/components/JobPackageChoicePanel";
import JobPhotoStore, { type PhotoCounts } from "@/components/JobPhotoStore";
import StatusBadge from "@/components/StatusBadge";
import JobCloseForm, { JobCloseValues } from "@/components/JobCloseForm";
import SignoffList from "@/components/SignoffList";
import JobWorkflowPanel from "@/components/JobWorkflowPanel";
import JobPartsCard from "@/components/JobPartsCard";
import JobQueuePanel from "@/components/serviceQueue/JobQueuePanel";
import JobLinksPanel from "@/components/JobLinksPanel";
import JobCloseEvidenceCard from "@/components/JobCloseEvidenceCard";
import JobRevisionPanel from "@/components/JobRevisionPanel";
import { isRestrictedJob, jobSignatureBadge } from "@/lib/jobRevisionRules";
import Chip from "@mui/material/Chip";
import JobFinanceCard from "@/components/finance/JobFinanceCard";
import { bangkokDateTime, thaiDayLabel, fmtDate } from "@/lib/date";
import { useDialog } from "@/components/Dialog";
import { jobCloseSection } from "@/lib/uiRules";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import EditIcon from "@mui/icons-material/Edit";
import { WomsCountTabs, WomsErrorState, WomsFormSection, WomsKeyValue, WomsLoadingState, WomsPageHeader } from "@/components/woms";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { has } = useAuth();

  const dialog = useDialog();
  const [job, setJob] = useState<Job | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  // เครื่องในใบงาน — อ่านจาก API เสมอ ไม่เดาจาก filterUnit
  const [equipment, setEquipment] = useState<JobEquipmentLine[]>([]);
  const [photoCounts, setPhotoCounts] = useState<PhotoCounts>({});
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
      // Q-R3-03: ใบงานที่ยกเลิก (ช่าง) — มุมมองประวัติย่อ ไม่เรียกข้อมูลเครื่อง/รายชื่อช่าง
      if (isRestrictedJob(j)) {
        setTechnicianNames([]);
        setEquipment([]);
        return;
      }
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
            .map((p) => `${p.serial} · ${fmtDate(p.lastPmDate)}`)
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

  const [tab, setTab] = useState<"overview" | "equipment" | "close" | "parts">("overview");
  const backLink = { href: "/jobs", label: "งานทั้งหมด" };
  const back = (
    <Button component={Link} href="/jobs" startIcon={<ArrowBackIcon />}>
      รายการงาน
    </Button>
  );

  if (loadError) {
    return (
      <>
        <WomsPageHeader title="ไม่พบงาน" back={backLink} />
        <WomsErrorState message={loadError} onRetry={load} />
      </>
    );
  }

  if (!job || !options) return <WomsLoadingState rows={6} />;

  // Q-R3-03: ช่างเปิดใบงานที่ถูกยกเลิก — แสดงเฉพาะประวัติย่อ (backend ไม่ส่งเครื่อง/SN/ที่อยู่อยู่แล้ว)
  if (isRestrictedJob(job)) {
    return (
      <>
        <WomsPageHeader
          title={
            <Stack direction="row" spacing={1} alignItems="center" component="span">
              <Box component="span" className="code" sx={{ fontSize: 20 }}>
                {job.jobId}
              </Box>
              <StatusBadge status={job.status} holdReason={job.holdReason ?? ""} />
            </Stack>
          }
          back={backLink}
        />
        <Alert severity="info" sx={{ mb: 2 }} data-testid="job-restricted">
          {job.restrictedReason || "ใบงานนี้ถูกยกเลิกแล้ว — ดูได้เฉพาะประวัติย่อ"}
        </Alert>
        <WomsFormSection title="ประวัติใบงาน">
          <WomsKeyValue
            items={[
              ["ชื่องาน", job.jobName || "—"],
              ["วันนัดเดิม", `${fmtDate(job.jobDate || "—")}${job.jobTime ? ` ${job.jobTime}` : ""}`],
              ["ยกเลิกเมื่อ", job.cancelledAt ? <span key="c" className="mono">{bangkokDateTime(job.cancelledAt)}</span> : "—"],
              ["ยกเลิกโดย", job.cancelledBy || "—"],
              ["เหตุผล", job.cancelReason || "—"],
            ]}
          />
        </WomsFormSection>
      </>
    );
  }

  const section = jobCloseSection(job.status);
  const sigBadge = jobSignatureBadge(job);
  const equipmentReadOnly =
    job.status === "CLOSED"
      ? "ใบงานนี้ปิดแล้ว — รายการอุปกรณ์เป็นประวัติ ดูได้อย่างเดียว"
      : job.status === "HOLD"
        ? "ใบงานนี้พักอยู่ — แก้รายการอุปกรณ์ได้หลังกลับมาดำเนินการ"
        : job.status === "CANCELLED"
          ? "ใบงานนี้ถูกยกเลิกแล้ว — ดูได้อย่างเดียว"
          : undefined;

  const steps = jobSteps(job);
  const closeTabLabel = section === "closed" ? "หลักฐานการปิดงาน" : "ปิดงาน & หลักฐาน";
  const custLabel = job.customerName || job.storeName || job.contactName || "";

  return (
    <>
      <WomsPageHeader
        back={{ href: "/jobs", label: "งานทั้งหมด" }}
        title={
          <Stack direction="row" spacing={1.5} alignItems="center" component="span" flexWrap="wrap" useFlexGap>
            <span>{job.jobName || job.jobId}</span>
            <StatusBadge status={job.status} holdReason={job.holdReason ?? ""} />
            {sigBadge ? <Chip size="small" color={sigBadge.tone} label={sigBadge.label} data-testid="job-revision-badge" /> : null}
          </Stack>
        }
        subtitle={
          <>
            <span className="mono">{job.jobId}</span>
            {custLabel ? ` · ${custLabel}` : ""}
            {job.jobDate ? ` · ${thaiDayLabel(job.jobDate)}${job.jobTime ? ` ${job.jobTime}` : ""}` : ""}
            {job.technicianTeam ? ` · ${job.technicianTeam}` : ""}
            {" · แก้ล่าสุด "}
            <span className="mono">{bangkokDateTime(job.updatedAt)}</span>
          </>
        }
        actions={
          <>
            {/* ใบงาน PDF จากเซิร์ฟเวอร์ (ฝังฟอนต์ไทย) — RPT-FN-002/004 · ENTECH design: "พิมพ์ใบงาน" */}
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={() =>
                downloadFile(`/api/jobs/${encodeURIComponent(id)}/report.pdf`, `${id}.pdf`).catch((err) =>
                  setNotice({ kind: "warn", text: err?.message ?? "ดาวน์โหลด PDF ไม่สำเร็จ" })
                )
              }
            >
              พิมพ์ใบงาน (PDF)
            </Button>
            {/* JOB-02 — Admin แก้วันเวลา/รายละเอียดที่ฟอร์มแยก · ช่างไม่มีปุ่มนี้ (backend ตอบ 403 อยู่แล้ว) */}
            {has("jobs:edit") && job.status !== "CANCELLED" ? (
              <Button component={Link} href={`/jobs/${encodeURIComponent(id)}/edit`} variant="outlined" startIcon={<EditIcon />}>
                แก้ไขรายละเอียด
              </Button>
            ) : null}
            {FEATURES.chat ? (
              <Button
                component={Link}
                href={`/jobs/${id}/chat`}
                variant={section === "close-form" && has("jobs:close") ? "outlined" : "contained"}
                startIcon={<ChatBubbleOutlineIcon />}
              >
                แชท / ส่งงาน
              </Button>
            ) : null}
            {/* ENTECH design: ปุ่มหลัก "ตรวจและปิดงาน" — เปิดแท็บปิดงาน (ตรวจหลักฐานตามเดิม) */}
            {section === "close-form" && has("jobs:close") ? (
              <Button variant="contained" onClick={() => setTab("close")} data-testid="job-go-close">
                ตรวจและปิดงาน
              </Button>
            ) : null}
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

      {/* ขั้นของงาน (ENTECH DS .steps) — อ่านจาก stage/เวลาในใบงาน ไม่ได้เปลี่ยนสถานะ */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }} aria-label="ขั้นของงาน">
        <Box sx={{ display: "flex", flexWrap: "wrap", rowGap: 2 }}>
          {steps.map((st) => (
            <Box key={st.label} sx={{ flex: "1 1 112px", display: "flex", flexDirection: "column", gap: 0.5, pr: 1 }}>
              <Box component="span" sx={{ height: 6, borderRadius: 999, bgcolor: st.state === "done" ? "primary.main" : st.state === "cur" ? "info.main" : "divider" }} />
              <Typography component="b" sx={{ fontSize: 14, fontWeight: 700, color: st.state === "cur" ? "info.main" : st.state === "todo" ? "text.secondary" : "text.primary" }}>
                {st.label}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: 12 }}>
                {st.at ? <span className="mono">{bangkokDateTime(st.at)}</span> : st.state === "cur" ? st.hint : "—"}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "flex-start" }}>
        <Box sx={{ flex: "3 1 560px", minWidth: 0 }}>
          <WomsCountTabs
            ariaLabel="ข้อมูลใบงาน"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "overview", label: "ภาพรวม" },
              { value: "equipment", label: "เครื่อง", count: equipment.length },
              ...(section === "close-form" || section === "closed" ? [{ value: "close" as const, label: closeTabLabel }] : []),
              { value: "parts", label: "อะไหล่ & การเงิน" },
            ]}
          />
          {tab === "overview" ? (
            <>
              {/* Phase 3 (ENTECH design): หลักฐานปิดงาน — อ่านจาก close-check ของ backend */}
              <JobCloseEvidenceCard
                job={job}
                lines={equipment}
                onOpenClose={section === "close-form" || section === "closed" ? () => setTab("close") : undefined}
              />
              <JobWorkflowPanel job={job} onChanged={(j) => setJob(j)} />
              <JobQueuePanel jobId={job.jobId} onChanged={() => void load()} />
              {/* JOB-02 — การ์ดรายละเอียดงาน (อ่านอย่างเดียว) · แก้ไขที่หน้า /jobs/[id]/edit */}
              <JobInfoCard job={job} technicianNames={technicianNames} />
              {section === "hold" ? (
                // เดิมใบงานที่พักอยู่แสดงหัวข้อ "หลักฐานการปิดงาน" ที่ว่างเปล่า ชวนให้เข้าใจว่าปิดแล้ว
                <Alert severity="info">ใบงานนี้พักอยู่ — ปิดงานได้หลังกลับมาดำเนินการ</Alert>
              ) : null}
            </>
          ) : null}
          {tab === "equipment" ? (
            <>
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
              {/* CR-EQ01 / Q-R7-01: เครื่องที่ต้องการ + จัดเครื่องจริง (แสดงเมื่อเปิดฟังก์ชันเท่านั้น) */}
              <JobAllocationPanel jobId={job.jobId} jobStatus={job.status} onChanged={load} />
              {/* CR-EQ02: ส่งออก/ส่งมอบ/รับคืน รายเครื่อง */}
              <JobDeliveryPanel jobId={job.jobId} jobStatus={job.status} lines={equipment} onChanged={load} />
              {/* §13.3 / D10-MIG: เลือกสิทธิ์ Package รายเครื่องในรอบ PM */}
              <JobPackageChoicePanel jobId={job.jobId} jobType={job.jobType} jobStatus={job.status} lines={equipment} onChanged={load} />
            </>
          ) : null}
          {tab === "close" ? (
            <>
      {section === "close-form" ? (
        <WomsFormSection title="ปิดงาน + แนบหลักฐาน (ถ่ายรูป + ลูกค้าเซ็น)">
          {/* JOB-03: แต่ละเครื่องแนบรูป SN และรูปงานแยกกัน — ครบทุกเครื่องจึงปิดได้ */}
          {/* CR-PH01: คลังรูปปิดงานไม่จำกัดจำนวน (หลายชุด · ส่งซ้ำรูปที่ล้มเหลว) */}
          <JobPhotoStore jobId={job.jobId} lines={equipment} canAdd={job.status === "OPEN"} onCountsChange={setPhotoCounts} />
          {/* UAT DEF-01: ฟอร์มปิดงานแสดงเฉพาะผู้มีสิทธิ์ปิดงาน (jobs:close) — Manager ตาม Matrix ดูอย่างเดียว (backend ปฏิเสธอยู่แล้ว) */}
          {!has("jobs:close") ? (
            <Alert severity="info" data-testid="job-close-not-allowed">ปิดงานได้เฉพาะช่างที่ได้รับมอบหมายหรือผู้มีสิทธิ์ปิดงาน</Alert>
          ) : (
          <JobCloseForm
            storeCounts={photoCounts}
            key={equipment.map((e) => e.id).join(",")}
            busy={closing}
            onSubmit={close}
            onError={(m) => setNotice({ kind: "warn", text: m })}
            jobId={job.jobId}
            lines={equipment}
            jobType={job.jobType}
            technicians={(job.technicianIds ?? []).map((tid, i) => ({ id: tid, name: technicianNames[i] ?? "ช่าง" }))}
          />
          )}
        </WomsFormSection>
      ) : section === "closed" ? (
        <WomsFormSection title="หลักฐานการปิดงาน">
          {/* CR-PH01: รูปในคลังรูปปิดงาน (ดูอย่างเดียวหลังปิด) */}
          <JobPhotoStore jobId={job.jobId} lines={equipment} canAdd={false} />
          <WomsKeyValue
            items={[
              ["ผู้เซ็นรับงาน", job.signerName || "—"],
              (job as any).closedByName ? ["ผู้ปิดงาน (ลงนาม)", (job as any).closedByName] : null,
              job.closedAt ? ["ปิดเมื่อ", <span key="c" className="mono">{bangkokDateTime(job.closedAt)}</span>] : null,
              job.closeNote ? ["หมายเหตุ", job.closeNote] : null,
            ]}
          />
          {job.signature ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                ลายเซ็นลูกค้า{job.currentRevisionNo ? " (ฉบับปิดงาน r0 — ไม่ครอบคลุมฉบับแก้ไข ดูการลงนามใหม่ด้านล่าง)" : ""}
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
          {/* FB-14 ลายเซ็นผู้ปิดงาน (Admin ตรวจย้อนหลังได้ว่าใครลงนาม เมื่อใด ครอบคลุมข้อมูลชุดใด) */}
          {job.status === "CLOSED" ? (
            <Box sx={{ mt: 2 }}>
              <SignoffList refType="jobs" refId={job.jobId} />
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
      ) : null}

      {/* Q-R3-13: แก้ไขหลังปิดงาน — ประวัติฉบับแก้ไข / Manager พิจารณา / ลงนามใหม่ */}
      {job.status === "CLOSED" ? <JobRevisionPanel job={job} lines={equipment} technicianNames={technicianNames} onChanged={load} /> : null}

            </>
          ) : null}
          {tab === "parts" ? (
            <>
              <JobPartsCard jobId={job.jobId} status={job.status} />
              {/* D-11 FIN-11: สถานะการเงินของใบเสนอราคาที่ผูก — แสดงเฉพาะผู้มี finance:view */}
              <JobFinanceCard jobId={job.jobId} />
            </>
          ) : null}
        </Box>
        {/* ENTECH design: คอลัมน์ขวา = ลูกค้า & หน้างาน · เครื่องในงาน · ความเชื่อมโยง (สัญญา/ใบเสนอราคา/บิลช่าง) */}
        <Box component="aside" sx={{ flex: "1 1 300px", minWidth: 0 }}>
          <CustomerInfoCard job={job} />
          <WomsFormSection
            title={`เครื่องในงาน${equipment.length ? ` (${equipment.length})` : ""}`}
            actions={
              <Button size="small" onClick={() => setTab("equipment")} data-testid="job-aside-equipment-open">
                ดูทั้งหมด
              </Button>
            }
          >
            {equipment.length ? (
              <Stack spacing={1} data-testid="job-aside-equipment">
                {equipment.slice(0, 5).map((e) => (
                  <Box key={e.id} sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                    <Box
                      component="span"
                      sx={{ flex: "0 0 auto", width: 36, height: 36, borderRadius: 1, bgcolor: "#e1f1e4", color: "primary.main", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {(e.model || "—").slice(0, 2).toUpperCase()}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
                        {e.model || "ไม่ระบุรุ่น"} · <span className="mono">{e.hasRealSerial ? e.serial : "Pending Serial"}</span>
                      </Typography>
                      {e.contractNo ? (
                        <Typography variant="caption" color="text.secondary">
                          สัญญา <span className="mono">{e.contractNo}</span>
                        </Typography>
                      ) : null}
                    </Box>
                  </Box>
                ))}
                {equipment.length > 5 ? <Typography variant="caption">และอีก {equipment.length - 5} เครื่อง</Typography> : null}
              </Stack>
            ) : (
              <Typography variant="body2">ยังไม่มีเครื่องในใบงาน</Typography>
            )}
          </WomsFormSection>
          <JobLinksPanel jobId={job.jobId} jobStatus={job.status} />
        </Box>
      </Box>
    </>
  );
}


/** ขั้นของงานสำหรับแถบด้านบน — done / cur / todo จาก stage และเวลาที่บันทึกในใบงาน */
function jobSteps(job: Job): { label: string; at?: string; state: "done" | "cur" | "todo"; hint?: string }[] {
  const stage = job.stage || "OPEN";
  const closed = job.status === "CLOSED";
  const order = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "SUBMITTED", "CONFIRMED"];
  // stage ลำดับที่ k = ขั้น 0..k เสร็จแล้ว ขั้น k+1 คือขั้นปัจจุบัน
  const idx = closed ? 5 : Math.max(0, order.indexOf(stage)) + 1;
  const raw: { label: string; at?: string; hint: string }[] = [
    { label: "เปิดงาน", at: job.createdAt, hint: "" },
    { label: "ช่างรับทราบ", at: job.acknowledgedAt, hint: "รอช่างรับทราบ" },
    { label: "เริ่มงาน", at: job.startedAt, hint: "รอช่างเริ่มงาน" },
    { label: "ส่งงาน", hint: "รอช่างส่งงาน" },
    { label: "ปิดงาน", at: job.closedAt, hint: "รอตรวจและปิดงาน" },
  ];
  return raw.map((r, i) => ({
    label: r.label,
    at: i < idx ? r.at : undefined,
    hint: r.hint,
    state: i < idx ? "done" : i === idx && job.status !== "CANCELLED" ? "cur" : "todo",
  }));
}
