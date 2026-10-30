"use client";

// ---------------------------------------------------------------------------
// วิธีคิดมูลค่าสต๊อกอะไหล่
// ---------------------------------------------------------------------------
// ⚠ Requirement ไม่ได้ระบุวิธีคิดมูลค่า และระบบเดิมไม่มีหลักเกณฑ์นี้
//   ระบบจึง "ไม่เดาให้" — ต้องให้ผู้ดูแลเลือกอย่างตั้งใจก่อน จึงจะแสดงมูลค่า

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, ApprovalPendingError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import type { ValuationMethod } from "@/lib/types";
import { bangkokDateTime } from "@/lib/date";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { WomsErrorState, WomsFormSection, WomsPageHeader } from "@/components/woms";

export default function StockSettingsPage() {
  const { has } = useAuth();
  const toast = useToast();
  const canEdit = has("stock:manage");

  const [method, setMethod] = useState<ValuationMethod>("");
  const [options, setOptions] = useState<Array<{ value: ValuationMethod; label: string }>>([]);
  const [decidedBy, setDecidedBy] = useState("");
  const [decidedAt, setDecidedAt] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [current, setCurrent] = useState<ValuationMethod>("");
  const [changeReason, setChangeReason] = useState("");
  const [approval, setApproval] = useState<{ previous: string; requestedBy: string; approvedBy: string; reason: string; effectiveAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.getStockSettings();
      setMethod(r.settings.valuationMethod);
      setCurrent(r.settings.valuationMethod);
      const lbl = (v?: string) => r.options.find((o) => o.value === (v ?? ""))?.label ?? (v || "ยังไม่กำหนด");
      setApproval(r.settings.approvedBy ? { previous: lbl(r.settings.previousMethod), requestedBy: r.settings.requestedBy ?? "", approvedBy: r.settings.approvedBy, reason: r.settings.reason ?? "", effectiveAt: r.settings.effectiveAt ?? "" } : null);
      setOptions(r.options);
      setDecidedBy(r.settings.decidedBy);
      setDecidedAt(r.settings.decidedAt);
      setNote(r.settings.note);
      setReason(r.reason);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      await api.saveStockSettings({ valuationMethod: method, note, reason: changeReason.trim() });
      toast.success("เปลี่ยนวิธีคิดมูลค่าแล้ว (มีผลทันที)");
      setChangeReason("");
      await load();
    } catch (e) {
      // Q-R3-10: Admin → ส่งคำขอให้ Manager อนุมัติ · วิธีเดิมยังมีผลจนกว่าจะอนุมัติ
      if (e instanceof ApprovalPendingError) {
        toast.success(`${e.message} — วิธีเดิมยังมีผลจนกว่า Manager จะอนุมัติ`);
        setChangeReason("");
        await load();
      } else toast.error(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <WomsErrorState message={error} onRetry={load} />;

  return (
    <>
      <WomsPageHeader title="วิธีคิดมูลค่าสต๊อก" subtitle="ใช้กับรายงานมูลค่าคงเหลือ (STK-FN-010) และต้นทุนอะไหล่ในสรุปรายเครื่อง" />

      {/* ขอบเขต Parts ที่ยืนยันแล้วไม่รวมการคิดมูลค่าสต๊อก — หน้านี้เป็นของเดิม คงไว้ตามเดิม ไม่เพิ่มความสามารถ (บันทึกในรายงานรอบ 5) */}
      {reason ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {reason}
        </Alert>
      ) : null}

      <WomsFormSection title={canEdit ? "ตั้งค่า" : "ตั้งค่า (ดูอย่างเดียว)"}>
        <Stack spacing={2} sx={{ maxWidth: 560 }}>
          <TextField select id="valuation-method" label="วิธีคิดมูลค่า" value={method} disabled={!canEdit} onChange={(e) => setMethod(e.target.value as ValuationMethod)}>
            {options.map((o) => (
              <MenuItem key={o.value || "none"} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField id="valuation-note" label="หมายเหตุ / ที่มาของการตัดสินใจ" value={note} disabled={!canEdit} onChange={(e) => setNote(e.target.value)} />
          {canEdit ? (
            <TextField
              id="valuation-change-reason"
              label="เหตุผลที่เปลี่ยน (บังคับ)"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              helperText="การเปลี่ยนวิธีคิดมูลค่าต้องได้รับอนุมัติจาก Manager · ไม่คำนวณรายงานย้อนหลังใหม่"
            />
          ) : null}
          {approval ? (
            <Typography variant="body2" data-testid="valuation-approval">
              วิธีเดิม {approval.previous} · ขอโดย {approval.requestedBy || "-"} · อนุมัติโดย {approval.approvedBy} · มีผล {bangkokDateTime(approval.effectiveAt)}
              {approval.reason ? ` · เหตุผล: ${approval.reason}` : ""}
            </Typography>
          ) : decidedBy ? (
            <Typography variant="body2">
              เลือกโดย {decidedBy} เมื่อ {bangkokDateTime(decidedAt)}
            </Typography>
          ) : null}
          {canEdit ? (
            <div>
              <Button variant="contained" disabled={busy || method === current || !changeReason.trim()} onClick={save}>
                {busy ? "กำลังบันทึก…" : "บันทึก / ส่งขออนุมัติ"}
              </Button>
            </div>
          ) : null}
        </Stack>
      </WomsFormSection>
    </>
  );
}
