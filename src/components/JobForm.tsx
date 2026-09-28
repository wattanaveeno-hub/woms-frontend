"use client";

import { useState } from "react";
import type { JobFormValues, Options } from "@/lib/types";
import { fieldErrorHelpers, withCurrent } from "@/lib/formErrors";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

const EMPTY: JobFormValues = {
  jobType: "INSTALL",
  jobSubType: "",
  jobName: "",
  technicianTeam: "",
  salesPerson: "",
  model: "",
  filterUnit: "",
  contactName: "",
  phone: "",
  jobDate: "",
  jobTime: "",
  mapLink: "",
  note: "",
};

export interface JobFormProps {
  options: Options;
  initial?: Partial<JobFormValues>;
  submitLabel: string;
  fieldError?: { field?: string; message: string } | null;
  busy?: boolean;
  onSubmit: (values: JobFormValues) => void;
  /** optional extra controls rendered next to the submit button (e.g. Close job) */
  extraActions?: React.ReactNode;
  /**
   * true = ใบงานนี้มีเครื่องผูกอยู่แล้ว (หรือกำลังจะผูกตอนบันทึก)
   * → ช่อง "เครื่องกรอง" (filterUnit) เป็นค่าที่ backend ตั้งให้เอง หน้าเว็บจึงแค่แสดง ไม่ให้แก้
   *   เพื่อไม่ให้มีกติกาความเข้ากันได้สองชุด
   */
  equipmentLinked?: boolean;
  /**
   * QA BUG-012 — ใบงานที่ถูกยกเลิกแล้วแก้ไขไม่ได้ (backend ตอบ 409 พร้อมเหตุผล)
   * เดิมฟอร์มและปุ่ม "บันทึกการแก้ไข" ยังแสดงและกดได้ตามปกติ ผู้ใช้จึงกดแล้วงง
   * เมื่อส่ง readOnly มา ฟอร์มจะปิดทุกช่อง ซ่อนปุ่มบันทึก และบอกเหตุผลไว้บนหัวฟอร์ม
   */
  readOnly?: boolean;
  readOnlyReason?: string;
}

export default function JobForm({
  options,
  initial,
  submitLabel,
  fieldError,
  busy,
  onSubmit,
  extraActions,
  equipmentLinked,
  readOnly,
  readOnlyReason,
}: JobFormProps) {
  const [v, setV] = useState<JobFormValues>({ ...EMPTY, ...initial });

  const set = <K extends keyof JobFormValues>(k: K, val: JobFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const { fid, errMsg, fe } = fieldErrorHelpers(fieldError, "job");

  const submit = () => {
    const cleaned: JobFormValues = {
      ...v,
      jobSubType: v.jobType === "REMOVE" ? v.jobSubType : "",
    };
    onSubmit(cleaned);
  };

  const isRemove = v.jobType === "REMOVE";

  const half = { xs: 12, sm: 6 } as const;
  const third = { xs: 12, sm: 6, md: 4 } as const;

  return (
    <Box
      component="form"
      noValidate
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault();
        if (!readOnly) submit();
      }}
    >
      {/* fieldset ปิดทุกช่องพร้อมกันเมื่อใบงานแก้ไม่ได้ (QA BUG-012) */}
      <Box
        component="fieldset"
        disabled={readOnly}
        sx={{ border: 0, m: 0, p: 0, minInlineSize: "auto" }}
        aria-describedby={readOnly ? "job-readonly-reason" : undefined}
      >
        {readOnly ? (
          <Alert severity="warning" id="job-readonly-reason" role="status" sx={{ mb: 2 }}>
            {readOnlyReason ?? "ใบงานนี้แก้ไขไม่ได้แล้ว — ดูได้อย่างเดียว"}
          </Alert>
        ) : null}
        {fieldError && !fieldError.field ? (
          <Alert severity="error" role="alert" sx={{ mb: 2 }}>
            {fieldError.message}
          </Alert>
        ) : null}

        <Grid container spacing={2}>
          <Grid size={half}>
            <TextField
              select
              required
              disabled={readOnly}
              {...fe("jobType")}
              label="ประเภทงาน"
              value={v.jobType}
              onChange={(e) => set("jobType", e.target.value as JobFormValues["jobType"])}
            >
              {options.jobTypes.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={half}>
            {isRemove ? (
              <TextField
                select
                required
                disabled={readOnly}
                {...fe("jobSubType")}
                label="ประเภทย่อย (ซ่อมถอน)"
                value={v.jobSubType}
                onChange={(e) => set("jobSubType", e.target.value as JobFormValues["jobSubType"])}
              >
                <MenuItem value="">— เลือก —</MenuItem>
                {options.jobSubTypes.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
          </Grid>

          <Grid size={12}>
            <TextField
              required
              disabled={readOnly}
              {...fe("jobName")}
              label="ชื่องาน"
              value={v.jobName}
              onChange={(e) => set("jobName", e.target.value)}
              placeholder="เช่น ติดตั้งเครื่องกรองน้ำ ลูกค้า..."
            />
          </Grid>

          <Grid size={third}>
            {options.teams.length ? (
              <TextField
                select
                required
                disabled={readOnly}
                {...fe("technicianTeam")}
                label="ทีมช่าง"
                value={v.technicianTeam}
                onChange={(e) => set("technicianTeam", e.target.value)}
              >
                <MenuItem value="">— เลือกทีม —</MenuItem>
                {withCurrent(options.teams, v.technicianTeam).map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField
                required
                disabled={readOnly}
                {...fe("technicianTeam")}
                label="ทีมช่าง"
                value={v.technicianTeam}
                onChange={(e) => set("technicianTeam", e.target.value)}
                placeholder="ชื่อทีมช่าง"
              />
            )}
          </Grid>

          <Grid size={third}>
            <TextField disabled={readOnly} id={fid("salesPerson")} label="เซลล์" value={v.salesPerson} onChange={(e) => set("salesPerson", e.target.value)} />
          </Grid>

          <Grid size={third}>
            <Autocomplete
              freeSolo
              disabled={readOnly}
              options={options.models}
              inputValue={v.model}
              onInputChange={(_, val) => set("model", val)}
              renderInput={(params) => <TextField {...params} id={fid("model")} label="รุ่น" />}
            />
          </Grid>

          <Grid size={third}>
            <TextField
              id={fid("filterUnit")}
              label="เครื่องกรอง"
              value={v.filterUnit}
              onChange={(e) => set("filterUnit", e.target.value)}
              placeholder="รุ่น / serial"
              disabled={readOnly || equipmentLinked}
              helperText={equipmentLinked ? "ระบบตั้งให้ตามเครื่องตัวแรกในใบงานโดยอัตโนมัติ" : undefined}
            />
          </Grid>

          <Grid size={third}>
            <TextField disabled={readOnly} id={fid("contactName")} label="ติดต่อ" value={v.contactName} onChange={(e) => set("contactName", e.target.value)} />
          </Grid>

          <Grid size={third}>
            <TextField
              disabled={readOnly}
              {...fe("phone")}
              label="เบอร์"
              type="tel"
              inputProps={{ inputMode: "tel" }}
              value={v.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Grid>

          <Grid size={half}>
            <TextField
              required
              disabled={readOnly}
              {...fe("jobDate")}
              label="วันที่"
              type="date"
              value={v.jobDate}
              onChange={(e) => set("jobDate", e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid size={half}>
            <TextField
              disabled={readOnly}
              {...fe("jobTime")}
              label="เวลา"
              type="time"
              value={v.jobTime}
              onChange={(e) => set("jobTime", e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid size={12}>
            <TextField
              disabled={readOnly}
              {...fe("mapLink")}
              label="Map"
              value={v.mapLink}
              onChange={(e) => set("mapLink", e.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </Grid>

          <Grid size={12}>
            <TextField disabled={readOnly} id={fid("note")} label="หมายเหตุ" multiline minRows={3} value={v.note} onChange={(e) => set("note", e.target.value)} />
          </Grid>
        </Grid>
      </Box>

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
