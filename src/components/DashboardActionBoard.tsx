"use client";
/**
 * แดชบอร์ด (Redesign 12 พ.ย. 69) — ส่วนบนของหน้า: ทักทาย · ตัวเลขหลัก 4 ตัว · "ต้องจัดการตอนนี้" · ทีมช่างวันนี้
 *   เดิม: การ์ดตัวเลข 21 ใบน้ำหนักเท่ากัน ต้องอ่านเองว่าอันไหนด่วน
 *   ใหม่: รวมเรื่องที่ต้องทำเรียงตามความด่วน กดทีเดียวไปรายการที่กรองแล้ว · เรื่องที่เป็น 0 ไม่แสดง
 *   ใช้ข้อมูลจาก API เดิมทั้งหมด (ใบงาน · สรุปคิว · คิวตรวจเงินเข้า · สรุปเครื่อง · สัญญา) — ไม่มี endpoint ใหม่
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/lib/AuthContext";
import { sqApi, type QueueSummary } from "@/lib/serviceQueueApi";
import { financeApi } from "@/lib/financeApi";
import { bangkokToday } from "@/lib/date";
import { fmtMoney } from "@/lib/options";
import { FEATURES } from "@/lib/features";
import type { Contract, EquipmentDashboard, JobDashboard, JobListItem } from "@/lib/types";

type Tone = "red" | "amber" | "blue" | "neutral";
interface ActionItem {
  key: string;
  count: number;
  title: string;
  detail: string;
  href: string;
  cta: string;
  tone: Tone;
  primary?: boolean;
}

const TONE: Record<Tone, { bg: string; fg: string }> = {
  red: { bg: "#fbeceb", fg: "#b3261e" },
  amber: { bg: "#fdf3e2", fg: "#8a5606" },
  blue: { bg: "#e6f1f8", fg: "#0b6aa2" },
  neutral: { bg: "#eef2f5", fg: "#2e3f4f" },
};

const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
function thaiLongDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${THAI_DAYS[dow]} ${d} ${THAI_MONTHS[m - 1]} ${y + 543}`;
}

const names = (js: JobListItem[], max = 2) => {
  const head = js.slice(0, max).map((j) => `${j.jobId} ${j.contactName || j.jobName}`);
  return js.length > max ? `${head.join(" · ")} · อีก ${js.length - max} งาน` : head.join(" · ");
};

/** งานที่ช่างทำเสร็จแล้วในวันนั้น (ส่งงาน/ยืนยัน/ปิด) */
const isDone = (j: JobListItem) => j.status === "CLOSED" || (j as any).stage === "SUBMITTED" || (j as any).stage === "CONFIRMED";

export default function DashboardActionBoard({
  jobs,
  jobDash,
  equipDash,
  contracts,
}: {
  jobs: JobListItem[] | null;
  jobDash: JobDashboard | null;
  equipDash: EquipmentDashboard | null;
  contracts: Contract[] | null;
}) {
  const { user, has } = useAuth();
  const [queue, setQueue] = useState<QueueSummary | null>(null);
  const [payQueue, setPayQueue] = useState<number | null>(null);
  const today = bangkokToday();

  useEffect(() => {
    let alive = true;
    // FE-02: เรียกเฉพาะ endpoint ที่บทบาทมีสิทธิ์ (ไม่ยิงแล้วรอ 403)
    if (FEATURES.serviceQueue && has("svcqueue:view")) sqApi.summary().then((s) => alive && setQueue(s)).catch(() => undefined);
    if (has("payments:verify")) financeApi.queue().then((r) => alive && setPayQueue(r.items.length)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [has]);

  const open = useMemo(() => (jobs ?? []).filter((j) => j.status === "OPEN"), [jobs]);
  const overdue = useMemo(() => open.filter((j) => j.jobDate && j.jobDate < today).sort((a, b) => a.jobDate.localeCompare(b.jobDate)), [open, today]);
  const submitted = useMemo(() => open.filter((j) => (j as any).stage === "SUBMITTED"), [open]);
  const reschedule = useMemo(() => open.filter((j) => (j.rescheduleRequests ?? []).some((r) => r.status === "PENDING")), [open]);
  const todayJobs = useMemo(
    () => (jobs ?? []).filter((j) => j.jobDate === today && j.status !== "CANCELLED").sort((a, b) => (a.jobTime || "").localeCompare(b.jobTime || "")),
    [jobs, today]
  );

  const items: ActionItem[] = [];
  if (overdue.length)
    items.push({ key: "overdue", count: overdue.length, title: "งานเลยวันนัด ยังไม่ปิด", detail: names(overdue), href: "/jobs?status=OPEN&dateScope=OVERDUE", cta: "ดูงาน", tone: "red" });
  if (queue?.waitAssign)
    items.push({ key: "assign", count: queue.waitAssign, title: "คิวใหม่รอจัดช่าง", detail: "เปิดบอร์ดคิวเพื่อเลือกช่างและวันนัด", href: "/service-queue", cta: "จัดช่าง", tone: "amber", primary: true });
  if (queue?.techReplied)
    items.push({ key: "replied", count: queue.techReplied, title: "ช่างตอบแล้ว รอ Admin รับคิว", detail: "ตรวจวันเวลาที่ช่างรับ แล้วส่งให้เซลล์ยืนยันกับลูกค้า", href: "/service-queue", cta: "รับคิว", tone: "amber", primary: true });
  if (reschedule.length)
    items.push({ key: "resched", count: reschedule.length, title: "ช่างขอเลื่อนนัด", detail: names(reschedule), href: reschedule.length === 1 ? `/jobs/${reschedule[0].jobId}` : "/jobs?status=OPEN", cta: "พิจารณา", tone: "amber" });
  if (queue?.readyToOpen)
    items.push({ key: "ready", count: queue.readyToOpen, title: "ลูกค้ายืนยันแล้ว รอเปิด JN", detail: "Admin กดเปิดใบงานจากคิวที่ลูกค้าตกลงแล้ว", href: "/service-queue", cta: "เปิด JN", tone: "blue", primary: true });
  if (submitted.length)
    items.push({ key: "review", count: submitted.length, title: "ช่างส่งงานแล้ว รอตรวจปิด", detail: names(submitted), href: submitted.length === 1 ? `/jobs/${submitted[0].jobId}` : "/jobs?status=OPEN", cta: "ตรวจงาน", tone: "blue" });
  if (payQueue)
    items.push({ key: "pay", count: payQueue, title: "เงินเข้ารอตรวจสอบ", detail: "สลิปที่แนบมาแล้ว รอยืนยันยอด", href: "/finance/queue", cta: "ตรวจสลิป", tone: "blue" });
  if (equipDash?.byPmStatus.OVERDUE)
    items.push({ key: "pm", count: equipDash.byPmStatus.OVERDUE, title: "PM เกินกำหนด", detail: "เครื่องที่เลยรอบ PM แล้ว ต้องนัดเข้าทำ", href: "/equipment?pmStatus=OVERDUE", cta: "ดูเครื่อง", tone: "red" });

  const teams = useMemo(() => {
    const m = new Map<string, JobListItem[]>();
    for (const j of todayJobs) {
      const k = j.technicianTeam || "ยังไม่จัดทีม";
      m.set(k, [...(m.get(k) ?? []), j]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, "th"));
  }, [todayJobs]);

  const doneToday = todayJobs.filter(isDone).length;
  const money = contracts ? contracts.reduce((a, c) => a + (c.overdueAmount ?? 0), 0) : null;
  const moneyCount = contracts ? contracts.filter((c) => (c.overdueAmount ?? 0) > 0).length : 0;
  const pmDue = equipDash ? equipDash.byPmStatus.OVERDUE + equipDash.byPmStatus.DUE_SOON : null;

  const kpi = (label: string, value: React.ReactNode, sub: React.ReactNode, href?: string, subTone?: string) => {
    const inner = (
      <Paper variant="outlined" sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column", gap: 0.5, "&:hover": href ? { borderColor: "primary.main" } : undefined }}>
        <Typography variant="body2">{label}</Typography>
        <Typography sx={{ fontSize: 30, fontWeight: 700, lineHeight: 1.15, color: "text.primary" }}>{value}</Typography>
        <Typography variant="body2" sx={{ color: subTone ?? "text.secondary", fontWeight: subTone ? 600 : 400 }}>
          {sub}
        </Typography>
      </Paper>
    );
    return href ? (
      <Box component={Link} href={href} sx={{ textDecoration: "none", color: "inherit", display: "block" }}>
        {inner}
      </Box>
    ) : (
      inner
    );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mb: 3 }} data-testid="dashboard-actions">
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "flex-end" }} spacing={1.5}>
        <Box>
          <Typography variant="body2">{thaiLongDate(today)}</Typography>
          <Typography component="h1" sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 700, lineHeight: 1.25, color: "text.primary" }}>
            สวัสดีคุณ{user?.name ?? ""} {items.length ? `วันนี้มี ${items.length} เรื่องรอจัดการ` : "วันนี้ไม่มีเรื่องค้าง"}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {has("calendar:view") ? (
            <Button component={Link} href="/calendar" variant="outlined">
              ดูปฏิทินช่าง
            </Button>
          ) : null}
        </Stack>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(4, minmax(0,1fr))" }, gap: 1.5 }}>
        {jobs ? kpi("งานวันนี้", todayJobs.length, `เสร็จแล้ว ${doneToday} · เหลือ ${todayJobs.length - doneToday}`, "/jobs?status=OPEN&dateScope=TODAY") : null}
        {jobDash
          ? kpi("งานที่เปิดอยู่", jobDash.open, jobDash.overdue ? `เลยนัด ${jobDash.overdue}` : "ไม่มีงานเลยนัด", "/jobs?status=OPEN", jobDash.overdue ? "#b3261e" : undefined)
          : null}
        {pmDue !== null && equipDash
          ? kpi("PM ต้องตาม", pmDue, `เกินกำหนด ${equipDash.byPmStatus.OVERDUE} · ใกล้ครบ ${equipDash.byPmStatus.DUE_SOON}`, "/equipment?pmStatus=DUE_SOON", equipDash.byPmStatus.OVERDUE ? "#b3261e" : undefined)
          : null}
        {money !== null ? kpi("ค้างชำระค่าเช่า", `฿${fmtMoney(money)}`, `${moneyCount} สัญญา`, "/contracts?payment=OVERDUE", money > 0 ? "#b3261e" : undefined) : null}
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
        <Paper variant="outlined" sx={{ flex: "999 1 480px", minWidth: 0 }} component="section" aria-labelledby="dash-actions-h">
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ px: 2.5, pt: 2, pb: 1 }}>
            <Typography id="dash-actions-h" component="h2" sx={{ fontSize: 18, fontWeight: 700, color: "text.primary" }}>
              ต้องจัดการตอนนี้
            </Typography>
            <Typography variant="body2">เรียงตามความด่วน</Typography>
          </Stack>
          {items.length === 0 ? (
            <Typography sx={{ px: 2.5, pb: 2.5 }} variant="body2">
              ไม่มีเรื่องที่ต้องจัดการตอนนี้
            </Typography>
          ) : (
            items.map((it) => (
              <Stack
                key={it.key}
                direction="row"
                spacing={1.75}
                alignItems="center"
                sx={{ px: 2.5, py: 1.5, borderTop: 1, borderColor: "divider" }}
                data-testid={`dash-action-${it.key}`}
              >
                <Box
                  sx={{
                    flex: "none",
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    fontSize: 17,
                    bgcolor: TONE[it.tone].bg,
                    color: TONE[it.tone].fg,
                  }}
                >
                  {it.count}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{it.title}</Typography>
                  <Typography variant="body2" noWrap title={it.detail}>
                    {it.detail}
                  </Typography>
                </Box>
                <Button component={Link} href={it.href} size="small" variant={it.primary ? "contained" : "outlined"} sx={{ flex: "none" }}>
                  {it.cta}
                </Button>
              </Stack>
            ))
          )}
        </Paper>

        <Paper variant="outlined" sx={{ flex: "1 1 320px", minWidth: 0, p: 2.5 }} component="section" aria-labelledby="dash-teams-h">
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.5 }}>
            <Typography id="dash-teams-h" component="h2" sx={{ fontSize: 18, fontWeight: 700, color: "text.primary" }}>
              ทีมช่างวันนี้
            </Typography>
            {has("calendar:view") ? (
              <Link href="/calendar" style={{ fontSize: 14, fontWeight: 600 }}>
                ปฏิทิน
              </Link>
            ) : null}
          </Stack>
          {teams.length === 0 ? (
            <Typography variant="body2">ยังไม่มีงานนัดวันนี้</Typography>
          ) : (
            <Stack spacing={2}>
              {teams.map(([team, js]) => {
                const done = js.filter(isDone).length;
                const doing = js.find((j) => (j as any).stage === "IN_PROGRESS") ?? js.find((j) => !isDone(j));
                const doingText = !doing
                  ? "เสร็จครบแล้ว"
                  : `${(doing as any).stage === "IN_PROGRESS" ? "กำลังทำ" : "ถัดไป"}: ${doing.jobTime || ""} ${doing.jobName}${doing.contactName ? ` · ${doing.contactName}` : ""}`;
                return (
                  <Box key={team}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{team}</Typography>
                      <Typography variant="body2">
                        เสร็จ {done} / {js.length}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={js.length ? (done / js.length) * 100 : 0}
                      sx={{ my: 0.75, height: 8, borderRadius: 99, bgcolor: "#e2e7ec" }}
                      aria-label={`${team} เสร็จ ${done} จาก ${js.length}`}
                    />
                    <Typography variant="body2" noWrap title={doingText}>
                      {doingText}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          )}
          {equipDash && equipDash.pmAttention.length ? (
            <Box sx={{ mt: 2.5, pt: 2, borderTop: 1, borderColor: "divider" }}>
              <Typography component="h3" sx={{ fontSize: 15, fontWeight: 700, color: "text.primary", mb: 1 }}>
                PM ที่ต้องตาม
              </Typography>
              <Stack spacing={0.75}>
                {equipDash.pmAttention.slice(0, 3).map((p) => (
                  <Stack key={p.id} direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="body2" sx={{ color: "text.primary" }} noWrap>
                      {p.customerName || p.location || p.serial} · {p.model || p.serial}
                    </Typography>
                    <Typography variant="body2" sx={{ flex: "none", color: p.pmDaysLeft < 0 ? "#b3261e" : undefined }}>
                      {p.pmDaysLeft < 0 ? `เกิน ${Math.abs(p.pmDaysLeft)} วัน` : `อีก ${p.pmDaysLeft} วัน`}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              <Box sx={{ mt: 1 }}>
                <Link href="/equipment?pmStatus=DUE_SOON" style={{ fontSize: 14, fontWeight: 600 }}>
                  ดูทั้งหมด {equipDash.pmAttentionTotal} เครื่อง
                </Link>
              </Box>
            </Box>
          ) : null}
        </Paper>
      </Box>
    </Box>
  );
}
