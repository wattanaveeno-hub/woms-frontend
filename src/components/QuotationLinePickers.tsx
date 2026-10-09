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
export function EquipmentPicker({
  equipmentId,
  serial,
  onChange,
  label,
}: {
  equipmentId?: string;
  serial?: string;
  onChange: (equipmentId: string, serial: string) => void;
  label: string;
}) {
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
      api
        .listEquipment({ q })
        .then((r) => {
          if (my === seq.current) setOptions(r.items.slice(0, 30).map((e: Equipment) => ({ id: e.id, serial: e.serial, model: e.model })));
        })
        .catch(() => {
          if (my === seq.current) setOptions([]);
        })
        .finally(() => {
          if (my === seq.current) setLoading(false);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  return (
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
