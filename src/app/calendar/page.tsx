"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { alpha, useTheme } from "@mui/material/styles";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { tokens } from "@/theme/tokens";
import type { CalendarEvent } from "@/lib/types";
import { statusLabel } from "@/lib/options";
import {
  WomsEmptyState,
  WomsErrorState,
  WomsFilterPanel,
  WomsLoadingState,
  WomsPageHeader,
  WomsSelectFilter,
} from "@/components/woms";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { CalendarResponse, Options } from "@/lib/types";
import { jobTypeLabel } from "@/lib/options";
import { addDaysISO, bangkokToday, dayMonthLabel, startOfWeekISO } from "@/lib/date";
import { monthGrid, shiftMonth } from "@/lib/calendarMonth";
import { CALENDAR_SEGMENT_LABEL, type CalendarSegment, calendarEventKind, filterBySegment, segmentCounts } from "@/lib/calendarSegments";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

const MONTH_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const monthLabel = (m: string) => `${MONTH_TH[Number(m.slice(5, 7)) - 1]} ${Number(m.slice(0, 4)) + 543}`;

// ปฏิทินทำงานบนวันที่แบบ date-only (YYYY-MM-DD) ล้วน ๆ
//
// เดิมสร้างวันของสัปดาห์เป็น Date แบบเวลาเครื่อง แล้วแปลงเป็นช่วง query ด้วย toISOString()
// ซึ่งเป็นเวลา UTC — เบราว์เซอร์ที่ตั้งเป็นเวลาไทย (UTC+7) จึงถามข้อมูลย้อนไป 1 วัน
// (หัวคอลัมน์ 14–20 แต่ query 13–19) ทำให้งานวันอาทิตย์ท้ายสัปดาห์หายไปทั้งวัน
// และงานที่ดึงมาได้ก็ตกคอลัมน์เพี้ยนไปหนึ่งช่อง
//
// ตอนนี้ช่วง query · หัวคอลัมน์ · คีย์ของช่องในตาราง มาจากสตริงชุดเดียวกัน
// จึงตรงกันโดยโครงสร้าง ไม่มีการแปลงผ่าน Date ให้เลื่อนวันได้อีก
const DOW = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const DOW_FULL = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];

/**
 * การ์ดงานในปฏิทิน — ใช้ร่วมกันทุกมุมมอง
 * สถานะบอกด้วยข้อความเสมอ (ไม่ใช้สีอย่างเดียว): นัดที่ต้องไป = พื้นสีแบรนด์ · งานพัก = กรอบเส้นประ + ป้าย · อื่น ๆ = พื้นเทา + ชื่อสถานะ
 */
function EventCard({ e, compact = false, showTeam = false }: { e: CalendarEvent; compact?: boolean; showTeam?: boolean }) {
  const kind = calendarEventKind(e);
  const hold = kind === "HOLD";
  const active = kind === "ACTIVE";
  const tag = hold ? "งานพัก · รอคิวใหม่" : active ? "" : statusLabel[e.status];
  return (
    <Box
      component={Link}
      href={`/jobs/${e.jobId}`}
      aria-label={`${e.time || ""} ${jobTypeLabel[e.jobType]} ${e.title}${tag ? ` (${tag})` : ""}`}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: compact ? 0 : 0.25,
        px: compact ? 0.75 : 1.25,
        py: compact ? 0.5 : 1,
        mb: compact ? 0.5 : 0.75,
        borderRadius: 1.25,
        border: "1px solid",
        borderStyle: hold ? "dashed" : "solid",
        borderColor: hold ? "warning.main" : active ? (t) => alpha(t.palette.primary.main, 0.28) : "divider",
        bgcolor: hold ? tokens.openBg : active ? tokens.accentBg : tokens.chip,
        color: "text.primary",
        textDecoration: e.status === "CANCELLED" ? "line-through" : "none",
        transition: "background-color 120ms",
        "&:hover": { bgcolor: hold ? alpha(tokens.open, 0.16) : active ? (t) => alpha(t.palette.primary.main, 0.16) : tokens.line },
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 1 },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, minWidth: 0 }}>
        <Box component="span" sx={{ fontSize: compact ? 12 : 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {e.time || "ไม่ระบุเวลา"}
        </Box>
        {tag && !compact ? (
          <Box
            component="span"
            sx={{ fontSize: 11.5, fontWeight: 600, px: 0.75, borderRadius: 99, whiteSpace: "nowrap", bgcolor: "background.paper", color: hold ? "warning.dark" : "text.secondary" }}
          >
            {tag}
          </Box>
        ) : null}
      </Box>
      <Box
        component="span"
        sx={{
          fontSize: compact ? 12 : 14,
          fontWeight: 500,
          lineHeight: 1.35,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {e.title}
      </Box>
      <Box component="span" sx={{ fontSize: compact ? 11.5 : 12.5, color: "text.secondary", lineHeight: 1.35 }}>
        {jobTypeLabel[e.jobType]}
        {showTeam && e.team ? ` · ${e.team}` : ""}
        {tag && compact ? ` · ${tag}` : ""}
      </Box>
    </Box>
  );
}

function Legend() {
  const sw = (sx: object) => <Box component="span" aria-hidden sx={{ width: 14, height: 14, borderRadius: 0.5, border: "1px solid", flexShrink: 0, ...sx }} />;
  return (
    <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" sx={{ fontSize: 13, color: "text.secondary" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        {sw({ bgcolor: tokens.accentBg, borderColor: "primary.main" })}นัดที่ต้องไป
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        {sw({ bgcolor: tokens.openBg, borderColor: "warning.main", borderStyle: "dashed" })}งานพัก (รอคิวใหม่)
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        {sw({ bgcolor: tokens.chip, borderColor: "divider" })}สถานะอื่น
      </Box>
    </Stack>
  );
}

export default function CalendarPage() {
  const theme = useTheme();
  // ต่ำกว่า md: แถบเลือกวัน + รายการของวันที่เลือก แทนตาราง 7 คอลัมน์ที่ต้องเลื่อนแนวนอน
  const narrow = useMediaQuery(theme.breakpoints.down("md"));
  // ยึด "วันนี้" ตามเวลาไทย ไม่ใช่เขตเวลาที่ตั้งไว้ในเครื่องผู้ใช้
  const today = bangkokToday();
  const [weekStart, setWeekStart] = useState<string>(() => startOfWeekISO(bangkokToday()));
  // JOB-04 / BR-01.5 — มุมมองรายเดือน (ช่างเห็นเฉพาะงานของตน — เซิร์ฟเวอร์กรองให้เสมอ)
  const [view, setView] = useState<"week" | "month">("week");
  const [month, setMonth] = useState<string>(() => bangkokToday().slice(0, 7));
  const [team, setTeam] = useState("");
  // BR-01 C-2 / CAL-D01: แยกนัดหมายที่ต้องไป กับงานพัก (HOLD) — งานปิดอยู่ที่ประวัติงาน
  const [segment, setSegment] = useState<CalendarSegment>("ALL");
  // D-13 / JOB-04: สิทธิ์การเห็นเป็นรายคน — ผู้เห็นทุกใบงานกรอง/จัดแถวตามช่างได้ (ช่างเห็นเฉพาะงานของตน — เซิร์ฟเวอร์บังคับ)
  const { has } = useAuth();
  const canFilterTech = has("jobs:view_all");
  const [techId, setTechId] = useState("");
  const [groupBy, setGroupBy] = useState<"team" | "technician">("team");
  const [techs, setTechs] = useState<{ value: string; label: string }[]>([]);
  const [options, setOptions] = useState<Options | null>(null);
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)),
    [weekStart]
  );
  const from = days[0];
  const to = days[6];

  // จอแคบ: วันที่เลือกในแถบวัน — เปลี่ยนสัปดาห์แล้วกลับไปที่วันนี้ (ถ้าอยู่ในสัปดาห์นั้น) หรือวันจันทร์
  const [selectedDay, setSelectedDay] = useState<string>(() => bangkokToday());
  useEffect(() => {
    setSelectedDay(days.includes(today) ? today : days[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- รีเซ็ตเฉพาะตอนเปลี่ยนสัปดาห์
  }, [weekStart]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const extra = { team: team || undefined, technicianId: techId || undefined, groupBy };
      const res = view === "month" ? await api.calendar({ month, ...extra }) : await api.calendar({ from, to, ...extra });
      setData(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดปฏิทินไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [from, to, team, view, month, techId, groupBy]);

  useEffect(() => {
    api.getOptions().then(setOptions).catch(() => setOptions(null));
  }, []);
  useEffect(() => {
    if (!canFilterTech) return;
    api
      .listTechnicians()
      .then((r) => setTechs(r.items.map((t) => ({ value: t.id, label: t.team ? `${t.name} · ${t.team}` : t.name }))))
      .catch(() => setTechs([]));
  }, [canFilterTech]);
  useEffect(() => {
    load();
  }, [load]);

  const allLanes = data?.lanes ?? [];
  const counts = segmentCounts(allLanes.flatMap((l) => l.events));
  const lanes = allLanes.map((l) => ({ ...l, events: filterBySegment(l.events, segment) })).filter((l) => segment === "ALL" || l.events.length);
  const grid = view === "month" ? monthGrid(month) : [];
  // จัดแถวตามช่าง: ใบงานหลายช่างอยู่หลาย lane — แสดงใบงานละครั้ง
  const eventsOn = (d: string) =>
    lanes
      .flatMap((lane) => lane.events.filter((e) => e.date === d))
      .filter((e, i, all) => all.findIndex((x) => x.jobId === e.jobId) === i)
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const laneLabel = groupBy === "technician" ? "ช่าง" : "ทีมช่าง";
  const todayTint = alpha(theme.palette.primary.main, 0.045);

  // หัววัน: วันนี้เป็นวงกลมสีแบรนด์ — ใช้ทั้งตารางสัปดาห์และเดือน
  const dayNumber = (d: string, size = 30) => {
    const isToday = d === today;
    return (
      <Box
        component="span"
        sx={{
          width: size,
          height: size,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size > 26 ? 17 : 13,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          bgcolor: isToday ? "primary.main" : "transparent",
          color: isToday ? "primary.contrastText" : "text.primary",
        }}
      >
        {Number(d.slice(8, 10))}
      </Box>
    );
  };

  const monthBody = loading ? (
    <WomsLoadingState rows={4} />
  ) : error ? (
    <WomsErrorState message={error} onRetry={load} />
  ) : narrow ? (
    // จอแคบ: แสดงเฉพาะวันที่มีงานของเดือนนี้ เรียงตามวัน
    (() => {
      const withJobs = grid.filter((g) => g.inMonth && eventsOn(g.date).length);
      return withJobs.length === 0 ? (
        <WomsEmptyState title="ไม่มีงานในเดือนนี้" />
      ) : (
        <Stack spacing={1.5}>
          {withJobs.map((g) => (
            <Paper key={g.date} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 700, color: "text.primary", mb: 1 }}>
                {dayMonthLabel(g.date)}
                {g.date === today ? " · วันนี้" : ""}
              </Typography>
              {eventsOn(g.date).map((e) => (
                <EventCard key={e.jobId} e={e} showTeam />
              ))}
            </Paper>
          ))}
        </Stack>
      );
    })()
  ) : (
    <Paper variant="outlined" sx={{ overflow: "hidden", borderRadius: 2 }} aria-label={`ปฏิทินเดือน ${monthLabel(month)}`}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", bgcolor: tokens.surface2, borderBottom: 1, borderColor: "divider" }}>
        {DOW.map((d) => (
          <Box key={d} sx={{ px: 1, py: 1, fontSize: 13, fontWeight: 600, color: "text.secondary" }}>
            {d}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
        {grid.map((g, i) => (
          <Box
            key={g.date}
            sx={{
              p: 0.75,
              minHeight: 108,
              borderTop: i < 7 ? 0 : 1,
              borderLeft: i % 7 === 0 ? 0 : 1,
              borderColor: "divider",
              minWidth: 0,
              bgcolor: !g.inMonth ? tokens.surface2 : g.date === today ? todayTint : undefined,
            }}
          >
            <Box sx={{ mb: 0.5, opacity: g.inMonth ? 1 : 0.5 }}>{dayNumber(g.date, 26)}</Box>
            {g.inMonth ? eventsOn(g.date).map((e) => <EventCard key={e.jobId} e={e} compact />) : null}
          </Box>
        ))}
      </Box>
    </Paper>
  );

  // จอแคบ: แถบ 7 วัน (มีจำนวนนัดของแต่ละวัน) แล้วแสดงรายการของวันที่เลือกเรียงตามเวลา
  const narrowWeek = (() => {
    const si = Math.max(0, days.indexOf(selectedDay));
    const list = eventsOn(selectedDay);
    return (
      <Stack spacing={2}>
        <Box role="group" aria-label="เลือกวัน" sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 0.75 }}>
          {days.map((d, i) => {
            const n = eventsOn(d).length;
            const sel = d === selectedDay;
            const isToday = d === today;
            return (
              <ButtonBase
                key={d}
                onClick={() => setSelectedDay(d)}
                aria-pressed={sel}
                aria-label={`${DOW_FULL[i]} ${dayMonthLabel(d)} · ${n ? `${n} นัด` : "ไม่มีงาน"}`}
                data-testid={`calendar-day-${d}`}
                sx={{
                  minHeight: 76,
                  py: 1,
                  px: 0.25,
                  borderRadius: 1.5,
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.25,
                  border: "1.5px solid",
                  borderColor: sel ? "primary.main" : isToday ? "primary.main" : "divider",
                  bgcolor: sel ? "primary.main" : "background.paper",
                  color: sel ? "primary.contrastText" : "text.primary",
                  "&:focus-visible": { outline: "2px solid", outlineColor: "primary.dark", outlineOffset: 2 },
                }}
              >
                <Box component="span" sx={{ fontSize: 12 }}>
                  {DOW[i]}
                </Box>
                <Box component="span" sx={{ fontSize: 18, lineHeight: 1.2, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {Number(d.slice(8, 10))}
                </Box>
                <Box component="span" sx={{ fontSize: 11, fontWeight: 600, color: sel ? "inherit" : n ? "primary.main" : "text.secondary" }}>
                  {n ? `${n} นัด` : "ว่าง"}
                </Box>
              </ButtonBase>
            );
          })}
        </Box>

        <Box>
          <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1, mb: 1 }}>
            <Typography component="h2" sx={{ fontSize: 17, fontWeight: 700, color: "text.primary" }}>
              {DOW_FULL[si]} {dayMonthLabel(selectedDay)}
              {selectedDay === today ? " · วันนี้" : ""}
            </Typography>
            <Typography variant="body2">{list.length ? `${list.length} นัด` : ""}</Typography>
          </Box>
          {list.length === 0 ? (
            <WomsEmptyState title="ไม่มีงานในวันนี้" />
          ) : (
            list.map((e) => <EventCard key={e.jobId} e={e} showTeam />)
          )}
        </Box>
      </Stack>
    );
  })();

  const body = loading ? (
    <WomsLoadingState rows={4} />
  ) : error ? (
    <WomsErrorState message={error} onRetry={load} />
  ) : narrow ? (
    narrowWeek
  ) : lanes.length === 0 ? (
    <WomsEmptyState title="ไม่มีงานในสัปดาห์นี้" />
  ) : (
    <Paper variant="outlined" sx={{ overflowX: "auto", borderRadius: 2 }}>
      <Box sx={{ minWidth: 920 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "168px repeat(7, minmax(0, 1fr))", bgcolor: tokens.surface2, borderBottom: 1, borderColor: "divider" }}>
          <Box sx={{ px: 1.5, py: 1.25, fontWeight: 700, fontSize: 13, color: "text.secondary", display: "flex", alignItems: "flex-end" }}>{laneLabel}</Box>
          {days.map((d, i) => {
            const n = eventsOn(d).length;
            return (
              <Box key={d} sx={{ px: 1, py: 1, borderLeft: 1, borderColor: "divider", textAlign: "center", bgcolor: d === today ? todayTint : undefined }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: d === today ? "primary.main" : "text.secondary" }}>
                  {DOW[i]}
                  {d === today ? " · วันนี้" : ""}
                </Typography>
                {dayNumber(d)}
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: n ? "primary.main" : "text.secondary" }}>{n ? `${n} นัด` : "ว่าง"}</Typography>
              </Box>
            );
          })}
        </Box>
        {lanes.map((lane) => (
          <Box
            key={lane.team}
            sx={{ display: "grid", gridTemplateColumns: "168px repeat(7, minmax(0, 1fr))", borderTop: 1, borderColor: "divider", "&:first-of-type": { borderTop: 0 } }}
          >
            <Box sx={{ px: 1.5, py: 1.25 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14, color: "text.primary" }}>{lane.team}</Typography>
              <Typography variant="caption" color="text.secondary">
                {lane.events.length} นัดในสัปดาห์
              </Typography>
            </Box>
            {days.map((d) => (
              // คีย์ของช่อง = วันที่เดียวกับที่ใช้ query และที่แสดงบนหัวคอลัมน์
              <Box key={d} sx={{ p: 0.75, minHeight: 88, borderLeft: 1, borderColor: "divider", minWidth: 0, bgcolor: d === today ? todayTint : undefined }}>
                {lane.events
                  .filter((e) => e.date === d)
                  .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
                  .map((e) => (
                    <EventCard key={e.jobId} e={e} />
                  ))}
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    </Paper>
  );

  return (
    <>
      <WomsPageHeader
        title="ปฏิทินงาน"
        subtitle={
          view === "month" ? (
            <>
              รายเดือน · <span className="mono">{monthLabel(month)}</span>
            </>
          ) : (
            <>
              {narrow ? "สัปดาห์" : `แยกตาม${laneLabel}`} · <span className="mono">{from} → {to}</span>
            </>
          )
        }
        actions={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {/* BR-01 C-2/C-3: งานที่ปิด/ยกเลิกไม่อยู่ในปฏิทิน — ดูย้อนหลังที่ประวัติงาน */}
            <Button component={Link} href="/jobs/history" variant="outlined" size="small" data-testid="calendar-history-link">
              ประวัติงาน
            </Button>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={view}
              onChange={(_, v) => v && setView(v)}
              aria-label="มุมมองปฏิทิน"
            >
              <ToggleButton value="week">สัปดาห์</ToggleButton>
              <ToggleButton value="month">เดือน</ToggleButton>
            </ToggleButtonGroup>
            {view === "month" ? (
              <>
                <Button variant="outlined" startIcon={<ChevronLeftIcon />} onClick={() => setMonth(shiftMonth(month, -1))}>
                  ก่อน
                </Button>
                <Button onClick={() => setMonth(bangkokToday().slice(0, 7))}>เดือนนี้</Button>
                <Button variant="outlined" endIcon={<ChevronRightIcon />} onClick={() => setMonth(shiftMonth(month, 1))}>
                  ถัดไป
                </Button>
              </>
            ) : (
              <>
                <Button variant="outlined" startIcon={<ChevronLeftIcon />} onClick={() => setWeekStart(addDaysISO(weekStart, -7))}>
                  ก่อน
                </Button>
                <Button onClick={() => setWeekStart(startOfWeekISO(bangkokToday()))}>สัปดาห์นี้</Button>
                <Button variant="outlined" endIcon={<ChevronRightIcon />} onClick={() => setWeekStart(addDaysISO(weekStart, 7))}>
                  ถัดไป
                </Button>
              </>
            )}
          </Stack>
        }
      />

      <WomsFilterPanel
        activeCount={(team ? 1 : 0) + (techId ? 1 : 0)}
        onClear={() => {
          setTeam("");
          setTechId("");
        }}
      >
        <WomsSelectFilter label="ทีมช่าง" value={team} onChange={setTeam} options={options?.teams ?? []} allLabel="ทุกทีม" freeTextFallback />
        {canFilterTech ? (
          <>
            <WomsSelectFilter label="ช่าง" value={techId} onChange={setTechId} options={techs} allLabel="ทุกช่าง" />
            <WomsSelectFilter
              label="จัดแถวตาม"
              value={groupBy}
              onChange={(v) => setGroupBy(v === "technician" ? "technician" : "team")}
              options={[
                { value: "team", label: "ทีมช่าง" },
                { value: "technician", label: "ช่างรายคน" },
              ]}
              noAll
            />
          </>
        ) : null}
      </WomsFilterPanel>

      <Stack spacing={1} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={segment}
            onChange={(_, v) => v && setSegment(v)}
            aria-label="แสดงรายการ"
            data-testid="calendar-segment"
          >
            {(["ALL", "ACTIVE", "HOLD"] as CalendarSegment[]).map((s) => (
              <ToggleButton key={s} value={s}>
                {CALENDAR_SEGMENT_LABEL[s]} ({counts[s]})
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary">
            งานพักแสดงที่วันนัดเดิมเพื่ออ้างอิง · งานปิด/ยกเลิกดูที่ “ประวัติงาน”
          </Typography>
        </Stack>
        <Legend />
      </Stack>

      {view === "month" ? monthBody : body}
    </>
  );
}
