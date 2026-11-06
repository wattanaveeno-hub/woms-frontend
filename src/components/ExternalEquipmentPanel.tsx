"use client";

// CR-EX01 §14 — ข้อมูลเครื่องลูกค้าภายนอกในหน้าเครื่อง + Admin ตรวจ/เติมข้อมูลใน Record เดิม
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import type { EquipmentModelMaster } from "@/lib/types";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { WomsFormSection, WomsKeyValue } from "@/components/woms";

type Ext = {
  brand?: string; modelText?: string; modelPendingReview?: boolean; location?: string; customerAssetCode?: string; description?: string;
  photos?: string[]; serviceNote?: string; warranty?: { provider?: string; terms?: string; evidenceNote?: string };
  reviewStatus?: string; reviewedByName?: string; reviewedAt?: string; createdByName?: string; createdAt?: string;
};

export default function ExternalEquipmentPanel({ equipment, onChanged }: { equipment: { id: string; status: string; externalInfo?: Ext }; onChanged: () => void }) {
  const { has } = useAuth();
  const toast = useToast();
  const ext: Ext = equipment.externalInfo ?? {};
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<EquipmentModelMaster[]>([]);
  const [f, setF] = useState({ brand: ext.brand ?? "", modelMasterId: "", modelText: ext.modelText ?? "", location: ext.location ?? "", customerAssetCode: ext.customerAssetCode ?? "", description: ext.description ?? "", provider: ext.warranty?.provider ?? "", terms: ext.warranty?.terms ?? "", evidenceNote: ext.warranty?.evidenceNote ?? "", markReviewed: ext.reviewStatus !== "REVIEWED" });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) api.listEquipmentModels().then((r) => setModels(r.items)).catch(() => setModels([]));
  }, [open]);
  if (equipment.status !== "EXTERNAL") return null;

  const save = async () => {
    try {
      await api.reviewExternalEquipment(equipment.id, {
        brand: f.brand, ...(f.modelMasterId ? { modelMasterId: f.modelMasterId } : { modelText: f.modelText }), location: f.location,
        customerAssetCode: f.customerAssetCode, description: f.description, warranty: { provider: f.provider, terms: f.terms, evidenceNote: f.evidenceNote }, markReviewed: f.markReviewed,
      });
      toast.success("บันทึกการตรวจข้อมูลแล้ว");
      setOpen(false);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    }
  };
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  return (
    <WomsFormSection
      title="เครื่องลูกค้าภายนอก"
      actions={has("equipment:edit") ? <Button onClick={() => setOpen(true)} data-testid="ext-review-btn">ตรวจ/เติมข้อมูล</Button> : undefined}
    >
      <Alert severity="info" sx={{ mb: 1.5 }} data-testid="ext-panel">
        ลูกค้าซื้อจากภายนอก — ไม่ใช่สต็อกบริษัท ไม่มีประกันตัวเครื่องของบริษัท งานครั้งเดียวไม่สร้างรอบ PM อัตโนมัติ
        {ext.reviewStatus === "REVIEWED" ? ` · ตรวจแล้วโดย ${ext.reviewedByName ?? "-"}` : " · รอ Admin ตรวจข้อมูล"}
      </Alert>
      <WomsKeyValue
        items={[
          ["ยี่ห้อ", ext.brand || "-"],
          ["รุ่นที่แจ้ง", `${ext.modelText || "-"}${ext.modelPendingReview ? " (รอตรวจรุ่น)" : ""}`],
          ["จุดวาง", ext.location || "-"],
          ["รหัสเครื่องของลูกค้า", ext.customerAssetCode || "-"],
          ["คำอธิบาย", ext.description || "-"],
          ["งาน/อาการที่แจ้ง", ext.serviceNote || "-"],
          ["ประกันภายนอก", ext.warranty?.provider ? `${ext.warranty.provider}${ext.warranty.terms ? ` · ${ext.warranty.terms}` : ""}` : "ไม่มีข้อมูล"],
          ["ผู้เพิ่ม", `${ext.createdByName ?? "-"} ${ext.createdAt ? ext.createdAt.slice(0, 10) : ""}`],
        ]}
      />
      {(ext.photos ?? []).length ? (
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          {(ext.photos ?? []).map((p, i) => (
            <Box key={i} component="img" src={p} alt={`รูปเครื่อง ${i + 1}`} sx={{ width: 96, height: 96, objectFit: "cover", borderRadius: 1 }} />
          ))}
        </Stack>
      ) : null}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>ตรวจ/เติมข้อมูลเครื่องภายนอก</DialogTitle>
        <DialogContent>
          {err ? <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert> : null}
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField size="small" label="ยี่ห้อ" value={f.brand} onChange={(e) => set("brand", e.target.value)} />
            <Autocomplete
              size="small"
              options={models}
              value={models.find((m) => m.id === f.modelMasterId) ?? null}
              getOptionLabel={(m) => `${m.model} · ${m.type}`}
              onChange={(_, m) => set("modelMasterId", m?.id ?? "")}
              renderInput={(p) => <TextField {...p} label="ผูกรุ่นกับ Master (ถ้ามีรุ่นนี้)" />}
            />
            {!f.modelMasterId ? <TextField size="small" label="รุ่นที่ทราบ" value={f.modelText} onChange={(e) => set("modelText", e.target.value)} /> : null}
            <TextField size="small" label="จุดวาง" value={f.location} onChange={(e) => set("location", e.target.value)} />
            <TextField size="small" label="รหัสเครื่องของลูกค้า" value={f.customerAssetCode} onChange={(e) => set("customerAssetCode", e.target.value)} />
            <TextField size="small" label="คำอธิบาย" value={f.description} onChange={(e) => set("description", e.target.value)} multiline minRows={2} />
            <TextField size="small" label="ผู้รับประกันภายนอก" value={f.provider} onChange={(e) => set("provider", e.target.value)} />
            <TextField size="small" label="เงื่อนไขประกันภายนอก" value={f.terms} onChange={(e) => set("terms", e.target.value)} />
            <TextField size="small" label="หลักฐานประกัน" value={f.evidenceNote} onChange={(e) => set("evidenceNote", e.target.value)} />
            <FormControlLabel control={<Checkbox checked={f.markReviewed} onChange={(e) => set("markReviewed", e.target.checked)} />} label="ตรวจข้อมูลแล้ว" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={save} data-testid="ext-review-save">บันทึก</Button>
        </DialogActions>
      </Dialog>
    </WomsFormSection>
  );
}
