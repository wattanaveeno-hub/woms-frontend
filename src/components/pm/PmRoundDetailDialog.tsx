"use client";

// ---------------------------------------------------------------------------
// ตาราง PM รายเดือน · Dialog รายละเอียด (กดชื่อลูกค้า · PM-01)
//   วันนัด · PM ล่าสุด · JN · เซลล์ · ช่างรอบนี้ · ผู้ดูแลประจำ + ที่มา · ซื้อ/ใช้แล้ว/คงเหลือ · ต้องตรวจ · เหตุผลเปลี่ยนช่างล่าสุด
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { api, ApiError, PmRoundDetailResponse, PmRoundRow } from "@/lib/api";
import { OWNER_SOURCE_LABEL, PM_ROUND_TYPE_LABEL, dateLabel, monthLabel } from "@/lib/pmRoundRules";
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
}: {
  row: PmRoundRow | null;
  onClose: () => void;
  onReassign: (row: PmRoundRow) => void;
}) {
  const [data, setData] = useState<PmRoundDetailResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!row) return;
    setData(null);
    setErr(null);
    api
      .pmRoundDetail(row.equipmentId, row.status === "DONE" ? row.roundId : "")
      .then(setData)
      .catch((e) => setErr(e instanceof ApiError ? e.message : "โหลดรายละเอียดไม่สำเร็จ"));
  }, [row]);
  if (!row) return null;
  const it = data?.item ?? row;
  const pkg = it.package;
  const appt = it.appointment;
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
                "รอบ PM",
                <Stack key="round" direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <span>{monthLabel(it.roundMonth, true)}</span>
                  <PmRoundStatusChip status={it.status} />
                </Stack>,
              ],
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
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          ปิด
        </Button>
        {it.canReassign && it.status !== "DONE" ? (
          <Button variant="contained" onClick={() => onReassign(it)}>
            เปลี่ยนช่าง
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
