"use client";
/**
 * บอร์ดคิวช่าง (Redesign 12 พ.ย. 69) — คอลัมน์ตามขั้นของคิว บอกชัดว่าใครต้องทำต่อ
 *   รอจัดช่าง (Admin) → รอช่างตอบ (ช่าง) → ช่างตอบแล้ว รอ Admin รับคิว (Admin) → รอลูกค้ายืนยัน (เซลล์) → พร้อมเปิด JN (Admin)
 *   การ์ดเรียงจากรอนานที่สุด · กดการ์ดเปิดหน้าคิวเพื่อทำขั้นถัดไป (ปุ่มทำงานจริงอยู่หน้ารายละเอียดเหมือนเดิม)
 *   Phase 4 (P4-04): ปุ่มขั้นถัดไปบนการ์ดตาม design — เป็นลิงก์ไปหน้ารายละเอียดคิว ไม่เรียก API เอง
 *   (ไม่เปลี่ยน state machine/สิทธิ์ · การยืนยันจริงยังทำที่หน้ารายละเอียด) · ปุ่ม "โทร" เฉพาะคิวรอลูกค้ายืนยัน
 *   UAT 2026-11-16 (Owner): ปุ่มเขียวกดทำขั้นถัดไปได้เลยบนบอร์ด (จัดช่าง / รับคิว / ลูกค้ายืนยัน / เปิดงาน) ไม่ต้องเข้าหน้าคิว
 *     ปุ่มแสดงตาม queueButtons เดียวกับหน้ารายละเอียด (backend ตรวจสิทธิ์/สถานะซ้ำ) · วันที่ช่างเสนอแสดงเด่นบนการ์ด
 */
import { useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ServiceQueue } from "@/lib/serviceQueueApi";
import { jnLabel, queueButtons, queueNoLabel, type SqStatus } from "@/lib/serviceQueueRules";
import { apptText, typeLabel } from "@/components/serviceQueue/QueueBits";
import { sqApi } from "@/lib/serviceQueueApi";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useDialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import AssignDialog from "@/components/serviceQueue/AssignDialog";

const COLUMNS: { status: SqStatus; title: string; who: string; mine: boolean; next: string; primary: boolean }[] = [
  { status: "WAIT_ASSIGN", title: "รอจัดช่าง", who: "Admin ต้องทำ", mine: true, next: "เลือกช่าง", primary: true },
  { status: "WAIT_TECH", title: "รอช่างตอบ", who: "ช่างต้องเสนอวัน", mine: false, next: "ดูคิว", primary: false },
  { status: "TECH_REPLIED", title: "ช่างตอบแล้ว · รอ Admin รับคิว", who: "Admin ต้องทำ", mine: true, next: "รับคิว", primary: true },
  { status: "WAIT_CUSTOMER", title: "รอลูกค้ายืนยัน", who: "เซลล์ติดตามลูกค้า", mine: false, next: "ลูกค้ายืนยันแล้ว", primary: false },
  { status: "READY_TO_OPEN", title: "พร้อมเปิด JN", who: "Admin ต้องทำ", mine: true, next: "เปิดงาน", primary: true },
];

function waited(iso: string): { text: string; tone: string } {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return { text: "", tone: "#51626f" };
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  const text = min < 60 ? `รอ ${min} นาที` : min < 60 * 24 ? `รอ ${Math.round(min / 60)} ชม.` : `รอ ${Math.round(min / 1440)} วัน`;
  const tone = min >= 24 * 60 ? "#b3261e" : min >= 120 ? "#8a5606" : "#51626f";
  return { text, tone };
}

type Step = "assign" | "accept" | "confirm" | "openJob" | "releaseReschedule";

export default function QueueBoard({ rows, onChanged }: { rows: ServiceQueue[]; onChanged?: () => void }) {
  const { user, has } = useAuth();
  const dialog = useDialog();
  const toast = useToast();
  const [busyId, setBusyId] = useState("");
  const [assignFor, setAssignFor] = useState<ServiceQueue | null>(null);
  const stepOf = (r: ServiceQueue): Step | null => {
    const b = user ? queueButtons(r, { id: user.id, has }) : [];
    for (const k of ["assign", "accept", "confirm", "openJob", "releaseReschedule"] as const) if (b.includes(k)) return k;
    return null;
  };
  const after = () => {
    window.dispatchEvent(new Event("woms:queue-changed"));
    onChanged?.();
  };
  const doStep = async (r: ServiceQueue, step: Step) => {
    if (step === "assign") return setAssignFor(r);
    const appt = r.current ? apptText(r.current.date ?? "", r.current.time ?? "", r.current.period ?? "") : "";
    const cfg = {
      accept: { title: `รับคิว ${r.queueNo}`, message: `รับวันเวลาที่ช่าง ${r.techName ?? ""} เสนอ: ${appt} — คิวจะเข้าสู่ "รอลูกค้าคอนเฟิร์ม" และแจ้งเซลล์เจ้าของงาน`, confirmLabel: "รับคิว", done: "รับคิวแล้ว — รอลูกค้าคอนเฟิร์ม", call: () => sqApi.accept(r.id, r.roundNo) },
      confirm: { title: `ลูกค้าคอนเฟิร์ม ${r.queueNo}`, message: `ยืนยันว่าลูกค้าคอนเฟิร์ม ${appt} — คิวจะรอ Admin ตรวจและเปิดงาน`, confirmLabel: "คอนเฟิร์มลูกค้า", done: "บันทึกลูกค้าคอนเฟิร์มแล้ว", call: () => sqApi.confirm(r.id, r.roundNo) },
      openJob: { title: `เปิดงานและออก JN — ${r.queueNo}`, message: `ระบบจะออก JN และผูกคิวกับใบงาน · ช่าง ${r.techName ?? ""} · ${appt} · เครื่องที่ยังไม่มี SN จะแสดง Pending Serial`, confirmLabel: "เปิดงาน", done: "เปิดงานแล้ว", call: () => sqApi.release(r.id, r.roundNo) },
      releaseReschedule: { title: `ส่งงานเดิมกลับ — ${r.queueNo}`, message: `อัปเดตวันนัดและช่างในใบงาน ${r.jobId} เดิม (ไม่สร้าง JN ใหม่) · ช่าง ${r.techName ?? ""} · ${appt}`, confirmLabel: "ยืนยันส่งงานกลับ", done: "ส่งงานกลับแล้ว", call: () => sqApi.release(r.id, r.roundNo) },
    }[step];
    if (!(await dialog.confirm({ title: cfg.title, message: cfg.message, confirmLabel: cfg.confirmLabel }))) return;
    setBusyId(r.id);
    try {
      await cfg.call();
      toast.success(cfg.done);
      after();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusyId("");
    }
  };
  return (
    <>
    <AssignDialog
      open={!!assignFor}
      reassign={false}
      currentTechId=""
      onClose={() => setAssignFor(null)}
      onSubmit={async (techId, note) => {
        const r = assignFor!;
        try {
          await sqApi.assign(r.id, r.version, techId, note);
          toast.success(`จัดช่างให้ ${r.queueNo} แล้ว`);
          setAssignFor(null);
          after();
        } catch (e) {
          toast.error(e instanceof ApiError ? e.message : "จัดช่างไม่สำเร็จ");
        }
      }}
    />
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
                const step = stepOf(r);
                // วันที่ช่างเสนอ/วันนัด เด่นบนการ์ด (ไม่ต้องกดเข้าไปดู)
                const apptLabel = c.status === "TECH_REPLIED" ? "ช่างเสนอ" : c.status === "WAIT_CUSTOMER" ? "รอลูกค้ายืนยันวัน" : c.status === "READY_TO_OPEN" ? "วันนัด" : "";
                return (
                  <Box
                    key={r.id}
                    data-testid="queue-card"
                    sx={{
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.25,
                      p: 1.5,
                      bgcolor: "#fff",
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1.5,
                      "&:hover": { borderColor: "primary.main" },
                    }}
                  >
                    {/* ลิงก์หลักคลุมทั้งการ์ด (stretched link) — ปุ่มด้านล่างอยู่เหนือ overlay */}
                    <Typography
                      component={Link}
                      href={`/service-queue/${r.id}`}
                      sx={{
                        fontWeight: 600,
                        color: "text.primary",
                        lineHeight: 1.35,
                        textDecoration: "none",
                        "&::after": { content: '""', position: "absolute", inset: 0, borderRadius: 1.5 },
                        "&:focus-visible": { outline: "none" },
                        "&:focus-visible::after": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                      }}
                    >
                      {r.jobName || typeLabel(r.jobType)}
                    </Typography>
                    <Typography variant="body2">
                      {typeLabel(r.jobType)} · {queueNoLabel(r)}
                      {r.ownerSaleName ? ` · เซลล์ ${r.ownerSaleName}` : ""}
                    </Typography>
                    {/* UAT2-13: คิวเลื่อนงาน (มี JN เดิม) แสดง JN ชัดบนการ์ด */}
                    {r.jobId ? (
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "primary.main" }} data-testid="board-jn">
                        {jnLabel(r.jobId)}
                      </Typography>
                    ) : null}
                    {appt && apptLabel ? (
                      <Box sx={{ mt: 0.5, px: 1, py: 0.5, borderRadius: 1, bgcolor: "#eef5f0", border: "1px solid #cfe3d6" }} data-testid="board-appt">
                        <Typography sx={{ fontSize: 12, color: "#3d6340", fontWeight: 600 }}>{apptLabel}</Typography>
                        <Typography sx={{ fontSize: 15, fontWeight: 700, color: "text.primary" }}>{appt}</Typography>
                      </Box>
                    ) : null}
                    {r.techName || (appt && !apptLabel) ? (
                      <Typography variant="body2" sx={{ fontSize: 13 }}>
                        {[apptLabel ? "" : appt, r.techName ? `ช่าง ${r.techName}` : ""].filter(Boolean).join(" · ")}
                      </Typography>
                    ) : null}
                    {w.text ? (
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: w.tone }}>
                        {w.text}
                      </Typography>
                    ) : null}
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.75, position: "relative", zIndex: 1 }}>
                      {step ? (
                        <Button
                          size="small"
                          variant="contained"
                          disabled={busyId === r.id}
                          onClick={() => void doStep(r, step)}
                          aria-label={`${c.next} — ${queueNoLabel(r)}`}
                          data-testid="queue-card-next"
                          data-step={step}
                        >
                          {step === "releaseReschedule" ? "ส่งงานกลับ" : c.next}
                        </Button>
                      ) : null}
                      <Button
                        component={Link}
                        href={`/service-queue/${r.id}`}
                        size="small"
                        variant={step ? "text" : c.primary ? "contained" : "outlined"}
                        aria-label={`ดูคิว ${queueNoLabel(r)}`}
                        data-testid="queue-card-open"
                      >
                        ดูคิว
                      </Button>
                      {c.status === "WAIT_CUSTOMER" && r.phone ? (
                        <Button component="a" href={`tel:${r.phone.replace(/[^0-9+]/g, "")}`} size="small" variant="outlined" aria-label={`โทร ${r.contactName || ""} ${r.phone}`.trim()} data-testid="queue-card-call">
                          โทร
                        </Button>
                      ) : null}
                    </Stack>
                  </Box>
                );
              })
            )}
          </Paper>
        );
      })}
    </Box>
    </>
  );
}
