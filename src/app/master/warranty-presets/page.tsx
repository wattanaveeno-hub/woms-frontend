"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { WarrantyPreset, WarrantyPresetItem, WarrantyProvider } from "@/lib/types";
import { warrantyProviderLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid2";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  WomsDataTable,
  WomsFormSection,
  WomsPageHeader,
  WomsPermissionGate,
  WomsStatusChip,
  type WomsColumn,
} from "@/components/woms";

const PROVIDERS: WarrantyProvider[] = ["BRAND", "AGENT", "OTHER"];

const EMPTY_ITEM: WarrantyPresetItem = { provider: "BRAND", providerName: "", months: 12, coverage: "" };

// ตั้งโปรไฟล์ประกันสำเร็จรูป — ตอนรับเครื่องเข้าคลังเลือกทีเดียว ระบบเติมประกันให้ครบ
// โดยใช้วันรับเข้าคลังเป็นวันเริ่มประกันอัตโนมัติ
function WarrantyPresets() {
  const { has } = useAuth();
  const toast = useToast();
  const dialog = useDialog();
  const canManage = has("master:manage");

  const [items, setItems] = useState<WarrantyPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [rows, setRows] = useState<WarrantyPresetItem[]>([{ ...EMPTY_ITEM }]);

  const [nameErr, setNameErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listWarrantyPresets();
      setItems(res.items);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setRow = (i: number, patch: Partial<WarrantyPresetItem>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const reset = () => {
    setName("");
    setNote("");
    setIsDefault(false);
    setRows([{ ...EMPTY_ITEM }]);
  };

  const create = async () => {
    if (!name.trim()) {
      setNameErr("ต้องระบุชื่อโปรไฟล์");
      return;
    }
    setNameErr(null);
    const valid = rows.filter((r) => r.months > 0);
    if (!valid.length) return toast.error("ต้องมีประกันอย่างน้อย 1 ชุด");
    setBusy(true);
    try {
      await api.createWarrantyPreset({ name: name.trim(), items: valid, isDefault, note });
      toast.success("เพิ่มโปรไฟล์แล้ว");
      reset();
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (p: WarrantyPreset) => {
    try {
      await api.patchWarrantyPreset(p.id, { isDefault: true });
      toast.success(`ตั้ง ${p.name} เป็นค่าตั้งต้นแล้ว`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "อัปเดตไม่สำเร็จ");
    }
  };

  const remove = async (p: WarrantyPreset) => {
    if (
      !(await dialog.confirm({
        title: `ลบโปรไฟล์ "${p.name}"?`,
        message: "เครื่องที่เคยใช้โปรไฟล์นี้จะยังเก็บค่าประกันเดิมไว้",
        confirmLabel: "ยืนยันลบ",
        danger: true,
      }))
    )
      return;
    try {
      await api.deleteWarrantyPreset(p.id);
      toast.success("ลบแล้ว");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ลบไม่สำเร็จ");
    }
  };

  const nameCell = (p: WarrantyPreset) => (
    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
      <span className="code">{p.name}</span>
      {p.isDefault ? <WomsStatusChip label="ค่าตั้งต้น" tone="success" /> : null}
    </Stack>
  );
  const actions = (p: WarrantyPreset) => (
    <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
      {!p.isDefault ? (
        <Button size="small" onClick={() => makeDefault(p)}>
          ตั้งเป็นค่าตั้งต้น
        </Button>
      ) : null}
      <Button size="small" color="error" onClick={() => remove(p)}>
        ลบ
      </Button>
    </Stack>
  );
  const columns: WomsColumn<WarrantyPreset>[] = [
    { key: "name", label: "ชื่อโปรไฟล์", sortValue: (p) => p.name, render: nameCell },
    { key: "summary", label: "ชุดประกัน", render: (p) => p.summary },
    { key: "note", label: "หมายเหตุ", hideBelowLg: true, render: (p) => p.note || "—" },
    ...(canManage ? [{ key: "act", label: "จัดการ", align: "right" as const, render: actions }] : []),
  ];

  return (
    <>
      <WomsPageHeader
        title="โปรไฟล์ประกัน"
        subtitle={`ชุดประกันสำเร็จรูปที่ใช้ตอนรับเครื่องเข้าคลัง · ${items.length} โปรไฟล์`}
        actions={
          <Button component={Link} href="/master" startIcon={<ArrowBackIcon />}>
            ข้อมูลพื้นฐาน
          </Button>
        }
      />

      {canManage ? (
        <WomsFormSection title="เพิ่มโปรไฟล์ใหม่">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                required
                id="preset-name"
                label="ชื่อโปรไฟล์"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameErr(null);
                }}
                placeholder="เช่น มาตรฐาน RO"
                error={!!nameErr}
                helperText={nameErr}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel
                control={<Checkbox checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />}
                label="ใช้โปรไฟล์นี้เป็นค่าแนะนำในฟอร์มรับเครื่อง"
              />
            </Grid>
            {rows.map((r, i) => (
              <Grid size={12} key={i}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Grid container spacing={1.5} alignItems="flex-start">
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <TextField select size="small" label="ผู้รับประกัน" value={r.provider} onChange={(e) => setRow(i, { provider: e.target.value as WarrantyProvider })}>
                        {PROVIDERS.map((p) => (
                          <MenuItem key={p} value={p}>
                            {warrantyProviderLabel[p]}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <TextField size="small" label="ชื่อแบรนด์/ตัวแทน" value={r.providerName} onChange={(e) => setRow(i, { providerName: e.target.value })} />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 2 }}>
                      <TextField size="small" label="เดือน" type="number" inputProps={{ min: 1 }} value={r.months} onChange={(e) => setRow(i, { months: Number(e.target.value) })} />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <TextField size="small" label="ขอบเขต" value={r.coverage} onChange={(e) => setRow(i, { coverage: e.target.value })} placeholder="เช่น อะไหล่และค่าแรง" />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 1 }} sx={{ textAlign: "right" }}>
                      <IconButton
                        color="error"
                        aria-label={`ลบชุดประกันที่ ${i + 1}`}
                        onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                        disabled={rows.length === 1}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            ))}
            <Grid size={12}>
              <Button startIcon={<AddIcon />} onClick={() => setRows((prev) => [...prev, { ...EMPTY_ITEM, provider: "AGENT" }])}>
                เพิ่มชุดประกัน
              </Button>
            </Grid>
            <Grid size={12}>
              <TextField label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} />
            </Grid>
          </Grid>
          <Button variant="contained" onClick={create} disabled={busy} sx={{ mt: 2 }}>
            {busy ? "กำลังบันทึก…" : "เพิ่มโปรไฟล์"}
          </Button>
        </WomsFormSection>
      ) : null}

      <WomsDataTable
        caption="โปรไฟล์ประกัน"
        rows={items}
        loading={loading}
        error={error}
        onRetry={load}
        columns={columns}
        rowKey={(p) => p.id}
        pageSize={25}
        emptyTitle="ยังไม่มีโปรไฟล์ประกัน"
        renderCard={(p) => (
          <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
            {nameCell(p)}
            <Typography variant="body2" sx={{ color: "text.primary", mt: 0.5 }}>
              {p.summary}
            </Typography>
            {p.note ? <Typography variant="body2">{p.note}</Typography> : null}
            {canManage ? <Box sx={{ mt: 1 }}>{actions(p)}</Box> : null}
          </Box>
        )}
      />
    </>
  );
}

// คงสิทธิ์เดิม: ดูรายการได้ตาม equipment:view (ตรงกับ GET /api/warranty-presets) · เพิ่ม/ลบ/ตั้งค่าตั้งต้นได้เฉพาะ master:manage
export default function WarrantyPresetsPage() {
  return (
    <WomsPermissionGate perm="equipment:view">
      <WarrantyPresets />
    </WomsPermissionGate>
  );
}
