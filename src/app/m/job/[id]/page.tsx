"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Job, JobEquipmentLine } from "@/lib/types";
import { jobTypeLabel } from "@/lib/options";
import JobCloseForm, { JobCloseValues } from "@/components/JobCloseForm";
import { useToast } from "@/components/Toast";
import { RESCHEDULE_REASON_LABEL } from "@/lib/types";
import type { RescheduleReason } from "@/lib/types";
import { bangkokDateTime } from "@/lib/date";
import { techJobFooter } from "@/lib/uiRules";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Collapse from "@mui/material/Collapse";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CallIcon from "@mui/icons-material/Call";
import DirectionsIcon from "@mui/icons-material/Directions";
import { JobStatusChip, NeedsSerialChip, WomsErrorState, WomsLoadingState } from "@/components/woms";

// ปิดงานจากมือถือ พร้อมลายเซ็นลูกค้าและรูปหน้างาน
export default function MobileJobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [job, setJob] = useState<Job | null>(null);
  // เครื่องในใบงาน — อ่านจาก API เสมอ ไม่เดาจากข้อความ filterUnit
  const [equipment, setEquipment] = useState<JobEquipmentLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ---- แจ้ง Admin / รับทราบงาน (เพิ่มรอบ Requirement.xlsx) ----
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<RescheduleReason>("LATE");
  const [reportNote, setReportNote] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [j, eq] = await Promise.all([
        api.getJob(id),
        api.jobEquipment(id).catch(() => ({ items: [] as JobEquipmentLine[], count: 0 })),
      ]);
      setJob(j);
      setEquipment(eq.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const close = async (v: JobCloseValues) => {
    if (!job) return;
    setBusy(true);
    try {
      await api.closeJob(job.jobId, job.updatedAt, v);
      toast.success(`ปิดงาน ${job.jobId} แล้ว`);
      router.push("/m");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ปิดงานไม่สำเร็จ");
      load();
    } finally {
      setBusy(false);
    }
  };

  if (error && !job) return <WomsErrorState message={error} onRetry={load} />;
  if (!job) return <WomsLoadingState rows={4} />;

  const setStage = async (stage: "ACKNOWLEDGED" | "IN_PROGRESS") => {
    if (!job) return;
    setBusy(true);
    try {
      setJob(await api.setJobStage(job.jobId, stage));
      toast.success(stage === "ACKNOWLEDGED" ? "รับทราบงานแล้ว" : "เริ่มดำเนินการแล้ว");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "อัปเดตไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const sendReport = async () => {
    if (!job) return;
    if (reason === "POSTPONE" && !newDate) {
      toast.error("ขอเลื่อนวันต้องระบุวันนัดใหม่");
      return;
    }
    setBusy(true);
    try {
      const r = await api.requestReschedule(job.jobId, {
        reason,
        note: reportNote,
        requestedDate: newDate,
        requestedTime: newTime,
      });
      setJob(r.job);
      setReportOpen(false);
      setReportNote("");
      toast.success("ส่งเรื่องให้แอดมินแล้ว");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ส่งเรื่องไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const pendingReq = (job.rescheduleRequests ?? []).filter((r) => r.status === "PENDING");

  const touch = { minHeight: 48 };
  const footer = techJobFooter(job.status);
  const kv = (k: string, v: React.ReactNode) => (
    <>
      <Typography variant="body2" component="dt" sx={{ fontWeight: 600 }}>
        {k}
      </Typography>
      <Box component="dd" sx={{ m: 0, minWidth: 0, color: "text.primary" }}>
        {v}
      </Box>
    </>
  );

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", py: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography className="code">{job.jobId}</Typography>
          <Typography variant="h1" sx={{ fontSize: 22 }}>
            {job.jobName}
          </Typography>
          <Typography variant="body2">
            {jobTypeLabel[job.jobType]} · {job.jobDate} {job.jobTime}
          </Typography>
        </Box>
        <Button component={Link} href="/m" startIcon={<ArrowBackIcon />} sx={{ flexShrink: 0 }}>
          กลับ
        </Button>
      </Stack>

      {/* การ์ดลูกค้า/สถานที่ — ปุ่มโทร/นำทางขนาดนิ้วแตะ */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ fontWeight: 600, color: "text.primary" }}>ข้อมูลหน้างาน</Typography>
            <JobStatusChip status={job.status} />
          </Stack>
          <Box
            component="dl"
            sx={{ display: "grid", gridTemplateColumns: "96px 1fr", columnGap: 1.5, rowGap: 1, m: 0 }}
          >
            {kv("ทีมช่าง", job.technicianTeam || "—")}
            {kv("ผู้ติดต่อ", job.contactName || "—")}
            {kv("โทร", job.phone || "—")}
            {kv(
              `เครื่อง${equipment.length > 1 ? ` (${equipment.length})` : ""}`,
              equipment.length > 0 ? (
                equipment.map((e) => (
                  <Box key={e.id} sx={{ mb: 0.5 }}>
                    <span className="code">{e.serial || "—"}</span>
                    {e.machineType ? <Typography component="span" variant="body2"> · {e.machineType}</Typography> : null}
                    {e.filterUnit ? <Typography component="span" variant="body2"> · เครื่องกรอง {e.filterUnit}</Typography> : null}
                    {!e.hasRealSerial ? (
                      <Box component="span" sx={{ ml: 0.75 }}>
                        <NeedsSerialChip />
                      </Box>
                    ) : null}
                    {e.model ? <Typography component="span" variant="body2"> · {e.model}</Typography> : null}
                    {e.note ? <Typography variant="body2">{e.note}</Typography> : null}
                  </Box>
                ))
              ) : job.filterUnit ? (
                <>
                  <span className="code">{job.filterUnit}</span>
                  <Typography variant="body2">ข้อมูลเดิม ยังไม่ผูกกับคลัง</Typography>
                </>
              ) : (
                "—"
              )
            )}
            {job.status === "HOLD" && job.holdReason ? kv("เหตุผลพักงาน", job.holdReason) : null}
            {job.note ? kv("หมายเหตุ", job.note) : null}
          </Box>
          {job.phone || job.mapLink ? (
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              {job.phone ? (
                <Button variant="outlined" fullWidth startIcon={<CallIcon />} href={`tel:${job.phone}`} sx={touch}>
                  โทร
                </Button>
              ) : null}
              {job.mapLink ? (
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<DirectionsIcon />}
                  href={job.mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={touch}
                >
                  นำทาง
                </Button>
              ) : null}
            </Stack>
          ) : null}
        </CardContent>
      </Card>

      {job.status === "OPEN" && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {!job.acknowledgedAt && (
                <Button variant="outlined" disabled={busy} onClick={() => setStage("ACKNOWLEDGED")} sx={touch}>
                  รับทราบงาน
                </Button>
              )}
              {!job.startedAt && (
                <Button variant="outlined" disabled={busy} onClick={() => setStage("IN_PROGRESS")} sx={touch}>
                  เริ่มดำเนินการ
                </Button>
              )}
              <Button
                variant={reportOpen ? "contained" : "outlined"}
                color="secondary"
                disabled={busy}
                onClick={() => setReportOpen((v) => !v)}
                aria-expanded={reportOpen}
                sx={touch}
              >
                แจ้งแอดมิน
              </Button>
            </Stack>

            {job.acknowledgedAt ? (
              <Typography variant="body2" sx={{ mt: 1 }}>
                รับทราบแล้วเมื่อ {bangkokDateTime(job.acknowledgedAt)}
              </Typography>
            ) : null}

            {pendingReq.length > 0 && (
              <Alert severity="warning" sx={{ mt: 1.5 }}>
                ส่งเรื่องให้แอดมินแล้ว — {RESCHEDULE_REASON_LABEL[pendingReq[0].reason]} · รอผลพิจารณา
              </Alert>
            )}

            <Collapse in={reportOpen} unmountOnExit>
              <Stack spacing={2} sx={{ mt: 2 }}>
                <TextField
                  select
                  label="เรื่องที่แจ้ง"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as RescheduleReason)}
                >
                  <MenuItem value="LATE">{RESCHEDULE_REASON_LABEL.LATE}</MenuItem>
                  <MenuItem value="IN_PROGRESS">{RESCHEDULE_REASON_LABEL.IN_PROGRESS}</MenuItem>
                  <MenuItem value="POSTPONE">{RESCHEDULE_REASON_LABEL.POSTPONE}</MenuItem>
                </TextField>
                {reason === "POSTPONE" && (
                  <Stack direction="row" spacing={1}>
                    <TextField
                      label="วันนัดใหม่"
                      type="date"
                      required
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      label="เวลานัดใหม่"
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Stack>
                )}
                <TextField label="รายละเอียด" value={reportNote} onChange={(e) => setReportNote(e.target.value)} />
                <Button variant="contained" disabled={busy} onClick={sendReport} size="large">
                  ส่งเรื่อง
                </Button>
              </Stack>
            </Collapse>
          </CardContent>
        </Card>
      )}

      {footer === "close-form" ? (
        <Card>
          <CardContent>
            <Typography variant="h2" sx={{ fontSize: 17, mb: 2 }}>
              ปิดงาน
            </Typography>
            {/* JOB-03 / TECH-02: รูป SN + รูปงานแยกรายเครื่อง · ถ่ายหรือเลือกรูปจากเครื่องได้ */}
            <JobCloseForm
              key={equipment.map((e) => e.id).join(",")}
              busy={busy}
              onSubmit={close}
              onError={(m) => toast.error(m)}
              jobId={job.jobId}
              lines={equipment}
            />
          </CardContent>
        </Card>
      ) : footer === "closed" ? (
        <Alert severity="success">งานนี้ปิดแล้วเมื่อ {bangkokDateTime(job.closedAt)}</Alert>
      ) : footer === "hold" ? (
        <Alert severity="info">งานนี้พักไว้ — ปิดงานได้หลังแอดมินกลับมาดำเนินการต่อ</Alert>
      ) : (
        <Alert severity="warning">งานนี้ถูกยกเลิกแล้ว</Alert>
      )}
    </Box>
  );
}
