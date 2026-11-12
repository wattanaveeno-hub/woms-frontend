"use client";
/**
 * บอร์ดคิวช่าง (Redesign 12 พ.ย. 69) — คอลัมน์ตามขั้นของคิว บอกชัดว่าใครต้องทำต่อ
 *   รอจัดช่าง (Admin) → รอช่างตอบ (ช่าง) → ช่างตอบแล้ว รอ Admin รับคิว (Admin) → รอลูกค้ายืนยัน (เซลล์) → พร้อมเปิด JN (Admin)
 *   การ์ดเรียงจากรอนานที่สุด · กดการ์ดเปิดหน้าคิวเพื่อทำขั้นถัดไป (ปุ่มทำงานจริงอยู่หน้ารายละเอียดเหมือนเดิม)
 */
import Link from "next/link";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ServiceQueue } from "@/lib/serviceQueueApi";
import { queueNoLabel, type SqStatus } from "@/lib/serviceQueueRules";
import { apptText, typeLabel } from "@/components/serviceQueue/QueueBits";

const COLUMNS: { status: SqStatus; title: string; who: string; mine: boolean }[] = [
  { status: "WAIT_ASSIGN", title: "รอจัดช่าง", who: "Admin ต้องทำ", mine: true },
  { status: "WAIT_TECH", title: "รอช่างตอบ", who: "ช่างต้องเสนอวัน", mine: false },
  { status: "TECH_REPLIED", title: "ช่างตอบแล้ว · รอ Admin รับคิว", who: "Admin ต้องทำ", mine: true },
  { status: "WAIT_CUSTOMER", title: "รอลูกค้ายืนยัน", who: "เซลล์ติดตามลูกค้า", mine: false },
  { status: "READY_TO_OPEN", title: "พร้อมเปิด JN", who: "Admin ต้องทำ", mine: true },
];

function waited(iso: string): { text: string; tone: string } {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return { text: "", tone: "#51626f" };
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  const text = min < 60 ? `รอ ${min} นาที` : min < 60 * 24 ? `รอ ${Math.round(min / 60)} ชม.` : `รอ ${Math.round(min / 1440)} วัน`;
  const tone = min >= 24 * 60 ? "#b3261e" : min >= 120 ? "#8a5606" : "#51626f";
  return { text, tone };
}

export default function QueueBoard({ rows }: { rows: ServiceQueue[] }) {
  return (
    <Box
      sx={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: { xs: "minmax(260px, 85%)", md: "minmax(190px, 1fr)" }, gap: 1.5, overflowX: "auto", pb: 1, mb: 2 }}
      data-testid="queue-board"
    >
      {COLUMNS.map((c) => {
        const items = rows
          .filter((r) => r.status === c.status)
          .sort((a, b) => (a.updatedAt || a.createdAt || "").localeCompare(b.updatedAt || b.createdAt || ""));
        return (
          <Paper
            key={c.status}
            variant="outlined"
            component="section"
            aria-label={c.title}
            sx={{ bgcolor: "#f6f8fa", p: 1.25, display: "flex", flexDirection: "column", gap: 1, minWidth: 0, alignSelf: "start" }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ px: 0.5, pt: 0.5 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: "text.primary", lineHeight: 1.3 }}>{c.title}</Typography>
                <Typography variant="caption" sx={{ color: c.mine ? "#8a5606" : "text.secondary", fontWeight: c.mine ? 600 : 400 }}>
                  {c.who}
                </Typography>
              </Box>
              <Box
                sx={{
                  minWidth: 26,
                  height: 22,
                  px: 0.75,
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 700,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: items.length && c.mine ? "#b3261e" : "#2e3f4f",
                  color: "#fff",
                }}
              >
                {items.length}
              </Box>
            </Stack>
            {items.length === 0 ? (
              <Typography variant="body2" sx={{ px: 0.5, py: 1 }}>
                ไม่มีคิว
              </Typography>
            ) : (
              items.map((r) => {
                const w = waited(r.updatedAt || r.createdAt);
                const appt = r.current ? apptText(r.current.date ?? "", r.current.time ?? "", r.current.period ?? "") : "";
                return (
                  <Box
                    key={r.id}
                    component={Link}
                    href={`/service-queue/${r.id}`}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.25,
                      p: 1.5,
                      bgcolor: "#fff",
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1.5,
                      textDecoration: "none",
                      color: "inherit",
                      "&:hover": { borderColor: "primary.main" },
                    }}
                  >
                    <Typography sx={{ fontWeight: 600, color: "text.primary", lineHeight: 1.35 }}>{r.jobName || typeLabel(r.jobType)}</Typography>
                    <Typography variant="body2" noWrap>
                      {typeLabel(r.jobType)} · {queueNoLabel(r)}
                      {r.ownerSaleName ? ` · เซลล์ ${r.ownerSaleName}` : ""}
                    </Typography>
                    {r.techName || appt ? (
                      <Typography variant="body2" sx={{ fontSize: 13 }} noWrap>
                        {[appt, r.techName ? `ช่าง ${r.techName}` : ""].filter(Boolean).join(" · ")}
                      </Typography>
                    ) : null}
                    {w.text ? (
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: w.tone }}>
                        {w.text}
                      </Typography>
                    ) : null}
                  </Box>
                );
              })
            )}
          </Paper>
        );
      })}
    </Box>
  );
}
