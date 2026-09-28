"use client";

// ---------------------------------------------------------------------------
// หัวเอกสารของบริษัท (ใช้กับใบงาน PDF / ใบเสนอราคา / สัญญา / ใบประวัติเครื่อง)
// ---------------------------------------------------------------------------
// ที่มา: RPT-FN-003 / CON-FN-005 / QUO-FN-007 "จัดรูปแบบเอกสารตามแบบฟอร์มที่บริษัทกำหนดได้"
//
// ⚠ สำคัญ: หน้านี้ทำให้ "แก้ไขหัวเอกสารได้" เท่านั้น
//   ยังไม่มีใครส่งแบบฟอร์มจริงที่บริษัทอนุมัติมาให้ ระบบจึงไม่อ้างว่าเอกสารที่ออก
//   เป็นแบบที่บริษัทอนุมัติ จนกว่าผู้ดูแลจะติ๊กยืนยันเองหลังเทียบกับไฟล์ต้นฉบับ

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { CompanyProfile } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/AuthContext";
import { bangkokDate } from "@/lib/date";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid2";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { WomsErrorState, WomsFormSection, WomsLoadingState, WomsPageHeader } from "@/components/woms";

export default function CompanySettingsPage() {
  const toast = useToast();
  const { has } = useAuth();
  const canEdit = has("master:manage");

  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<{ field?: string; message: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.getCompany();
      setCompany(r.company);
      setMissing(r.missing);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = <K extends keyof CompanyProfile>(k: K, v: CompanyProfile[K]) =>
    setCompany((c) => (c ? { ...c, [k]: v } : c));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || busy) return;
    setFieldErr(null);
    setBusy(true);
    try {
      const r = await api.saveCompany({
        name: company.name,
        address: company.address,
        phone: company.phone,
        email: company.email,
        taxId: company.taxId,
        approved: company.approved,
        note: company.note,
      });
      setCompany(r.company);
      setMissing(r.missing);
      toast.success("บันทึกแล้ว");
    } catch (err) {
      if (err instanceof ApiError && err.field) setFieldErr({ field: err.field, message: err.message });
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <WomsErrorState message={error} onRetry={load} />;
  if (!company) return <WomsLoadingState rows={4} />;

  const fe = (f: keyof CompanyProfile) => ({
    id: `co-${String(f)}`,
    error: fieldErr?.field === f,
    helperText: fieldErr?.field === f ? fieldErr.message : undefined,
    disabled: !canEdit,
  });

  return (
    <>
      <WomsPageHeader title="หัวเอกสารบริษัท" subtitle="ใช้กับใบประวัติเครื่อง ใบเสนอราคา สัญญา และเอกสารที่พิมพ์ทุกชนิด" />

      {missing.length > 0 ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          ยังไม่พร้อมออกเอกสารตามแบบบริษัท — ขาด: {missing.join(" · ")}
        </Alert>
      ) : null}

      <WomsFormSection title={canEdit ? "ข้อมูลหัวเอกสาร" : "ข้อมูลหัวเอกสาร (ดูอย่างเดียว)"}>
        <Box component="form" noValidate onSubmit={save}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField {...fe("name")} label="ชื่อบริษัท" value={company.name} onChange={(e) => set("name", e.target.value)} />
            </Grid>
            <Grid size={12}>
              <TextField {...fe("address")} label="ที่อยู่" value={company.address} onChange={(e) => set("address", e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField {...fe("phone")} label="เบอร์โทร" value={company.phone} onChange={(e) => set("phone", e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField {...fe("email")} label="อีเมล" value={company.email} onChange={(e) => set("email", e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField {...fe("taxId")} label="เลขประจำตัวผู้เสียภาษี (13 หลัก)" inputProps={{ inputMode: "numeric" }} value={company.taxId} onChange={(e) => set("taxId", e.target.value)} />
            </Grid>
            <Grid size={12}>
              <TextField {...fe("note")} label="หมายเหตุภายใน" value={company.note} onChange={(e) => set("note", e.target.value)} />
            </Grid>
          </Grid>

          <Alert severity="info" icon={false} sx={{ mt: 2 }}>
            <FormControlLabel
              sx={{ alignItems: "flex-start", m: 0 }}
              control={<Checkbox checked={company.approved} disabled={!canEdit} onChange={(e) => set("approved", e.target.checked)} sx={{ mt: -0.75 }} />}
              label={
                <span>
                  ยืนยันว่าหัวเอกสารด้านบนตรงกับ <strong>แบบฟอร์มที่บริษัทอนุมัติ</strong> แล้ว
                  <Typography variant="body2">
                    ระบบยังไม่ได้รับไฟล์แบบฟอร์มต้นฉบับจากบริษัท จนกว่าจะติ๊กช่องนี้ เอกสารที่ออกจะมีข้อความกำกับว่ายังไม่ได้รับการยืนยัน
                    {company.approvedBy ? ` · ยืนยันโดย ${company.approvedBy} เมื่อ ${bangkokDate(company.approvedAt)}` : ""}
                  </Typography>
                </span>
              }
            />
          </Alert>

          {canEdit ? (
            <Button type="submit" variant="contained" disabled={busy} sx={{ mt: 2 }}>
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          ) : null}
        </Box>
      </WomsFormSection>
    </>
  );
}
