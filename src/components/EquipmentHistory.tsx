"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { Equipment, EquipmentEvent, MoveEquipmentValues, Options } from "@/lib/types";
import { equipmentEventLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { bangkokDateTimeOr } from "@/lib/date";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid2";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import { WomsDataTable, WomsErrorState, WomsFormSection, type WomsColumn } from "@/components/woms";

function fmt(at: string): string {
  return bangkokDateTimeOr(at);
}

export interface EquipmentHistoryProps {
  equipment: Equipment;
  options: Options;
  onMoved: (updated: Equipment) => void;
}

// ประวัติเครื่อง + ฟอร์มย้ายที่อยู่ (บันทึกประวัติให้อัตโนมัติ)
export default function EquipmentHistory({ equipment, options, onMoved }: EquipmentHistoryProps) {
  const { has } = useAuth();
  const toast = useToast();
  const dialog = useDialog();
  const [items, setItems] = useState<EquipmentEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MoveEquipmentValues>({
    location: equipment.location,
    address: equipment.address,
    district: equipment.district,
    province: equipment.province,
    postcode: equipment.postcode,
    zone: equipment.zone,
    lat: equipment.lat,
    lng: equipment.lng,
    note: "",
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.equipmentHistory(equipment.id);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดประวัติไม่สำเร็จ");
    }
  }, [equipment.id, equipment.updatedAt]);


  useEffect(() => {
    load();
  }, [load]);

  const set = <K extends keyof MoveEquipmentValues>(k: K, v: MoveEquipmentValues[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  // ดึงพิกัดปัจจุบันจากมือถือ/เบราว์เซอร์
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set("lat", Number(pos.coords.latitude.toFixed(6)));
        set("lng", Number(pos.coords.longitude.toFixed(6)));
        toast.success("ดึงพิกัดปัจจุบันแล้ว");
      },
      () => toast.error("ดึงพิกัดไม่สำเร็จ — ตรวจสอบการอนุญาตตำแหน่ง")
    );
  };

  // แก้หมายเหตุของรายการประวัติ — ระบบเก็บข้อความเดิมและผู้แก้ไว้เสมอ
  const editNote = async (ev: EquipmentEvent) => {
    const note = await dialog.prompt({
      title: "แก้หมายเหตุของรายการประวัติ",
      label: "หมายเหตุ",
      help: "ระบบเก็บข้อความเดิมและผู้แก้ไว้เสมอ",
      type: "textarea",
      defaultValue: ev.note ?? "",
      confirmLabel: "บันทึกหมายเหตุ",
    });
    if (note === null) return;
    setEditingId(ev.id);
    try {
      await api.patchEquipmentEvent(equipment.id, ev.id, { note });
      toast.success("แก้ไขประวัติแล้ว");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "แก้ไขไม่สำเร็จ");
    } finally {
      setEditingId(null);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const updated = await api.moveEquipment(equipment.id, form, equipment.updatedAt);
      onMoved(updated);
      setOpen(false);
      toast.success("ย้ายเครื่องและบันทึกประวัติแล้ว");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ย้ายเครื่องไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const canEdit = has("equipment:edit");
  const small = (t: React.ReactNode) => (
    <Typography component="div" variant="body2" sx={{ fontSize: 12 }}>
      {t}
    </Typography>
  );
  const statusText = (ev: EquipmentEvent) =>
    ev.fromStatus || ev.toStatus ? `${ev.fromStatus || "—"} → ${ev.toStatus || "—"}` : "—";
  const whereCell = (ev: EquipmentEvent) =>
    ev.toLocation || ev.fromLocation ? (
      <>
        {ev.fromLocation ? small(`จาก: ${ev.fromLocation}`) : null}
        {ev.toLocation ? <div>ไป: {ev.toLocation}</div> : null}
        {ev.lat || ev.lng ? small(<span className="mono">{ev.lat}, {ev.lng}</span>) : null}
      </>
    ) : (
      "—"
    );
  const byCell = (ev: EquipmentEvent) => (
    <>
      {ev.byName || "—"}
      {ev.edited
        ? small(`แก้ไขโดย ${ev.editedByName} เมื่อ ${fmt(ev.editedAt)}${ev.originalNote ? ` · เดิม: ${ev.originalNote}` : ""}`)
        : null}
    </>
  );
  const editBtn = (ev: EquipmentEvent) => (
    <Button size="small" onClick={() => editNote(ev)} disabled={editingId === ev.id}>
      แก้หมายเหตุ
    </Button>
  );

  const columns: WomsColumn<EquipmentEvent>[] = [
    { key: "at", label: "เวลา", sortValue: (ev) => ev.at, render: (ev) => <span className="mono">{fmt(ev.at)}</span> },
    { key: "type", label: "รายการ", render: (ev) => equipmentEventLabel[ev.type] ?? ev.label },
    { key: "status", label: "สถานะ", hideBelowLg: true, render: statusText },
    { key: "where", label: "ที่อยู่", render: whereCell },
    {
      key: "ref",
      label: "อ้างอิง",
      render: (ev) => (
        <>
          {ev.refId ? <span className="code">{ev.refId}</span> : "—"}
          {ev.note ? small(ev.note) : null}
        </>
      ),
    },
    { key: "by", label: "ผู้ทำรายการ", hideBelowLg: true, render: byCell },
    ...(canEdit ? [{ key: "act", label: "จัดการ", align: "right" as const, render: editBtn }] : []),
  ];

  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <WomsFormSection
      title="ประวัติเครื่อง"
      actions={
        canEdit ? (
          <Button variant={open ? "text" : "outlined"} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? "ปิดฟอร์มย้าย" : "ย้ายเครื่อง / อัปเดตที่อยู่"}
          </Button>
        ) : undefined
      }
    >
      <Collapse in={open} unmountOnExit>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="สถานที่ / ไซต์" value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Autocomplete
              freeSolo
              options={options.zones ?? []}
              inputValue={form.zone ?? ""}
              onInputChange={(_, v) => set("zone", v)}
              renderInput={(params) => <TextField {...params} label="โซนบริการ" />}
            />
          </Grid>
          <Grid size={12}>
            <TextField label="ที่อยู่" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="อำเภอ / เขต" value={form.district ?? ""} onChange={(e) => set("district", e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="จังหวัด" value={form.province ?? ""} onChange={(e) => set("province", e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="รหัสไปรษณีย์"
              inputProps={{ inputMode: "numeric", maxLength: 5 }}
              value={form.postcode ?? ""}
              onChange={(e) => set("postcode", e.target.value)}
            />
          </Grid>
          <Grid size={12}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-start" }}>
              <TextField label="ละติจูด (lat)" type="number" inputProps={{ step: "any" }} value={form.lat ?? 0} onChange={(e) => set("lat", num(e.target.value))} />
              <TextField label="ลองจิจูด (lng)" type="number" inputProps={{ step: "any" }} value={form.lng ?? 0} onChange={(e) => set("lng", num(e.target.value))} />
              <Button variant="outlined" startIcon={<MyLocationIcon />} onClick={useMyLocation} sx={{ flexShrink: 0, minHeight: 40 }}>
                ตำแหน่งฉัน
              </Button>
            </Stack>
          </Grid>
          <Grid size={12}>
            <TextField
              label="เหตุผล / หมายเหตุการย้าย"
              value={form.note ?? ""}
              onChange={(e) => set("note", e.target.value)}
              placeholder="เช่น ย้ายไปติดตั้งที่สาขาใหม่ตามใบงาน JN-2026-0012"
            />
          </Grid>
          <Grid size={12}>
            <Button variant="contained" onClick={submit} disabled={busy}>
              {busy ? "กำลังบันทึก…" : "บันทึกการย้าย"}
            </Button>
          </Grid>
        </Grid>
      </Collapse>

      {error ? (
        <WomsErrorState message={error} onRetry={load} />
      ) : (
        <WomsDataTable
          caption="ประวัติเครื่อง"
          rows={items ?? []}
          loading={!items}
          columns={columns}
          rowKey={(ev) => ev.id}
          pageSize={10}
          emptyTitle="ยังไม่มีประวัติของเครื่องนี้"
          renderCard={(ev) => (
            <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{equipmentEventLabel[ev.type] ?? ev.label}</Typography>
                {canEdit ? editBtn(ev) : null}
              </Stack>
              <Typography variant="body2" className="mono">
                {fmt(ev.at)}
              </Typography>
              {ev.fromStatus || ev.toStatus ? <Typography variant="body2">สถานะ: {statusText(ev)}</Typography> : null}
              <Box sx={{ mt: 0.5 }}>{whereCell(ev)}</Box>
              {ev.refId ? <span className="code">{ev.refId}</span> : null}
              {ev.note ? small(ev.note) : null}
              <Box sx={{ mt: 0.5 }}>{small(byCell(ev))}</Box>
            </Box>
          )}
        />
      )}
    </WomsFormSection>
  );
}
