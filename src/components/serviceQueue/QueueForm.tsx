"use client";

// ฟอร์มเปิดคิว (QUEUE 01) — แยกการ์ด รายละเอียดงาน / ลูกค้าและสถานที่ / เครื่อง ตามฟอร์มเปิดงานเดิม
// ใช้ตัวเลือกเดิมของระบบ (ประเภทงาน ประเภทลูกค้า ฐานลูกค้า/สาขา) · ยังไม่บังคับ SN · ไม่มีช่าง/วันนัดจริง
import { useEffect, useState, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid2";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import PasteJobTextDialog from "@/components/PasteJobTextDialog";
import { typeLabel } from "@/components/serviceQueue/QueueBits";
import { queueFillFromPaste, queueFormIssues, shouldBlockEnter, type QueueFieldIssue } from "@/lib/serviceQueueRules";
import MachinePicker from "@/components/MachinePicker";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { Options } from "@/lib/types";
import { CustomerSitePicker } from "@/components/JobForm";
import { WomsFormSection } from "@/components/woms";
import QueueItemExtras from "@/components/serviceQueue/QueueItemExtras";
import { sqApi, type QueueFormValues, type QueueItemInput } from "@/lib/serviceQueueApi";
import { INSTALL_GROUP, INSTALL_SUBTYPES, installSubtypeError, installSubtypeOf, jobTypeFromMain, mainTypeOf, mainTypeOptions } from "@/lib/installType";

const MACHINE_TYPES = ["", "ตู้แช่", "เครื่องทำน้ำแข็ง", "อื่น ๆ"];
const CUSTOMER_TYPES = [
  { value: "", label: "— ไม่ระบุ —" },
  { value: "IN", label: "ลูกค้าใน" },
  { value: "OUT", label: "ลูกค้านอก" },
];

export const EMPTY_QUEUE: QueueFormValues = {
  // INST-01 v2: ยังไม่เลือกประเภทงาน — ผู้ใช้ต้องเลือก (ติดตั้ง → เช่า/ขาย)
  jobType: "",
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
  items: [],
};

export default function QueueForm({
  initial,
  submitLabel,
  busy,
  error,
  onSubmit,
  editing = false,
  itemsFromJob = false,
  review = false,
  onSaveDraft,
  placeLabel = "",
  extraActions,
}: {
  initial?: QueueFormValues;
  submitLabel: string;
  busy: boolean;
  error: { field?: string; message: string } | null;
  onSubmit: (v: QueueFormValues) => void;
  editing?: boolean;
  /** QA-F06 (Round 2): คิวที่ผูก JN แล้ว (เช่นคิวเลื่อนงาน) — รายการเครื่องจัดการที่ใบงาน ไม่บังคับเลือกเครื่องในฟอร์มนี้
   *  (ใบงานเดิมที่ไม่มีแถวเครื่องจะได้คิวที่ไม่มีรายการเครื่อง และเดิมบันทึกการแก้ไขไม่ได้) */
  itemsFromJob?: boolean;
  /** D-05: ส่งคิว = ตรวจช่องที่ต้องครบ แล้วเปิดหน้าตรวจทานก่อนยืนยัน (ไม่ใช้กับการแก้ไขของ Admin) */
  review?: boolean;
  /** D-05: มีปุ่ม "บันทึกร่าง" (ร่างต้องมีแค่ประเภทงาน) */
  onSaveDraft?: (v: QueueFormValues) => void;
  /** ป้ายลูกค้า/สาขาที่เลือกไว้แล้ว (ร่างที่โหลดกลับมา) — แสดงในหน้าตรวจทาน */
  placeLabel?: string;
  /** ปุ่มเพิ่มเติมข้างปุ่มบันทึก (เช่น ลบร่าง) */
  extraActions?: ReactNode;
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
  const [localErr, setLocalErr] = useState<string | null>(null);
  // D-05: ช่องที่ขาด (ตรวจก่อนส่ง) · หน้าตรวจทาน · วางข้อความ LINE
  const [issues, setIssues] = useState<QueueFieldIssue[]>([]);
  const [reviewOf, setReviewOf] = useState<QueueFormValues | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteInfo, setPasteInfo] = useState<string | null>(null);
  const [place, setPlace] = useState(placeLabel);
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
  const err = (f: string) =>
    error?.field && (error.field === f || error.field.startsWith(`${f}.`)) ? error.message : issues.find((i) => i.field === f)?.message;
  // D-05: ช่องบังคับแสดงดาวเฉพาะฟอร์มส่งคิว (การแก้ไขของ Admin คงกติกาเดิม)
  const req = review;

  /** ค่าที่จะส่ง — ตัดแถวเปล่า และล้างค่าประกันเมื่อไม่ใช่ติดตั้งขาย */
  const cleaned = (): QueueFormValues => {
    // แถวเปล่า (ยังไม่เลือก/กรอกอะไร) ไม่ส่ง — กันระบบสร้างเครื่องเปล่าในคลังตอนเปิดงาน (FB-05)
    const items = v.items.filter(isFilled);
    // ประกันบริษัทกรอกได้เฉพาะติดตั้งขาย — เปลี่ยนประเภทงานแล้วล้างค่าประกันที่ค้าง (กันบันทึกไม่ผ่าน)
    const warrantyOk = v.jobType === "INSTALL_SALE" || v.jobType === "INSTALL";
    return { ...v, items: warrantyOk ? items : items.map((it) => ({ ...it, warrantyMonths: 0, warrantyStart: "" })) };
  };

  return (
    <Box
      component="form"
      noValidate
      // D-05: Enter ในช่องกรอก (รวมช่องค้นหาเครื่อง) ต้องไม่ส่งคิวโดยไม่ตั้งใจ — textarea ขึ้นบรรทัดใหม่ได้ตามปกติ
      onKeyDown={(e) => {
        if (shouldBlockEnter(e.key, (e.target as HTMLElement)?.tagName)) e.preventDefault();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        if (review) {
          const out = cleaned();
          const found = queueFormIssues(out);
          setIssues(found);
          if (found.length) {
            setLocalErr(`ข้อมูลยังไม่ครบ: ${found.map((i) => i.message).join(" · ")}`);
            return;
          }
          setLocalErr(null);
          setReviewOf(out);
          return;
        }
        // แถวเปล่า (ยังไม่เลือก/กรอกอะไร) ไม่ส่ง — กันระบบสร้างเครื่องเปล่าในคลังตอนเปิดงาน (FB-05)
        const items = v.items.filter(isFilled);
        // QUE-04 v2: การบังคับจำนวนเครื่องอยู่ตอนส่งคิว แยกจากการถอดเครื่องเพื่อแก้ไข
        // INST-01: บังคับเลือกเช่า/ขายเฉพาะคิวใหม่ — คิวเลื่อนงานของใบงาน INSTALL เดิมแก้ได้ (QA F-06)
        const sub = editing ? null : installSubtypeError(v.jobType);
        const msg = !v.jobType ? "ต้องเลือกประเภทงาน" : sub ? sub : !items.length && !itemsFromJob ? "ยังไม่ได้เลือกเครื่อง — เลือกเครื่องจากคลังหรือเพิ่มเครื่องอย่างน้อยหนึ่งรายการก่อนส่งคิว" : null;
        if (msg) {
          setLocalErr(msg);
          return;
        }
        setLocalErr(null);
        // ประกันบริษัทกรอกได้เฉพาะติดตั้งขาย — เปลี่ยนประเภทงานแล้วล้างค่าประกันที่ค้าง (กันบันทึกไม่ผ่าน)
        const warrantyOk = v.jobType === "INSTALL_SALE" || v.jobType === "INSTALL";
        onSubmit({ ...v, items: warrantyOk ? items : items.map((it) => ({ ...it, warrantyMonths: 0, warrantyStart: "" })) });
      }}
    >
      {error && !error.field ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error.message}
        </Alert>
      ) : null}
      {localErr ? (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="queue-form-error">
          {localErr}
        </Alert>
      ) : null}
      {pasteInfo ? (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setPasteInfo(null)}>
          {pasteInfo}
        </Alert>
      ) : null}

      <WomsFormSection
        title="รายละเอียดงาน"
        actions={
          review ? (
            <Button size="small" startIcon={<ContentPasteIcon />} onClick={() => setPasteOpen(true)} data-testid="queue-paste-line">
              วางข้อความ LINE
            </Button>
          ) : undefined
        }
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField select required fullWidth label="ประเภทงาน" value={mainTypeOf(v.jobType)} onChange={(e) => set("jobType", jobTypeFromMain(e.target.value, v.jobType))} error={!!err("jobType")} helperText={err("jobType") ?? " "}>
              {v.jobType ? null : <MenuItem value="">— เลือกประเภทงาน —</MenuItem>}
              {mainTypeOptions(options?.jobTypes ?? [], v.jobType, ["REMOVE"]).map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          {mainTypeOf(v.jobType) === INSTALL_GROUP ? (
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                select
                required
                fullWidth
                label="ประเภทย่อยงานติดตั้ง"
                value={installSubtypeOf(v.jobType)}
                onChange={(e) => set("jobType", e.target.value)}
                error={!!err("jobType") || v.jobType === "INSTALL"}
                helperText={v.jobType === "INSTALL" ? "เลือก เช่า ขาย หรือ เช่าซื้อ" : " "}
                inputProps={{ "data-testid": "install-subtype" }}
              >
                <MenuItem value="">— เลือก —</MenuItem>
                {INSTALL_SUBTYPES.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          ) : null}
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
          {/* QUE-02 v2: ตัดช่องวัน/เวลาที่ลูกค้าต้องการออก (วันนัดมาจากช่างเสนอ → Admin รับ → ลูกค้าคอนเฟิร์ม)
              คิวเดิมที่มีค่าอยู่ยังแสดงในหน้ารายละเอียดคิว */}
          <Grid size={12}>
            <TextField fullWidth multiline minRows={2} label="หมายเหตุ" value={v.note} onChange={(e) => set("note", e.target.value)} error={!!err("note")} helperText={err("note") ?? " "} />
          </Grid>
        </Grid>
      </WomsFormSection>

      <WomsFormSection title="ลูกค้าและสถานที่">
        <CustomerSitePicker
          customerId={v.customerId}
          siteId={v.siteId}
          onPick={(p, s) => {
            setPlace([p?.name, s?.label].filter(Boolean).join(" · "));
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
            });
          }}
        />
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth required label="ชื่อร้าน / บริษัท / สาขา" value={v.jobName} onChange={(e) => set("jobName", e.target.value)} error={!!err("jobName")} helperText={err("jobName") ?? " "} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField fullWidth required={req} label="ผู้ติดต่อ" value={v.contactName} onChange={(e) => set("contactName", e.target.value)} error={!!err("contactName")} helperText={err("contactName") ?? " "} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField fullWidth required={req} label="เบอร์โทร" value={v.phone} onChange={(e) => set("phone", e.target.value)} error={!!err("phone")} helperText={err("phone") ?? " "} />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField
              fullWidth
              required={req && !v.siteId}
              label="ที่อยู่"
              value={v.address}
              onChange={(e) => set("address", e.target.value)}
              error={!!err("address")}
              helperText={err("address") ?? (req ? "กรอกที่อยู่ หรือเลือกสาขาจากฐานข้อมูลลูกค้า" : " ")}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth label="ลิงก์ Map" value={v.mapLink} onChange={(e) => set("mapLink", e.target.value)} error={!!err("mapLink")} helperText={err("mapLink") ?? " "} />
          </Grid>
        </Grid>
      </WomsFormSection>

      <WomsFormSection
        title={`เครื่อง (${v.items.length} รายการ)${req ? " *" : ""}`}
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
          {v.items.length === 0 ? (
            <Alert severity="info" data-testid="queue-no-machine">
              ยังไม่ได้เลือกเครื่อง — เลือกเครื่องจากคลัง หรือกด “เพิ่มเครื่องที่ยังไม่มีในคลัง”
            </Alert>
          ) : null}
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
                  <IconButton aria-label={`เอาเครื่อง #${i + 1} ออกจากคิว`} title="เอาออกจากคิว (ไม่ลบเครื่องในคลัง)" onClick={() => set("items", v.items.filter((_, j) => j !== i))}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </Grid>
                <Grid size={12}>
                  <QueueItemExtras item={it} index={i} jobType={v.jobType} onChange={(p) => setItem(i, p)} error={err} />
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
                  <IconButton aria-label={`เอาเครื่อง #${i + 1} ออกจากคิว`} title="เอาออกจากคิว (ไม่ลบเครื่องในคลัง)" onClick={() => set("items", v.items.filter((_, j) => j !== i))}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </Grid>
                <Grid size={12}>
                  <QueueItemExtras item={it} index={i} jobType={v.jobType} onChange={(p) => setItem(i, p)} error={err} />
                </Grid>
              </Grid>
            )
          )}
        </Stack>
      </WomsFormSection>

      <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
        {extraActions}
        {onSaveDraft ? (
          <Button
            variant="outlined"
            disabled={busy}
            data-testid="queue-save-draft"
            onClick={() => {
              // D-05: ร่างต้องมีแค่ประเภทงาน — ช่องอื่นกรอกต่อภายหลังได้
              if (!v.jobType) {
                setIssues([{ field: "jobType", message: "ต้องเลือกประเภทงาน" }]);
                setLocalErr("บันทึกร่างต้องเลือกประเภทงานก่อน");
                return;
              }
              setIssues([]);
              setLocalErr(null);
              onSaveDraft(cleaned());
            }}
          >
            บันทึกร่าง
          </Button>
        ) : null}
        <Button type="submit" variant="contained" disabled={busy}>
          {busy ? "กำลังบันทึก…" : submitLabel}
        </Button>
      </Stack>

      <PasteJobTextDialog
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        jobTypeLabel={typeLabel}
        hint="ระบบใส่เฉพาะช่องที่ยังว่างในฟอร์ม · รุ่น/SN เป็นรายการเครื่อง (SN ที่ตรงกับคลังผูกให้ตอนบันทึก) · วันที่ เวลา ทีมช่าง เซลล์ ต่อท้ายหมายเหตุ · ลูกค้า/สาขาให้เลือกจากฐานข้อมูลเอง"
        onApply={(parsed) => {
          const r = queueFillFromPaste(parsed, v);
          setV(r.values);
          setPasteOpen(false);
          setPasteInfo(r.filled.length ? `ใส่ข้อมูลจากข้อความแล้ว: ${r.filled.join(", ")} — ตรวจทานก่อนส่งคิว` : "ไม่มีช่องว่างที่ใส่ข้อมูลจากข้อความได้");
        }}
      />

      <QueueReviewDialog
        values={reviewOf}
        placeLabel={place}
        busy={busy}
        onEdit={() => setReviewOf(null)}
        onConfirm={() => {
          const out = reviewOf;
          setReviewOf(null);
          if (out) onSubmit(out);
        }}
      />
    </Box>
  );
}

/** D-05: หน้าตรวจทานก่อนส่งคิว — สรุปทุกช่องและรายการเครื่อง · "แก้ไข" กลับไปฟอร์ม · "ยืนยันส่งคิว" ส่งจริง */
function QueueReviewDialog({
  values,
  placeLabel,
  busy,
  onEdit,
  onConfirm,
}: {
  values: QueueFormValues | null;
  placeLabel: string;
  busy: boolean;
  onEdit: () => void;
  onConfirm: () => void;
}) {
  const v = values;
  const row = (label: string, value: ReactNode) => (
    <TableRow key={label}>
      <TableCell sx={{ width: 170, color: "text.secondary", verticalAlign: "top" }}>{label}</TableCell>
      <TableCell sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{value || "—"}</TableCell>
    </TableRow>
  );
  return (
    <Dialog open={!!v} onClose={busy ? undefined : onEdit} fullWidth maxWidth="md" data-testid="queue-review">
      <DialogTitle>ตรวจทานก่อนส่งคิว</DialogTitle>
      <DialogContent>
        {v ? (
          <>
            <Table size="small">
              <TableBody>
                {row("ประเภทงาน", [typeLabel(v.jobType), v.jobSubType].filter(Boolean).join(" · "))}
                {row("ประเภทลูกค้า", v.customerType === "IN" ? "ลูกค้าใน" : v.customerType === "OUT" ? "ลูกค้านอก" : "")}
                {row("ลูกค้า / สาขา (ฐานข้อมูล)", placeLabel || (v.siteId || v.customerId ? "เลือกไว้แล้ว" : "ไม่ได้เลือก"))}
                {row("ชื่อร้าน / บริษัท", v.jobName)}
                {row("ผู้ติดต่อ", v.contactName)}
                {row("เบอร์โทร", v.phone)}
                {row("ที่อยู่", v.address || (v.siteId ? "ใช้ที่อยู่สาขา" : ""))}
                {row("ลิงก์ Map", v.mapLink)}
                {row("หมายเหตุ", v.note)}
              </TableBody>
            </Table>
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>
              เครื่อง ({v.items.length} รายการ)
            </Typography>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>ประเภท</TableCell>
                    <TableCell>รุ่น</TableCell>
                    <TableCell>SN / เครื่องในคลัง</TableCell>
                    <TableCell>เครื่องกรอง</TableCell>
                    <TableCell>หมายเหตุเครื่อง</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {v.items.map((it, i) => (
                    <TableRow key={it.itemId ?? `${i}-${it.equipmentId ?? it.serial}`}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{it.machineType || "—"}</TableCell>
                      <TableCell>{it.model || "—"}</TableCell>
                      <TableCell className="code">
                        {it.serial || (it.equipmentId ? `Pending Serial · ${it.internalCode || "เครื่องในคลัง"}` : "ยังไม่มี SN")}
                      </TableCell>
                      <TableCell>{it.filterUnit || "—"}</TableCell>
                      <TableCell>{it.note || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onEdit} disabled={busy}>
          แก้ไข
        </Button>
        <Button variant="contained" onClick={onConfirm} disabled={busy} data-testid="queue-review-confirm">
          ยืนยันส่งคิว
        </Button>
      </DialogActions>
    </Dialog>
  );
}
