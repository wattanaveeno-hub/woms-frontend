"use client";
// D-07A: ช่อง ประเภท → หมวดหมู่ → รุ่น จาก Equipment Model Master (กรองตามลำดับ + Auto Fill)
//   Auto Fill เติมเฉพาะประเภท/หมวดหมู่/รุ่น — ไม่เติมต้นทุนมาตรฐานลงช่องราคาใด ๆ (owner decision 30 ต.ค. 69)
//   · backend ตรวจความสัมพันธ์ซ้ำทุกครั้ง
// EQ-02: ทั้ง 3 ช่องเป็น Searchable Dropdown (MUI Autocomplete) — คลิกแล้วแสดงรายการ · พิมพ์ค้นในช่องเดียวกัน (contains ·
//   ไม่สนตัวพิมพ์) · ปุ่มล้าง + ลูกศร · เลือกได้เฉพาะค่าใน master (ไม่รับข้อความพิมพ์เอง)
//   · ค่าเดิมที่ไม่อยู่ใน master (ข้อมูลก่อน D-07B) แสดงเป็น "ข้อมูลเดิม" — เปิด/บันทึกเอกสารเดิมได้ ค่าไม่หาย
//   · รุ่นชื่อซ้ำต่างหมวดหมู่ เลือกตามแถว master (id) และแสดงประเภท/หมวดหมู่กำกับ
import { useEffect, useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import type { FilterOptionsState } from "@mui/material/useAutocomplete";
import Grid from "@mui/material/Grid2";
import TextField from "@mui/material/TextField";
import { api } from "@/lib/api";
import {
  cascadeProblem,
  categoriesFor,
  categoryOptionsFor,
  changeCategory,
  changeModel,
  changeType,
  inferCategory,
  matchMaster,
  matchesQuery,
  modelOptionsFor,
  modelValueFor,
  normKey,
  typeOptionsFor,
  type CascadeValue,
  type MasterRow,
  type ModelOption,
  type TextOption,
} from "@/lib/equipmentModelCascade";

/** ประเภทเดิมของระบบ (ยังใช้กับเครื่องเดิม · backend MACHINE_TYPES) — รวมกับประเภทใน master */
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
  /** ฟอร์มที่บันทึกหมวดหมู่ (คลังเครื่อง) · false = ไม่บันทึกหมวดหมู่ (คิว / ใบงาน) */
  hasCategory?: boolean;
  /** EQ-02: ฟอร์มที่ไม่บันทึกหมวดหมู่ แสดงช่องหมวดหมู่ไว้กรองรุ่น (ไม่ส่งค่าออกไป · เปิดเอกสารเดิมอนุมานจาก master) */
  categoryFilterOnly?: boolean;
  modelRequired?: boolean;
  disabled?: boolean;
  size?: "small" | "medium";
  /** ขนาดคอลัมน์ของแต่ละช่อง */
  col?: Record<string, number>;
  errors?: Partial<Record<"machineType" | "category" | "model", string>>;
  idPrefix?: string;
  /** แสดงต้นทุนมาตรฐานจาก master ใต้ช่องรุ่น (เฉพาะเมื่อ API ส่งค่า = ผู้มีสิทธิ์ดูต้นทุน) */
  showPrice?: boolean;
  labels?: Partial<Record<"machineType" | "category" | "model", string>>;
  /** DATA-GAP-Q1: แถว master ที่บันทึกไว้ (เปิดเอกสารเดิม) — รุ่นชื่อซ้ำแสดงแถว/หมวดหมู่ที่ผู้ใช้เคยเลือก */
  masterId?: string;
}

const NO_OPTIONS = "ไม่พบรายการในข้อมูลหลัก";
const LEGACY_SUFFIX = " (ข้อมูลเดิม · ไม่อยู่ในข้อมูลหลัก)";

function filterText(options: TextOption[], state: FilterOptionsState<TextOption>) {
  return options.filter((o) => matchesQuery(o.value, state.inputValue));
}
function filterModels(options: ModelOption[], state: FilterOptionsState<ModelOption>) {
  return options.filter((o) => matchesQuery(o.model, state.inputValue));
}

export default function EquipmentModelFields({
  value,
  onChange,
  hasCategory = true,
  categoryFilterOnly = false,
  modelRequired = false,
  disabled,
  size = "medium",
  col = { xs: 12, sm: 4 },
  errors = {},
  idPrefix = "eqm",
  showPrice = true,
  labels = {},
  masterId = "",
}: EquipmentModelFieldsProps) {
  const [rows, setRows] = useState<MasterRow[]>(cacheRows ?? []);
  useEffect(() => {
    let alive = true;
    void loadEquipmentModelRows().then((r) => alive && setRows(r));
    return () => {
      alive = false;
    };
  }, []);
  // EQ-02: หมวดหมู่สำหรับกรองเท่านั้น (ฟอร์มที่ไม่บันทึกหมวดหมู่) · ค่าเริ่มต้นอนุมานจากประเภท+รุ่นเดิม (ตรงชุดเดียว)
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  // EQ-02: แถว master ที่ผู้ใช้เลือกล่าสุด — รุ่นชื่อซ้ำต่างหมวดหมู่ในฟอร์มที่ไม่บันทึกหมวดหมู่
  const [pickedId, setPickedId] = useState(masterId);
  const showCategory = hasCategory || categoryFilterOnly;
  // DATA-GAP-Q1: แถวที่บันทึกไว้ (ยังใช้งานและตรงรุ่น/ประเภทปัจจุบัน) กำหนดหมวดหมู่กรองเริ่มต้น — ไม่เดาเมื่อไม่มี id
  const savedRow = masterId
    ? rows.find((r) => r.id === masterId && normKey(r.model) === normKey(value.model) && (!value.machineType || normKey(r.type) === normKey(value.machineType)))
    : undefined;
  const category = hasCategory
    ? value.category ?? ""
    : categoryFilterOnly
      ? filterCategory ?? savedRow?.category ?? inferCategory(value.machineType, value.model, rows)
      : "";

  const typeOpts = useMemo(() => typeOptionsFor(rows, value.machineType, LEGACY_MACHINE_TYPES), [rows, value.machineType]);
  const categoryOpts = useMemo(() => categoryOptionsFor(value.machineType, rows, hasCategory ? category : ""), [rows, value.machineType, category, hasCategory]);
  const modelOpts = useMemo(() => modelOptionsFor(value.machineType, showCategory ? category : "", rows, value.model), [rows, value.machineType, category, showCategory, value.model]);

  // ค่าที่ใช้กับกติกาลำดับชั้น: ฟอร์มที่ไม่บันทึกหมวดหมู่ใช้หมวดหมู่กรอง (ถ้ามี) แต่ไม่ส่งออกไป
  const v0: CascadeValue = { ...value, category: showCategory ? category : "" };
  const master = matchMaster(v0, rows);
  const problem = cascadeProblem(v0, rows, { hasCategory });
  const typeValue = typeOpts.find((o) => o.value === value.machineType) ?? null;
  const categoryValue = category ? categoryOpts.find((o) => o.value === category) ?? { value: category, legacy: true } : null;
  const modelValue = modelValueFor(v0, rows, modelOpts, pickedId);

  const emit = (r: CascadeValue & { master: MasterRow | null }) => {
    const { master: m, ...v } = r;
    if (!hasCategory && categoryFilterOnly) setFilterCategory(v.category);
    onChange(hasCategory ? v : { ...v, category: value.category ?? "" }, m);
  };

  const legacyHelp = (o: TextOption | ModelOption | null) => !!o && !!o.legacy;

  return (
    <>
      <Grid size={col}>
        <Autocomplete<TextOption>
          id={`${idPrefix}-machineType`}
          size={size}
          disabled={disabled}
          options={typeOpts}
          value={typeValue}
          openOnFocus
          autoHighlight
          filterOptions={filterText}
          getOptionLabel={(o) => o.value}
          isOptionEqualToValue={(a, b) => a.value === b.value}
          noOptionsText={NO_OPTIONS}
          renderOption={(props, o) => (
            <li {...props} key={o.value}>
              {o.value}
              {o.legacy ? <span style={{ marginLeft: 8, opacity: 0.6, fontSize: "0.85em" }}>{LEGACY_SUFFIX}</span> : null}
            </li>
          )}
          onChange={(_, o) => {
            setPickedId("");
            emit(changeType(v0, o?.value ?? "", rows));
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={labels.machineType ?? "ประเภทเครื่อง"}
              placeholder="พิมพ์ค้นหาหรือเลือก"
              error={!!errors.machineType}
              helperText={errors.machineType || (value.machineType === "อื่น ๆ" ? "ระบุรายละเอียดในหมายเหตุ" : legacyHelp(typeValue) ? "ประเภทเดิมของเครื่องนี้ ไม่อยู่ในรายการ" : " ")}
              InputLabelProps={{ shrink: true }}
              inputProps={{ ...params.inputProps, "data-testid": `${idPrefix}-type` }}
            />
          )}
        />
      </Grid>
      {showCategory ? (
        <Grid size={col}>
          <Autocomplete<TextOption>
            id={`${idPrefix}-category`}
            size={size}
            disabled={disabled}
            options={categoryOpts}
            value={categoryValue}
            openOnFocus
            autoHighlight
            filterOptions={filterText}
            getOptionLabel={(o) => o.value}
            isOptionEqualToValue={(a, b) => a.value === b.value}
            noOptionsText={value.machineType ? "ประเภทนี้ไม่มีหมวดหมู่ในข้อมูลหลัก" : NO_OPTIONS}
            renderOption={(props, o) => (
              <li {...props} key={o.value}>
                {o.value}
                {o.legacy ? <span style={{ marginLeft: 8, opacity: 0.6, fontSize: "0.85em" }}>{LEGACY_SUFFIX}</span> : null}
              </li>
            )}
            onChange={(_, o) => {
              setPickedId("");
              emit(changeCategory(v0, o?.value ?? "", rows));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                  label={labels.category ?? (hasCategory ? "หมวดหมู่" : "หมวดหมู่ (ใช้กรองรุ่น)")}
                placeholder="พิมพ์ค้นหาหรือเลือก"
                error={!!errors.category}
                helperText={
                  errors.category ||
                  (value.machineType && !categoriesFor(value.machineType, rows).length
                    ? "ประเภทนี้ยังไม่มีหมวดหมู่ในข้อมูลหลัก"
                    : legacyHelp(categoryValue)
                      ? "หมวดหมู่เดิมของเครื่องนี้ ไม่อยู่ในข้อมูลหลัก"
                      : hasCategory
                        ? " "
                        : "ไม่บันทึกในคิว — ใช้กรองรุ่นเท่านั้น")
                }
                InputLabelProps={{ shrink: true }}
                inputProps={{ ...params.inputProps, "data-testid": `${idPrefix}-category` }}
              />
            )}
          />
        </Grid>
      ) : null}
      <Grid size={col}>
        <Autocomplete<ModelOption>
          id={`${idPrefix}-model`}
          size={size}
          disabled={disabled}
          options={modelOpts}
          value={modelValue}
          openOnFocus
          autoHighlight
          filterOptions={filterModels}
          getOptionLabel={(o) => o.model}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          noOptionsText={NO_OPTIONS}
          renderOption={(props, o) => (
            <li {...props} key={o.id} data-option-id={o.id}>
              {o.model}
              <span style={{ marginLeft: 8, opacity: 0.6, fontSize: "0.85em" }}>
                {o.legacy ? LEGACY_SUFFIX : `${o.type}${showCategory ? ` / ${o.category}` : ""}`}
              </span>
            </li>
          )}
          onChange={(_, o) => {
            if (o?.legacy) return; // ค่าเดิม — ไม่เปลี่ยน
            setPickedId(o?.id ?? "");
            emit(o ? changeModel(v0, o.model, rows, o) : changeModel(v0, "", rows));
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={labels.model ?? "รุ่นเครื่อง"}
              placeholder="พิมพ์ค้นหาหรือเลือก"
              required={modelRequired}
              error={!!errors.model || !!problem}
              helperText={
                errors.model ||
                problem ||
                (master && showPrice && typeof master.standardCost === "number"
                  ? `ต้นทุนมาตรฐาน ${master.standardCost.toLocaleString("th-TH")} บาท (ค่าอ้างอิง${master.costStatus === "APPROVED" ? "" : " · ยังไม่อนุมัติ"})`
                  : legacyHelp(modelValue) && rows.length
                    ? "รุ่นนี้ยังไม่อยู่ในข้อมูลหลัก (ข้อมูลเดิม)"
                    : " ")
              }
              inputProps={{ ...params.inputProps, "data-testid": `${idPrefix}-model` }}
            />
          )}
        />
      </Grid>
    </>
  );
}
