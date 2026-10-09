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
import { addDaysISO, bangkokClock, bangkokToday } from "@/lib/date";
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
        api.listJobs({ status: "OPEN" }),
      ]);
      setBookings(bk.items);
      setJobs(jb.jobs);
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

  if (status !== "authed") return <WomsEmptyState title="กรุณาเข้าสู่ระบบ" />;

  const nextStep: Partial<Record<BookingStatus, { to: BookingStatus; label: string }>> = {
    BOOKED: { to: "ON_THE_WAY", label: "ออกเดินทาง" },
    ON_THE_WAY: { to: "ARRIVED", label: "ถึงหน้างานแล้ว" },
    ARRIVED: { to: "DONE", label: "ปิดคิว" },
  };

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", py: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          {/* QA (Cosmetic) — บัญชีที่มี jobs:view_all เห็นงานของทั้งบริษัท
              หัวข้อ "งานของ <ชื่อตัวเอง>" จึงทำให้เข้าใจผิด */}
          <Typography variant="h1" sx={{ fontSize: 22 }}>
            {has("jobs:view_all") ? "งานที่ต้องติดตาม" : `งานของ ${user?.name ?? ""}`}
          </Typography>
          <Typography variant="body2">
            {loading ? "กำลังโหลด…" : `ใบงานเปิดอยู่ ${jobs.length} งาน`}
            {FEATURES.techQueue ? ` · ${range === "today" ? "คิววันนี้" : "คิว 7 วัน"} ${bookings.length} คิว` : ""}
          </Typography>
        </Box>
        {FEATURES.techQueue ? (
          <Button variant="outlined" onClick={() => setRange(range === "today" ? "week" : "today")}>
            {range === "today" ? "ดู 7 วัน" : "ดูวันนี้"}
          </Button>
        ) : null}
      </Stack>

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
        <Button component={Link} href="/notifications" variant="outlined" fullWidth sx={touch}>
          การแจ้งเตือน
        </Button>
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

      <Typography variant="h2" sx={{ fontSize: 17, mt: 3, mb: 1 }}>
        ใบงานที่ยังเปิดอยู่
      </Typography>
      {loading && jobs.length === 0 ? (
        <WomsLoadingState rows={3} />
      ) : jobs.length === 0 && !error ? (
        <WomsEmptyState title="ไม่มีใบงานค้าง" />
      ) : (
        <Stack spacing={1.5}>
          {jobs.slice(0, 20).map((j) => (
            <Card key={j.jobId}>
              <CardContent sx={{ pb: 1 }}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography className="code">{j.jobId}</Typography>
                  <JobStatusChip status={j.status} />
                </Stack>
                <Typography sx={{ fontWeight: 600, color: "text.primary", mt: 0.5 }}>{j.jobName}</Typography>
                <Typography variant="body2">
                  {j.jobDate} {j.jobTime} · ทีม {j.technicianTeam || "—"}
                </Typography>
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2 }}>
                <Button
                  component={Link}
                  href={`/m/job/${encodeURIComponent(j.jobId)}`}
                  variant="contained"
                  fullWidth
                  size="large"
                  startIcon={<TaskAltIcon />}
                >
                  ปิดงาน
                </Button>
              </CardActions>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
