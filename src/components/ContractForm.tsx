"use client";

import { useEffect, useState } from "react";
import DateField from "@/components/DateField";
import { api } from "@/lib/api";
import type { ContractFormValues, ContractType, CustomerSite, Options, Partner } from "@/lib/types";
import { contractTypeLabel } from "@/lib/options";
import { fieldErrorHelpers } from "@/lib/formErrors";
import { useMoneyInputs } from "@/components/FieldErrors";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import { sortSerialsForModel } from "@/lib/contractRules";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { tokens as t } from "@/theme/tokens";
import ContractClausesEditor from "@/components/ContractClausesEditor";
import { CLAUSE_HEADING, clausesOf, toClausePayload, validateClauseTexts } from "@/lib/contractClauses";

const grid = { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: "16px 24px" } as const;
const full = { gridColumn: "1 / -1" } as const;

const TYPES: ContractType[] = ["RENTAL", "HIRE_PURCHASE", "SALE"];

const EMPTY: ContractFormValues = {
  type: "RENTAL",
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  siteAddress: "",
  siteLat: 0,
  siteLng: 0,
  zone: "",
  serial: "",
  model: "",
  startDate: "",
  rentPerMonth: 0,
  periodMonths: 0,
  rentUnit: "MONTH",
  rentPerDay: 0,
  periodDays: 0,
  deposit: 0,
  totalPrice: 0,
  downPayment: 0,
  installmentCount: 0,
  note: "",
};

export interface ContractFormProps {
  options: Options;
  serials: { serial: string; model: string }[];
  initial?: Partial<ContractFormValues>;
  submitLabel: string;
  fieldError?: { field?: string; message: string } | null;
  busy?: boolean;
  /**
   * `activate` = ผู้ใช้เลือก "สร้างและเปิดใช้งานทันที"
   * หน้าที่แก้ไขสัญญาเดิมจะไม่ส่งค่านี้ไปใช้
   */
  onSubmit: (values: ContractFormValues, activate: boolean) => void;
  /** true = ฟอร์มนี้กำลังสร้างสัญญาใหม่ (แสดงตัวเลือกสถานะตอนสร้าง) */
  isNew?: boolean;
}

export default function ContractForm({
  options,
  serials,
  initial,
  submitLabel,
  fieldError,
  busy,
  onSubmit,
  isNew,
}: ContractFormProps) {
  const [v, setV] = useState<ContractFormValues>({ ...EMPTY, ...initial });
  // UAT2-18 — ข้อกำหนดเพิ่มเติม (แก้เป็นรายการข้อความ · ส่งเป็น { order, text } ตอนบันทึก)
  const [clauseTexts, setClauseTexts] = useState<string[]>(() => clausesOf(initial as any).map((c) => c.text));
  const [clauseShowErrors, setClauseShowErrors] = useState(false);
  /*
   * QA BUG-028 — ฟอร์มนี้เคยรับ "ชื่อลูกค้า" เป็นข้อความอิสระล้วน และไม่มีช่องสาขาเลย
   * สัญญาจึงไม่ผูกกับฐานข้อมูลลูกค้ากลาง แม้ลูกค้ารายนั้นจะมีอยู่จริง
   * ที่นี่เพิ่มการ "เลือกจากฐานข้อมูล" ให้เป็นทางหลัก แต่ยังพิมพ์เองได้
   * (backend ยังรับเฉพาะ customerName/siteAddress จึงเติมค่าจากที่เลือกให้)
   */
  const [customers, setCustomers] = useState<Partner[]>([]);
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [customerId, setCustomerId] = useState(initial?.partnerId ?? "");
  const [siteId, setSiteId] = useState(initial?.siteId ?? "");
  const [sitesLoading, setSitesLoading] = useState(false);
  // QA BUG-025 — สัญญาสร้างใหม่เป็นร่างเสมอ เว้นแต่ผู้ใช้กด "สร้างและเปิดใช้งานสัญญา" (ปุ่มแยกตาม design)
  const activate = false;

  useEffect(() => {
    api
      .listPartners({ type: "CUSTOMER" })
      .then((r) => setCustomers(r.items))
      .catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    if (!customerId) {
      setSites([]);
      setSiteId("");
      return;
    }
    let cancelled = false;
    setSitesLoading(true);
    api
      .listCustomerSites(customerId, { activeOnly: true })
      .then((r) => {
        if (!cancelled) setSites(r.items);
      })
      .catch(() => {
        if (!cancelled) setSites([]);
      })
      .finally(() => {
        if (!cancelled) setSitesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const set = <K extends keyof ContractFormValues>(k: K, val: ContractFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  // ช่องเงินรับเฉพาะเลขฐานสิบ — เดิม type=number + Number() ทำให้ "1e5" ผ่านเป็น 100000
  const money = useMoneyInputs();

  // CON-01 v2: เลือก Serial แล้วเติมรุ่นจาก Machine Record ทันที (ไม่สนตัวพิมพ์/ช่องว่าง) และอัปเดตเมื่อเปลี่ยนเครื่อง
  // เปลี่ยนไปเป็น Serial ที่ไม่มีในคลัง → ล้างรุ่นที่ค้างจากเครื่องเดิม (ให้ผู้ใช้กรอกเอง)
  const findSerial = (serial: string) => {
    const k = serial.trim().toLowerCase();
    return k ? serials.find((x) => x.serial.trim().toLowerCase() === k) : undefined;
  };
  const onSerial = (serial: string) => {
    setV((prev) => {
      const match = findSerial(serial);
      const prevMatch = findSerial(prev.serial);
      return {
        ...prev,
        serial,
        model: match ? match.model : prevMatch && prev.model === prevMatch.model ? "" : prev.model,
      };
    });
  };
  const serialMatch = findSerial(v.serial);
  // ค่าเริ่มต้นจาก ?serial= / ใบเสนอราคา อาจมาก่อนรายการเครื่องโหลดเสร็จ — เติมรุ่นเมื่อรายการมาถึง
  useEffect(() => {
    const m = findSerial(v.serial);
    if (m && m.model && v.model !== m.model) setV((prev) => ({ ...prev, model: m.model }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serials]);

  const { fe } = fieldErrorHelpers(fieldError, "ct");

  const isRental = v.type === "RENTAL";
  const isHP = v.type === "HIRE_PURCHASE";
  const isSale = v.type === "SALE";

  const pickedCustomer = customers.find((c) => c.id === customerId) ?? null;

  // ---- ENTECH redesign (ContractNew): ป้ายเหนือช่อง · การ์ดหลักแบ่งส่วน · การ์ดข้างสรุปงวด · แถบบันทึก ----
  const lab = (id: string, text: string, req = false) => (
    <Box component="label" htmlFor={id} sx={{ display: "block", fontSize: 13, fontWeight: 600, color: t.slate, mb: 0.5 }}>
      {text}
      {req ? <Box component="i" sx={{ color: t.danger, fontStyle: "normal" }}> *</Box> : null}
    </Box>
  );
  const moneyField = (key: keyof ContractFormValues, label: string, required = false, help?: string) => {
    const f = fe(String(key), help);
    const m = money.props(String(key), v[key] as number, (n) => set(key, n as never));
    return (
      <Box>
        {lab(f.id, label, required)}
        <TextField {...f} required={required} {...m} />
      </Box>
    );
  };
  // พิกัดช่องเดียวแบบ "lat, lng" ตาม design — แยกเก็บเป็น siteLat/siteLng เหมือนเดิม
  const [geo, setGeo] = useState(v.siteLat || v.siteLng ? `${v.siteLat}, ${v.siteLng}` : "");
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const onGeo = (text: string) => {
    setGeo(text);
    const s2 = text.trim();
    if (!s2) {
      setGeoErr(null);
      setV((prev) => ({ ...prev, siteLat: 0, siteLng: 0 }));
      return;
    }
    const m = /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(s2);
    if (!m) return setGeoErr("รูปแบบพิกัด: ละติจูด, ลองจิจูด เช่น 13.6683, 100.6047");
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return setGeoErr("พิกัดเกินช่วงที่เป็นไปได้");
    setGeoErr(null);
    setV((prev) => ({ ...prev, siteLat: lat, siteLng: lng }));
  };
  const mapHref =
    v.siteLat || v.siteLng
      ? `https://www.google.com/maps/search/?api=1&query=${v.siteLat},${v.siteLng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.siteAddress || v.customerAddress || v.customerName || "")}`;
  const geoFe = fe("siteLat");

  const baht = (n: number) => `฿${(Number.isFinite(n) ? n : 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
  const sumRow = (l: string, r: string, strong = false) => (
    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, fontSize: 14, ...(strong ? { fontWeight: 700, borderTop: `1px solid ${t.line}`, pt: 1.25 } : {}) }}>
      <span>{l}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{r}</span>
    </Box>
  );
  const isDaily = isRental && v.rentUnit === "DAY";
  const hpFinanced = Math.max(0, (v.totalPrice || 0) - (v.downPayment || 0));
  const hpPer = v.installmentCount > 0 ? hpFinanced / v.installmentCount : 0;

  const submitWith = (act: boolean) => {
    if (geoErr) return;
    if (isRental && clauseTexts.length) {
      const cv = validateClauseTexts(clauseTexts);
      if (cv.overall || cv.perItem.some(Boolean)) {
        setClauseShowErrors(true);
        document.getElementById("contract-clauses")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    // ไม่ใช่สัญญาเช่า → ไม่ส่งข้อกำหนดเพิ่มเติม (backend รับเฉพาะสัญญาเช่า)
    const additionalClauses = isRental ? toClausePayload(clauseTexts) : undefined;
    if (money.check()) onSubmit({ ...v, partnerId: customerId, siteId, additionalClauses }, act);
  };

  return (
    <Box
      component="form"
      noValidate
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault();
        submitWith(isNew ? false : activate);
      }}
    >
      {fieldError && !fieldError.field ? (
        <Alert severity="error" sx={{ mb: 2 }} role="alert">
          {fieldError.message}
        </Alert>
      ) : null}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "flex-start" }}>
        <Paper variant="outlined" sx={{ flex: "3 1 560px", minWidth: 0, overflow: "hidden" }}>
          <Sec title="คู่สัญญา" first>
            <Box>
              {lab("ct-type", "ประเภทสัญญา", true)}
              <ToggleButtonGroup
                id="ct-type"
                exclusive
                size="small"
                value={v.type}
                onChange={(_e, val) => val && set("type", val as ContractType)}
                aria-label="ประเภทสัญญา"
              >
                {TYPES.map((tp) => (
                  <ToggleButton key={tp} value={tp} sx={{ px: 2 }}>
                    {contractTypeLabel[tp]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <Box sx={grid}>
              <Box>
                {lab("ct-customerPicker", "ลูกค้า")}
                <Autocomplete
                  id="ct-customerPicker"
                  options={customers}
                  value={pickedCustomer}
                  getOptionLabel={(c) => c.name}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  onChange={(_, picked) => {
                    setCustomerId(picked?.id ?? "");
                    setSiteId(""); // สาขาต้องเป็นของลูกค้าที่เลือกใหม่เสมอ
                    if (picked) {
                      setV((prev) => ({
                        ...prev,
                        customerName: picked.name,
                        customerPhone: picked.phone || prev.customerPhone,
                        customerAddress: picked.address || prev.customerAddress,
                      }));
                    }
                  }}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="ค้นชื่อลูกค้าจากฐานข้อมูล" helperText="ผูกกับลูกค้ารายเดียวกับที่ใช้ในใบงานและคลังเครื่อง" />
                  )}
                />
              </Box>
              <Box>
                {lab("ct-sitePicker", "สาขา/จุดติดตั้ง")}
                <TextField
                  select
                  id="ct-sitePicker"
                  value={siteId}
                  disabled={!customerId || sitesLoading}
                  SelectProps={{ displayEmpty: true }}
                  helperText="เลือกสาขาแล้วระบบเติมที่อยู่หน้างานและโซนให้"
                  onChange={(e) => {
                    const id = e.target.value;
                    setSiteId(id);
                    const picked = sites.find((x) => x.id === id);
                    if (picked) {
                      set("siteAddress", picked.addressFull || picked.address || picked.label);
                      if (picked.zone) set("zone", picked.zone);
                    }
                  }}
                >
                  <MenuItem value="">
                    {!customerId
                      ? "— เลือกลูกค้าก่อน —"
                      : sitesLoading
                        ? "กำลังโหลดสาขา…"
                        : sites.length === 0
                          ? "— ลูกค้ารายนี้ยังไม่มีสาขาในระบบ —"
                          : "— ไม่ระบุสาขา —"}
                  </MenuItem>
                  {sites.map((x) => (
                    <MenuItem key={x.id} value={x.id}>
                      {x.label} (สาขา {x.branchNo})
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              <Box sx={full}>
                {lab("ct-customerName", "ชื่อที่พิมพ์ในสัญญา")}
                <TextField
                  {...fe("customerName", "เว้นว่างได้ถ้ายังไม่ผูกลูกค้า (แสดงเป็น -)")}
                  value={v.customerName}
                  onChange={(e) => set("customerName", e.target.value)}
                />
              </Box>
              <Box>
                {lab("ct-customerPhone", "เบอร์โทร")}
                <TextField {...fe("customerPhone")} type="tel" inputProps={{ inputMode: "tel" }} value={v.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} />
              </Box>
              <Box>
                {lab("ct-customerAddress", "ที่อยู่ลูกค้า")}
                <TextField {...fe("customerAddress")} value={v.customerAddress} onChange={(e) => set("customerAddress", e.target.value)} />
              </Box>
            </Box>
          </Sec>

          <Sec title="เครื่องในสัญญา">
            <Alert severity="info" icon={false}>
              สัญญา 1 ฉบับต่อ 1 เครื่อง · เลือก Serial จากคลังแล้วระบบเติมรุ่นให้ · ยังไม่มีเครื่องจริงเว้น Serial ไว้และระบุรุ่นได้
            </Alert>
            <Box sx={grid}>
              <Box>
                {lab("ct-model", serialMatch ? "รุ่น (ตามข้อมูลเครื่อง)" : "รุ่น")}
                {serialMatch ? (
                  <TextField
                    {...fe("model")}
                    value={serialMatch.model || v.model}
                    disabled
                    helperText="รุ่นจากคลังเครื่อง — แก้ที่ข้อมูลเครื่อง"
                    inputProps={{ readOnly: true, "data-testid": "contract-model-readonly" }}
                  />
                ) : (
                  <Autocomplete
                    id="ct-model"
                    freeSolo
                    options={options.models}
                    inputValue={v.model}
                    onInputChange={(_, val) => set("model", val)}
                    renderInput={(params) => <TextField {...params} {...fe("model")} />}
                  />
                )}
              </Box>
              <Box>
                {lab("ct-serial", "Serial (SN)")}
                <Autocomplete
                  id="ct-serial"
                  freeSolo
                  // MOM-33: SN ของรุ่นที่ใส่ในสัญญาขึ้นก่อน แล้วเรียงตาม SN
                  options={sortSerialsForModel(serials, v.model).map((x) => x.serial)}
                  groupBy={v.model.trim() ? (o) => (sortSerialsForModel(serials, v.model).find((x) => x.serial === o)?.sameModel ? `รุ่น ${v.model.trim()}` : "รุ่นอื่น") : undefined}
                  inputValue={v.serial}
                  onInputChange={(_, val) => onSerial(val)}
                  renderOption={(props, option) => {
                    const { key, ...rest } = props as typeof props & { key: string };
                    return (
                      <li key={key} {...rest}>
                        {option}
                        <Typography component="span" variant="body2" sx={{ ml: 1 }}>
                          {serials.find((x) => x.serial === option)?.model}
                        </Typography>
                      </li>
                    );
                  }}
                  renderInput={(params) => <TextField {...params} {...fe("serial")} placeholder="เลือก/พิมพ์ serial" />}
                />
              </Box>
            </Box>
          </Sec>

          <Sec title={isRental ? "ค่าเช่าและงวด" : isHP ? "ราคาและงวดผ่อน" : "ราคาขาย"}>
            <Box sx={grid}>
              {isRental ? (
                <Box sx={{ gridColumn: "1 / -1" }}>
                  {/* MOM-26 — เช่ารายวันสำหรับงาน Event · ใช้แบบฟอร์มสัญญาเช่าเดิม */}
                  {lab("ct-rentUnit", "คิดค่าเช่า", true)}
                  <ToggleButtonGroup
                    id="ct-rentUnit"
                    exclusive
                    size="small"
                    aria-label="คิดค่าเช่า"
                    value={isDaily ? "DAY" : "MONTH"}
                    disabled={!isNew}
                    onChange={(_e, val) => val && set("rentUnit", val as never)}
                    data-testid="contract-rent-unit"
                  >
                    <ToggleButton value="MONTH">รายเดือน</ToggleButton>
                    <ToggleButton value="DAY">รายวัน (Event)</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              ) : null}
              {isRental && !isDaily ? (
                <>
                  {moneyField("rentPerMonth", "ค่าเช่า/เดือน (บาท)", true)}
                  {moneyField("periodMonths", "จำนวนงวด (เดือน)", true)}
                </>
              ) : null}
              {isRental && isDaily ? (
                <>
                  {moneyField("rentPerDay", "ค่าเช่า/วัน (บาท)", true)}
                  {moneyField("periodDays", "จำนวนวันที่เช่า", true, "ไม่เกิน 90 วัน · เก็บเงินงวดเดียววันเริ่มสัญญา")}
                </>
              ) : null}
              {isHP ? (
                <>
                  {moneyField("totalPrice", "ราคารวม (บาท)", true)}
                  {moneyField("installmentCount", "จำนวนงวด", true)}
                </>
              ) : null}
              {isSale ? moneyField("totalPrice", "ราคาขาย (บาท)", true) : null}
              <Box>
                {lab("ct-startDate", "เริ่มสัญญา", true)}
                <DateField required {...fe("startDate")} value={v.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </Box>
              {isRental ? moneyField("deposit", "เงินมัดจำ/ประกัน (บาท)") : null}
              {isHP ? moneyField("downPayment", "เงินดาวน์ (บาท)") : null}
            </Box>
          </Sec>

          <Sec title="จุดติดตั้ง">
            <Box sx={grid}>
              <Box sx={full}>
                {lab("ct-siteAddress", "ที่อยู่หน้างาน")}
                <TextField
                  {...fe("siteAddress", "เว้นว่าง = ใช้ที่อยู่ลูกค้า")}
                  value={v.siteAddress}
                  onChange={(e) => set("siteAddress", e.target.value)}
                  placeholder="ที่อยู่ที่ติดตั้งเครื่องจริง"
                />
              </Box>
              <Box>
                {lab("ct-zone", "โซน")}
                <Autocomplete
                  id="ct-zone"
                  freeSolo
                  options={options.zones ?? []}
                  inputValue={v.zone}
                  onInputChange={(_, val) => set("zone", val)}
                  renderInput={(params) => <TextField {...params} />}
                />
              </Box>
              <Box>
                {lab("ct-geo", "พิกัด")}
                <TextField
                  id="ct-geo"
                  value={geo}
                  onChange={(e) => onGeo(e.target.value)}
                  placeholder="13.6683, 100.6047"
                  error={!!geoErr || geoFe.error || !!fe("siteLng").error}
                  helperText={
                    geoErr ?? (geoFe.error ? geoFe.helperText : fe("siteLng").error ? fe("siteLng").helperText : (
                      <a href={mapHref} target="_blank" rel="noreferrer">
                        ปักหมุดบน Google Map
                      </a>
                    ))
                  }
                />
              </Box>
            </Box>
          </Sec>

          {isRental ? (
            <Box id="contract-clauses" sx={{ scrollMarginTop: 80 }}>
              <Sec title={CLAUSE_HEADING}>
                {fieldError?.field?.startsWith("additionalClauses") ? (
                  <Alert severity="error" role="alert">
                    {fieldError.message}
                  </Alert>
                ) : null}
                <ContractClausesEditor value={clauseTexts} onChange={setClauseTexts} disabled={busy} showErrors={clauseShowErrors} />
              </Sec>
            </Box>
          ) : null}

          <Sec title="หมายเหตุ">
            <TextField {...fe("note")} inputProps={{ "aria-label": "หมายเหตุ" }} multiline minRows={3} value={v.note} onChange={(e) => set("note", e.target.value)} />
          </Sec>

          {/* ENTECH DS .savebar */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, justifyContent: "flex-end", alignItems: "center", px: { xs: 2, sm: 3 }, py: 2, borderTop: `1px solid ${t.line}`, bgcolor: t.surface2 }}>
            {isNew ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mr: "auto", flex: "1 1 260px" }}>
                  บันทึกร่าง = ยังไม่นับเป็นสัญญาที่ใช้งาน ยอดค้างชำระยังไม่เข้ารายงาน · เปิดใช้งานภายหลังได้จากหน้าสัญญา
                </Typography>
                <Button component={Link} href="/contracts" variant="outlined" disabled={busy}>
                  ยกเลิก
                </Button>
                <Button type="submit" variant="outlined" disabled={busy} data-testid="contract-save-draft">
                  {busy ? "กำลังบันทึก…" : submitLabel}
                </Button>
                <Button variant="contained" disabled={busy} onClick={() => submitWith(true)} data-testid="contract-save-active">
                  สร้างและเปิดใช้งานสัญญา
                </Button>
              </>
            ) : (
              <Button type="submit" variant="contained" disabled={busy}>
                {busy ? "กำลังบันทึก…" : submitLabel}
              </Button>
            )}
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ flex: "1 1 300px", minWidth: 0, p: 2, display: "flex", flexDirection: "column", gap: 1.25 }} data-testid="contract-summary">
          <Typography variant="h3" sx={{ fontSize: 15, fontWeight: 700 }}>
            ตารางงวด (ตัวอย่าง)
          </Typography>
          {isRental ? (
            <>
              {sumRow("มัดจำ", baht(v.deposit))}
              {isDaily ? (
                <>
                  {sumRow(`${v.periodDays || 0} วัน × ${baht(v.rentPerDay || 0)}`, baht((v.rentPerDay || 0) * (v.periodDays || 0)))}
                  {sumRow("รวมตลอดสัญญา", baht((v.deposit || 0) + (v.rentPerDay || 0) * (v.periodDays || 0)), true)}
                </>
              ) : (
                <>
                  {sumRow(`งวด 1–${v.periodMonths || 0} × ${baht(v.rentPerMonth)}`, baht((v.rentPerMonth || 0) * (v.periodMonths || 0)))}
                  {sumRow("รวมตลอดสัญญา", baht((v.deposit || 0) + (v.rentPerMonth || 0) * (v.periodMonths || 0)), true)}
                </>
              )}
            </>
          ) : isHP ? (
            <>
              {sumRow("เงินดาวน์", baht(v.downPayment))}
              {sumRow(`งวด 1–${v.installmentCount || 0} × ${baht(hpPer)}`, baht(hpFinanced))}
              {sumRow("ราคารวม", baht(v.totalPrice), true)}
            </>
          ) : (
            sumRow("ราคาขาย", baht(v.totalPrice), true)
          )}
          <Typography variant="caption" color="text.secondary">
            ตัวเลขประมาณจากที่กรอก · ระบบออกตารางงวดจริงหลังบันทึก
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}

/** ENTECH DS .sec — ส่วนในการ์ดหลัก คั่นด้วยเส้นบาง */
function Sec({ title, children, first }: { title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <Box component="section" sx={{ p: { xs: 2, sm: 3 }, display: "flex", flexDirection: "column", gap: 2, borderTop: first ? 0 : `1px solid ${t.line}` }}>
      <Typography variant="h2">{title}</Typography>
      {children}
    </Box>
  );
}
