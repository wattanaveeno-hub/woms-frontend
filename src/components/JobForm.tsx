"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuthUser, CustomerSite, JobFormValues, Options, Partner } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import Typography from "@mui/material/Typography";
import { WomsFormSection } from "@/components/woms";
import AddIcon from "@mui/icons-material/Add";
import { fieldErrorHelpers, withCurrent } from "@/lib/formErrors";
import { pickJobFormValues } from "@/lib/jobView";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

const EMPTY: JobFormValues = {
  // ไม่ตั้งค่าเริ่มต้น — ผู้เปิดงานต้องเลือกประเภทเองเสมอ (ค่าเดิม "INSTALL" ไม่ระบุเช่า/ขาย จึงทำให้ประกัน/PM ผิดได้)
  jobType: "" as JobFormValues["jobType"],
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
  customerType: "",
  customerId: "",
  siteId: "",
  installAddress: "",
  technicianIds: [],
};

// D-11: ใบงานใหม่เลือกได้ 9 ประเภทตามข้อกำหนด p5 — INSTALL (ไม่ระบุเช่า/ขาย) และ REMOVE (ซ่อมถอน) เป็นค่าเดิม
// ซ่อนจากใบงานใหม่ แต่ใบงานเก่ายังแสดง/บันทึกค่าของตัวเองได้
const LEGACY_JOB_TYPES = ["INSTALL", "REMOVE"];

/** ลิงก์ Map จากพิกัดสาขา (ใช้เฉพาะตอนช่อง Map ยังว่าง — ผู้ใช้แก้เองได้) */
function mapFromSite(s: CustomerSite): string {
  // CUS-02 (D-08): ใช้ลิงก์แผนที่ที่บันทึกในสาขาก่อน ไม่มีจึงสร้างจากพิกัด
  if (s.mapLink && s.mapLink.trim()) return s.mapLink.trim();
  return s.lat || s.lng ? `https://www.google.com/maps?q=${s.lat},${s.lng}` : "";
}

/**
 * JOB-01 / CUS-02 / AT-03 — เลือกลูกค้าและสาขาจากฐานข้อมูลลูกค้า
 * - รหัสสาขาเป็นข้อความ 2 หลักเสมอ ("00" ไม่ถูกตัดเลข 0)
 * - ไม่มีสาขาที่ต้องการ → เพิ่มสาขาใหม่จากหน้าเปิดงานได้ (สิทธิ์ partners:create)
 * - เลือกสาขาแล้วเติมผู้ติดต่อ/เบอร์/Map ให้ถ้าช่องยังว่าง (แก้ต่อได้)
 */
export function CustomerSitePicker({
  customerId,
  siteId,
  disabled,
  onPick,
}: {
  customerId: string;
  siteId: string;
  disabled?: boolean;
  onPick: (partner: Partner | null, site: CustomerSite | null) => void;
}) {
  const { has } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [adding, setAdding] = useState(false);
  // D-10 / CUS-02: สาขาที่เพิ่มจากหน้าเปิดงานเก็บที่อยู่และพิกัดได้ (API รองรับอยู่แล้ว)
  const EMPTY_SITE = { branchNo: "", storeName: "", contactPerson: "", phone: "", address: "", district: "", province: "", postcode: "", lat: "", lng: "" };
  const [draft, setDraft] = useState(EMPTY_SITE);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // D-17: โหลดรายชื่อลูกค้า/สาขาไม่สำเร็จต้องบอกผู้ใช้ (เดิม dropdown ว่างเฉย ๆ)
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const failMsg = (e: unknown, what: string) => (e instanceof ApiError ? `${what}ไม่สำเร็จ — ${e.message}` : `${what}ไม่สำเร็จ`);

  useEffect(() => {
    setLoadErr(null);
    api
      .listPartners({})
      .then((r) => setPartners(r.items.filter((p) => p.type !== "SUPPLIER")))
      .catch((e) => {
        setPartners([]);
        setLoadErr(failMsg(e, "โหลดรายชื่อลูกค้า"));
      });
  }, [reload]);

  useEffect(() => {
    if (!customerId) {
      setSites([]);
      return;
    }
    api
      .listCustomerSites(customerId, { activeOnly: true })
      .then((r) => setSites(r.items))
      .catch((e) => {
        setSites([]);
        setLoadErr(failMsg(e, "โหลดสาขาของลูกค้า"));
      });
  }, [customerId, reload]);

  const partner = useMemo(() => partners.find((p) => p.id === customerId) ?? null, [partners, customerId]);
  const site = useMemo(() => sites.find((x) => x.id === siteId) ?? null, [sites, siteId]);

  const addSite = async () => {
    if (!customerId) return;
    const branchNo = draft.branchNo.trim();
    if (branchNo && !/^\d{2}$/.test(branchNo)) {
      setErr("รหัสสาขาต้องเป็นตัวเลข 2 หลัก เช่น 00, 01");
      return;
    }
    if (!branchNo && !draft.storeName.trim()) {
      setErr("ระบุรหัสสาขาหรือชื่อร้านอย่างน้อยหนึ่งอย่าง");
      return;
    }
    const lat = draft.lat.trim() === "" ? 0 : Number(draft.lat);
    const lng = draft.lng.trim() === "" ? 0 : Number(draft.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      setErr("ละติจูด/ลองจิจูดไม่ถูกต้อง (เช่น 13.7563, 100.5018)");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const created = await api.createCustomerSite(customerId, { ...draft, branchNo, lat, lng });
      setSites((prev) => [...prev, created]);
      setAdding(false);
      setDraft(EMPTY_SITE);
      onPick(partner, created);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "เพิ่มสาขาไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      {loadErr ? (
        <Alert
          severity="error"
          sx={{ mb: 1.5 }}
          action={
            <Button color="inherit" size="small" onClick={() => setReload((n) => n + 1)}>
              ลองใหม่
            </Button>
          }
        >
          {loadErr}
        </Alert>
      ) : null}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Autocomplete
            disabled={disabled}
            options={partners}
            value={partner}
            // D-18: mockup แยก "รหัสลูกค้า" / "ชื่อบริษัทลูกค้า" — ค้นได้ทั้งสองอย่างในช่องเดียว
            getOptionLabel={(p) => (p.customerCode ? `${p.customerCode} · ${p.name}` : p.name)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onChange={(_, p) => onPick(p, null)}
            renderInput={(params) => (
              <TextField {...params} id="job-customerId" label="รหัสลูกค้า / ชื่อบริษัทลูกค้า" placeholder="พิมพ์รหัสหรือชื่อลูกค้า" />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            id="job-siteId"
            label="รหัสสาขา / ชื่อร้าน/สาขา"
            value={site ? site.id : ""}
            disabled={disabled || !customerId}
            onChange={(e) => onPick(partner, sites.find((x) => x.id === e.target.value) ?? null)}
            helperText={!customerId ? "เลือกลูกค้าก่อน" : sites.length === 0 ? "ลูกค้ารายนี้ยังไม่มีสาขา — เพิ่มได้ด้านล่าง" : " "}
          >
            <MenuItem value="">— ไม่ระบุสาขา —</MenuItem>
            {sites.map((x) => (
              <MenuItem key={x.id} value={x.id}>
                {x.branchNo ? `[${x.branchNo}] ` : ""}
                {x.storeName || x.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>
      {site ? (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          รหัสสาขา <span className="code">{site.branchNo || "—"}</span>
          {site.addressFull ? ` · ${site.addressFull}` : ""}
        </Typography>
      ) : null}
      {customerId && !disabled && has("partners:create") ? (
        adding ? (
          <Box sx={{ mt: 1.5, p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              เพิ่มสาขาใหม่ให้ {partner?.name ?? "ลูกค้า"}
            </Typography>
            {err ? (
              <Alert severity="error" sx={{ mb: 1 }}>
                {err}
              </Alert>
            ) : null}
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  label="รหัสสาขา (2 หลัก)"
                  value={draft.branchNo}
                  inputProps={{ inputMode: "numeric", maxLength: 2 }}
                  onChange={(e) => setDraft((d) => ({ ...d, branchNo: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) }))}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 9 }}>
                <TextField label="ชื่อร้าน / สาขา" value={draft.storeName} onChange={(e) => setDraft((d) => ({ ...d, storeName: e.target.value }))} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="ผู้ติดต่อ" value={draft.contactPerson} onChange={(e) => setDraft((d) => ({ ...d, contactPerson: e.target.value }))} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="เบอร์" type="tel" value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
              </Grid>
              <Grid size={12}>
                <TextField label="ที่อยู่สาขา" value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} placeholder="เลขที่ ถนน ตำบล/แขวง" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="อำเภอ/เขต" value={draft.district} onChange={(e) => setDraft((d) => ({ ...d, district: e.target.value }))} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="จังหวัด" value={draft.province} onChange={(e) => setDraft((d) => ({ ...d, province: e.target.value }))} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="รหัสไปรษณีย์"
                  value={draft.postcode}
                  inputProps={{ inputMode: "numeric", maxLength: 5 }}
                  onChange={(e) => setDraft((d) => ({ ...d, postcode: e.target.value.replace(/[^0-9]/g, "").slice(0, 5) }))}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField label="ละติจูด" value={draft.lat} inputProps={{ inputMode: "decimal" }} onChange={(e) => setDraft((d) => ({ ...d, lat: e.target.value }))} placeholder="13.7563" />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField label="ลองจิจูด" value={draft.lng} inputProps={{ inputMode: "decimal" }} onChange={(e) => setDraft((d) => ({ ...d, lng: e.target.value }))} placeholder="100.5018" />
              </Grid>
            </Grid>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
              <Button variant="contained" onClick={addSite} disabled={busy}>
                {busy ? "กำลังบันทึก…" : "บันทึกสาขา"}
              </Button>
              <Button onClick={() => setAdding(false)} disabled={busy}>
                ยกเลิก
              </Button>
            </Stack>
          </Box>
        ) : (
          <Button size="small" startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={() => setAdding(true)}>
            เพิ่มสาขาใหม่
          </Button>
        )
      ) : null}
    </Box>
  );
}

export interface JobFormProps {
  options: Options;
  initial?: Partial<JobFormValues>;
  /** true = หน้าเปิดงานใหม่ (บังคับช่องที่ mockup SCR-JOB-001 กำหนด เช่น ที่อยู่ติดตั้ง) */
  isNew?: boolean;
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
  /** เนื้อหาการ์ด "รายละเอียดเครื่อง" (หน้าเปิดงานส่ง JobEquipmentSection มา) */
  machineSection?: (legacyFields: React.ReactNode) => React.ReactNode;
  /** แจ้งค่าล่าสุดของฟอร์มให้หน้าแม่ (ใช้รวมกับข้อความที่วางจาก LINE) */
  onValuesChange?: (values: JobFormValues) => void;
  /** บันทึกร่าง (JOB-01) — ไม่ตรวจความครบถ้วน ไม่ออกเลขงาน */
  onSaveDraft?: (values: JobFormValues) => void;
  draftBusy?: boolean;
  /** แจ้งหน้าแม่เมื่อเปลี่ยนประเภทงาน — ใช้แสดงช่องรายเครื่องตามประเภทงาน (AT-04) */
  onJobTypeChange?: (jobType: string) => void;
}

/**
 * TECH-01 / VFB: ช่างเห็นใบงานเฉพาะที่ระบุชื่อตัวเองเป็นผู้รับผิดชอบ (แม้อยู่ทีมเดียวกัน)
 * จึงต้องเลือกช่างรายบุคคลได้จากหน้าเปิดงาน — รายชื่อมาจาก /api/users/technicians (บทบาทช่างที่ยังใช้งาน)
 * ช่างที่ถูกปิดบัญชีไปแล้วแต่ยังอยู่ในใบงานเดิม แสดงเป็น "(ไม่ใช้งานแล้ว)" และเอาออกได้
 */
export function TechnicianPicker({
  value,
  onChange,
  disabled,
  error,
  helperText,
  team,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  team?: string;
}) {
  const [techs, setTechs] = useState<Pick<AuthUser, "id" | "name" | "team">[] | null>(null);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    api
      .listTechnicians()
      .then((r) => setTechs(r.items.filter((t) => t.active !== false)))
      .catch((e) => {
        setTechs([]);
        setLoadError(e instanceof ApiError ? e.message : "โหลดรายชื่อช่างไม่สำเร็จ");
      });
  }, []);
  const byId = new Map((techs ?? []).map((t) => [t.id, t]));
  const options = [
    ...(techs ?? []),
    ...value.filter((id) => !byId.has(id)).map((id) => ({ id, name: `${id} (ไม่ใช้งานแล้ว)`, team: "" })),
  ];
  // ช่างในทีมที่เลือกขึ้นก่อน
  const sorted = [...options].sort((a, b) => Number((b.team ?? "") === team) - Number((a.team ?? "") === team));
  return (
    <Autocomplete
      multiple
      disabled={disabled}
      loading={techs === null}
      options={sorted}
      getOptionLabel={(o) => (o.team ? `${o.name} · ${o.team}` : o.name)}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      value={value.map((id) => options.find((o) => o.id === id)!).filter(Boolean)}
      onChange={(_, list) => onChange(list.map((o) => o.id))}
      renderInput={(params) => (
        <TextField
          {...params}
          id="job-technicianIds"
          label="ช่างผู้รับผิดชอบ"
          error={error || !!loadError}
          helperText={loadError || helperText || (value.length ? undefined : "ยังไม่ได้เลือกช่าง — ช่างจะยังไม่เห็นใบงานนี้ในมือถือ")}
        />
      )}
    />
  );
}

export default function JobForm({
  options,
  initial,
  isNew = false,
  submitLabel,
  fieldError,
  busy,
  onSubmit,
  extraActions,
  equipmentLinked,
  readOnly,
  readOnlyReason,
  machineSection,
  onJobTypeChange,
  onSaveDraft,
  draftBusy,
  onValuesChange,
}: JobFormProps) {
  const [v, setV] = useState<JobFormValues>({ ...EMPTY, ...initial });
  const [localError, setLocalError] = useState<{ field?: string; message: string } | null>(null);
  useEffect(() => {
    onValuesChange?.(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);

  const set = <K extends keyof JobFormValues>(k: K, val: JobFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const { fid, errMsg, fe } = fieldErrorHelpers(localError ?? fieldError, "job");

  const submit = () => {
    // ตรวจฝั่งหน้าเว็บก่อนส่ง (backend ตรวจซ้ำเสมอ) — แจ้งช่องที่ขาดทันทีไม่ต้องรอรอบส่ง
    const missing: [keyof JobFormValues, string][] = [
      ["jobType", "ต้องเลือกประเภทงาน"],
      ["jobName", "ต้องระบุชื่องาน"],
      ["technicianTeam", "ต้องระบุทีมช่าง"],
      ["jobDate", "ต้องระบุวันที่นัด"],
    ];
    for (const [k, msg] of missing) {
      if (!String(v[k] ?? "").trim()) {
        setLocalError({ field: k, message: msg });
        return;
      }
    }
    if (v.jobType === "REMOVE" && !v.jobSubType) {
      setLocalError({ field: "jobSubType", message: "งานซ่อมถอนต้องเลือกประเภทย่อย" });
      return;
    }
    // SCR-JOB-001 "ที่อยู่ติดตั้ง *" — บังคับตอนเปิดงานใหม่ (ใบงานเก่าที่ไม่มีค่านี้ยังแก้ช่องอื่นได้)
    if (isNew && !String(v.installAddress ?? "").trim()) {
      setLocalError({ field: "installAddress", message: "ต้องระบุที่อยู่ติดตั้ง (เลือกสาขาเพื่อเติมให้อัตโนมัติ หรือพิมพ์เอง)" });
      return;
    }
    // SCR-JOB-001 "เซลล์ผู้รับผิดชอบ *" — บังคับเมื่อมีรายชื่อเซลล์ในข้อมูลพื้นฐานแล้ว
    if ((options.salespeople?.length ?? 0) > 0 && !String(v.salesPerson ?? "").trim()) {
      setLocalError({ field: "salesPerson", message: "ต้องเลือกเซลล์ผู้รับผิดชอบ" });
      return;
    }
    if (v.jobType === "OTHER" && !v.note.trim()) {
      setLocalError({ field: "note", message: "ประเภทงาน “อื่น ๆ” ต้องระบุรายละเอียดในหมายเหตุ" });
      return;
    }
    setLocalError(null);
    // D-05: ส่งเฉพาะฟิลด์ของฟอร์ม — หน้าแก้ได้ initial = ใบงานทั้งก้อน (ฟิลด์ระบบต้องไม่ถูกส่งกลับไปเขียนทับ)
    const cleaned: JobFormValues = pickJobFormValues({
      ...v,
      jobSubType: v.jobType === "REMOVE" ? v.jobSubType : "",
    });
    onSubmit(cleaned);
  };

  const pickSite = (partner: Partner | null, site: CustomerSite | null) =>
    setV((prev) => ({
      ...prev,
      customerId: partner?.id ?? "",
      siteId: site?.id ?? "",
      // เติมให้เฉพาะช่องที่ยังว่าง — ไม่เขียนทับสิ่งที่ผู้ใช้พิมพ์ไว้
      contactName: prev.contactName || site?.contactPerson || partner?.name || "",
      phone: prev.phone || site?.phone || "",
      mapLink: prev.mapLink || (site ? mapFromSite(site) : ""),
      // SCR-JOB-001 ที่อยู่ติดตั้ง — เติมจากที่อยู่สาขาเมื่อยังว่าง (แก้เป็นจุดติดตั้งจริงได้)
      installAddress: prev.installAddress || site?.addressFull || "",
    }));

  const isRemove = v.jobType === "REMOVE";

  const formId = "job-form";
  const half = { xs: 12, sm: 6 } as const;
  const third = { xs: 12, sm: 6, md: 4 } as const;

  // ข้อความรุ่น/เครื่องกรองระดับใบงาน (ข้อมูลเดิมก่อนผูกเครื่อง และค่าที่แยกจากข้อความ LINE) — แสดงไว้ ไม่ทิ้งข้อมูลที่อ่านได้
  const legacyMachineFields = (
    <Grid container spacing={2} sx={{ mt: 2 }}>
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

          {/* D-01: ช่องนี้คือ serial แบบข้อความของใบงานเดิม (ไม่ใช่ "เครื่องกรอง" รายเครื่อง — กรอกที่การ์ดเครื่อง)
              ใบงานใหม่ไม่แสดง เว้นแต่มีค่าอยู่แล้ว (เช่น ร่างเก่า) · ป้ายเดียวกับมือถือ */}
          {!isNew || v.filterUnit ? (
            <Grid size={third}>
              <TextField
                id={fid("filterUnit")}
                label="Serial (ข้อความเดิม)"
                value={v.filterUnit}
                onChange={(e) => set("filterUnit", e.target.value)}
                placeholder="serial ที่ยังไม่ผูกกับคลัง"
                disabled={readOnly || equipmentLinked}
                helperText={equipmentLinked ? "มีเครื่องผูกในใบงานแล้ว — แก้ข้อมูลเครื่องที่การ์ดรายละเอียดเครื่อง" : undefined}
              />
            </Grid>
          ) : null}

    </Grid>
  );

  // ฟอร์มครอบเฉพาะการ์ดงาน/ลูกค้า — การ์ดเครื่องมีฟอร์มค้นหาของตัวเอง (ห้ามซ้อน <form>) จึงอยู่นอก
  // ปุ่มบันทึกอยู่ท้ายการ์ดเครื่องและผูกกับฟอร์มด้วย attribute form (ค่าทั้งหมดอยู่ใน state ไม่ได้อ่านจาก DOM)
  return (
    <>
    <Box
      component="form"
      id={formId}
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

        {/* JOB-01 / JOB-02 — แยกฟอร์มเป็นการ์ดตาม Developer Handoff: รายละเอียดงาน · รายละเอียดลูกค้า · รายละเอียดเครื่อง */}
        <WomsFormSection title="รายละเอียดงาน">
          <Grid container spacing={2}>
            <Grid size={half}>
              <TextField
                select
                required
                disabled={readOnly}
                {...fe("jobType")}
                label="ประเภทงาน"
                value={v.jobType}
                onChange={(e) => {
                  set("jobType", e.target.value as JobFormValues["jobType"]);
                  onJobTypeChange?.(e.target.value);
                }}
              >
                {v.jobType ? null : <MenuItem value="">— เลือกประเภทงาน —</MenuItem>}
                {/* INSTALL (ติดตั้ง ไม่ระบุเช่า/ขาย) เป็นค่าเดิม — ซ่อนจากใบงานใหม่ แต่ใบงานเก่ายังแสดงค่าของตัวเองได้ */}
                {options.jobTypes
                  .filter((o) => !LEGACY_JOB_TYPES.includes(o.value) || o.value === v.jobType)
                  .map((o) => (
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
              <TextField
                select
                disabled={readOnly}
                {...fe("customerType")}
                label="ประเภทลูกค้า"
                value={v.customerType ?? ""}
                onChange={(e) => set("customerType", e.target.value as JobFormValues["customerType"])}
              >
                <MenuItem value="">— ไม่ระบุ —</MenuItem>
                <MenuItem value="IN">ลูกค้าใน</MenuItem>
                <MenuItem value="OUT">ลูกค้านอก</MenuItem>
              </TextField>
            </Grid>

            <Grid size={third}>
              {options.salespeople?.length ? (
                <TextField
                  select
                  required
                  disabled={readOnly}
                  {...fe("salesPerson")}
                  label="เซลล์ผู้รับผิดชอบ"
                  value={v.salesPerson}
                  onChange={(e) => set("salesPerson", e.target.value)}
                >
                  <MenuItem value="">— เลือกเซลล์ —</MenuItem>
                  {withCurrent(options.salespeople, v.salesPerson).map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  disabled={readOnly}
                  {...fe("salesPerson")}
                  label="เซลล์ผู้รับผิดชอบ"
                  value={v.salesPerson}
                  onChange={(e) => set("salesPerson", e.target.value)}
                  helperText="ยังไม่ได้ตั้งรายชื่อเซลล์ในข้อมูลพื้นฐาน"
                />
              )}
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

            <Grid size={12}>
              <TechnicianPicker
                value={v.technicianIds ?? []}
                onChange={(ids) => set("technicianIds", ids)}
                disabled={readOnly}
                error={!!errMsg("technicianIds")}
                helperText={errMsg("technicianIds")}
                team={v.technicianTeam}
              />
            </Grid>

            <Grid size={half}>
              <TextField
                required
                disabled={readOnly}
                {...fe("jobDate")}
                label="วันที่นัดหมาย"
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
                {...fe("note")}
                label="หมายเหตุ"
                multiline
                minRows={3}
                value={v.note}
                onChange={(e) => set("note", e.target.value)}
                required={v.jobType === "OTHER"}
                helperText={
                  errMsg("note") ??
                  (v.jobType === "OTHER" ? "ประเภท “อื่น ๆ” — ระบุรายละเอียดของงานที่นี่ (ระบบไม่เพิ่มเป็นประเภทใหม่)" : undefined)
                }
              />
            </Grid>
          </Grid>
        </WomsFormSection>

        <WomsFormSection title="รายละเอียดลูกค้า">
          <Grid container spacing={2}>
            <Grid size={12}>
              <CustomerSitePicker customerId={v.customerId ?? ""} siteId={v.siteId ?? ""} disabled={readOnly} onPick={pickSite} />
            </Grid>

            <Grid size={12}>
              <TextField
                disabled={readOnly}
                {...fe("installAddress")}
                required={isNew}
                multiline
                minRows={1}
                label="ที่อยู่ติดตั้ง"
                value={v.installAddress ?? ""}
                onChange={(e) => set("installAddress", e.target.value)}
                placeholder="ที่อยู่สถานที่ติดตั้ง — เลือกสาขาแล้วระบบเติมให้"
                inputProps={{ maxLength: 500 }}
              />
            </Grid>

            <Grid size={third}>
              <TextField disabled={readOnly} id={fid("contactName")} label="ผู้ติดต่อ" value={v.contactName} onChange={(e) => set("contactName", e.target.value)} />
            </Grid>

            <Grid size={third}>
              <TextField
                disabled={readOnly}
                {...fe("phone")}
                label="เบอร์โทรศัพท์"
                type="tel"
                inputProps={{ inputMode: "tel" }}
                value={v.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Grid>

            <Grid size={12}>
              <TextField
                disabled={readOnly}
                {...fe("mapLink")}
                label="Google Map"
                value={v.mapLink}
                onChange={(e) => set("mapLink", e.target.value)}
                placeholder="https://maps.google.com/..."
              />
            </Grid>

          </Grid>
        </WomsFormSection>
      </Box>
    </Box>

      {/* การ์ด "รายละเอียดเครื่อง" — หน้าเปิดงานส่ง JobEquipmentSection มา (เป็นการ์ดในตัว) พร้อมช่องข้อความรุ่น/เครื่องกรองท้ายการ์ด */}
      {machineSection ? (
        machineSection(legacyMachineFields)
      ) : (
        <WomsFormSection title="รายละเอียดเครื่อง">
          <Typography variant="body2">
            เพิ่ม/แก้เครื่องในใบงาน (SN ประเภท รุ่น เครื่องกรอง PM ประกัน) ได้ที่การ์ด “รายละเอียดเครื่อง” ในหน้าใบงาน
          </Typography>
          {legacyMachineFields}
        </WomsFormSection>
      )}

      {!readOnly || extraActions ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          {readOnly ? null : (
            <Button type="submit" form={formId} variant="contained" disabled={busy || draftBusy}>
              {busy ? "กำลังบันทึก…" : submitLabel}
            </Button>
          )}
          {!readOnly && onSaveDraft ? (
            <Button
              variant="outlined"
              disabled={busy || draftBusy}
              onClick={() => {
                setLocalError(null);
                onSaveDraft(pickJobFormValues({ ...v, jobSubType: v.jobType === "REMOVE" ? v.jobSubType : "" }));
              }}
            >
              {draftBusy ? "กำลังบันทึกร่าง…" : "บันทึกร่าง"}
            </Button>
          ) : null}
          {extraActions}
        </Stack>
      ) : null}
    </>
  );
}
