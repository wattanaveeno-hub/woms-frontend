"use client";

// ---------------------------------------------------------------------------
// ตาราง PM รายเดือน · Dialog รายละเอียด (กดชื่อลูกค้า · PM-01)
//   วันนัด · PM ล่าสุด · JN · เซลล์ · ช่างรอบนี้ · ผู้ดูแลประจำ + ที่มา · ซื้อ/ใช้แล้ว/คงเหลือ · ต้องตรวจ · เหตุผลเปลี่ยนช่างล่าสุด
//   v1.2: เดือนตามแผน/เดือนจัดงาน · หมายเหตุลูกค้า · ประวัติ PM · ยกเลิกการดึงงานก่อนรอบ (Admin · ยังไม่มีคิว/JN)
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { api, ApiError, PmRoundDetailResponse, PmRoundRow } from "@/lib/api";
import { OWNER_SOURCE_LABEL, PM_PLAN_MODE_LABEL, PM_ROUND_TYPE_LABEL, REASSIGN_REASON_MAX, dateLabel, monthLabel, statusText } from "@/lib/pmRoundRules";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import { PmRoundStatusChip, WomsErrorState, WomsKeyValue, WomsLoadingState } from "@/components/woms";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

const mono = { fontFamily: 'ui-monospace, "SFMono-Regular", "JetBrains Mono", "Consolas", monospace', fontSize: 13 } as const;

export default function PmRoundDetailDialog({
  row,
  onClose,
  onReassign,
  onChanged,
  canEarly,
  onEarly,
}: {
  row: PmRoundRow | null;
  onClose: () => void;
  onReassign: (row: PmRoundRow) => void;
  onChanged?: (msg: string) => void;
  /** v1.2 PM-07 (mockup): ปุ่ม "นัด PM ก่อนรอบ" อยู่ในรายละเอียด — Admin · รอบตามแผนอยู่ในอนาคต */
  canEarly?: (row: PmRoundRow) => boolean;
  onEarly?: (row: PmRoundRow) => void;
}) {
  const [data, setData] = useState<PmRoundDetailResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelErr, setCancelErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!row) return;
    setData(null);
    setErr(null);
    setCancelling(false);
    setCancelReason("");
    setCancelErr(null);
    api
      .pmRoundDetail(row.equipmentId, row.status === "DONE" || row.kind === "UNSCHEDULED" ? row.roundId : "")
      .then(setData)
      .catch((e) => setErr(e instanceof ApiError ? e.message : "โหลดรายละเอียดไม่สำเร็จ"));
  }, [row]);
  if (!row) return null;
  const it = data?.item ?? row;
  const pkg = it.package;
  const appt = it.appointment;
  // ยกเลิกการดึง/PM นอกแผน: Admin (สิทธิ์เดียวกับแก้หมายเหตุ) · ยังไม่มีคิว/JN
  const canCancel = !!it.canEditNote && it.status !== "DONE" && !it.queue && !it.openJobId && (it.kind === "UNSCHEDULED" || !!it.earlyMode);
  const doCancel = async () => {
    if (!cancelReason.trim()) return setCancelErr("กรุณาระบุเหตุผล");
    setBusy(true);
    setCancelErr(null);
    try {
      await api.pmEarlyCancel({ equipmentId: it.equipmentId, requestType: it.kind === "UNSCHEDULED" ? "UNSCHEDULED" : "REPLACE", reason: cancelReason.trim() });
      onChanged?.(it.kind === "UNSCHEDULED" ? `ยกเลิก PM นอกแผนแล้ว · ${it.serial}` : `ยกเลิกการดึงงานแล้ว · ${it.serial} · กลับไปเดือนตามแผน ${monthLabel(it.plannedMonth)}`);
    } catch (x) {
      setCancelErr(x instanceof ApiError ? x.message : "ยกเลิกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="pm-detail-title">
      <DialogTitle id="pm-detail-title" sx={{ pb: 0.5 }}>
        รายละเอียด PM
        <Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
          {it.customerName || "-"}
          {it.siteLabel ? ` · ${it.siteLabel}` : ""}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {err ? (
          <WomsErrorState message={err} />
        ) : !data ? (
          <WomsLoadingState rows={6} />
        ) : (
          <WomsKeyValue
            items={[
              [
                "รุ่น / SN",
                <>
                  {it.model || "-"} · <span style={mono}>{it.serial || "-"}</span>
                  {it.pendingSerial ? " (รอ SN จริง)" : ""}
                </>,
              ],
              [
                "เดือนจัดงาน",
                <Stack key="round" direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <span>{monthLabel(it.roundMonth, true)}</span>
                  <PmRoundStatusChip status={it.status} label={statusText(it)} />
                  {it.kind === "UNSCHEDULED" ? <Typography variant="body2">PM นอกแผน</Typography> : null}
                </Stack>,
              ],
              !!it.plannedMonth && it.plannedMonth !== it.roundMonth && [
                it.kind === "UNSCHEDULED" ? "รอบตามแผน (คงเดิม)" : "รอบตามแผน",
                <>
                  {monthLabel(it.plannedMonth, true)}
                  {it.earlyMode ? <Typography variant="body2">ดึงมาก่อนรอบ · {PM_PLAN_MODE_LABEL[it.earlyMode]}</Typography> : null}
                  {it.requestReason ? <Typography variant="body2">เหตุผล: {it.requestReason}</Typography> : null}
                </>,
              ],
              it.kind === "UNSCHEDULED" && !!it.quotationNo && ["ใบเสนอราคา", <span key="qt" style={mono}>{it.quotationNo}</span>],
              ["หมายเหตุลูกค้า", it.customerNote || "–"],
              ["เซลล์ผู้รับผิดชอบ", it.sales?.name || "ยังไม่ระบุ"],
              [
                "ประเภท PM",
                <>
                  {PM_ROUND_TYPE_LABEL[it.type]}
                  {it.rental?.contractNo ? <Typography variant="body2">สัญญา {it.rental.contractNo}</Typography> : null}
                  {it.entitlementEnded ? <Typography variant="body2">สิทธิ์สิ้นสุด</Typography> : null}
                  {it.serviceStopped ? <Typography variant="body2">หยุดบริการ</Typography> : null}
                </>,
              ],
              pkg && [
                "รอบคงเหลือ",
                <>
                  <Typography component="span" sx={{ fontWeight: 700, color: pkg.remaining === 0 ? "error.main" : "text.primary" }}>
                    เหลือ {pkg.remaining} รอบ
                  </Typography>
                  <Typography variant="body2">
                    ซื้อ {pkg.total} รอบ · ใช้แล้ว {pkg.used} รอบ{pkg.expired ? ` · หมดอายุ ${pkg.expired} ชุด` : ""}
                    {pkg.pending ? ` · รอเปิดสิทธิ์ ${pkg.pending} ชุด` : ""}
                  </Typography>
                </>,
              ],
              [
                "ช่างรอบนี้",
                <>
                  {it.roundTech?.name || "ยังไม่ระบุช่าง"}
                  {it.roundTech?.source === "ADMIN_ROUND" ? <Typography variant="body2">Admin ปรับเฉพาะรอบ</Typography> : null}
                </>,
              ],
              [
                "ผู้ดูแลประจำ",
                <>
                  {it.owner?.name || "ยังไม่ระบุช่าง"}
                  <Typography variant="body2">{OWNER_SOURCE_LABEL[it.owner?.source ?? "NONE"]}</Typography>
                </>,
              ],
              ["วันนัด", appt ? `${dateLabel(appt.date)}${appt.time ? ` · ${appt.time} น.` : ""}${appt.state === "PROPOSED" ? " (รอลูกค้ายืนยัน)" : ""}` : it.status === "DONE" ? "–" : "ยังไม่ได้นัด"],
              ["PM ล่าสุด", it.status === "DONE" && it.serviceDate ? dateLabel(it.serviceDate) : dateLabel(data.latestPm)],
              ["ใบงาน", <span key="jn" style={mono}>{it.jobId || it.openJobId || "–"}</span>],
              it.queue && ["คิว", <span key="q" style={mono}>{it.queue.queueNo || it.queue.queueId}</span>],
              it.status === "NEEDS_REVIEW" && ["ต้องตรวจ", data.reviewReasonLabel || it.reviewReason],
              !!data.history?.length && [
                "ประวัติ PM",
                <Stack key="hist" spacing={0.25}>
                  {data.history.map((h) => (
                    <Typography key={h.roundId} variant="body2">
                      {dateLabel(h.serviceDate)} · {h.kind === "UNSCHEDULED" ? "นอกแผน" : `รอบ ${monthLabel(h.plannedMonth)}`}
                      {h.earlyDone ? " · เข้าก่อนรอบ" : ""}
                      {h.performedBy ? ` · ${h.performedBy}` : ""}
                      {h.jobId ? ` · ${h.jobId}` : ""}
                    </Typography>
                  ))}
                </Stack>,
              ],
              !!(data.lastReassign?.reason || it.lastReason) && [
                "เหตุผลที่เปลี่ยนช่างล่าสุด",
                <>
                  {data.lastReassign?.reason || it.lastReason}
                  {data.lastReassign ? <Typography variant="body2">โดย {data.lastReassign.by}</Typography> : null}
                </>,
              ],
            ]}
          />
        )}
        {cancelling ? (
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            {cancelErr ? <Alert severity="error">{cancelErr}</Alert> : null}
            <TextField
              id="pm-early-cancel-reason"
              label={it.kind === "UNSCHEDULED" ? "เหตุผลที่ยกเลิก PM นอกแผน" : "เหตุผลที่ยกเลิกการดึงงาน"}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              inputProps={{ maxLength: REASSIGN_REASON_MAX }}
              helperText="รอบตามแผนและยอดสิทธิ์ไม่เปลี่ยน"
            />
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={busy}>
          ปิด
        </Button>
        {canCancel && data ? (
          cancelling ? (
            <Button color="error" variant="contained" onClick={doCancel} disabled={busy}>
              ยืนยันยกเลิก
            </Button>
          ) : (
            <Button color="error" variant="text" onClick={() => setCancelling(true)}>
              {it.kind === "UNSCHEDULED" ? "ยกเลิก PM นอกแผน" : "ยกเลิกการดึงงาน"}
            </Button>
          )
        ) : null}
        {it.canReassign && it.status !== "DONE" ? (
          <Button variant={canEarly?.(it) ? "outlined" : "contained"} onClick={() => onReassign(it)}>
            เปลี่ยนช่าง
          </Button>
        ) : null}
        {data && onEarly && canEarly?.(it) ? (
          <Button variant="contained" onClick={() => onEarly(it)} data-testid="pm-detail-early">
            นัด PM ก่อนรอบ
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
