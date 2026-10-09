"use client";

// ฟอร์มเปิดคิว (QUEUE 01) — แยกการ์ด รายละเอียดงาน / ลูกค้าและสถานที่ / เครื่อง ตามฟอร์มเปิดงานเดิม
// ใช้ตัวเลือกเดิมของระบบ (ประเภทงาน ประเภทลูกค้า ฐานลูกค้า/สาขา) · ยังไม่บังคับ SN · ไม่มีช่าง/วันนัดจริง
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid2";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { Options } from "@/lib/types";
import { CustomerSitePicker } from "@/components/JobForm";
import { WomsFormSection } from "@/components/woms";
import { sqApi, type QueueFormValues, type QueueItemInput } from "@/lib/serviceQueueApi";

const MACHINE_TYPES = ["", "ตู้แช่", "เครื่องทำน้ำแข็ง", "อื่น ๆ"];
const CUSTOMER_TYPES = [
  { value: "", label: "— ไม่ระบุ —" },
  { value: "IN", label: "ลูกค้าใน" },
  { value: "OUT", label: "ลูกค้านอก" },
];

export const EMPTY_QUEUE: QueueFormValues = {
  jobType: "INSTALL",
  jobSubType: "",
  customerType: "",
  jobName: "",
  customerId: "",
  siteId: "",
  address: "",
  contactName: "",
  phone: "",
  mapLink: "",
  note: "",
  preferredDate: "",
  preferredTime: "",
  ownerSaleId: "",
  items: [{ machineType: "", model: "", serial: "", note: "" }],
};

export default function QueueForm({
  initial,
  submitLabel,
  busy,
  error,
  onSubmit,
  editing = false,
}: {
  initial?: QueueFormValues;
  submitLabel: string;
  busy: boolean;
  error: { field?: string; message: string } | null;
  onSubmit: (v: QueueFormValues) => void;
  editing?: boolean;
}) {
  const { has, user } = useAuth();
  const admin = has("svcqueue:admin");
  const [v, setV] = useState<QueueFormValues>(initial ?? EMPTY_QUEUE);
  const [options, setOptions] = useState<Options | null>(null);
  const [sales, setSales] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    api.getOptions().then(setOptions).catch(() => setOptions(null));
    if (admin) sqApi.sales().then((r) => setSales(r.items)).catch(() => setSales([]));
  }, [admin]);

  const set = <K extends keyof QueueFormValues>(k: K, val: QueueFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const setItem = (i: number, patch: Partial<QueueItemInput>) =>
    setV((p) => ({ ...p, items: p.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const err = (f: string) => (error?.field && (error.field === f || error.field.startsWith(`${f}.`)) ? error.message : undefined);

  return (
    <Box
      component="form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
    >
      {error && !error.field ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error.message}
        </Alert>
      ) : null}

      <WomsFormSection title="รายละเอียดงาน">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField select fullWidth label="ประเภทงาน" value={v.jobType} onChange={(e) => set("jobType", e.target.value)} error={!!err("jobType")} helperText={err("jobType") ?? " "}>
              {(options?.jobTypes ?? [{ value: v.jobType, label: v.jobType }]).map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          {v.jobType === "REMOVE" ? (
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField select fullWidth label="ประเภทย่อย" value={v.jobSubType} onChange={(e) => set("jobSubType", e.target.value)} error={!!err("jobSubType")} helperText={err("jobSubType") ?? " "}>
                <MenuItem value="">— เลือก —</MenuItem>
                {(options?.jobSubTypes ?? []).map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          ) : null}
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField select fullWidth label="ประเภทลูกค้า" value={v.customerType} onChange={(e) => set("customerType", e.target.value)} helperText=" ">
              {CUSTOMER_TYPES.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            {admin ? (
              <TextField
                select
                fullWidth
                label="เซลล์เจ้าของงาน"
                value={v.ownerSaleId}
                onChange={(e) => set("ownerSaleId", e.target.value)}
                error={!!err("ownerSaleId")}
                helperText={err("ownerSaleId") ?? "Admin เปิดคิวแทนเซลล์ได้"}
              >
                <MenuItem value="">— ไม่ระบุ (Admin ดำเนินการเอง) —</MenuItem>
                {sales.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField fullWidth label="เซลล์เจ้าของงาน" value={user?.name ?? ""} disabled helperText="กำหนดจากผู้เปิดคิว" />
            )}
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField fullWidth type="date" label="วันที่ลูกค้าต้องการ" value={v.preferredDate} onChange={(e) => set("preferredDate", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} error={!!err("preferredDate")} helperText={err("preferredDate") ?? "ข้อมูลประกอบ — ไม่ใช่วันนัดยืนยัน"} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField fullWidth type="time" label="เวลาที่ลูกค้าต้องการ" value={v.preferredTime} onChange={(e) => set("preferredTime", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} error={!!err("preferredTime")} helperText={err("preferredTime") ?? " "} />
          </Grid>
          <Grid size={12}>
            <TextField fullWidth multiline minRows={2} label="หมายเหตุ" value={v.note} onChange={(e) => set("note", e.target.value)} error={!!err("note")} helperText={err("note") ?? " "} />
          </Grid>
        </Grid>
      </WomsFormSection>

      <WomsFormSection title="ลูกค้าและสถานที่">
        <CustomerSitePicker
          customerId={v.customerId}
          siteId={v.siteId}
          onPick={(p, s) =>
            setV((prev) => ({
              ...prev,
              customerId: p?.id ?? "",
              siteId: s?.id ?? "",
              jobName: s?.label || prev.jobName || p?.name || "",
              contactName: prev.contactName || s?.contactPerson || "",
              phone: prev.phone || s?.phone || "",
              address: prev.address || s?.addressFull || "",
              mapLink: prev.mapLink || (s && (s.lat || s.lng) ? `https://www.google.com/maps?q=${s.lat},${s.lng}` : ""),
            }))
          }
        />
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth required label="ชื่อร้าน / บริษัท / สาขา" value={v.jobName} onChange={(e) => set("jobName", e.target.value)} error={!!err("jobName")} helperText={err("jobName") ?? " "} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField fullWidth label="ผู้ติดต่อ" value={v.contactName} onChange={(e) => set("contactName", e.target.value)} helperText=" " />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField fullWidth label="เบอร์โทร" value={v.phone} onChange={(e) => set("phone", e.target.value)} error={!!err("phone")} helperText={err("phone") ?? " "} />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField fullWidth label="ที่อยู่" value={v.address} onChange={(e) => set("address", e.target.value)} helperText=" " />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth label="ลิงก์ Map" value={v.mapLink} onChange={(e) => set("mapLink", e.target.value)} error={!!err("mapLink")} helperText={err("mapLink") ?? " "} />
          </Grid>
        </Grid>
      </WomsFormSection>

      <WomsFormSection
        title={`เครื่อง (${v.items.length} รายการ)`}
        actions={
          <Button size="small" startIcon={<AddIcon />} onClick={() => set("items", [...v.items, { machineType: "", model: "", serial: "", note: "" }])} disabled={v.items.length >= 50}>
            เพิ่มเครื่อง
          </Button>
        }
      >
        {err("items") ? (
          <Alert severity="error" sx={{ mb: 1 }}>
            {err("items")}
          </Alert>
        ) : null}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          ยังไม่บังคับ SN — เครื่องที่ไม่มี SN จะแสดงเป็น Pending Serial และเติมได้หลังเปิดงาน
          {editing ? " · รายการเดิมคงรหัสรายการไว้ ไม่สร้างเครื่องซ้ำ" : ""}
        </Typography>
        <Stack spacing={1.5}>
          {v.items.map((it, i) => (
            <Grid container spacing={1.5} key={it.itemId ?? `new-${i}`} alignItems="flex-start">
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField select fullWidth size="small" label={`ประเภทเครื่อง #${i + 1}`} value={it.machineType} onChange={(e) => setItem(i, { machineType: e.target.value })}>
                  {MACHINE_TYPES.map((m) => (
                    <MenuItem key={m || "none"} value={m}>
                      {m || "— ไม่ระบุ —"}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  select={!!options?.models?.length}
                  fullWidth
                  size="small"
                  label="รุ่น"
                  value={it.model}
                  onChange={(e) => setItem(i, { model: e.target.value })}
                >
                  {options?.models?.length
                    ? ["", ...options.models.filter((m) => m !== it.model), ...(it.model ? [it.model] : [])].map((m) => (
                        <MenuItem key={m || "none"} value={m}>
                          {m || "— ไม่ระบุ —"}
                        </MenuItem>
                      ))
                    : null}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 2.5 }}>
                <TextField fullWidth size="small" label="SN (ถ้ามี)" value={it.serial} onChange={(e) => setItem(i, { serial: e.target.value })} error={!!err(`items.${i}`)} helperText={err(`items.${i}`)} />
              </Grid>
              <Grid size={{ xs: 10, sm: 3 }}>
                <TextField fullWidth size="small" label="หมายเหตุเครื่อง" value={it.note} onChange={(e) => setItem(i, { note: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 2, sm: 0.5 }}>
                <IconButton aria-label={`ลบเครื่อง #${i + 1}`} disabled={v.items.length <= 1} onClick={() => set("items", v.items.filter((_, j) => j !== i))}>
                  <DeleteOutlineIcon />
                </IconButton>
              </Grid>
            </Grid>
          ))}
        </Stack>
      </WomsFormSection>

      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
        <Button type="submit" variant="contained" disabled={busy}>
          {busy ? "กำลังบันทึก…" : submitLabel}
        </Button>
      </Stack>
    </Box>
  );
}
