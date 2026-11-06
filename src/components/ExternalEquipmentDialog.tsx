"use client";

// ---------------------------------------------------------------------------
// CR-EX01 §14.2 — เพิ่มเครื่องลูกค้าภายนอกจากข้อมูลที่ทราบ (หน้าเปิดคิว / หน้าเลือกเครื่องขาย Service)
//   ขั้นที่ 1 กรอกข้อมูล → ขั้นที่ 2 ระบบค้นเครื่องที่อาจซ้ำ (ลูกค้า สาขา ยี่ห้อ SN จุดวาง รหัสเครื่องลูกค้า)
//   → ใช้ Record เดิม หรือยืนยันว่าเป็นเครื่องคนละตัว แล้วจึงบันทึก · ไม่ทราบ SN = Pending Serial (รหัสภายใน)
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { compressImage } from "@/lib/imageCompress";
import type { CustomerSite, EquipmentModelMaster } from "@/lib/types";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

export interface ExternalCreated {
  id: string;
  serial: string;
  model: string;
  hasRealSerial: boolean;
}

type Candidate = { id: string; serial: string; hasRealSerial: boolean; model: string; brand: string; location: string; customerAssetCode: string; photo: string; reasons: string[] };

export default function ExternalEquipmentDialog({
  open,
  customerId,
  siteId,
  onClose,
  onCreated,
  onUseExisting,
}: {
  open: boolean;
  customerId: string;
  siteId?: string;
  onClose: () => void;
  onCreated: (e: ExternalCreated) => void;
  /** ผู้ใช้เลือกใช้ Record เดิมจากรายการที่อาจซ้ำ */
  onUseExisting?: (e: { id: string; serial: string; model: string }) => void;
}) {
  const { has } = useAuth();
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [models, setModels] = useState<EquipmentModelMaster[]>([]);
  const [techs, setTechs] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({ siteId: siteId ?? "", machineType: "", brand: "", modelMasterId: "", modelText: "", serial: "", location: "", customerAssetCode: "", description: "", serviceNote: "", wProvider: "", wTerms: "", wEvidence: "", caretakerId: "" });
  const [photos, setPhotos] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open || !customerId) return;
    setCandidates(null);
    setErr(null);
    api.listCustomerSites(customerId, { activeOnly: true }).then((r) => setSites(r.items)).catch(() => setSites([]));
    api.listEquipmentModels().then((r) => setModels(r.items)).catch(() => setModels([]));
    if (has("pm:manage"))
      api.listUsers().then((r) => setTechs(r.items.filter((u: any) => u.role === "tech" && u.active !== false).map((u) => ({ id: u.id, name: u.name })))).catch(() => setTechs([]));
  }, [open, customerId, has]);
  useEffect(() => setF((p) => ({ ...p, siteId: siteId ?? p.siteId })), [siteId]);

  const types = [...new Set(models.map((m) => m.type).filter(Boolean))];
  const chosen = models.find((m) => m.id === f.modelMasterId) ?? null;
  const dupBody = () => ({ customerId, siteId: f.siteId, brand: f.brand, serial: f.serial, location: f.location, customerAssetCode: f.customerAssetCode });

  const check = async () => {
    setErr(null);
    if (!f.machineType && !chosen) return setErr("ต้องระบุประเภทเครื่อง");
    if (!chosen && !f.modelText.trim()) return setErr("เลือกรุ่นจาก Master หรือพิมพ์รุ่นที่ทราบ (ใส่ 'ไม่ทราบรุ่น' ได้)");
    setBusy(true);
    try {
      const r = await api.externalDuplicates(dupBody());
      if (r.items.length) setCandidates(r.items);
      else await create([]);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "ตรวจเครื่องซ้ำไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const create = async (ackIds: string[]) => {
    setBusy(true);
    try {
      const r = await api.createExternalEquipment({
        ...dupBody(),
        machineType: chosen?.type ?? f.machineType,
        modelMasterId: f.modelMasterId,
        modelText: chosen ? "" : f.modelText,
        description: f.description,
        photos,
        serviceNote: f.serviceNote,
        warranty: { provider: f.wProvider, terms: f.wTerms, evidenceNote: f.wEvidence },
        caretakerId: f.caretakerId,
        duplicateAckIds: ackIds,
      });
      onCreated({ id: r.id, serial: r.serial, model: chosen?.model ?? f.modelText, hasRealSerial: r.hasRealSerial });
    } catch (e) {
      if (e instanceof ApiError && (e.code === "POSSIBLE_DUPLICATE" || e.code === "SERIAL_EXISTS")) setCandidates(((e.body as any)?.error?.details?.candidates ?? []) as Candidate[]);
      else setErr(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>เพิ่มเครื่องลูกค้า (เครื่องภายนอก)</DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          เครื่องที่ลูกค้าซื้อจากที่อื่น — ไม่เข้าสต็อกบริษัท ไม่มีประกันตัวเครื่องของบริษัท · ไม่ทราบ SN ให้เว้นว่าง ระบบใช้รหัสภายในแทน (Pending Serial)
        </Typography>
        {err ? <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert> : null}
        {candidates ? (
          <Box data-testid="ext-duplicates">
            <Alert severity="warning" sx={{ mb: 1 }}>พบเครื่องที่อาจเป็นตัวเดียวกัน — ตรวจเทียบรูป/ป้ายเครื่องก่อน</Alert>
            {candidates.map((c) => (
              <Stack key={c.id} direction="row" spacing={1} alignItems="center" sx={{ py: 0.75, borderBottom: 1, borderColor: "divider" }}>
                {c.photo ? <Box component="img" src={c.photo} alt="" sx={{ width: 48, height: 48, objectFit: "cover" }} /> : null}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2">
                    <span className="code">{c.serial}</span>{c.hasRealSerial ? "" : " (Pending Serial)"} · {c.model} {c.brand ? `· ${c.brand}` : ""}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{[c.location, c.customerAssetCode, ...c.reasons].filter(Boolean).join(" · ")}</Typography>
                </Box>
                {onUseExisting ? (
                  <Button size="small" onClick={() => onUseExisting({ id: c.id, serial: c.serial, model: c.model })} data-testid="ext-use-existing">
                    ใช้เครื่องนี้
                  </Button>
                ) : null}
              </Stack>
            ))}
          </Box>
        ) : (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField select size="small" label="สาขา / จุดติดตั้ง" value={f.siteId} onChange={(e) => set("siteId", e.target.value)}>
              <MenuItem value="">ไม่ระบุสาขา</MenuItem>
              {sites.map((s) => (
                <MenuItem key={s.id} value={s.id}>{`${s.branchNo ? `(${s.branchNo}) ` : ""}${s.storeName}`}</MenuItem>
              ))}
            </TextField>
            <Autocomplete
              size="small"
              options={models}
              value={chosen}
              getOptionLabel={(m) => `${m.model} · ${m.type}${m.category ? ` / ${m.category}` : ""}`}
              onChange={(_, m) => set("modelMasterId", m?.id ?? "")}
              renderInput={(p) => <TextField {...p} label="รุ่นจาก Master (ถ้ามี)" />}
            />
            {!chosen ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField select size="small" label="ประเภทเครื่อง" value={f.machineType} onChange={(e) => set("machineType", e.target.value)} sx={{ minWidth: 180 }} inputProps={{ "data-testid": "ext-type" }}>
                  {types.map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </TextField>
                <TextField size="small" label="รุ่นที่ทราบ (รอตรวจ)" value={f.modelText} onChange={(e) => set("modelText", e.target.value)} fullWidth inputProps={{ "data-testid": "ext-model-text" }} />
              </Stack>
            ) : null}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField size="small" label="ยี่ห้อ" value={f.brand} onChange={(e) => set("brand", e.target.value)} fullWidth inputProps={{ "data-testid": "ext-brand" }} />
              <TextField size="small" label="SN (ถ้าทราบ)" value={f.serial} onChange={(e) => set("serial", e.target.value)} fullWidth inputProps={{ "data-testid": "ext-serial" }} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField size="small" label="จุดวางเครื่อง" value={f.location} onChange={(e) => set("location", e.target.value)} fullWidth inputProps={{ "data-testid": "ext-location" }} />
              <TextField size="small" label="รหัสเครื่องของลูกค้า" value={f.customerAssetCode} onChange={(e) => set("customerAssetCode", e.target.value)} fullWidth />
            </Stack>
            <TextField size="small" label="คำอธิบายที่ช่วยแยกตัวเครื่อง" value={f.description} onChange={(e) => set("description", e.target.value)} multiline minRows={2} />
            <TextField size="small" label="อาการ / งานที่ต้องการ / เงื่อนไขที่ทราบ" value={f.serviceNote} onChange={(e) => set("serviceNote", e.target.value)} multiline minRows={2} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField size="small" label="ผู้รับประกันภายนอก (ถ้ามีหลักฐาน)" value={f.wProvider} onChange={(e) => set("wProvider", e.target.value)} fullWidth />
              <TextField size="small" label="เงื่อนไขประกันภายนอก" value={f.wTerms} onChange={(e) => set("wTerms", e.target.value)} fullWidth />
            </Stack>
            {has("pm:manage") ? (
              <TextField select size="small" label="ผู้ดูแลเครื่อง (ถ้ากำหนดตั้งแต่แรก)" value={f.caretakerId} onChange={(e) => set("caretakerId", e.target.value)}>
                <MenuItem value="">ยังไม่กำหนด</MenuItem>
                {techs.map((t) => (
                  <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                ))}
              </TextField>
            ) : null}
            <Box>
              <Button component="label" size="small" variant="outlined" disabled={photos.length >= 3}>
                แนบรูปเครื่อง/ป้ายเครื่อง ({photos.length}/3)
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    try {
                      const d = await compressImage(file);
                      setPhotos((p) => [...p, d].slice(0, 3));
                    } catch {
                      setErr("อ่านรูปไม่สำเร็จ");
                    }
                  }}
                />
              </Button>
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => (candidates ? setCandidates(null) : onClose())}>{candidates ? "กลับไปแก้ข้อมูล" : "ยกเลิก"}</Button>
        {candidates ? (
          candidates.some((c) => c.reasons.includes("SN ตรงกัน")) ? null : (
            <Button variant="contained" color="warning" disabled={busy} onClick={() => create(candidates.map((c) => c.id))} data-testid="ext-confirm-new">
              ตรวจแล้ว เป็นเครื่องคนละตัว — บันทึก
            </Button>
          )
        ) : (
          <Button variant="contained" disabled={busy} onClick={check} data-testid="ext-save">
            ตรวจเครื่องซ้ำและบันทึก
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
