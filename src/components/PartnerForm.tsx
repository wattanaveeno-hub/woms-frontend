"use client";

import { useEffect, useState } from "react";
import type { CustomerKind, PartnerFormValues, PartnerType } from "@/lib/types";
import { partnerTypeLabel } from "@/lib/options";
import { useFieldErrors } from "@/components/FieldErrors";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

const TYPES: PartnerType[] = ["CUSTOMER", "SUPPLIER", "BOTH"];

const EMPTY: PartnerFormValues = {
  name: "",
  type: "CUSTOMER",
  phone: "",
  email: "",
  address: "",
  taxId: "",
  contactPerson: "",
  note: "",
  customerCode: "",
  customerKind: "",
};

// Round 8 · CUS-01 — บริษัท / บุคคล
const KINDS: Array<{ value: CustomerKind; label: string }> = [
  { value: "", label: "ยังไม่ระบุ" },
  { value: "COMPANY", label: "บริษัท/นิติบุคคล" },
  { value: "PERSON", label: "บุคคล" },
];

/** ช่องที่ backend อาจชี้กลับมาว่าผิด */
const FIELDS = ["name", "type", "customerCode", "customerKind", "phone", "email", "taxId", "contactPerson", "address", "note"] as const;

export interface PartnerFormProps {
  initial?: Partial<PartnerFormValues>;
  submitLabel: string;
  fieldError?: { field?: string; message: string } | null;
  busy?: boolean;
  onSubmit: (values: PartnerFormValues) => void;
  extraActions?: React.ReactNode;
  /** ผู้ที่ไม่มีสิทธิ์แก้ (เช่น Sale / viewer) — แสดงข้อมูลอย่างเดียว ไม่มีปุ่มบันทึก */
  readOnly?: boolean;
}

export default function PartnerForm({
  initial,
  submitLabel,
  fieldError,
  busy,
  onSubmit,
  extraActions,
  readOnly,
}: PartnerFormProps) {
  const [v, setV] = useState<PartnerFormValues>({
    ...EMPTY,
    ...initial,
    // ข้อมูลเดิมไม่มีสองฟิลด์นี้ — ให้เป็นค่าว่างแทน undefined
    customerCode: initial?.customerCode ?? "",
    customerKind: initial?.customerKind ?? "",
  });
  // QA BUG-001/002 — ฟอร์มนี้เคยไม่มี validation ฝั่งหน้าเว็บและไม่มี a11y binding เลย
  // กด "บันทึก" ตอนช่องบังคับว่าง แล้วหน้าจอนิ่งสนิท ไม่มี toast ไม่มี error ไม่มี request
  const err = useFieldErrors("ptn");

  // ข้อความผิดพลาดที่หน้าแม่ส่งลงมา (มาจาก API) ให้แสดงที่ช่องเดียวกัน
  useEffect(() => {
    if (fieldError?.field) err.setIssue(fieldError.field, fieldError.message);
    else if (!fieldError) err.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldError?.field, fieldError?.message]);

  const set = <K extends keyof PartnerFormValues>(k: K, val: PartnerFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const submit = () => {
    err.clear();
    if (!v.name.trim()) {
      err.setIssue("name", "ต้องระบุชื่อคู่ค้า");
      document.getElementById(err.fid("name"))?.focus();
      return;
    }
    if (v.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) {
      err.setIssue("email", "รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }
    if (v.taxId.trim() && !/^\d{13}$/.test(v.taxId.replace(/[\s-]/g, ""))) {
      err.setIssue("taxId", "เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก");
      return;
    }
    onSubmit({ ...v, name: v.name.trim(), customerCode: (v.customerCode ?? "").trim() });
  };

  const half = { xs: 12, sm: 6 } as const;
  return (
    <Box component="form" noValidate onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (!readOnly) submit(); }}>
      {fieldError && !fieldError.field ? (
        <Alert severity="error" role="alert" sx={{ mb: 2 }}>
          {fieldError.message}
        </Alert>
      ) : null}
      <Grid container spacing={2}>
        <Grid size={12}>
          <TextField
            required
            disabled={readOnly}
            {...err.mui("name", "ชื่อที่ใช้ค้นหาและแสดงในใบงาน/สัญญา")}
            label="ชื่อคู่ค้า"
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Grid>
        <Grid size={half}>
          <TextField
            select
            disabled={readOnly}
            {...err.mui("type", "เลือก BOTH เมื่อเป็นทั้งลูกค้าและผู้ขาย")}
            label="ประเภท"
            value={v.type}
            onChange={(e) => set("type", e.target.value as PartnerType)}
          >
            {TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {partnerTypeLabel[t]}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={half}>
          <TextField
            disabled={readOnly}
            {...err.mui("customerCode", "ไม่บังคับ · ถ้ากรอกต้องไม่ซ้ำ · ใช้จับคู่สาขาตอนนำเข้า Excel")}
            label="รหัสลูกค้า"
            value={v.customerCode ?? ""}
            onChange={(e) => set("customerCode", e.target.value)}
            inputProps={{ maxLength: 40 }}
          />
        </Grid>
        <Grid size={half}>
          <TextField
            select
            disabled={readOnly}
            {...err.mui("customerKind")}
            label="บริษัท / บุคคล"
            value={v.customerKind ?? ""}
            onChange={(e) => set("customerKind", e.target.value as CustomerKind)}
          >
            {KINDS.map((k) => (
              <MenuItem key={k.value || "none"} value={k.value}>
                {k.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={half}>
          <TextField disabled={readOnly} {...err.mui("contactPerson")} label="ผู้ติดต่อ" value={v.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} />
        </Grid>
        <Grid size={half}>
          <TextField
            disabled={readOnly}
            {...err.mui("phone", "ใช้ค้นหาลูกค้าที่หน้า /customers ได้")}
            label="เบอร์โทร"
            type="tel"
            inputProps={{ inputMode: "tel" }}
            value={v.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </Grid>
        <Grid size={half}>
          <TextField disabled={readOnly} {...err.mui("email")} label="อีเมล" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
        </Grid>
        <Grid size={half}>
          <TextField
            disabled={readOnly}
            {...err.mui("taxId", "ตัวเลข 13 หลัก — ใช้พิมพ์ลงเอกสารการขาย")}
            label="เลขผู้เสียภาษี"
            inputProps={{ inputMode: "numeric" }}
            placeholder="13 หลัก"
            value={v.taxId}
            onChange={(e) => set("taxId", e.target.value)}
          />
        </Grid>
        <Grid size={12}>
          <TextField disabled={readOnly} {...err.mui("address")} label="ที่อยู่" multiline minRows={2} value={v.address} onChange={(e) => set("address", e.target.value)} />
        </Grid>
        <Grid size={12}>
          <TextField disabled={readOnly} {...err.mui("note")} label="หมายเหตุ" multiline minRows={2} value={v.note} onChange={(e) => set("note", e.target.value)} />
        </Grid>
      </Grid>
      {!readOnly || extraActions ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 3 }}>
          {readOnly ? null : (
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? "กำลังบันทึก…" : submitLabel}
            </Button>
          )}
          {extraActions}
        </Stack>
      ) : null}
    </Box>
  );
}
