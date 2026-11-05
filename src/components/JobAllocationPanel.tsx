"use client";
// CR-EQ01 / Q-R7-01 (รอบ 8) — จัดเครื่องจริงให้รายการเครื่องที่ต้องการของใบงาน
//   แสดงเมื่อใบงานมี Requested Line และผู้ใช้มี svcqueue:admin
//   รอบ 10 (OD-R9-04): ไม่ขึ้นกับ flag — ปิด flag (rollback) แล้วบรรทัดที่มีอยู่ยังจัด/ปลดจองได้ · flag ใช้กับการสร้างบรรทัดใหม่เท่านั้น
//   ปิดงานติดตั้งได้เมื่อจัดครบทุกรายการ (backend ตรวจ) · การปลดจองต้องมีเหตุผล · ไม่สร้างเครื่องชั่วคราว
import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { api, ApiError, type AllocationHistoryItem, type RequestedLine } from "@/lib/api";
import { bangkokTime } from "@/lib/serviceQueueRules";
import { useAuth } from "@/lib/AuthContext";
import { useDialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import { EquipmentPicker } from "@/components/QuotationLinePickers";

const STATE_LABEL: Record<RequestedLine["state"], string> = { NONE: "ยังไม่จัดเครื่อง", PARTIAL: "จัดบางส่วน", FULL: "จัดครบ" };

export default function JobAllocationPanel({ jobId, jobStatus, onChanged }: { jobId: string; jobStatus: string; onChanged?: () => void }) {
  const { has } = useAuth();
  const dialog = useDialog();
  const toast = useToast();
  const [enabled, setEnabled] = useState(false);
  const [flagOn, setFlagOn] = useState(true);
  const [data, setData] = useState<{ complete: boolean; lines: RequestedLine[]; history?: AllocationHistoryItem[] } | null>(null);
  const [pick, setPick] = useState<Record<string, { id: string; serial: string }>>({});
  const [busy, setBusy] = useState(false);
  const canEdit = has("svcqueue:admin") && (jobStatus === "OPEN" || jobStatus === "HOLD");

  const load = useCallback(async () => {
    try {
      const r = await api.jobRequestedLines(jobId);
      setData(r);
    } catch {
      setData(null);
    }
  }, [jobId]);
  useEffect(() => {
    if (!has("svcqueue:admin")) return;
    setEnabled(true);
    void load();
    api
      .allocationStatus()
      .then((s) => setFlagOn(s.enabled))
      .catch(() => setFlagOn(false));
  }, [has, load]);

  if (!enabled || !data || !data.lines.length) return null;

  const allocate = async (l: RequestedLine) => {
    const p = pick[l.lineId];
    if (!p?.id) return toast.error("เลือกเครื่องในคลังก่อน");
    setBusy(true);
    try {
      await api.allocateLine(l.lineId, p.id);
      toast.success(`จัดเครื่อง ${p.serial} แล้ว`);
      setPick((x) => ({ ...x, [l.lineId]: { id: "", serial: "" } }));
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "จัดเครื่องไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };
  const release = async (allocationId: string) => {
    const reason = await dialog.prompt({ title: "ปลดจองเครื่องนี้?", label: "เหตุผล", required: true, validate: (v) => (v.trim() ? null : "ต้องระบุเหตุผล"), confirmLabel: "ปลดจอง", danger: true });
    if (reason === null) return;
    setBusy(true);
    try {
      await api.releaseAllocation(allocationId, reason.trim());
      toast.success("ปลดจองแล้ว");
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ปลดจองไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, my: 2 }} data-testid="job-allocation-panel">
      <Typography variant="h6" sx={{ mb: 1 }}>
        เครื่องที่ต้องการ (ยังไม่ใช่เครื่องจริง)
      </Typography>
      {!flagOn ? (
        <Alert severity="info" sx={{ mb: 1 }} data-testid="allocation-flag-off">
          ฟังก์ชันจัดเครื่องตามรายการปิดอยู่ — รายการเดิมของใบงานนี้ยังจัด/ปลดจองได้ แต่ระบบไม่สร้างรายการใหม่
        </Alert>
      ) : null}
      {!data.complete ? (
        <Alert severity="warning" sx={{ mb: 1 }} data-testid="allocation-incomplete">
          ยังจัดเครื่องจริงไม่ครบ — ปิดงานติดตั้งไม่ได้จนกว่าจะจัดครบทุกรายการ
        </Alert>
      ) : null}
      <Stack spacing={1.5}>
        {data.lines.map((l) => (
          <Box key={l.lineId} sx={{ borderTop: 1, borderColor: "divider", pt: 1 }} data-testid="requested-line">
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Typography sx={{ fontWeight: 600, flex: 1 }}>
                {l.machineType || "เครื่อง"} {l.model || "(รอยืนยันรุ่น)"} · {l.allocations.length}/{l.qty}
              </Typography>
              <Chip size="small" label={STATE_LABEL[l.state]} color={l.state === "FULL" ? "success" : l.state === "PARTIAL" ? "warning" : "default"} />
            </Stack>
            {l.note ? (
              <Typography variant="caption" color="text.secondary">
                {l.note}
              </Typography>
            ) : null}
            {l.allocations.map((a) => (
              <Stack key={a.allocationId} direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                <Typography variant="body2" className="code" sx={{ flex: 1 }}>
                  เครื่อง {a.serial || a.equipmentId}
                </Typography>
                {canEdit ? (
                  <Button size="small" color="warning" disabled={busy} onClick={() => release(a.allocationId)}>
                    ปลดจอง
                  </Button>
                ) : null}
              </Stack>
            ))}
            {canEdit && l.allocations.length < l.qty ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }} alignItems={{ sm: "flex-start" }}>
                <EquipmentPicker
                  equipmentId={pick[l.lineId]?.id}
                  serial={pick[l.lineId]?.serial}
                  label={`เครื่องสำหรับ ${l.machineType}`}
                  onChange={(id, serial) => setPick((x) => ({ ...x, [l.lineId]: { id, serial } }))}
                />
                <Button variant="contained" size="small" disabled={busy || !pick[l.lineId]?.id} onClick={() => allocate(l)} data-testid="allocate-btn">
                  จัดเครื่อง
                </Button>
              </Stack>
            ) : null}
          </Box>
        ))}
      </Stack>
      {data.history?.length ? (
        <Box sx={{ mt: 2 }} data-testid="allocation-history">
          <Typography variant="subtitle2">ประวัติการปลดจอง</Typography>
          {data.history.map((h) => (
            <Typography key={h.allocationId} variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {h.serial || h.equipmentId} · ปลดเมื่อ {bangkokTime(h.releasedAt)} · เหตุผล: {h.releaseReason || "-"}
            </Typography>
          ))}
        </Box>
      ) : null}
    </Paper>
  );
}
