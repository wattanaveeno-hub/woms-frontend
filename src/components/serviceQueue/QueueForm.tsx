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
import SearchIcon from "@mui/icons-material/Search";
import MachinePicker from "@/components/MachinePicker";
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

  const [picking, setPicking] = useState(false);
  // รุ่นตามประเภทเครื่อง (Model Index) — ใช้กับเครื่องที่ยังไม่มีในคลัง
  const [modelsByType, setModelsByType] = useState<Record<string, string[]>>({});
  const loadModels = async (t: string) => {
    if (!t || modelsByType[t]) return;
    try {
      const r = await api.equipmentPicker({ machineType: t, limit: 1 });
      setModelsByType((m) => ({ ...m, [t]: r.models.map((x) => x.value) }));
    } catch {
      /* ใช้รายการรุ่นทั้งหมดแทน */
    }
  };
  useEffect(() => {
    for (const it of v.items) if (it.machineType && !it.equipmentId) void loadModels(it.machineType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // แถวเปล่าค่าเริ่มต้น (ยังไม่กรอกอะไร) ถูกแทนที่เมื่อเลือกเครื่องจากคลัง
  const isFilled = (it: QueueItemInput) => !!(it.equipmentId || it.machineType || it.model || it.serial || it.note);
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
        // แถวเปล่า (ยังไม่เลือก/กรอกอะไร) ไม่ส่ง — กันระบบสร้างเครื่องเปล่าในคลังตอนเปิดงาน (FB-05)
        onSubmit({ ...v, items: v.items.filter(isFilled) });
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
            setV((prev) => {
              // FB-01: เลือกลูกค้า/สาขาใหม่ → ใช้ข้อมูลจากฐานข้อมูลของรายการนั้น (เดิมเติมเฉพาะช่องว่าง ทำให้ข้อมูลรายเก่าค้าง)
              const changed = (p?.id ?? "") !== prev.customerId || (s?.id ?? "") !== prev.siteId;
              const pick = (fromDb: string | undefined, current: string) => (changed ? fromDb || "" : current || fromDb || "");
              const map = s ? s.mapLink?.trim() || (s.lat || s.lng ? `https://www.google.com/maps?q=${s.lat},${s.lng}` : "") : "";
              return {
                ...prev,
                customerId: p?.id ?? "",
                siteId: s?.id ?? "",
                jobName: (changed ? s?.storeName || s?.label || p?.name : prev.jobName || s?.label || p?.name) || prev.jobName,
                contactName: pick(s?.contactPerson || p?.contactPerson, prev.contactName),
                phone: pick(s?.phone || p?.phone, prev.phone),
                address: pick(s?.addressFull || p?.address, prev.address),
                mapLink: pick(map, prev.mapLink),
              };
            })
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
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button size="small" variant={picking ? "contained" : "outlined"} startIcon={<SearchIcon />} onClick={() => setPicking((x) => !x)} disabled={v.items.length >= 50}>
              {picking ? "ปิดตัวเลือก" : "เลือกเครื่องจากคลัง"}
            </Button>
            <Button size="small" startIcon={<AddIcon />} onClick={() => set("items", [...v.items.filter(isFilled), { machineType: "", model: "", serial: "", note: "" }])} disabled={v.items.length >= 50}>
              เพิ่มเครื่องที่ยังไม่มีในคลัง
            </Button>
          </Stack>
        }
      >
        {err("items") ? (
          <Alert severity="error" sx={{ mb: 1 }}>
            {err("items")}
          </Alert>
        ) : null}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          เลือกเครื่องจากคลังเพื่อผูกกับ Machine Record เดิม (รองรับหลายเครื่อง เลือกเครื่องเดิมซ้ำไม่ได้) · เครื่องที่ยังไม่มี SN แสดงเป็น Pending Serial
          {editing ? " · รายการเดิมคงรหัสรายการไว้ ไม่สร้างเครื่องซ้ำ" : ""}
        </Typography>
        {picking ? (
          <Box sx={{ p: 1.5, mb: 2, border: 1, borderColor: "divider", borderRadius: 1 }}>
            <MachinePicker
              selectedIds={v.items.map((i) => i.equipmentId ?? "").filter(Boolean)}
              pickLabel="เพิ่มเข้าคิว"
              onPick={(e) =>
                setV((p) => ({
                  ...p,
                  items: [
                    ...p.items.filter(isFilled),
                    {
                      machineType: e.machineType,
                      model: e.model,
                      serial: e.hasRealSerial ? e.serial : "",
                      equipmentId: e.id,
                      internalCode: e.hasRealSerial ? "" : e.internalCode,
                      note: "",
                    },
                  ],
                }))
              }
            />
          </Box>
        ) : null}
        <Stack spacing={1.5}>
          {v.items.map((it, i) =>
            it.equipmentId ? (
              // FB-06: เครื่องจากคลัง — รุ่น/ประเภท/SN ตามคลัง แก้ที่นี่ไม่ได้
              <Grid container spacing={1.5} key={it.itemId ?? `eq-${it.equipmentId}`} alignItems="center" data-testid="queue-item-stock">
                <Grid size={{ xs: 12, sm: 5.5 }}>
                  <Typography sx={{ fontWeight: 600 }} className="code">
                    #{i + 1} {it.serial ? `${it.serial} / ${it.model || "ไม่ระบุรุ่น"}` : `Pending Serial · ${it.internalCode || "รหัสภายใน"} · ${it.model || "ไม่ระบุรุ่น"}`}
                  </Typography>
                  <Typography variant="caption">{[it.machineType, "ผูกกับเครื่องในคลัง (รุ่นแก้ไม่ได้)"].filter(Boolean).join(" · ")}</Typography>
                </Grid>
                <Grid size={{ xs: 10, sm: 6 }}>
                  <TextField fullWidth size="small" label="หมายเหตุเครื่อง" value={it.note} onChange={(e) => setItem(i, { note: e.target.value })} />
                </Grid>
                <Grid size={{ xs: 2, sm: 0.5 }}>
                  <IconButton aria-label={`ลบเครื่อง #${i + 1}`} disabled={v.items.length <= 1} onClick={() => set("items", v.items.filter((_, j) => j !== i))}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ) : (
              <Grid container spacing={1.5} key={it.itemId ?? `new-${i}`} alignItems="flex-start" data-testid="queue-item-manual">
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label={`ประเภทเครื่อง #${i + 1}`}
                    value={it.machineType}
                    onChange={(e) => {
                      const t = e.target.value;
                      const keep = !t || (modelsByType[t] ?? []).includes(it.model);
                      setItem(i, { machineType: t, model: keep ? it.model : "" });
                      void loadModels(t);
                    }}
                  >
                    {MACHINE_TYPES.map((m) => (
                      <MenuItem key={m || "none"} value={m}>
                        {m || "— ไม่ระบุ —"}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  {(() => {
                    const list = it.machineType ? modelsByType[it.machineType] ?? [] : options?.models ?? [];
                    return list.length ? (
                      <TextField select fullWidth size="small" label="รุ่น" value={it.model} onChange={(e) => setItem(i, { model: e.target.value })} helperText={it.machineType ? `รุ่นในประเภท ${it.machineType}` : undefined}>
                        {["", ...list.filter((m) => m !== it.model), ...(it.model ? [it.model] : [])].map((m) => (
                          <MenuItem key={m || "none"} value={m}>
                            {m || "— ไม่ระบุ —"}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      <TextField fullWidth size="small" label="รุ่น" value={it.model} onChange={(e) => setItem(i, { model: e.target.value })} />
                    );
                  })()}
                </Grid>
                <Grid size={{ xs: 12, sm: 2.5 }}>
                  <TextField fullWidth size="small" label="SN (ถ้ามี)" value={it.serial} onChange={(e) => setItem(i, { serial: e.target.value })} error={!!err(`items.${i}`)} helperText={err(`items.${i}`) ?? "ยังไม่มีในคลัง"} />
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
            )
          )}
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
