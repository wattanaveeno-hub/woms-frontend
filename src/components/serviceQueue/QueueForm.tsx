"use client";

// ฟอร์มเปิดคิว (QUEUE 01) — แยกการ์ด รายละเอียดงาน / ลูกค้าและสถานที่ / เครื่อง ตามฟอร์มเปิดงานเดิม
// ใช้ตัวเลือกเดิมของระบบ (ประเภทงาน ประเภทลูกค้า ฐานลูกค้า/สาขา) · ยังไม่บังคับ SN · ไม่มีช่าง/วันนัดจริง
import EquipmentModelFields from "@/components/EquipmentModelFields";
import DateField from "@/components/DateField";
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
import Paper from "@mui/material/Paper";
import ButtonBase from "@mui/material/ButtonBase";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
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
import { parseJobText } from "@/lib/jobTextParser";
import { typeLabel } from "@/components/serviceQueue/QueueBits";
import { queueFillFromPaste, queueFormIssues, shouldBlockEnter, type QueueFieldIssue } from "@/lib/serviceQueueRules";
import MachinePicker from "@/components/MachinePicker";
import ExternalEquipmentDialog from "@/components/ExternalEquipmentDialog";
import { api } from "@/lib/api";
import { WomsStatusChip } from "@/components/woms/WomsStatusChip";
import { WomsFormSummary, WomsValidationSummary, focusField } from "@/components/woms/WomsFormSummary";
import { missingInOrder, queueRequirements } from "@/lib/formRequirements";
import { useAuth } from "@/lib/AuthContext";
import type { Options } from "@/lib/types";
import { CustomerSitePicker } from "@/components/JobForm";
import { tokens as t } from "@/theme/tokens";
import QueueItemExtras from "@/components/serviceQueue/QueueItemExtras";
import { sqApi, type QueueFormValues, type QueueItemInput } from "@/lib/serviceQueueApi";
import { isInstallType, INSTALL_GROUP, INSTALL_SUBTYPES, installSubtypeError, installSubtypeOf, jobTypeFromMain, mainTypeOf, mainTypeOptions } from "@/lib/installType";

const grid = { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: "16px 24px" } as const;
const full = { gridColumn: "1 / -1" } as const;

/** ป้ายเหนือช่อง (ENTECH DS .f label) */
function lab(htmlFor: string, text: string, req = false) {
  return (
    <Box component="label" htmlFor={htmlFor} sx={{ display: "block", fontSize: 13, fontWeight: 600, color: t.slate, mb: 0.5 }}>
      {text}
      {req ? <Box component="i" sx={{ color: t.danger, fontStyle: "normal" }}> *</Box> : null}
    </Box>
  );
}

/** ENTECH DS .sec — ส่วนในการ์ดหลัก คั่นด้วยเส้นบาง */
function Sec({ title, children, first, actions, tone, id }: { title: ReactNode; children: ReactNode; first?: boolean; actions?: ReactNode; tone?: "muted"; id?: string }) {
  return (
    <Box component="section" id={id} sx={{ scrollMarginTop: 80, p: { xs: 2, sm: 3 }, display: "flex", flexDirection: "column", gap: 2, borderTop: first ? 0 : `1px solid ${t.line}`, bgcolor: tone === "muted" ? t.paper : undefined }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h2">{title}</Typography>
        {actions}
      </Box>
      {children}
    </Box>
  );
}

/** MOM-10: หัวส่วนมีเลขกำกับแบบเดียวกับหน้าเปิดงาน · * = ส่วนนี้มีช่องที่ต้องกรอก */
function secTitle(n: number, text: string, required: boolean, suffix?: ReactNode) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1.25 }}>
      <Box component="span" aria-hidden="true" sx={{ width: 28, height: 28, borderRadius: 99, bgcolor: t.accent, color: "#fff", fontSize: 14, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 28px" }}>
        {n}
      </Box>
      <span>
        {text}
        {suffix}
        {required ? <Box component="i" sx={{ color: t.danger, fontStyle: "normal" }}> *</Box> : <Box component="span" sx={{ color: t.slate2, fontWeight: 400, fontSize: 14 }}> (ไม่บังคับ)</Box>}
      </span>
    </Box>
  );
}

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
  extraSection,
}: {
  /** UAT2-08: ส่วนเพิ่มเติมก่อนปุ่มบันทึก (เช่น รูปหน้างาน) */
  extraSection?: ReactNode;
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

  // MOM-12: ปุ่มเดียว "เลือกเครื่องที่ต้องการ" เปิดแผงเลือก 2 แบบ (มีในคลัง / ยังไม่มีในคลัง)
  const [pickMode, setPickMode] = useState<"stock" | "model" | null>(null);
  const picking = pickMode === "stock";
  const [addExt, setAddExt] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  // D-05: ช่องที่ขาด (ตรวจก่อนส่ง) · หน้าตรวจทาน · วางข้อความ LINE
  const [issues, setIssues] = useState<QueueFieldIssue[]>([]);
  const [reviewOf, setReviewOf] = useState<QueueFormValues | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteInfo, setPasteInfo] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [place, setPlace] = useState(placeLabel);
  // D-07A: รุ่นตามประเภทของเครื่องที่ยังไม่มีในคลัง มาจาก Equipment Model Master (EquipmentModelFields)
  // แถวเปล่าค่าเริ่มต้น (ยังไม่กรอกอะไร) ถูกแทนที่เมื่อเลือกเครื่องจากคลัง
  const isFilled = (it: QueueItemInput) => !!(it.equipmentId || it.machineType || it.model || it.serial || it.note);
  const set = <K extends keyof QueueFormValues>(k: K, val: QueueFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const setItem = (i: number, patch: Partial<QueueItemInput>) =>
    setV((p) => ({ ...p, items: p.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const err = (f: string) =>
    error?.field && (error.field === f || error.field.startsWith(`${f}.`)) ? error.message : issues.find((i) => i.field === f)?.message;
  // D-05: ช่องบังคับแสดงดาวเฉพาะฟอร์มส่งคิว (การแก้ไขของ Admin คงกติกาเดิม)
  const req = review;
  // MOM-02: id ของช่องตามชื่อฟิลด์ — ใช้กับการ์ดสรุปและรายการข้อผิดพลาด (กดแล้วไปที่ช่อง)
  const fieldId = (f: string) => (f === "items" ? "queue-items" : f === "customerName" || f === "storeName" ? "queue-jobName" : `queue-${f}`);
  const addModelRow = () => {
    const next = [...v.items.filter(isFilled), { machineType: "", model: "", serial: "", note: "" }];
    set("items", next);
    setPickMode(null);
    window.setTimeout(() => focusField(`queue-item-${next.length - 1}-model`), 50);
  };

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
            // MOM-02: แสดงทุกช่องที่ขาดพร้อมกัน (กดไปที่ช่องได้) และพาไปช่องแรกตามลำดับบนจอ
            setLocalErr(null);
            const first = missingInOrder(queueRequirements(out))[0];
            if (first) focusField(fieldId(first.field));
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
      {review ? <WomsValidationSummary issues={issues} fieldId={fieldId} title="ข้อมูลยังไม่ครบ — แก้ช่องต่อไปนี้แล้วส่งอีกครั้ง" testId="queue-form-error" /> : null}
      {pasteInfo ? (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setPasteInfo(null)}>
          {pasteInfo}
        </Alert>
      ) : null}

      {/* ENTECH redesign (ServiceQueueNew.dc.html): การ์ดหลักแบ่งส่วน + คอลัมน์ข้าง "หลังส่งคำขอ" · ป้ายเหนือช่อง
          UAT 2026-11-16: เพิ่มช่อง "ลูกค้าสะดวกวันที่/เวลา" กลับมา (ข้อมูลประกอบ ไม่ใช่วันนัด) — เดิม QUE-02 v2 ตัดออก
          (วันนัดมาจากช่างเสนอ → Admin รับ → ลูกค้าคอนเฟิร์ม) · คงช่องประเภทลูกค้า / เซลล์เจ้าของงาน / ผู้ติดต่อ / ลิงก์ Map ที่ระบบใช้ */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "flex-start" }}>
        <Paper variant="outlined" sx={{ flex: "3 1 560px", minWidth: 0, overflow: "hidden" }} data-testid="queue-form-card">
          {review ? (
            <Sec title="วางข้อความจากลูกค้า (ไม่บังคับ)" first tone="muted">
              <Box>
                {lab("queue-paste-text", "วางข้อความจาก LINE หรืออีเมล แล้วกดเติมให้")}
                <TextField
                  id="queue-paste-text"
                  multiline
                  minRows={2}
                  placeholder="ชื่อ เบอร์ ที่อยู่ อาการ"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
              </Box>
              <Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentPasteIcon />}
                  disabled={!pasteText.trim()}
                  data-testid="queue-paste-line"
                  onClick={() => {
                    const r = queueFillFromPaste(parseJobText(pasteText), v);
                    setV(r.values);
                    setPasteInfo(r.filled.length ? `ใส่ข้อมูลจากข้อความแล้ว: ${r.filled.join(", ")} — ตรวจทานก่อนส่งคิว` : "ไม่มีช่องว่างที่ใส่ข้อมูลจากข้อความได้");
                  }}
                >
                  เติมจากข้อความ
                </Button>
              </Box>
            </Sec>
          ) : null}

          <Sec id="queue-sec-job" first={!review} title={secTitle(1, "ต้องการให้ช่างทำอะไร", true)}>
            <Box
              id="queue-jobType"
              role="radiogroup"
              aria-label="ประเภทงาน"
              data-testid="queue-jobtype-tiles"
              sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", sm: "repeat(4, minmax(0,1fr))" }, gap: 1 }}
            >
              {mainTypeOptions(options?.jobTypes ?? [], v.jobType, ["REMOVE"]).map((o) => {
                const on = mainTypeOf(v.jobType) === o.value;
                return (
                  <ButtonBase
                    key={o.value}
                    role="radio"
                    aria-checked={on}
                    onClick={() => set("jobType", jobTypeFromMain(o.value, v.jobType))}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      justifyContent: "center",
                      minHeight: 56,
                      px: 2,
                      py: 1.25,
                      textAlign: "left",
                      borderRadius: "12px",
                      border: on ? `2px solid ${t.accent}` : `1px solid ${t.lineStrong}`,
                      bgcolor: on ? t.accentBg : "#fff",
                      fontWeight: 700,
                      fontSize: 15,
                      "&:hover": { bgcolor: on ? t.accentBg : "#f8fafb" },
                    }}
                  >
                    {o.label}
                  </ButtonBase>
                );
              })}
            </Box>
            {err("jobType") ? (
              <Typography variant="caption" color="error" sx={{ fontWeight: 600 }}>
                {err("jobType")}
              </Typography>
            ) : null}
            {mainTypeOf(v.jobType) === INSTALL_GROUP ? (
              <Box>
                {lab("install-subtype", "ติดตั้งแบบ", true)}
                <ToggleButtonGroup
                  id="install-subtype"
                  exclusive
                  size="small"
                  value={installSubtypeOf(v.jobType)}
                  onChange={(_e, val) => val && set("jobType", val)}
                  aria-label="ประเภทย่อยงานติดตั้ง"
                  data-testid="install-subtype"
                >
                  {INSTALL_SUBTYPES.map((o) => (
                    <ToggleButton key={o.value} value={o.value} sx={{ px: 2 }}>
                      {o.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                {v.jobType === "INSTALL" ? (
                  <Typography variant="caption" color="error" component="div" sx={{ mt: 0.5 }}>
                    เลือก เช่า ขาย หรือ เช่าซื้อ
                  </Typography>
                ) : null}
              </Box>
            ) : null}
            {v.jobType === "REMOVE" ? (
              <Box>
                {lab("queue-jobSubType", "ประเภทย่อย", true)}
                <TextField select id="queue-jobSubType" value={v.jobSubType} onChange={(e) => set("jobSubType", e.target.value)} error={!!err("jobSubType")} helperText={err("jobSubType")}>
                  <MenuItem value="">— เลือก —</MenuItem>
                  {(options?.jobSubTypes ?? []).map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            ) : null}
            <Box>
              {lab("queue-note", v.jobType === "OTHER" ? "อาการ / รายละเอียดงาน" : "อาการ / รายละเอียดงาน (ไม่บังคับ)", req && v.jobType === "OTHER")}
              <TextField id="queue-note" multiline minRows={3} value={v.note} onChange={(e) => set("note", e.target.value)} error={!!err("note")} helperText={err("note")} />
            </Box>
          </Sec>

          <Sec id="queue-sec-customer" title={secTitle(2, "ลูกค้าและหน้างาน", req)}>
            <CustomerSitePicker
              customerId={v.customerId}
              siteId={v.siteId}
              quickInitial={{ storeName: v.jobName, contactPerson: v.contactName, phone: v.phone, address: v.address, mapLink: v.mapLink }}
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
            <Box sx={grid}>
              <Box sx={full}>
                {lab("queue-jobName", "ชื่อร้าน / บริษัท / สาขา", true)}
                <TextField id="queue-jobName" value={v.jobName} onChange={(e) => set("jobName", e.target.value)} error={!!err("jobName")} helperText={err("jobName")} />
              </Box>
              <Box>
                {lab("queue-contactName", "ผู้ติดต่อหน้างาน", req)}
                <TextField id="queue-contactName" value={v.contactName} onChange={(e) => set("contactName", e.target.value)} error={!!err("contactName")} helperText={err("contactName")} />
              </Box>
              <Box>
                {lab("queue-phone", "เบอร์ติดต่อหน้างาน", req)}
                <TextField id="queue-phone" value={v.phone} onChange={(e) => set("phone", e.target.value)} error={!!err("phone")} helperText={err("phone")} />
              </Box>
              <Box sx={full}>
                {lab("queue-address", "ที่อยู่", req && !v.siteId)}
                <TextField
                  id="queue-address"
                  value={v.address}
                  onChange={(e) => set("address", e.target.value)}
                  error={!!err("address")}
                  helperText={err("address") ?? (req ? "กรอกที่อยู่ หรือเลือกสาขาจากฐานข้อมูลลูกค้า" : undefined)}
                />
              </Box>
              <Box sx={full}>
                {lab("queue-mapLink", "ลิงก์ Map")}
                <TextField id="queue-mapLink" value={v.mapLink} onChange={(e) => set("mapLink", e.target.value)} error={!!err("mapLink")} helperText={err("mapLink")} />
              </Box>
            </Box>
          </Sec>

          <Sec
            id="queue-sec-machines"
            title={secTitle(3, "เครื่องที่ต้องไป", !itemsFromJob, ` (${v.items.length})`)}
          >
            {err("items") ? <Alert severity="error">{err("items")}</Alert> : null}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
              <Button
                id="queue-items"
                variant={pickMode ? "outlined" : "contained"}
                startIcon={<SearchIcon />}
                onClick={() => setPickMode((m) => (m ? null : "stock"))}
                disabled={v.items.length >= 50}
                data-testid="queue-pick-machine"
              >
                {pickMode ? "ปิดตัวเลือกเครื่อง" : "เลือกเครื่องที่ต้องการ"}
              </Button>
              {/* CR-EX01 §14.2: เพิ่มเครื่องลูกค้าภายนอกจากหน้าเปิดคิว (ต้องเลือกลูกค้าก่อน) */}
              {has("svcqueue:request") || has("equipment:create") ? (
                <Button size="small" variant="text" startIcon={<AddIcon />} onClick={() => setAddExt(true)} disabled={!v.customerId || v.items.length >= 50} data-testid="queue-add-external">
                  เพิ่มเครื่องลูกค้า (ภายนอก)
                </Button>
              ) : null}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {isInstallType(v.jobType) || !v.jobType
                ? "งานติดตั้ง: เลือกเครื่องที่มีในคลัง หรือเลือกรุ่นที่ยังไม่มีในคลัง (ใส่ SN ทีหลังได้)"
                : "งานซ่อม/บริการ: เลือกเครื่องของลูกค้าหรือสาขานี้"}
              {" · เลือกเครื่องเดิมซ้ำไม่ได้ · สูงสุด 50 เครื่อง"}
              {editing ? " · รายการเดิมคงรหัสรายการไว้ ไม่สร้างเครื่องซ้ำ" : ""}
            </Typography>
            {pickMode ? (
              <ToggleButtonGroup
                exclusive
                size="small"
                value={pickMode}
                onChange={(_e, m) => m && setPickMode(m)}
                aria-label="แหล่งเครื่อง"
                data-testid="queue-pick-mode"
              >
                <ToggleButton value="stock" sx={{ px: 2 }}>มีในคลัง (มี SN)</ToggleButton>
                <ToggleButton value="model" sx={{ px: 2 }}>ยังไม่มีในคลัง (เลือกรุ่น)</ToggleButton>
              </ToggleButtonGroup>
            ) : null}
            {pickMode === "model" ? (
              <Box sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1, display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
                <Typography variant="body2" sx={{ flex: "1 1 260px" }}>
                  เพิ่มเครื่องโดยเลือกรุ่นจากข้อมูลหลัก ระบบออกเลขชั่วคราวให้ แล้วใส่ SN จริงทีหลัง
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={addModelRow} data-testid="queue-add-model-row">
                  เพิ่มเครื่องตามรุ่น
                </Button>
              </Box>
            ) : null}
            <ExternalEquipmentDialog
              open={addExt}
              customerId={v.customerId}
              siteId={v.siteId}
              onClose={() => setAddExt(false)}
              onCreated={(e) => {
                setAddExt(false);
                setV((p) => ({ ...p, items: [...p.items.filter(isFilled), { machineType: "", model: e.model, serial: e.hasRealSerial ? e.serial : "", equipmentId: e.id, internalCode: e.hasRealSerial ? "" : e.serial, note: "" }] }));
              }}
              onUseExisting={(e) => {
                setAddExt(false);
                if (v.items.some((i) => i.equipmentId === e.id)) return;
                setV((p) => ({ ...p, items: [...p.items.filter(isFilled), { machineType: "", model: e.model, serial: e.serial.startsWith("TMP-") ? "" : e.serial, equipmentId: e.id, internalCode: e.serial.startsWith("TMP-") ? e.serial : "", note: "" }] }));
              }}
            />
            {picking ? (
              <Box sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }} data-testid="picker-selected-count">
                  เลือกแล้ว {v.items.filter((i) => i.equipmentId).length} เครื่อง — รายการที่เลือกแสดงพื้นเขียวพร้อมป้าย “เลือกแล้ว” และเป็นการ์ด “เครื่องที่ …” ด้านล่าง
                </Typography>
                <MachinePicker
                  selectedIds={v.items.map((i) => i.equipmentId ?? "").filter(Boolean)}
                  availableOnly={!v.jobType || isInstallType(v.jobType)}
                  // D-R2-01: งานซ่อม/บริการ = เครื่องของลูกค้า/สาขาในคิวเท่านั้น
                  atCustomer={!v.jobType || isInstallType(v.jobType) ? undefined : v.customerId ? { customerId: v.customerId, siteId: v.siteId } : null}
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
            {v.items.length === 0 ? (
              <Alert severity="info" data-testid="queue-no-machine">
                ยังไม่ได้เลือกเครื่อง — กด “เลือกเครื่องที่ต้องการ”
              </Alert>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }} data-testid="queue-items-table">
                {v.items.map((it, i) => {
                  const fromStock = !!it.equipmentId;
                  const removeBtn = (
                    <Button size="small" variant="outlined" sx={{ ml: "auto" }} aria-label={`เอาเครื่องที่ ${i + 1} ออกจากคิว`} title="เอาออกจากคิว (ไม่ลบเครื่องในคลัง)" onClick={() => set("items", v.items.filter((_, j) => j !== i))}>
                      เอาออก
                    </Button>
                  );
                  // MOM-13: เครื่องละการ์ด หัว "เครื่องที่ N" แยกกันชัด · id ใช้พาไปจากข้อความผิดพลาดรายเครื่อง
                  return (
                    <Paper
                      key={it.itemId ?? (fromStock ? `eq-${it.equipmentId}` : `new-${i}`)}
                      id={`queue-item-card-${i}`}
                      variant="outlined"
                      sx={{ p: 2, borderRadius: "12px", borderColor: err(`items.${i}`) ? t.danger : t.lineStrong }}
                      data-testid={fromStock ? "queue-item-stock" : "queue-item-manual"}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap", mb: 1.5 }}>
                        <Box component="span" sx={{ bgcolor: t.ink, color: "#fff", borderRadius: "6px", px: 1.25, py: 0.25, fontSize: 13, fontWeight: 700 }}>
                          เครื่องที่ {i + 1}
                        </Box>
                        {fromStock ? (
                          <>
                            <Box component="span" sx={{ fontFamily: t.mono, fontWeight: 700, fontSize: 16 }}>{it.model || "ไม่ระบุรุ่น"}</Box>
                            {it.machineType ? <Typography component="span" variant="body2" color="text.secondary">{it.machineType}</Typography> : null}
                            <WomsStatusChip label="จากคลัง" tone="primary" />
                          </>
                        ) : (
                          <WomsStatusChip label="ยังไม่มีในคลัง · รอ SN" tone="warning" />
                        )}
                        {removeBtn}
                      </Box>
                      {fromStock ? (
                        // FB-06: เครื่องจากคลัง — รุ่น/ประเภท/SN ตามคลัง แก้ที่นี่ไม่ได้
                        <Grid container spacing={1.5} alignItems="flex-start">
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block" }}>SN</Typography>
                            <Typography sx={{ fontFamily: t.mono, fontSize: 14, color: t.accentInk, fontWeight: 600 }}>
                              {it.serial || `รอ SN · ${it.internalCode || "เลขชั่วคราว"}`}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">เครื่องจากคลัง (แก้รุ่นไม่ได้)</Typography>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 8 }}>
                            <TextField fullWidth size="small" label="หมายเหตุเครื่อง (ไม่บังคับ)" placeholder="เช่น ใต้บันได" inputProps={{ "aria-label": `หมายเหตุเครื่องที่ ${i + 1}` }} value={it.note} onChange={(e) => setItem(i, { note: e.target.value })} />
                          </Grid>
                        </Grid>
                      ) : (
                        <Grid container spacing={1.5} alignItems="flex-start">
                          {/* MOM-14 / D-07A / EQ-02: รุ่นอยู่หน้าสุดและกว้าง ค้นได้ทุกรุ่น — เลือกแล้วเติมประเภทให้ · หมวดหมู่ใช้กรองรุ่นเท่านั้น (คิวไม่บันทึกหมวดหมู่) */}
                          <EquipmentModelFields
                            hasCategory={false}
                            categoryFilterOnly
                            modelFirst
                            modelCol={{ xs: 12, sm: 6 }}
                            size="small"
                            col={{ xs: 12, sm: 3 }}
                            idPrefix={`queue-item-${i}`}
                            showPrice={false}
                            labels={{ machineType: "ประเภทเครื่อง", model: "รุ่น (พิมพ์ค้นหา เช่น B-301SA)" }}
                            value={{ machineType: it.machineType ?? "", category: "", model: it.model ?? "" }}
                            masterId={it.modelMasterId ?? ""}
                            // DATA-GAP-Q1: เก็บแถว master ที่เลือก (รุ่นชื่อซ้ำต่างหมวดหมู่) · ไม่ตรงแถวเดียว = "" (ไม่เดา)
                            onChange={(next, master) => setItem(i, { machineType: next.machineType, model: next.model, modelMasterId: master?.id ?? "" })}
                          />
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField fullWidth size="small" label="SN (ไม่บังคับ)" value={it.serial} onChange={(e) => setItem(i, { serial: e.target.value })} error={!!err(`items.${i}`)} helperText={err(`items.${i}`) ?? "ไม่มี SN ระบบออกเลขชั่วคราวให้"} />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 8 }}>
                            <TextField fullWidth size="small" label="หมายเหตุเครื่อง (ไม่บังคับ)" value={it.note} onChange={(e) => setItem(i, { note: e.target.value })} />
                          </Grid>
                        </Grid>
                      )}
                      {fromStock && err(`items.${i}`) ? <Typography variant="caption" color="error" sx={{ fontWeight: 600 }}>{err(`items.${i}`)}</Typography> : null}
                      <Box sx={{ mt: 1 }}>
                        <QueueItemExtras item={it} index={i} jobType={v.jobType} onChange={(p) => setItem(i, p)} error={err} />
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            )}
          </Sec>

          <Sec id="queue-sec-schedule" title={secTitle(4, "วันที่ลูกค้าสะดวกและข้อมูลอื่น", false)}>
            {/* UAT 2026-11-16 (Owner): ใส่วัน/เวลาที่ลูกค้าสะดวกได้อีกครั้ง — เป็นข้อมูลประกอบให้ช่างเห็นตอนเสนอวัน (วันนัดจริงยังมาจากช่างเสนอ → Admin รับ) */}
            <Box sx={grid}>
              <Box>
                {lab("queue-preferredDate", "ลูกค้าสะดวกวันที่ (ไม่บังคับ)")}
                <DateField
                  id="queue-preferredDate"
                  
                  value={v.preferredDate}
                  onChange={(e) => set("preferredDate", e.target.value)}
                  error={!!err("preferredDate")}
                  helperText={err("preferredDate") ?? "ช่างเห็นวันนี้ตอนเสนอวันนัด"}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
              <Box>
                {lab("queue-preferredTime", "เวลาที่ลูกค้าสะดวก (ไม่บังคับ)")}
                <TextField id="queue-preferredTime" type="time" value={v.preferredTime} onChange={(e) => set("preferredTime", e.target.value)} error={!!err("preferredTime")} helperText={err("preferredTime")} InputLabelProps={{ shrink: true }} />
              </Box>
            </Box>
            <Box sx={grid}>
              <Box>
                {lab("queue-customerType", "ประเภทลูกค้า")}
                <TextField select id="queue-customerType" value={v.customerType} onChange={(e) => set("customerType", e.target.value)} SelectProps={{ displayEmpty: true }}>
                  {CUSTOMER_TYPES.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              <Box>
                {lab("queue-ownerSale", "เซลล์เจ้าของงาน")}
                {admin ? (
                  <TextField
                    select
                    id="queue-ownerSale"
                    value={v.ownerSaleId}
                    onChange={(e) => set("ownerSaleId", e.target.value)}
                    error={!!err("ownerSaleId")}
                    helperText={err("ownerSaleId") ?? "Admin เปิดคิวแทนเซลล์ได้"}
                    SelectProps={{ displayEmpty: true }}
                  >
                    <MenuItem value="">— ไม่ระบุ (Admin ดำเนินการเอง) —</MenuItem>
                    {sales.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <TextField id="queue-ownerSale" value={user?.name ?? ""} disabled helperText="กำหนดจากผู้เปิดคิว" />
                )}
              </Box>
            </Box>
          </Sec>

          {extraSection ? (
            <Box
              sx={{
                borderTop: `1px solid ${t.line}`,
                "& > .MuiPaper-root": { border: 0, borderRadius: 0, boxShadow: "none", mb: 0, p: { xs: 2, sm: 3 } },
              }}
            >
              {extraSection}
            </Box>
          ) : null}

          {/* ENTECH DS .savebar */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, justifyContent: "flex-end", alignItems: "center", px: { xs: 2, sm: 3 }, py: 2, borderTop: `1px solid ${t.line}`, bgcolor: t.surface2 }}>
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
            <Button type="submit" variant="contained" disabled={busy} data-testid="queue-submit">
              {busy ? "กำลังบันทึก…" : submitLabel}
            </Button>
          </Box>
        </Paper>

        <Box sx={{ flex: "1 1 280px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2, position: { lg: "sticky" }, top: { lg: 80 } }}>
          {review ? (
            // MOM-02 / MOM-10: การ์ดสรุปแบบเดียวกับหน้าเปิดงาน — นับเฉพาะช่องบังคับจริง กดแถวแล้วไปช่องแรกที่ขาด
            <WomsFormSummary
              title="สรุปคำขอคิว"
              rows={queueRequirements(v)}
              fieldId={fieldId}
              sections={{
                job: { label: "ต้องการให้ช่างทำอะไร", anchorId: "queue-sec-job", value: [typeLabel(v.jobType), v.note.trim().slice(0, 40)].filter(Boolean).join(" · ") },
                customer: { label: "ลูกค้าและหน้างาน", anchorId: "queue-sec-customer", value: v.jobName },
                machines: { label: "เครื่องที่ต้องไป", anchorId: "queue-sec-machines", value: v.items.filter(isFilled).length ? `${v.items.filter(isFilled).length} เครื่อง` : "" },
                schedule: { label: "วันที่ลูกค้าสะดวก", anchorId: "queue-sec-schedule", value: [v.preferredDate, v.preferredTime].filter(Boolean).join(" ") },
              }}
              footnote="กดส่งตอนยังไม่ครบได้ ระบบจะบอกทุกช่องที่ต้องแก้และพาไปช่องแรก"
            />
          ) : null}
          <Alert severity="info" icon={false} data-testid="queue-after-submit">
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>หลังส่งคำขอ</Typography>
            คำขอจะเข้ากลุ่มเช็คคิวของทีมคุณ แอดมินจะเลือกช่างและเวลา แล้วคุณยืนยันกับลูกค้า
          </Alert>
        </Box>
      </Box>


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
