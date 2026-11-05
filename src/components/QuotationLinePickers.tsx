"use client";

// Round 8 — ตัวเลือกของรายการใบเสนอราคา (QUO-02): ชนิดรายการ / เครื่องที่รับบริการ / อะไหล่
// อะไหล่แสดงเป็น "ชื่อ" เป็นหลัก รหัสใช้ช่วยค้นในหน้าจอภายในเท่านั้น (เอกสารถึงลูกค้าไม่แสดงรหัส)
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Equipment, Part } from "@/lib/types";
import { QUOTATION_LINE_KIND_LABEL } from "@/lib/contractQuoApi";
import Autocomplete from "@mui/material/Autocomplete";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import AddIcon from "@mui/icons-material/Add";

export function LineKindSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: "" | "SERVICE" | "PART" | "PM_PACKAGE" | "OTHER") => void;
  label: string;
}) {
  return (
    <TextField
      select
      size="small"
      label="ชนิด"
      value={value}
      onChange={(e) => onChange(e.target.value as "" | "SERVICE" | "PART" | "PM_PACKAGE" | "OTHER")}
      inputProps={{ "aria-label": label }}
      sx={{ minWidth: 130 }}
    >
      <MenuItem value="">ไม่ระบุ</MenuItem>
      {Object.entries(QUOTATION_LINE_KIND_LABEL).map(([k, v]) => (
        <MenuItem key={k} value={k}>
          {v}
        </MenuItem>
      ))}
    </TextField>
  );
}

type EqOption = { id: string; serial: string; model: string };

/** ค้นเครื่องจากฐานข้อมูลกลางด้วย serial/รุ่น (ค้นฝั่งเซิร์ฟเวอร์) */
/** OD-QT-01 Rev2: แหล่งเครื่องของรายการ — เครื่องของลูกค้า (ตามลูกค้า/สาขาในใบ) หรือ Stock กลาง (ในคลัง ยังไม่ผูกลูกค้า) */
export type EquipmentSource = "CUSTOMER" | "STOCK";
export function EquipmentPicker({
  equipmentId,
  serial,
  onChange,
  label,
  customerId,
  siteId,
}: {
  equipmentId?: string;
  serial?: string;
  onChange: (equipmentId: string, serial: string) => void;
  label: string;
  customerId?: string;
  siteId?: string;
}) {
  const [source, setSource] = useState<EquipmentSource>(customerId ? "CUSTOMER" : "STOCK");
  // OD-R9-03 (Owner อนุมัติ รอบ 10): เลือกลูกค้าแล้วค่าเริ่มต้นเป็น "เครื่องของลูกค้า" (เดิมค้าง Stock กลางจากตอน mount)
  //   ผู้ใช้เลือกแหล่งเองแล้ว / แก้ไขรายการที่มีเครื่องอยู่ → ไม่เปลี่ยนให้ · แหล่งของรายการเดิมอนุมานจากเครื่องที่เลือก
  const sourceLocked = useRef(false);
  useEffect(() => {
    if (sourceLocked.current) return;
    if (customerId) setSource("CUSTOMER");
  }, [customerId]);
  useEffect(() => {
    if (!equipmentId || sourceLocked.current) return;
    let alive = true;
    api
      .getEquipment(equipmentId)
      .then((e) => {
        if (!alive || sourceLocked.current) return;
        sourceLocked.current = true;
        setSource(String((e as any).customerId ?? "").trim() ? "CUSTOMER" : "STOCK");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // ตรวจครั้งเดียวต่อรายการที่มีเครื่องอยู่แล้วตอนเปิด (โหมดแก้ไข)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [input, setInput] = useState("");
  const [options, setOptions] = useState<EqOption[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const value: EqOption | null = equipmentId ? { id: equipmentId, serial: serial || equipmentId, model: "" } : null;

  useEffect(() => {
    const q = input.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    const my = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      const req =
        source === "CUSTOMER" && customerId
          ? api.listEquipment({ q, customerId, siteId: siteId || undefined })
          : api.listEquipment({ q, status: "IN_STOCK" });
      req
        .then((r) => {
          const rows = source === "STOCK" || !customerId ? r.items.filter((e: Equipment) => !(e as any).customerId) : r.items;
          if (my === seq.current) setOptions(rows.slice(0, 30).map((e: Equipment) => ({ id: e.id, serial: e.serial, model: e.model })));
        })
        .catch(() => {
          if (my === seq.current) setOptions([]);
        })
        .finally(() => {
          if (my === seq.current) setLoading(false);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [input, source, customerId, siteId]);

  return (
    <Stack direction="row" spacing={1}>
    <TextField
      select
      size="small"
      label="แหล่งเครื่อง"
      value={customerId ? source : "STOCK"}
      onChange={(e) => {
        sourceLocked.current = true;
        setSource(e.target.value as EquipmentSource);
        setOptions([]);
      }}
      inputProps={{ "data-testid": "equipment-source" }}
      sx={{ minWidth: 150 }}
      helperText="ไม่เลือกเครื่องก็ได้ (Service Only) · การเลือกไม่ใช่การจอง"
    >
      <MenuItem value="CUSTOMER" disabled={!customerId}>เครื่องของลูกค้า</MenuItem>
      <MenuItem value="STOCK">Stock กลาง (ในคลัง)</MenuItem>
    </TextField>
    <Autocomplete
      size="small"
      options={options}
      value={value}
      loading={loading}
      filterOptions={(x) => x}
      getOptionLabel={(o) => (o.model ? `${o.serial} · ${o.model}` : o.serial)}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      onInputChange={(_, v, reason) => {
        if (reason === "input") setInput(v);
      }}
      onChange={(_, o) => onChange(o?.id ?? "", o?.serial ?? "")}
      noOptionsText={input.trim().length < 2 ? "พิมพ์ serial อย่างน้อย 2 ตัว" : "ไม่พบเครื่อง"}
      renderInput={(params) => (
        <TextField {...params} label="เครื่องที่รับบริการ" placeholder="ค้นด้วย serial" inputProps={{ ...params.inputProps, "aria-label": label }} />
      )}
      sx={{ minWidth: 200 }}
    />
    </Stack>
  );
}

/**
 * เลือกอะไหล่จากรายการที่โหลดไว้ — แสดงชื่อเป็นหลัก
 * PART-03 "หากไม่มีก็เพิ่มได้" — ส่ง onCreateNew (ผู้มีสิทธิ์ stock:manage) เพื่อแสดงปุ่มเพิ่มอะไหล่ใหม่
 */
export function PartPicker({
  parts,
  partId,
  partName,
  onChange,
  label,
  onCreateNew,
}: {
  parts: Part[];
  partId?: string;
  partName?: string;
  onChange: (part: Part | null) => void;
  label: string;
  onCreateNew?: () => void;
}) {
  const found = parts.find((p) => p.id === partId) ?? null;
  const value: Part | null = found ?? (partId ? ({ id: partId, name: partName || "", code: "" } as Part) : null);
  const picker = (
    <Autocomplete
      size="small"
      options={parts}
      value={value}
      getOptionLabel={(p) => p.name}
      renderOption={(props, p) => (
        <li {...props} key={p.id}>
          {p.name}
          {p.code ? <span style={{ opacity: 0.6, marginLeft: 8, fontSize: "0.85em" }}>({p.code})</span> : null}
        </li>
      )}
      filterOptions={(opts, st) => {
        const q = st.inputValue.trim().toLowerCase();
        return q ? opts.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)).slice(0, 50) : opts.slice(0, 50);
      }}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      onChange={(_, p) => onChange(p)}
      noOptionsText="ไม่พบอะไหล่"
      renderInput={(params) => (
        <TextField {...params} label="อะไหล่" placeholder="ค้นด้วยชื่อ" inputProps={{ ...params.inputProps, "aria-label": label }} />
      )}
      sx={{ minWidth: 200 }}
    />
  );
  if (!onCreateNew) return picker;
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {picker}
      <Button size="small" startIcon={<AddIcon />} onClick={onCreateNew} aria-label={`เพิ่มอะไหล่ใหม่ — ${label}`} sx={{ whiteSpace: "nowrap" }}>
        เพิ่มอะไหล่ใหม่
      </Button>
    </Stack>
  );
}
