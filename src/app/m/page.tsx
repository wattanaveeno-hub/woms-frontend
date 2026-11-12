"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CallIcon from "@mui/icons-material/Call";
import DirectionsIcon from "@mui/icons-material/Directions";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useTechLocation } from "@/lib/useTechLocation";
import type { Booking, BookingStatus, JobListItem } from "@/lib/types";
import { bookingStatusLabel, bookingTypeLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";
import { FEATURES } from "@/lib/features";
import { sqApi, type ServiceQueue } from "@/lib/serviceQueueApi";
import { addDaysISO, bangkokClock, bangkokDateTime, bangkokToday } from "@/lib/date";
import { JobStatusChip, WomsEmptyState, WomsErrorState, WomsLoadingState, WomsStatusChip } from "@/components/woms";

// "วันนี้" ตามเวลาไทย — ตัวช่วยกลางที่ lib/date.ts
const today = bangkokToday;
const addDays = addDaysISO;

const touch = { minHeight: 48 };

// หน้าหลักของช่างบนมือถือ (ติดตั้งเป็นแอปจากเบราว์เซอร์ได้ — PWA)
export default function MobileHome() {
  const { user, status, has } = useAuth();
  const toast = useToast();
  const loc = useTechLocation();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [jobs, setJobs] = useState<JobListItem[]>([]); // รายการไม่มีรูป/ลายเซ็น (Phase 9.1)
  const [allJobs, setAllJobs] = useState<JobListItem[]>([]);
  const [range, setRange] = useState<"today" | "week">("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // คิวช่างที่รอช่างตอบ (Chat & Queue v1 · TECH) — แสดงบนหน้าแรกให้เห็นทันที
  const [queueWaiting, setQueueWaiting] = useState<ServiceQueue[]>([]);
  useEffect(() => {
    if (status !== "authed" || !FEATURES.serviceQueue || !has("svcqueue:respond")) return;
    sqApi
      .list({ status: "WAIT_TECH" })
      .then((r) => setQueueWaiting(r.items.filter((q) => q.techId === user?.id)))
      .catch(() => setQueueWaiting([]));
  }, [status, has, user?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = today();
      const to = range === "today" ? today() : addDays(from, 7);
      const [bk, jb] = await Promise.all([
        // คิวช่างซ่อนไว้ก่อน (HIDE-01) — ไม่เรียก API คิวเมื่อปิดฟังก์ชัน
        FEATURES.techQueue ? api.myBookings({ from, to }) : Promise.resolve({ items: [] as Booking[] }),
        // Redesign: ดึงทุกสถานะเพื่อนับ "เสร็จแล้ววันนี้" (ขอบเขตของช่าง = งานที่ได้รับมอบหมายเท่านั้น — บังคับที่ backend)
        api.listJobs({}),
      ]);
      setBookings(bk.items);
      setAllJobs(jb.jobs);
      setJobs(jb.jobs.filter((j) => j.status === "OPEN"));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (status === "authed") load();
  }, [load, status]);

  const setStatusOf = async (b: Booking, next: BookingStatus) => {
    setBusyId(b.id);
    try {
      await api.setBookingStatus(b.id, next, { lat: loc.lat, lng: loc.lng });
      if (loc.sharing) loc.sendNow();
      toast.success(bookingStatusLabel[next]);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "อัปเดตไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const acknowledge = async (jobId: string) => {
    setBusyId(jobId);
    try {
      const updated = await api.setJobStage(jobId, "ACKNOWLEDGED");
      setJobs((list) => list.map((x) => (x.jobId === jobId ? { ...x, stage: updated.stage, acknowledgedAt: updated.acknowledgedAt } : x)));
      toast.success("รับทราบงานแล้ว");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "รับทราบงานไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  if (status !== "authed") return <WomsEmptyState title="กรุณาเข้าสู่ระบบ" />;

  const nextStep: Partial<Record<BookingStatus, { to: BookingStatus; label: string }>> = {
    BOOKED: { to: "ON_THE_WAY", label: "ออกเดินทาง" },
    ON_THE_WAY: { to: "ARRIVED", label: "ถึงหน้างานแล้ว" },
    ARRIVED: { to: "DONE", label: "ปิดคิว" },
  };

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", py: 2 }}>
      {(() => {
        const t = today();
        const todays = allJobs.filter((j) => j.jobDate === t && j.status !== "CANCELLED");
        const done = todays.filter((j) => j.status === "CLOSED" || j.stage === "SUBMITTED" || j.stage === "CONFIRMED").length;
        return (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2">{t}</Typography>
            <Typography variant="h1" sx={{ fontSize: 22, lineHeight: 1.3 }}>
              {has("jobs:view_all") ? "งานที่ต้องติดตาม" : `สวัสดีช่าง${user?.name ?? ""}`}
              <br />
              {loading ? "กำลังโหลด…" : `วันนี้มี ${todays.length} งาน เสร็จแล้ว ${done}`}
            </Typography>
            <Box sx={{ mt: 1, height: 8, borderRadius: 99, bgcolor: "#e2e7ec" }} aria-hidden="true">
              <Box sx={{ width: `${todays.length ? (done / todays.length) * 100 : 0}%`, height: 8, borderRadius: 99, bgcolor: "primary.main" }} />
            </Box>
            {FEATURES.techQueue ? (
              <Button variant="outlined" onClick={() => setRange(range === "today" ? "week" : "today")} sx={{ mt: 1 }}>
                {range === "today" ? "ดูคิว 7 วัน" : "ดูคิววันนี้"}
              </Button>
            ) : null}
          </Box>
        );
      })()}

      {/* DN-07 / TECH-02.3: ช่างไม่เปิดใบงานเอง (Handoff p2 CORE-01 · p12 · mockup ช่าง "ไม่ใช่สิทธิ์ของช่าง") — แสดงเฉพาะผู้มี jobs:create */}
      {has("jobs:create") ? (
        <Button
          component={Link}
          href="/m/job/new"
          variant="contained"
          size="large"
          fullWidth
          startIcon={<AddIcon />}
          sx={{ mb: 2 }}
        >
          เปิดงานใหม่
        </Button>
      ) : null}
      {FEATURES.techQueue ? (
        <Button component={Link} href="/queue/slots" variant="outlined" fullWidth sx={{ mb: 2, ...touch }}>
          ตาราง slot ของฉัน
        </Button>
      ) : null}

      {queueWaiting.length ? (
        <Card sx={{ mb: 2, borderLeft: 4, borderColor: "warning.main" }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Typography sx={{ fontWeight: 600, color: "text.primary", mb: 1 }}>
              คิวรอคุณตอบ ({queueWaiting.length})
            </Typography>
            <Stack spacing={1}>
              {queueWaiting.slice(0, 5).map((q) => (
                <Button
                  key={q.id}
                  component={Link}
                  href={`/service-queue/${q.id}`}
                  variant="outlined"
                  sx={{ ...touch, justifyContent: "space-between", textAlign: "left" }}
                  fullWidth
                >
                  <span>
                    <span className="code">{q.queueNo}</span> · {q.jobName || q.contactName}
                  </span>
                  <span>{q.preferredDate ? `${q.preferredDate}${q.preferredTime ? ` ${q.preferredTime}` : ""}` : "เสนอวัน"}</span>
                </Button>
              ))}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        {has("calendar:view") ? (
          <Button component={Link} href="/calendar" variant="outlined" fullWidth sx={touch}>
            ปฏิทินงาน
          </Button>
        ) : null}
        {/* ADV-14 (D-20): ไม่มีทางเข้าหน้าแจ้งเตือนแยก — ใช้กระดิ่งบนแถบบน (เปิดมุม "ยังไม่อ่าน") */}
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          {/* B-09 — การแชร์ตำแหน่งเป็นสวิตช์ตั้งค่า ไม่ใช่ปุ่มหลักของหน้า */}
          <FormControlLabel
            sx={{ m: 0, width: "100%", justifyContent: "space-between" }}
            labelPlacement="start"
            label={<Typography sx={{ fontWeight: 600, color: "text.primary" }}>แชร์ตำแหน่งให้ออฟฟิศ</Typography>}
            control={<Switch checked={loc.sharing} onChange={loc.sharing ? loc.stop : loc.start} />}
          />
          <Typography variant="body2">
            {loc.sharing
              ? loc.lat
                ? `กำลังส่ง · ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}${loc.lastSentAt ? ` · ล่าสุด ${bangkokClock(loc.lastSentAt)}` : ""}`
                : "กำลังขอตำแหน่ง…"
              : "ปิดอยู่ — เปิดเพื่อให้ออฟฟิศเห็น ETA"}
          </Typography>
          {loc.error ? (
            <Typography variant="body2" color="error" role="alert">
              {loc.error}
            </Typography>
          ) : null}
        </CardContent>
      </Card>

      {error ? <WomsErrorState message={error} onRetry={load} /> : null}

      {FEATURES.techQueue ? (
        <>
          <Typography variant="h2" sx={{ fontSize: 17, mt: 3, mb: 1 }}>
            คิวงาน
          </Typography>
          {loading ? (
            <WomsLoadingState rows={2} />
          ) : bookings.length === 0 ? (
            <WomsEmptyState title="ไม่มีคิวในช่วงนี้" />
          ) : (
            <Stack spacing={1.5}>
              {bookings.map((b) => {
                const step = nextStep[b.status];
                return (
                  <Card key={b.id}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography className="code">{b.bookingNo}</Typography>
                        <WomsStatusChip label={bookingStatusLabel[b.status]} tone="warning" />
                      </Stack>
                      <Typography sx={{ fontWeight: 600, color: "text.primary", mt: 0.5 }}>
                        {bookingTypeLabel[b.type]} · {b.customerName}
                      </Typography>
                      <Typography variant="body2">
                        {b.date} {b.start}–{b.end}
                      </Typography>
                      <Typography variant="body2">{b.address}</Typography>
                    </CardContent>
                    <CardActions sx={{ flexWrap: "wrap", gap: 1, px: 2, pb: 2 }}>
                      {b.lat || b.lng ? (
                        <Button
                          variant="outlined"
                          startIcon={<DirectionsIcon />}
                          href={`https://maps.google.com/?q=${b.lat},${b.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={touch}
                        >
                          นำทาง
                        </Button>
                      ) : null}
                      {b.phone ? (
                        <Button variant="outlined" startIcon={<CallIcon />} href={`tel:${b.phone}`} sx={touch}>
                          โทรหาลูกค้า
                        </Button>
                      ) : null}
                      <Button component={Link} href={`/m/booking/${b.id}`} sx={touch}>
                        รายละเอียด
                      </Button>
                      {step ? (
                        <Button
                          variant="contained"
                          onClick={() => setStatusOf(b, step.to)}
                          disabled={busyId === b.id}
                          sx={touch}
                        >
                          {step.label}
                        </Button>
                      ) : null}
                    </CardActions>
                  </Card>
                );
              })}
            </Stack>
          )}
        </>
      ) : null}

      {loading && jobs.length === 0 ? (
        <WomsLoadingState rows={3} />
      ) : jobs.length === 0 && !error ? (
        <WomsEmptyState title="ไม่มีใบงานค้าง" />
      ) : (
        <MobileJobList jobs={jobs} busyId={busyId} canAck={has("jobs:close")} onAck={acknowledge} />
      )}
    </Box>
  );
}

/**
 * Redesign มือถือช่าง: งานถัดไปเป็นการ์ดใหญ่ (โทร / นำทาง / เปิดใบงาน) · ที่เหลือเป็นแถวเรียงตามเวลา แยกวันนี้ / พรุ่งนี้ / วันอื่น
 * ปุ่มกดสูง ≥ 48px · งานที่ยังไม่รับทราบมีปุ่ม "รับทราบงาน" ในแถว
 */
function MobileJobList({
  jobs,
  busyId,
  canAck,
  onAck,
}: {
  jobs: JobListItem[];
  busyId: string | null;
  canAck: boolean;
  onAck: (jobId: string) => void;
}) {
  const t = today();
  const tm = addDays(t, 1);
  const sorted = [...jobs].sort((a, b) => `${a.jobDate || "9999"} ${a.jobTime || ""}`.localeCompare(`${b.jobDate || "9999"} ${b.jobTime || ""}`));
  const notDone = (j: JobListItem) => j.stage !== "SUBMITTED" && j.stage !== "CONFIRMED";
  const late = sorted.filter((j) => j.jobDate && j.jobDate < t && notDone(j));
  const todays = sorted.filter((j) => j.jobDate === t);
  const next = todays.find((j) => j.stage === "IN_PROGRESS") ?? todays.find(notDone) ?? late[0];
  const tomorrow = sorted.filter((j) => j.jobDate === tm);
  const later = sorted.filter((j) => !j.jobDate || j.jobDate > tm);
  const pending = (j: JobListItem) => !j.stage || j.stage === "OPEN";

  const row = (j: JobListItem) => {
    const isNext = next?.jobId === j.jobId;
    const isLate = !!j.jobDate && j.jobDate < t;
    const done = !notDone(j);
    return (
      <Box
        key={j.jobId}
        sx={{
          display: "flex",
          gap: 1.5,
          alignItems: "center",
          p: 1.75,
          bgcolor: isLate ? "#fffaf9" : pending(j) ? "#fffbf4" : "#fff",
          border: isNext ? 2 : 1,
          borderColor: isNext ? "primary.main" : isLate ? "#e6c4c1" : pending(j) ? "#ecd6a8" : "divider",
          borderRadius: 2,
          opacity: done ? 0.75 : 1,
        }}
      >
        <Box component={Link} href={`/m/job/${encodeURIComponent(j.jobId)}`} sx={{ display: "flex", gap: 1.5, flex: 1, minWidth: 0, textDecoration: "none", color: "inherit", minHeight: 48, alignItems: "center" }}>
          <Typography sx={{ width: 52, flex: "none", fontWeight: 700, fontSize: 17, color: isLate ? "#b3261e" : done ? "text.secondary" : "text.primary" }}>
            {j.jobDate === t || j.jobDate === tm ? j.jobTime || "—" : (j.jobDate || "—").slice(5).split("-").reverse().join("/")}
          </Typography>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, color: "text.primary" }} noWrap>
              {j.jobName}
            </Typography>
            <Typography variant="body2" noWrap>
              {j.contactName || j.jobId}
            </Typography>
            {isLate ? (
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#b3261e" }}>เลยนัด</Typography>
            ) : done ? (
              <Typography sx={{ fontSize: 14, color: "#3d6340" }}>ส่งงานแล้ว</Typography>
            ) : pending(j) ? (
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#8a5606" }}>ยังไม่รับทราบ</Typography>
            ) : null}
          </Box>
        </Box>
        {pending(j) && canAck ? (
          <Button variant="outlined" sx={{ ...touch, flex: "none" }} disabled={busyId === j.jobId} onClick={() => onAck(j.jobId)}>
            รับทราบ
          </Button>
        ) : null}
      </Box>
    );
  };

  return (
    <Stack spacing={2}>
      {next ? (
        <Box
          component="section"
          aria-label="งานถัดไป"
          sx={{ bgcolor: "#fff", border: 2, borderColor: "primary.main", borderRadius: 3, p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#14432a" }}>
              {next.stage === "IN_PROGRESS" ? "กำลังทำ" : "งานถัดไป"} · {next.jobDate === t ? next.jobTime || "วันนี้" : next.jobDate}
            </Typography>
            <JobStatusChip status={next.status} />
          </Stack>
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, color: "text.primary" }}>{next.jobName}</Typography>
            <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{next.contactName}</Typography>
            <Typography variant="body2" className="code">{next.jobId}</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            {next.phone ? (
              <Button variant="outlined" startIcon={<CallIcon />} href={`tel:${next.phone}`} sx={{ ...touch, flex: 1 }}>
                โทร
              </Button>
            ) : null}
            {next.mapLink ? (
              <Button variant="outlined" startIcon={<DirectionsIcon />} href={next.mapLink} target="_blank" rel="noopener noreferrer" sx={{ ...touch, flex: 1 }}>
                นำทาง
              </Button>
            ) : null}
          </Stack>
          <Button component={Link} href={`/m/job/${encodeURIComponent(next.jobId)}`} variant="contained" size="large" startIcon={<TaskAltIcon />} sx={{ minHeight: 56, fontSize: 18 }}>
            เปิดใบงาน
          </Button>
        </Box>
      ) : null}

      {late.length ? (
        <Box>
          <Typography variant="h2" sx={{ fontSize: 17, mb: 1, color: "#b3261e" }}>
            เลยนัด ({late.length})
          </Typography>
          <Stack spacing={1}>{late.map(row)}</Stack>
        </Box>
      ) : null}
      <Box>
        <Typography variant="h2" sx={{ fontSize: 17, mb: 1 }}>
          วันนี้
        </Typography>
        {todays.length ? <Stack spacing={1}>{todays.map(row)}</Stack> : <Typography variant="body2">ไม่มีงานนัดวันนี้</Typography>}
      </Box>
      {tomorrow.length ? (
        <Box>
          <Typography variant="h2" sx={{ fontSize: 17, mb: 1 }}>
            พรุ่งนี้
          </Typography>
          <Stack spacing={1}>{tomorrow.map(row)}</Stack>
        </Box>
      ) : null}
      {later.length ? (
        <Box>
          <Typography variant="h2" sx={{ fontSize: 17, mb: 1 }}>
            วันอื่น ({later.length})
          </Typography>
          <Stack spacing={1}>{later.slice(0, 20).map(row)}</Stack>
        </Box>
      ) : null}
    </Stack>
  );
}
