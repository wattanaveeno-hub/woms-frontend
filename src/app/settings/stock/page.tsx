"use client";

// ---------------------------------------------------------------------------
// วิธีคิดมูลค่าสต๊อกอะไหล่
// ---------------------------------------------------------------------------
// ⚠ Requirement ไม่ได้ระบุวิธีคิดมูลค่า และระบบเดิมไม่มีหลักเกณฑ์นี้
//   ระบบจึง "ไม่เดาให้" — ต้องให้ผู้ดูแลเลือกอย่างตั้งใจก่อน จึงจะแสดงมูลค่า

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.getStockSettings();
      setMethod(r.settings.valuationMethod);
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
      await api.saveStockSettings({ valuationMethod: method, note });
      toast.success("บันทึกแล้ว");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
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
          {decidedBy ? (
            <Typography variant="body2">
              เลือกโดย {decidedBy} เมื่อ {bangkokDateTime(decidedAt)}
            </Typography>
          ) : null}
          {canEdit ? (
            <div>
              <Button variant="contained" disabled={busy} onClick={save}>
                {busy ? "กำลังบันทึก…" : "บันทึก"}
              </Button>
            </div>
          ) : null}
        </Stack>
      </WomsFormSection>
    </>
  );
}
