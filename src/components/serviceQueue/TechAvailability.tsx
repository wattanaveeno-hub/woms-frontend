"use client";

// ---------------------------------------------------------------------------
// UAT2-01 — ปฏิทินว่าง/ไม่ว่างของช่าง 14 วันข้างหน้า แสดงตอนเสนอวันเวลาคิว
//   อ่านจาก GET /api/calendar (สิทธิ์ calendar:view เดิม · ช่างเห็นเฉพาะงานของตัวเองตาม RBAC เดิม)
//   นับเฉพาะนัดที่ต้องไปจริง (ใบงานเปิดอยู่ ไม่ใช่งานพัก/ปิด/ยกเลิก) · กดวันเพื่อเลือกวันนั้น
//   อ่านอย่างเดียว ไม่จองหรือล็อกวัน — การชนเวลายังเตือนด้วย /api/service-queue/conflicts เหมือนเดิม
// ---------------------------------------------------------------------------
import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { api } from "@/lib/api";
import type { CalendarEvent } from "@/lib/types";
import { bangkokToday } from "@/lib/date";
import { addDaysISO as addDays, agendaByDate, appointmentsByDate, PROPOSED_QUEUE_STATUSES, type ProposedSlot } from "@/lib/availabilityRules";
import { sqApi } from "@/lib/serviceQueueApi";
import { tokens as t } from "@/theme/tokens";

const DAYS = 14;
const WD = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

export default function TechAvailability({
  techId,
  value,
  onPick,
  excludeQueueId = "",
}: {
  techId: string;
  value?: string;
  onPick?: (date: string) => void;
  /** คิวที่กำลังเสนออยู่ — ไม่นับเป็น "เสนอแล้ว" */
  excludeQueueId?: string;
}) {
  const today = bangkokToday();
  const to = addDays(today, DAYS - 1);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!techId) return;
    let alive = true;
    setEvents(null);
    setErr(false);
    api
      .calendar({ from: today, to, technicianId: techId, groupBy: "technician" })
      .then((r) => alive && setEvents(r.lanes.flatMap((l) => l.events)))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [techId, today, to]);

  // UAT 2026-11-16: คิวที่ช่างเสนอวันไปแล้ว (ยังไม่เป็นใบงาน) — โหลดไม่ได้ = แสดงเฉพาะนัดจริง
  const [proposals, setProposals] = useState<ProposedSlot[]>([]);
  useEffect(() => {
    if (!techId) return;
    let alive = true;
    sqApi
      .list({ techId, status: PROPOSED_QUEUE_STATUSES.join(",") })
      .then((r) =>
        alive &&
        setProposals(
          r.items.map((q) => ({ queueId: q.id, queueNo: q.queueNo, date: q.apptDate || q.current?.date || "", time: q.apptTime || q.current?.time || "", title: q.jobName || "", status: q.status }))
        )
      )
      .catch(() => alive && setProposals([]));
    return () => {
      alive = false;
    };
  }, [techId]);
  const byDate = useMemo(() => agendaByDate(appointmentsByDate(events ?? []), proposals, excludeQueueId), [events, proposals, excludeQueueId]);
  const picked = value ? byDate.get(value) ?? [] : [];

  if (!techId) return null;
  return (
    <Box data-testid="tech-availability">
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: t.slate, mb: 0.75 }}>ปฏิทินช่าง 14 วันข้างหน้า · กดวันเพื่อเลือก</Typography>
      {err ? (
        <Typography variant="body2">โหลดปฏิทินช่างไม่สำเร็จ — ยังเสนอวันได้ตามปกติ</Typography>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 0.5 }}>
          {Array.from({ length: DAYS }, (_, i) => {
            const d = addDays(today, i);
            const list = byDate.get(d) ?? [];
            const n = list.length;
            const on = value === d;
            const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
            const tone = events === null ? "#eef2f5" : n === 0 ? "#eef3ec" : n <= 2 ? "#fdf3e2" : "#fbeceb";
            const ink = events === null ? t.slate2 : n === 0 ? "#3d6340" : n <= 2 ? "#8a5606" : t.danger;
            const tip = events === null ? "กำลังโหลด…" : n === 0 ? "ว่างทั้งวัน" : list.map((e) => `${e.time || "ไม่ระบุเวลา"} ${e.text}`).join("\n");
            return (
              <Tooltip key={d} title={<span style={{ whiteSpace: "pre-line" }}>{tip}</span>}>
                <ButtonBase
                  onClick={() => onPick?.(d)}
                  aria-pressed={on}
                  aria-label={`${d} ${n === 0 ? "ว่าง" : `มีงาน ${n} งาน`}`}
                  data-date={d}
                  data-count={n}
                  sx={{
                    flexDirection: "column",
                    py: 0.75,
                    borderRadius: 1,
                    bgcolor: tone,
                    color: ink,
                    border: on ? `2px solid ${t.accent}` : "2px solid transparent",
                    fontFamily: "inherit",
                  }}
                >
                  <Box component="span" sx={{ fontSize: 11, fontWeight: 600 }}>
                    {WD[wd]} {Number(d.slice(8, 10))}
                  </Box>
                  <Box component="span" sx={{ fontSize: 12, fontWeight: 700 }}>
                    {events === null ? "…" : n === 0 ? "ว่าง" : `${n} งาน`}
                  </Box>
                  {/* ช่วงเวลาที่ไม่ว่างแสดงบนช่องเลย (มือถือไม่มี tooltip) */}
                  {n ? (
                    <Box component="span" sx={{ fontSize: 10, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
                      {list
                        .slice(0, 2)
                        .map((e) => e.time || "—")
                        .join(" ")}
                      {n > 2 ? " …" : ""}
                    </Box>
                  ) : null}
                </ButtonBase>
              </Tooltip>
            );
          })}
        </Box>
      )}
      {value && events !== null ? (
        <Box sx={{ mt: 1, p: 1, borderRadius: 1, bgcolor: "#f6f8f9" }} data-testid="tech-day-agenda">
          <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>
            {picked.length ? `วันที่เลือกไม่ว่างช่วงเวลาเหล่านี้` : "วันที่เลือกว่างทั้งวัน"}
          </Typography>
          {picked.map((a, i) => (
            <Typography key={i} sx={{ fontSize: 13, color: a.kind === "PROPOSED" ? "#8a5606" : t.slate }} data-kind={a.kind}>
              <b style={{ fontVariantNumeric: "tabular-nums" }}>{a.time || "ไม่ระบุเวลา"}</b> {a.text}
            </Typography>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
