"use client";

// Phase 3 (ENTECH design JobDetail · แท็บภาพรวม): การ์ด "หลักฐานปิดงาน" + "บันทึกจากช่าง"
// สถานะทุกข้ออ่านจาก backend: GET /api/jobs/:id/close-check (เกณฑ์เดียวกับตอนกดปิดงาน) และข้อมูลใบงาน/เครื่องที่โหลดแล้ว
// ไม่ได้ตรวจเอง ไม่ได้เปลี่ยนกติกาปิดงาน — การปิดงานจริงยังอยู่ในแท็บ "ปิดงาน & หลักฐาน"
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { api, ApiError } from "@/lib/api";
import type { Job, JobEquipmentLine } from "@/lib/types";
import { closeEvidenceItems, type CloseCheckResult } from "@/lib/closeEvidence";
import { WomsFormSection } from "@/components/woms";

const MARK = { ok: "✓", missing: "!", "at-close": "○" } as const;
const TONE = {
  ok: { bg: "#e1f1e4", fg: "#14432a" },
  missing: { bg: "#fdf3e1", fg: "#8a5606" },
  "at-close": { bg: "#eef2f5", fg: "#51626f" },
} as const;

export default function JobCloseEvidenceCard({
  job,
  lines,
  onOpenClose,
}: {
  job: Job;
  lines: JobEquipmentLine[];
  /** เปิดแท็บปิดงาน (มีเมื่อผู้ใช้ปิดงานได้) */
  onOpenClose?: () => void;
}) {
  const [check, setCheck] = useState<CloseCheckResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setErr(null);
    if (job.status === "CLOSED") {
      setCheck(null);
      return;
    }
    api
      .jobCloseCheck(job.jobId)
      .then((r) => alive && setCheck(r))
      .catch((e) => alive && setErr(e instanceof ApiError ? e.message : "ตรวจความพร้อมปิดงานไม่สำเร็จ"));
    return () => {
      alive = false;
    };
  }, [job.jobId, job.status, job.updatedAt, lines.length]);

  if (job.status === "CANCELLED") return null;
  const items = closeEvidenceItems(job as Job & { closeSignoffId?: string }, check);
  const ok = items.filter((i) => i.state === "ok").length;
  const closed = job.status === "CLOSED";
  const notes = [
    ...lines.filter((l) => (l as JobEquipmentLine & { resultNote?: string }).resultNote).map((l) => ({
      who: `${l.serial || "เครื่อง"}`,
      text: String((l as JobEquipmentLine & { resultNote?: string }).resultNote),
    })),
    ...(job.closeNote ? [{ who: "หมายเหตุปิดงาน", text: job.closeNote }] : []),
  ];

  return (
    <WomsFormSection
      title="หลักฐานปิดงาน"
      actions={
        onOpenClose && !closed ? (
          <Button size="small" variant="outlined" onClick={onOpenClose}>
            ไปที่ปิดงาน
          </Button>
        ) : undefined
      }
    >
      <Box data-testid="job-close-evidence">
        {err ? (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            {err}
          </Alert>
        ) : null}
        <Typography variant="body2" sx={{ mb: 1.5 }} data-testid="job-close-evidence-summary">
          {closed
            ? `ปิดงานแล้ว — หลักฐานครบ ${ok} จาก ${items.length}`
            : check
              ? check.canClose
                ? `พร้อมปิดงาน (ผลตรวจจากระบบ) — เหลือลายเซ็นลูกค้าและช่างตอนกดปิดงาน`
                : `ยังปิดงานไม่ได้ — ครบ ${ok} จาก ${items.length} · ลายเซ็นลูกค้าและช่างเก็บตอนกดปิดงาน`
              : err
                ? "แสดงสถานะไม่ได้"
                : "กำลังตรวจความพร้อมปิดงาน…"}
        </Typography>
        <Stack component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
          {items.map((it, i) => (
            <Box
              component="li"
              key={`${it.key}-${i}`}
              data-key={it.key}
              data-state={it.state}
              sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", py: 1.25, borderTop: i ? "1px solid #e2e7ec" : 0 }}
            >
              <Box
                component="span"
                aria-hidden="true"
                sx={{ flex: "0 0 auto", width: 24, height: 24, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, bgcolor: TONE[it.state].bg, color: TONE[it.state].fg }}
              >
                {MARK[it.state]}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: "text.primary", fontWeight: it.state === "missing" ? 600 : 400 }}>
                  {it.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  {it.state === "at-close" ? "เซ็นในขั้นปิดงาน (บังคับ)" : it.state === "ok" ? "ครบ" : it.detail ?? "ยังไม่ครบ"}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
        {notes.length ? (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h3" component="h3" sx={{ fontSize: 15, mb: 1 }}>
              บันทึกจากช่าง
            </Typography>
            <Stack spacing={1}>
              {notes.map((n, i) => (
                <Box key={i} sx={{ bgcolor: "#f6f8fa", border: "1px solid #e2e7ec", borderRadius: 1, p: 1.25 }}>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {n.who}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.primary", whiteSpace: "pre-wrap" }}>
                    {n.text}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        ) : null}
      </Box>
    </WomsFormSection>
  );
}
