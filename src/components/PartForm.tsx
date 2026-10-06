"use client";

// ฟอร์มข้อมูลอะไหล่ (PART-02): รหัส · ชื่อ (ซ้ำได้) · รุ่นที่ใช้ได้หลายรุ่น · รูป (ไม่มีก็ได้)
import { useEffect, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid2";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { ApiError } from "@/lib/api";
import { compressPartImage, partsApi, type PartFormValues, type PartProfile } from "@/lib/partsApi";

export const EMPTY_PART: PartFormValues = {
  code: "",
  name: "",
  unit: "ชิ้น",
  compatibleModels: [],
  image: "",
  note: "",
  active: true,
};

export function partToForm(p: PartProfile): PartFormValues {
  return {
    code: p.code,
    name: p.name,
    unit: p.unit || "ชิ้น",
    compatibleModels: p.compatibleModels ?? [],
    image: p.image ?? "",
    note: p.note ?? "",
    active: p.active !== false,
  };
}

export default function PartForm({
  initial,
  existing,
  onSaved,
  onCancel,
}: {
  initial?: PartFormValues;
  /** มีค่า = โหมดแก้ไข */
  existing?: PartProfile;
  onSaved: (p: PartProfile) => void;
  onCancel?: () => void;
}) {
  const [v, setV] = useState<PartFormValues>(initial ?? EMPTY_PART);
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);

  useEffect(() => {
    partsApi
      .models()
      .then((r) => setModels(r.items))
      .catch(() => setModels([]));
  }, []);

  const set = <K extends keyof PartFormValues>(k: K, val: PartFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr({ field: "image", message: "เลือกได้เฉพาะไฟล์รูปภาพ" });
      return;
    }
    try {
      set("image", await compressPartImage(file));
      setErr(null);
    } catch (e) {
      setErr({ field: "image", message: e instanceof Error ? e.message : "โหลดรูปไม่สำเร็จ" });
    }
  };

  const save = async () => {
    if (!v.code.trim()) return setErr({ field: "code", message: "ต้องระบุรหัสอะไหล่" });
    if (!v.name.trim()) return setErr({ field: "name", message: "ต้องระบุชื่ออะไหล่" });
    setBusy(true);
    setErr(null);
    try {
      const saved = existing ? await partsApi.patch(existing.id, v, existing.updatedAt) : await partsApi.create(v);
      onSaved({ ...saved, image: saved.image ?? "", compatibleModels: saved.compatibleModels ?? [] });
    } catch (e) {
      setErr(e instanceof ApiError ? { field: e.field, message: e.message } : { message: "บันทึกไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  const fieldErr = (f: string) => (err?.field === f ? err.message : undefined);

  return (
    <Box>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="รหัสอะไหล่"
            required
            value={v.code}
            onChange={(e) => set("code", e.target.value)}
            error={!!fieldErr("code")}
            helperText={fieldErr("code") ?? "ใช้แยกอะไหล่ที่ชื่อซ้ำกัน"}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 5 }}>
          <TextField
            label="ชื่ออะไหล่"
            required
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            error={!!fieldErr("name")}
            helperText={fieldErr("name")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField label="หน่วย" value={v.unit} onChange={(e) => set("unit", e.target.value)} />
        </Grid>
        <Grid size={12}>
          <Autocomplete
            multiple
            options={models}
            value={v.compatibleModels}
            onChange={(_e, val) => set("compatibleModels", val)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="รุ่นเครื่องที่ใช้ได้"
                error={!!fieldErr("compatibleModels")}
                helperText={fieldErr("compatibleModels") ?? "เลือกได้หลายรุ่น จากข้อมูลพื้นฐาน › รุ่น"}
              />
            )}
          />
        </Grid>
        <Grid size={12}>
          <Stack direction="row" spacing={2} alignItems="center">
            {v.image ? (
              <Box
                component="img"
                src={v.image}
                alt="รูปอะไหล่"
                sx={{ width: 96, height: 96, objectFit: "cover", borderRadius: 1, border: 1, borderColor: "divider" }}
              />
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                ยังไม่มีรูป (ไม่ใส่ก็ได้)
              </Typography>
            )}
            <Button component="label" variant="outlined" startIcon={<PhotoCameraIcon />}>
              {v.image ? "เปลี่ยนรูป" : "เพิ่มรูป"}
              <input hidden type="file" accept="image/*" onChange={(e) => pickImage(e.target.files?.[0])} />
            </Button>
            {v.image ? (
              <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => set("image", "")}>
                ลบรูป
              </Button>
            ) : null}
          </Stack>
          {fieldErr("image") ? (
            <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
              {fieldErr("image")}
            </Typography>
          ) : null}
        </Grid>
        <Grid size={12}>
          <TextField label="หมายเหตุ" multiline minRows={2} value={v.note} onChange={(e) => set("note", e.target.value)} />
        </Grid>
      </Grid>
      {err && !err.field ? (
        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
          {err.message}
        </Typography>
      ) : null}
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button variant="contained" disabled={busy} onClick={save}>
          {busy ? "กำลังบันทึก…" : existing ? "บันทึกการแก้ไข" : "เพิ่มอะไหล่"}
        </Button>
        {onCancel ? (
          <Button disabled={busy} onClick={onCancel}>
            ยกเลิก
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}
