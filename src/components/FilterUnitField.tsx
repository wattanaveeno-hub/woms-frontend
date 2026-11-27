"use client";

// ---------------------------------------------------------------------------
// MOM-09 (MoM 23/11/69): ช่อง "เครื่องกรอง" เป็น dropdown จากข้อมูลหลัก (master kind = filter_unit)
// ค้นหาได้ · ยังพิมพ์ค่าที่ไม่อยู่ในรายการได้ (ข้อมูลเดิมเป็นข้อความ — ไม่ทำให้ค่าเดิมหาย)
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { api } from "@/lib/api";

let cache: string[] | null = null;
let pending: Promise<string[]> | null = null;
function loadFilterUnits(): Promise<string[]> {
  if (cache) return Promise.resolve(cache);
  if (pending) return pending;
  pending = api
    .getOptions()
    .then((o) => (cache = o.filterUnits ?? []))
    .catch(() => (cache = []))
    .finally(() => (pending = null));
  return pending;
}

export default function FilterUnitField({
  value,
  onChange,
  size,
  label = "เครื่องกรอง",
  fullWidth = true,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  size?: "small" | "medium";
  label?: string;
  fullWidth?: boolean;
  testId?: string;
}) {
  const [options, setOptions] = useState<string[]>(cache ?? []);
  useEffect(() => {
    let alive = true;
    void loadFilterUnits().then((o) => alive && setOptions(o));
    return () => {
      alive = false;
    };
  }, []);
  const legacy = !!value.trim() && options.length > 0 && !options.includes(value.trim());
  return (
    <Autocomplete
      freeSolo
      openOnFocus
      autoHighlight
      fullWidth={fullWidth}
      size={size}
      options={options}
      inputValue={value}
      onInputChange={(_e, v) => onChange(v)}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={options.length ? "เลือกหรือพิมพ์ค้นหา" : "พิมพ์รุ่นเครื่องกรอง"}
          helperText={legacy ? "ค่านี้ไม่อยู่ในข้อมูลหลัก (เพิ่มได้ที่ ข้อมูลพื้นฐาน › เครื่องกรองน้ำ)" : undefined}
          inputProps={{ ...params.inputProps, "data-testid": testId }}
        />
      )}
    />
  );
}
