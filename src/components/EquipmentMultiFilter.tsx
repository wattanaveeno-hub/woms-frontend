"use client";

// MCH-01 (Audit A D-14) — ตัวกรองแบบ "เลือกติ๊ก" ได้หลายค่า
// ค่าเก็บเป็นข้อความคั่นด้วยจุลภาค (เช่น "IN_STOCK,RENTED") ให้ลง URL ได้เหมือนตัวกรองเดิม
// backend (GET /api/equipment) แปลงเป็นหลายค่าเอง — ว่าง = ทั้งหมด
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";

export function splitMulti(v: string): string[] {
  return (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function EquipmentMultiFilter({
  label,
  value,
  onChange,
  options,
  allLabel = "ทั้งหมด",
  minWidth = 150,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  allLabel?: string;
  minWidth?: number;
}) {
  const selected = splitMulti(value);
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  return (
    <TextField
      select
      label={label}
      value={selected}
      fullWidth={false}
      sx={{ minWidth }}
      InputLabelProps={{ shrink: true }}
      SelectProps={{
        multiple: true,
        displayEmpty: true,
        renderValue: (sel) => {
          const list = sel as string[];
          if (!list.length) return allLabel;
          return list.length <= 2 ? list.map(labelOf).join(", ") : `${labelOf(list[0])} +${list.length - 1}`;
        },
        onChange: (e) => {
          const raw = e.target.value as unknown as string[] | string;
          const list = typeof raw === "string" ? splitMulti(raw) : raw;
          // คงลำดับตามรายการตัวเลือก เพื่อให้ URL เหมือนกันทุกครั้ง
          onChange(options.map((o) => o.value).filter((v) => list.includes(v)).join(","));
        },
      }}
    >
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value} dense>
          <Checkbox size="small" checked={selected.includes(o.value)} sx={{ p: 0.5, mr: 1 }} />
          <ListItemText primary={o.label} />
        </MenuItem>
      ))}
    </TextField>
  );
}
