"use client";
// D-07A: ช่อง ประเภท → หมวดหมู่ → รุ่น จาก Equipment Model Master (กรองตามลำดับ + Auto Fill + ราคามาตรฐาน)
//   · รุ่นพิมพ์เองได้ (ข้อมูลเดิมที่ยังไม่อยู่ใน master — D-07B) · backend ตรวจความสัมพันธ์ซ้ำทุกครั้ง
import { useEffect, useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { api } from "@/lib/api";
import {
  categoriesFor,
  cascadeProblem,
  changeCategory,
  changeModel,
  changeType,
  matchMaster,
  modelsFor,
  type CascadeValue,
  type MasterRow,
} from "@/lib/equipmentModelCascade";

/** ประเภทเดิมของระบบ (ยังใช้กับเครื่องเดิม) — รวมกับประเภทใน master */
export const LEGACY_MACHINE_TYPES = ["ตู้แช่", "เครื่องทำน้ำแข็ง", "อื่น ๆ"];

let cacheRows: MasterRow[] | null = null;
let cachePromise: Promise<MasterRow[]> | null = null;
export function loadEquipmentModelRows(force = false): Promise<MasterRow[]> {
  if (!force && cacheRows) return Promise.resolve(cacheRows);
  if (!force && cachePromise) return cachePromise;
  cachePromise = api
    .listEquipmentModels()
    .then((r) => (cacheRows = r.items.filter((x) => x.active)))
    .catch(() => (cacheRows = []))
    .finally(() => (cachePromise = null));
  return cachePromise;
}

export interface EquipmentModelFieldsProps {
  value: CascadeValue;
  onChange: (next: CascadeValue, master: MasterRow | null) => void;
  /** ฟอร์มที่ไม่มีช่องหมวดหมู่ (คิว / ใบงาน) */
  hasCategory?: boolean;
  modelRequired?: boolean;
  disabled?: boolean;
  size?: "small" | "medium";
  /** ขนาดคอลัมน์ของแต่ละช่อง */
  col?: Record<string, number>;
  errors?: Partial<Record<"machineType" | "category" | "model", string>>;
  idPrefix?: string;
  /** แสดงราคามาตรฐานจาก master ใต้ช่องรุ่น */
  showPrice?: boolean;
  labels?: Partial<Record<"machineType" | "category" | "model", string>>;
}

export default function EquipmentModelFields({
  value,
  onChange,
  hasCategory = true,
  modelRequired = false,
  disabled,
  size = "medium",
  col = { xs: 12, sm: 4 },
  errors = {},
  idPrefix = "eqm",
  showPrice = true,
  labels = {},
}: EquipmentModelFieldsProps) {
  const [rows, setRows] = useState<MasterRow[]>(cacheRows ?? []);
  useEffect(() => {
    let alive = true;
    void loadEquipmentModelRows().then((r) => alive && setRows(r));
    return () => {
      alive = false;
    };
  }, []);

  const types = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of [...LEGACY_MACHINE_TYPES, ...rows.map((r) => r.type), value.machineType].filter(Boolean)) if (!m.has(t.trim().toUpperCase())) m.set(t.trim().toUpperCase(), t);
    return [...m.values()];
  }, [rows, value.machineType]);
  const categories = useMemo(() => {
    const c = categoriesFor(value.machineType, rows);
    return value.category && !c.includes(value.category) ? [...c, value.category] : c;
  }, [rows, value.machineType, value.category]);
  const modelOptions = useMemo(() => modelsFor(value.machineType, hasCategory ? value.category : "", rows), [rows, value.machineType, value.category, hasCategory]);
  // ฟอร์มที่ไม่มีหมวดหมู่ใช้ค่าว่างแทน (ไม่ส่งหมวดหมู่ออกไป)
  const v0: CascadeValue = hasCategory ? { ...value, category: value.category ?? "" } : { ...value, category: "" };
  const master = matchMaster(v0, rows);
  const problem = cascadeProblem(v0, rows, { hasCategory });

  const emit = (r: CascadeValue & { master: MasterRow | null }) => {
    const { master: m, ...v } = r;
    onChange(hasCategory ? v : { ...v, category: value.category ?? "" }, m);
  };

  return (
    <>
      <Grid size={col}>
        <TextField
          select
          fullWidth
          size={size}
          id={`${idPrefix}-machineType`}
          label={labels.machineType ?? "ประเภทเครื่อง"}
          value={value.machineType}
          disabled={disabled}
          onChange={(e) => emit(changeType(v0, e.target.value, rows))}
          error={!!errors.machineType}
          helperText={errors.machineType || (value.machineType === "อื่น ๆ" ? "ระบุรายละเอียดในหมายเหตุ" : " ")}
          SelectProps={{ displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
          inputProps={{ "data-testid": `${idPrefix}-type` }}
        >
          <MenuItem value="">— ไม่ระบุ —</MenuItem>
          {types.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      {hasCategory ? (
        <Grid size={col}>
          <TextField
            select
            fullWidth
            size={size}
            id={`${idPrefix}-category`}
            label={labels.category ?? "หมวดหมู่"}
            value={value.category}
            disabled={disabled}
            onChange={(e) => emit(changeCategory(v0, e.target.value, rows))}
            error={!!errors.category}
            helperText={errors.category || (value.machineType && !categoriesFor(value.machineType, rows).length ? "ประเภทนี้ยังไม่มีหมวดหมู่ในข้อมูลหลัก" : " ")}
            SelectProps={{ displayEmpty: true }}
            InputLabelProps={{ shrink: true }}
            inputProps={{ "data-testid": `${idPrefix}-category` }}
          >
            <MenuItem value="">— ไม่ระบุ —</MenuItem>
            {categories.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      ) : null}
      <Grid size={col}>
        <Autocomplete
          freeSolo
          size={size}
          disabled={disabled}
          options={modelOptions}
          getOptionLabel={(o) => (typeof o === "string" ? o : o.model)}
          renderOption={(props, o) => (
            <li {...props} key={(o as MasterRow).id}>
              {(o as MasterRow).model}
              <span style={{ marginLeft: 8, opacity: 0.6, fontSize: "0.85em" }}>
                {(o as MasterRow).type}
                {hasCategory ? ` / ${(o as MasterRow).category}` : ""}
              </span>
            </li>
          )}
          inputValue={value.model}
          onInputChange={(_, val, reason) => {
            if (reason === "input" || reason === "clear") emit(changeModel(v0, val, rows));
          }}
          onChange={(_, val) => {
            if (val && typeof val !== "string") emit(changeModel(v0, val.model, rows, val));
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              id={`${idPrefix}-model`}
              label={labels.model ?? "รุ่นเครื่อง"}
              required={modelRequired}
              error={!!errors.model || !!problem}
              helperText={
                errors.model ||
                problem ||
                (master && showPrice ? `ราคามาตรฐาน ${master.standardPrice.toLocaleString("th-TH")} บาท (ข้อมูลหลัก)` : value.model && rows.length ? "รุ่นนี้ยังไม่อยู่ในข้อมูลหลัก" : " ")
              }
              inputProps={{ ...params.inputProps, "data-testid": `${idPrefix}-model` }}
            />
          )}
        />
      </Grid>
    </>
  );
}
