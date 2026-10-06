"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ContractFormValues, ContractType, CustomerSite, Options, Partner } from "@/lib/types";
import { contractTypeLabel } from "@/lib/options";
import { fieldErrorHelpers } from "@/lib/formErrors";
import { useMoneyInputs } from "@/components/FieldErrors";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

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
  // QA BUG-025 — สัญญาสร้างใหม่เป็นร่างเสมอ เว้นแต่ผู้ใช้ติ๊กเปิดใช้งานทันที
  const [activate, setActivate] = useState(false);

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

  const num = (s: string) => (s === "" ? 0 : Number(s));
  // ช่องเงินรับเฉพาะเลขฐานสิบ — เดิม type=number + Number() ทำให้ "1e5" ผ่านเป็น 100000
  const money = useMoneyInputs();

  const onSerial = (serial: string) => {
    const match = serials.find((s) => s.serial === serial);
    setV((prev) => ({ ...prev, serial, model: match ? match.model : prev.model }));
  };

  const { fe } = fieldErrorHelpers(fieldError, "ct");

  const isRental = v.type === "RENTAL";
  const isHP = v.type === "HIRE_PURCHASE";
  const isSale = v.type === "SALE";

  const g = { xs: 12, sm: 6, md: 4 } as const;
  const moneyField = (key: keyof ContractFormValues, label: string, required = false) => (
    <Grid size={g}>
      <TextField
        {...fe(key)}
        required={required}
        label={label}
        {...money.props(String(key), v[key] as number, (n) => set(key, n as never))}
      />
    </Grid>
  );
  const pickedCustomer = customers.find((c) => c.id === customerId) ?? null;

  return (
    <Box component="form" noValidate onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (money.check()) onSubmit({ ...v, partnerId: customerId, siteId }, activate); }}>
      {fieldError && !fieldError.field ? (
        <Alert severity="error" sx={{ mb: 2 }} role="alert">
          {fieldError.message}
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField select required {...fe("type")} label="ประเภทสัญญา" value={v.type} onChange={(e) => set("type", e.target.value as ContractType)}>
            {TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {contractTypeLabel[t]}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            required
            {...fe("startDate")}
            label="วันเริ่มสัญญา"
            type="date"
            value={v.startDate}
            onChange={(e) => set("startDate", e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>

        <Grid size={12}>
          <Autocomplete
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
              <TextField
                {...params}
                id="ct-customerPicker"
                label="ลูกค้าจากฐานข้อมูล"
                placeholder="ไม่เลือก = พิมพ์ชื่อเอง"
                helperText="เลือกจากที่นี่เพื่อให้สัญญาผูกกับลูกค้ารายเดียวกับที่ใช้ในใบงานและคลังเครื่อง"
              />
            )}
          />
        </Grid>

        <Grid size={12}>
          <TextField
            {...fe("customerName", "ชื่อที่จะพิมพ์ลงเอกสารสัญญา — เว้นว่างได้ถ้ายังไม่ผูกลูกค้า (แสดงเป็น -)")}
            label="ชื่อลูกค้า"
            value={v.customerName}
            onChange={(e) => set("customerName", e.target.value)}
          />
        </Grid>

        <Grid size={12}>
          <TextField
            select
            id="ct-sitePicker"
            label="ร้าน / สาขาของลูกค้า"
            value={siteId}
            disabled={!customerId || sitesLoading}
            SelectProps={{ displayEmpty: true }}
            InputLabelProps={{ shrink: true }}
            helperText="เลือกสาขาแล้วระบบจะเติม “ที่อยู่หน้างาน” และโซนบริการให้อัตโนมัติ"
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
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField {...fe("customerPhone")} label="เบอร์โทร" type="tel" inputProps={{ inputMode: "tel" }} value={v.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField {...fe("customerAddress")} label="ที่อยู่ลูกค้า" value={v.customerAddress} onChange={(e) => set("customerAddress", e.target.value)} />
        </Grid>

        {/* ---- ที่อยู่ติดตั้งตามสัญญา — ใช้ตรวจว่าเครื่องยังอยู่ที่เดิมไหม ---- */}
        <Grid size={12}>
          <Typography sx={{ fontWeight: 700, color: "text.primary" }}>ที่อยู่ติดตั้งตามสัญญา (ถ้าเว้นว่าง = ที่อยู่ลูกค้า)</Typography>
        </Grid>
        <Grid size={12}>
          <TextField {...fe("siteAddress")} label="ที่อยู่หน้างาน" value={v.siteAddress} onChange={(e) => set("siteAddress", e.target.value)} placeholder="ที่อยู่ที่ติดตั้งเครื่องจริง" />
        </Grid>
        <Grid size={g}>
          <Autocomplete
            freeSolo
            options={options.zones ?? []}
            inputValue={v.zone}
            onInputChange={(_, val) => set("zone", val)}
            renderInput={(params) => <TextField {...params} id="ct-zone" label="โซนบริการ" />}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <TextField {...fe("siteLat")} label="ละติจูด (lat)" type="number" inputProps={{ step: "any" }} value={v.siteLat} onChange={(e) => set("siteLat", num(e.target.value))} />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <TextField {...fe("siteLng")} label="ลองจิจูด (lng)" type="number" inputProps={{ step: "any" }} value={v.siteLng} onChange={(e) => set("siteLng", num(e.target.value))} />
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <Autocomplete
            freeSolo
            options={serials.map((x) => x.serial)}
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
            renderInput={(params) => <TextField {...params} {...fe("serial")} label="เครื่อง (serial)" placeholder="เลือก/พิมพ์ serial" />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Autocomplete
            freeSolo
            options={options.models}
            inputValue={v.model}
            onInputChange={(_, val) => set("model", val)}
            renderInput={(params) => <TextField {...params} {...fe("model")} label="รุ่น" />}
          />
        </Grid>

        {isRental ? (
          <>
            {moneyField("rentPerMonth", "ค่าเช่า/เดือน (บาท)", true)}
            {moneyField("periodMonths", "จำนวนเดือน", true)}
            {moneyField("deposit", "เงินมัดจำ/ประกัน (บาท)")}
          </>
        ) : null}
        {isHP ? (
          <>
            {moneyField("totalPrice", "ราคารวม (บาท)", true)}
            {moneyField("downPayment", "เงินดาวน์ (บาท)")}
            {moneyField("installmentCount", "จำนวนงวด", true)}
          </>
        ) : null}
        {isSale ? moneyField("totalPrice", "ราคาขาย (บาท)", true) : null}

        <Grid size={12}>
          <TextField {...fe("note")} label="หมายเหตุ" multiline minRows={3} value={v.note} onChange={(e) => set("note", e.target.value)} />
        </Grid>
      </Grid>

      {isNew ? (
        <Alert severity="warning" icon={false} sx={{ mt: 2 }}>
          <FormControlLabel
            sx={{ alignItems: "flex-start", m: 0 }}
            control={<Checkbox checked={activate} onChange={(e) => setActivate(e.target.checked)} sx={{ mt: -0.75 }} />}
            label={
              <span>
                <strong>เปิดใช้งานสัญญาทันทีหลังสร้าง</strong>
                <Typography variant="body2">
                  ไม่ติ๊ก = บันทึกเป็น <strong>ร่างสัญญา</strong> ซึ่งยังไม่นับเป็นสัญญาที่ใช้งานอยู่ และยอดค้างชำระยังไม่เข้ารายงาน —
                  เปิดใช้งานภายหลังได้จากหน้ารายละเอียดสัญญา
                </Typography>
              </span>
            }
          />
        </Alert>
      ) : null}

      <Button type="submit" variant="contained" disabled={busy} sx={{ mt: 3 }}>
        {busy ? "กำลังบันทึก…" : isNew && activate ? "สร้างและเปิดใช้งาน" : submitLabel}
      </Button>
    </Box>
  );
}
