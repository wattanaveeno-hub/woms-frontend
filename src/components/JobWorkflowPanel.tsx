"use client";

// ---------------------------------------------------------------------------
// แผงจัดการสถานะใบงาน (เพิ่มรอบ Requirement.xlsx)
// ---------------------------------------------------------------------------
// ครอบคลุมสิ่งที่ชีตหลักระบุแต่ระบบเดิมไม่มี:
//   * การยกเลิกงาน (เดิมมีแค่เปิด/ปิด)
//   * ช่างรับทราบงาน / กำลังดำเนินการ (TECH-FN-005, TECH-FN-006)
//   * ช่างแจ้ง Admin เมื่อเข้าไม่ทัน / ขอเลื่อนวัน และ Admin อนุมัติ
//   * Admin บันทึกรายรับ/ค่าใช้จ่ายของใบงาน
//
// หมายเหตุ: "ช่างส่งตรวจ" ยังใช้ทางเดิมคือแท็ก #ส่งงาน ในห้องแชทของใบงาน
// แผงนี้จึงแสดงขั้น SUBMITTED ให้เห็น แต่ไม่สร้างช่องทางส่งงานซ้ำซ้อน

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import type { Job, JobStage, RescheduleReason } from "@/lib/types";
import { JOB_STAGE_LABEL, RESCHEDULE_REASON_LABEL } from "@/lib/types";
import { bangkokDateTime } from "@/lib/date";
import { MONEY_MAX, parseMoney, useFieldErrors } from "@/components/FieldErrors";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { WomsFormSection, WomsStatusChip } from "@/components/woms";

const REASONS: RescheduleReason[] = ["LATE", "IN_PROGRESS", "POSTPONE"];

export default function JobWorkflowPanel({
  job,
  onChanged,
}: {
  job: Job;
  onChanged: (job: Job) => void;
}) {
  const { has } = useAuth();
  const toast = useToast();
  const dialog = useDialog();
  const canEdit = has("jobs:edit");
  const canClose = has("jobs:close");

  const [stage, setStage] = useState<JobStage | null>(null);
  const [busy, setBusy] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [reason, setReason] = useState<RescheduleReason>("LATE");
  const [note, setNote] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [revenue, setRevenue] = useState(String(job.revenueAmount ?? 0));
  const [cost, setCost] = useState(String(job.costAmount ?? 0));
  const [financeNote, setFinanceNote] = useState(job.financeNote ?? "");
  // QA BUG-011 — ช่องเงินเคยเป็น text ที่ไม่ตรวจอะไรเลย: "abc" → 0 เงียบ ๆ, "1e5" → 100,000 เงียบ ๆ
  const finErr = useFieldErrors("fin");

  const loadStage = useCallback(async () => {
    try {
      const r = await api.jobStage(job.jobId);
      setStage(r.stage);
    } catch {
      setStage(null);
    }
  }, [job.jobId]);

  useEffect(() => {
    loadStage();
  }, [loadStage]);

  const act = async (fn: () => Promise<Job>, okMsg: string) => {
    setBusy(true);
    try {
      const updated = await fn();
      onChanged(updated);
      await loadStage();
      toast.success(okMsg);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  /**
   * QA BUG-011 — ตรวจที่หน้าเว็บด้วยกติกาเดียวกับที่ backend เพิ่งบังคับไว้
   * และแสดงข้อความผิดพลาด "ข้างช่องที่ผิด" ไม่ใช่กลืนหายหรือขึ้นเป็น toast ลอย ๆ
   */
  const saveFinance = async () => {
    finErr.clear();
    const rev = parseMoney(revenue);
    if (!rev.ok) {
      finErr.setIssue("revenueAmount", rev.message);
      return;
    }
    const cst = parseMoney(cost);
    if (!cst.ok) {
      finErr.setIssue("costAmount", cst.message);
      return;
    }
    setBusy(true);
    try {
      const updated = await api.setJobFinance(
        job.jobId,
        { revenueAmount: rev.value, costAmount: cst.value, financeNote },
        job.updatedAt
      );
      onChanged(updated);
      await loadStage();
      toast.success("บันทึกยอดแล้ว");
    } catch (e) {
      if (!finErr.fromApi(e, ["revenueAmount", "costAmount", "financeNote"])) {
        toast.error(e instanceof ApiError ? e.message : "บันทึกยอดไม่สำเร็จ");
      }
    } finally {
      setBusy(false);
    }
  };

  const pending = (job.rescheduleRequests ?? []).filter((r) => r.status === "PENDING");
  const history = (job.rescheduleRequests ?? []).filter((r) => r.status !== "PENDING");
  const active = job.status === "OPEN";

  const reasonPrompt = (title: string, message: string, extra: Partial<Parameters<typeof dialog.prompt>[0]> = {}) =>
    dialog.prompt({
      title,
      message,
      label: "เหตุผล",
      type: "textarea",
      required: true,
      validate: (v) => (v.trim().length < 3 ? "ต้องระบุเหตุผลอย่างน้อย 3 ตัวอักษร" : null),
      ...extra,
    });

  // QA BUG-016 — การยกเลิกใบงานย้อนกลับไม่ได้: ถามเหตุผล + ยืนยันในขั้นตอนเดียว ปุ่มยืนยันสีอันตราย
  const cancelJob = async () => {
    const r = await reasonPrompt(
      `ยกเลิกใบงาน ${job.jobId}?`,
      "การยกเลิกใบงานย้อนกลับไม่ได้ — ใบงานจะแก้ไขต่อไม่ได้และวางบิลไม่ได้",
      {
        label: "เหตุผลที่ยกเลิก",
        help: "เหตุผลนี้จะถูกบันทึกไว้บนใบงานอย่างถาวร",
        confirmLabel: "ยืนยันยกเลิกใบงาน",
        cancelLabel: "ไม่ยกเลิก",
        danger: true,
      }
    );
    if (r === null) return;
    act(() => api.cancelJob(job.jobId, r.trim(), job.updatedAt), "ยกเลิกใบงานแล้ว");
  };

  return (
    <WomsFormSection
      title="ขั้นของงาน"
      titleAdornment={stage ? <WomsStatusChip label={JOB_STAGE_LABEL[stage]} tone="info" /> : null}
    >
      {stage === "SUBMITTED" && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          ช่างส่งตรวจแล้ว — รอผู้ตรวจยืนยันปิดงานในห้องแชทของใบงานนี้ (สถานะใบงานยังเป็น “เปิดงาน” จนกว่าจะยืนยัน)
        </Alert>
      )}
      {job.status === "CANCELLED" && (
        <Alert severity="error" sx={{ mb: 2 }}>
          ยกเลิกเมื่อ {bangkokDateTime(job.cancelledAt)}
          {job.cancelledBy ? ` โดย ${job.cancelledBy}` : ""}
          {job.cancelReason ? ` — ${job.cancelReason}` : ""}
        </Alert>
      )}
      {job.status === "HOLD" && (
        <Alert severity="info" sx={{ mb: 2 }}>
          พักงานเมื่อ {bangkokDateTime(job.holdAt ?? "")}
          {job.holdBy ? ` โดย ${job.holdBy}` : ""}
          {job.holdReason ? ` — ${job.holdReason}` : ""} · ปิดงานและเปลี่ยนขั้นไม่ได้จนกว่าจะกลับมาดำเนินการ
        </Alert>
      )}

      {job.status === "HOLD" && canEdit && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <Button
            variant="contained"
            disabled={busy}
            onClick={async () => {
              const r = await dialog.prompt({
                title: `กลับมาดำเนินการใบงาน ${job.jobId}`,
                message: "เลือกวันนัดใหม่ หรือเว้นว่างเพื่อใช้วันนัดเดิม ระบบจะแจ้งช่างอีกครั้ง",
                label: "วันนัดใหม่",
                type: "date",
                defaultValue: job.jobDate,
                confirmLabel: "กลับมาดำเนินการ",
              });
              if (r === null) return;
              // D-04: ไม่ส่งเวลา = คงเวลานัดเดิม (แก้เวลาได้ที่หน้าแก้ไขใบงาน) · วันเดิม = ไม่ส่งวัน
              const date = r.trim() === job.jobDate ? "" : r.trim();
              act(() => api.resumeJob(job.jobId, job.updatedAt, date), "กลับมาดำเนินการแล้ว");
            }}
          >
            กลับมาดำเนินการ
          </Button>
          <Button color="error" variant="outlined" disabled={busy} onClick={cancelJob}>
            ยกเลิกใบงาน
          </Button>
        </Stack>
      )}

      {active && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          {canEdit && (
            <Button
              variant="outlined"
              disabled={busy}
              onClick={async () => {
                const r = await reasonPrompt(
                  `พักงาน ${job.jobId}?`,
                  "ใช้เมื่อรอคิวใหม่ ระหว่างพักงานช่างปิดงานไม่ได้ และระบบจะไม่เตือนเลยนัด",
                  { label: "เหตุผลที่พักงาน", confirmLabel: "พักงาน" }
                );
                if (r === null) return;
                act(() => api.holdJob(job.jobId, r.trim(), job.updatedAt), "พักงานแล้ว");
              }}
            >
              พักงาน (HOLD)
            </Button>
          )}
          {canClose && stage !== "ACKNOWLEDGED" && stage !== "IN_PROGRESS" && stage !== "SUBMITTED" && (
            <Button variant="outlined" disabled={busy} onClick={() => act(() => api.setJobStage(job.jobId, "ACKNOWLEDGED"), "รับทราบงานแล้ว")}>
              รับทราบงาน
            </Button>
          )}
          {canClose && stage !== "IN_PROGRESS" && stage !== "SUBMITTED" && (
            <Button variant="outlined" disabled={busy} onClick={() => act(() => api.setJobStage(job.jobId, "IN_PROGRESS"), "เริ่มดำเนินการแล้ว")}>
              เริ่มดำเนินการ
            </Button>
          )}
          {canClose && (
            <Button
              variant={showReschedule ? "contained" : "outlined"}
              color="secondary"
              disabled={busy}
              onClick={() => setShowReschedule((v) => !v)}
              aria-expanded={showReschedule}
            >
              แจ้ง Admin / ขอเลื่อนนัด
            </Button>
          )}
          {canEdit && (
            <Button color="error" variant="outlined" disabled={busy} onClick={cancelJob}>
              ยกเลิกใบงาน
            </Button>
          )}
        </Stack>
      )}

      <Collapse in={showReschedule && active} unmountOnExit>
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField select label="เรื่องที่แจ้ง" value={reason} onChange={(e) => setReason(e.target.value as RescheduleReason)}>
                {REASONS.map((r) => (
                  <MenuItem key={r} value={r}>
                    {RESCHEDULE_REASON_LABEL[r]}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField
                label={`วันนัดใหม่${reason === "POSTPONE" ? "" : " (ถ้ามี)"}`}
                required={reason === "POSTPONE"}
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField label="เวลานัดใหม่" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid size={12}>
              <TextField label="รายละเอียด" value={note} onChange={(e) => setNote(e.target.value)} />
            </Grid>
          </Grid>
          <Button
            variant="contained"
            sx={{ mt: 2 }}
            disabled={busy}
            onClick={() =>
              act(async () => {
                const r = await api.requestReschedule(job.jobId, {
                  reason,
                  note,
                  requestedDate: newDate,
                  requestedTime: newTime,
                });
                setShowReschedule(false);
                setNote("");
                return r.job;
              }, "ส่งเรื่องให้ Admin แล้ว")
            }
          >
            ส่งเรื่อง
          </Button>
        </Paper>
      </Collapse>

      {pending.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>คำขอที่รอพิจารณา</AlertTitle>
          <Stack spacing={1}>
            {pending.map((r) => (
              <Stack key={r.id} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                <span>
                  {RESCHEDULE_REASON_LABEL[r.reason]} โดย {r.requestedBy}
                  {r.requestedDate ? ` — ขอเลื่อนเป็น ${r.requestedDate}${r.requestedTime ? ` ${r.requestedTime}` : ""}` : ""}
                  {r.note ? ` · ${r.note}` : ""}
                </span>
                {canEdit && (
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={busy}
                      onClick={() => act(() => api.decideReschedule(job.jobId, r.id, "APPROVED"), "อนุมัติแล้ว — เลื่อนวันนัดให้เรียบร้อย")}
                    >
                      อนุมัติ
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={busy}
                      onClick={() => act(() => api.decideReschedule(job.jobId, r.id, "REJECTED"), "ปฏิเสธคำขอแล้ว")}
                    >
                      ปฏิเสธ
                    </Button>
                  </Stack>
                )}
              </Stack>
            ))}
          </Stack>
        </Alert>
      )}

      {history.length > 0 && (
        <Accordion variant="outlined" disableGutters sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>ประวัติคำขอ ({history.length})</AccordionSummary>
          <AccordionDetails sx={{ overflowX: "auto" }}>
            <Table size="small" aria-label="ประวัติคำขอเลื่อนนัด">
              <TableHead>
                <TableRow>
                  <TableCell>เมื่อ</TableCell>
                  <TableCell>เรื่อง</TableCell>
                  <TableCell>ผู้แจ้ง</TableCell>
                  <TableCell>ผล</TableCell>
                  <TableCell>ผู้พิจารณา</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="mono">{bangkokDateTime(r.requestedAt)}</TableCell>
                    <TableCell>
                      {RESCHEDULE_REASON_LABEL[r.reason]}
                      {r.requestedDate ? ` → ${r.requestedDate}` : ""}
                    </TableCell>
                    <TableCell>{r.requestedBy}</TableCell>
                    <TableCell>
                      <WomsStatusChip label={r.status === "APPROVED" ? "อนุมัติ" : "ปฏิเสธ"} tone={r.status === "APPROVED" ? "success" : "neutral"} />
                    </TableCell>
                    <TableCell>
                      {r.decidedBy}
                      {r.decisionNote ? ` · ${r.decisionNote}` : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccordionDetails>
        </Accordion>
      )}

      {canEdit && job.status !== "CANCELLED" && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h3" component="h3" sx={{ fontSize: 16, mb: 0.5 }}>
            รายรับ / ค่าใช้จ่ายของใบงานนี้
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            ยอดของใบงานนี้เท่านั้น — ไม่รวมค่าเช่าตามสัญญาและไม่รวมค่าวางบิลช่าง เพื่อไม่ให้ถูกนับซ้ำในสรุปรายเครื่อง
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                {...finErr.mui("revenueAmount", "ตัวเลขเท่านั้น ไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง")}
                label="รายรับจากลูกค้า (บาท)"
                type="number"
                inputProps={{ min: 0, max: MONEY_MAX, step: "0.01", inputMode: "decimal" }}
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                {...finErr.mui("costAmount", "ตัวเลขเท่านั้น ไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง")}
                label="ค่าใช้จ่าย (บาท)"
                type="number"
                inputProps={{ min: 0, max: MONEY_MAX, step: "0.01", inputMode: "decimal" }}
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </Grid>
            <Grid size={12}>
              <TextField {...finErr.mui("financeNote")} label="หมายเหตุ" value={financeNote} onChange={(e) => setFinanceNote(e.target.value)} />
            </Grid>
          </Grid>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} sx={{ mt: 2 }}>
            <Button variant="contained" disabled={busy} onClick={saveFinance}>
              {busy ? "กำลังบันทึก…" : "บันทึกยอด"}
            </Button>
            {job.financeBy ? (
              <Typography variant="body2">
                บันทึกล่าสุดโดย {job.financeBy} เมื่อ {bangkokDateTime(job.financeAt)}
              </Typography>
            ) : null}
          </Stack>
        </Paper>
      )}
    </WomsFormSection>
  );
}
