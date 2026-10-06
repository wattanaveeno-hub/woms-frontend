"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
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
import type { CalendarResponse, Options } from "@/lib/types";
import { jobTypeLabel } from "@/lib/options";
import { addDaysISO, bangkokToday, dayMonthLabel, startOfWeekISO } from "@/lib/date";
import { monthGrid, shiftMonth } from "@/lib/calendarMonth";
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

export default function CalendarPage() {
  const theme = useTheme();
  // ต่ำกว่า md: แสดงเป็นรายการตามวัน (agenda) แทนตาราง 7 คอลัมน์ที่ต้องเลื่อนแนวนอน
  const narrow = useMediaQuery(theme.breakpoints.down("md"));
  // ยึด "วันนี้" ตามเวลาไทย ไม่ใช่เขตเวลาที่ตั้งไว้ในเครื่องผู้ใช้
  const [weekStart, setWeekStart] = useState<string>(() => startOfWeekISO(bangkokToday()));
  // JOB-04 / BR-01.5 — มุมมองรายเดือน (ช่างเห็นเฉพาะงานของตน — เซิร์ฟเวอร์กรองให้เสมอ)
  const [view, setView] = useState<"week" | "month">("week");
  const [month, setMonth] = useState<string>(() => bangkokToday().slice(0, 7));
  const [team, setTeam] = useState("");
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res =
        view === "month"
          ? await api.calendar({ month, team: team || undefined })
          : await api.calendar({ from, to, team: team || undefined });
      setData(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดปฏิทินไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [from, to, team, view, month]);

  useEffect(() => {
    api.getOptions().then(setOptions).catch(() => setOptions(null));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // งานที่ไม่ได้ "เปิด" ต้องบอกด้วยข้อความ ไม่ใช่สีอย่างเดียว (เดิมแยกแค่ CLOSED ด้วยสีเทา)
  const eventLink = (e: CalendarEvent) => {
    const muted = e.status !== "OPEN";
    return (
      <Box
        key={e.jobId}
        component={Link}
        href={`/jobs/${e.jobId}`}
        sx={{
          display: "block",
          fontSize: 12.5,
          lineHeight: 1.35,
          px: 0.75,
          py: 0.5,
          mb: 0.5,
          borderRadius: 1,
          borderLeft: 3,
          borderColor: muted ? "divider" : "primary.main",
          bgcolor: muted ? tokens.chip : tokens.accentBg,
          color: muted ? "text.secondary" : "text.primary",
          textDecoration: e.status === "CANCELLED" ? "line-through" : "none",
          "&:hover": { bgcolor: "#d8edee" },
          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
        }}
      >
        <Box component="span" className="mono" sx={{ fontSize: 11, opacity: 0.8 }}>
          {e.time || ""}
        </Box>{" "}
        {jobTypeLabel[e.jobType]} · {e.title}
        {muted ? ` (${statusLabel[e.status]})` : ""}
      </Box>
    );
  };

  const lanes = data?.lanes ?? [];
  const grid = view === "month" ? monthGrid(month) : [];
  const eventsOn = (d: string) =>
    lanes.flatMap((lane) => lane.events.filter((e) => e.date === d)).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const monthBody = loading ? (
    <WomsLoadingState rows={4} />
  ) : error ? (
    <WomsErrorState message={error} onRetry={load} />
  ) : narrow ? (
    // จอแคบ: แสดงเฉพาะวันที่มีงานของเดือนนี้ เรียงตามวัน
    (() => {
      const days = grid.filter((g) => g.inMonth && eventsOn(g.date).length);
      return days.length === 0 ? (
        <WomsEmptyState title="ไม่มีงานในเดือนนี้" />
      ) : (
        <Stack spacing={1.5}>
          {days.map((g) => (
            <Paper key={g.date} variant="outlined" sx={{ p: 1.5 }}>
              <Typography sx={{ fontWeight: 700, color: "text.primary", mb: 1 }}>
                {dayMonthLabel(g.date)}
                {g.date === bangkokToday() ? " · วันนี้" : ""}
              </Typography>
              {eventsOn(g.date).map((e) => (
                <Box key={e.jobId}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {e.team}
                  </Typography>
                  {eventLink(e)}
                </Box>
              ))}
            </Paper>
          ))}
        </Stack>
      );
    })()
  ) : (
    <Paper variant="outlined" sx={{ overflow: "hidden" }} aria-label={`ปฏิทินเดือน ${monthLabel(month)}`}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", bgcolor: tokens.ink, color: "#cdd9e1" }}>
        {DOW.map((d) => (
          <Box key={d} sx={{ p: 1, fontSize: 12.5, fontWeight: 600, borderLeft: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            {d}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
        {grid.map((g) => (
          <Box
            key={g.date}
            sx={{
              p: 0.75,
              minHeight: 96,
              borderTop: 1,
              borderLeft: 1,
              borderColor: "divider",
              minWidth: 0,
              bgcolor: g.inMonth ? undefined : tokens.surface2,
              opacity: g.inMonth ? 1 : 0.6,
            }}
          >
            <Typography
              variant="body2"
              sx={{ fontWeight: g.date === bangkokToday() ? 700 : 500, color: g.date === bangkokToday() ? "primary.main" : "text.secondary", mb: 0.5 }}
            >
              {Number(g.date.slice(8, 10))}
            </Typography>
            {g.inMonth ? eventsOn(g.date).map(eventLink) : null}
          </Box>
        ))}
      </Box>
    </Paper>
  );
  const body = loading ? (
    <WomsLoadingState rows={4} />
  ) : error ? (
    <WomsErrorState message={error} onRetry={load} />
  ) : lanes.length === 0 ? (
    <WomsEmptyState title="ไม่มีงานในสัปดาห์นี้" />
  ) : narrow ? (
    <Stack spacing={1.5}>
      {days.map((d, i) => {
        const perTeam = lanes
          .map((lane) => ({ team: lane.team, evs: lane.events.filter((e) => e.date === d) }))
          .filter((x) => x.evs.length);
        return (
          <Paper key={d} variant="outlined" sx={{ p: 1.5 }}>
            <Typography sx={{ fontWeight: 700, color: "text.primary", mb: perTeam.length ? 1 : 0 }}>
              {DOW[i]} {dayMonthLabel(d)}
              {d === bangkokToday() ? " · วันนี้" : ""}
            </Typography>
            {perTeam.length === 0 ? (
              <Typography variant="body2">ไม่มีงาน</Typography>
            ) : (
              perTeam.map((x) => (
                <Box key={x.team} sx={{ mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {x.team}
                  </Typography>
                  {x.evs.map(eventLink)}
                </Box>
              ))
            )}
          </Paper>
        );
      })}
    </Stack>
  ) : (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "140px repeat(7, minmax(0, 1fr))", bgcolor: tokens.ink, color: "#cdd9e1" }}>
        <Box sx={{ p: 1, fontWeight: 700, bgcolor: tokens.slate, color: "#fff", fontSize: 13 }}>ทีมช่าง</Box>
        {days.map((d, i) => (
          <Box key={d} sx={{ p: 1, fontSize: 12.5, fontWeight: 600, borderLeft: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            {DOW[i]} {dayMonthLabel(d)}
          </Box>
        ))}
      </Box>
      {lanes.map((lane) => (
        <Box
          key={lane.team}
          sx={{ display: "grid", gridTemplateColumns: "140px repeat(7, minmax(0, 1fr))", borderTop: 1, borderColor: "divider" }}
        >
          <Box sx={{ p: 1, fontWeight: 600, fontSize: 13, bgcolor: tokens.surface2, color: "text.primary" }}>{lane.team}</Box>
          {days.map((d) => (
            // คีย์ของช่อง = วันที่เดียวกับที่ใช้ query และที่แสดงบนหัวคอลัมน์
            <Box key={d} sx={{ p: 0.75, minHeight: 64, borderLeft: 1, borderColor: "divider", minWidth: 0 }}>
              {lane.events.filter((e) => e.date === d).map(eventLink)}
            </Box>
          ))}
        </Box>
      ))}
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
              แยกตามทีมช่าง · <span className="mono">{from} → {to}</span>
            </>
          )
        }
        actions={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
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

      <WomsFilterPanel activeCount={team ? 1 : 0} onClear={() => setTeam("")}>
        <WomsSelectFilter label="ทีมช่าง" value={team} onChange={setTeam} options={options?.teams ?? []} allLabel="ทุกทีม" freeTextFallback />
      </WomsFilterPanel>

      {view === "month" ? monthBody : body}
    </>
  );
}
