"use client";

import { useEffect, useState } from "react";
import type { CustomerSite, Part, Partner, QuotationFormValues, QuotationLine } from "@/lib/types";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { EquipmentPicker, LineKindSelect, PartPicker } from "@/components/QuotationLinePickers";
import MenuItem from "@mui/material/MenuItem";
import { fmtMoney } from "@/lib/options";
import { fieldErrorHelpers } from "@/lib/formErrors";
import { useMoneyInputs } from "@/components/FieldErrors";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid2";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

const EMPTY: QuotationFormValues = {
  partnerId: "",
  siteId: "",
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  issueDate: "",
  validUntil: "",
  lines: [{ no: 1, description: "", qty: 1, unitPrice: 0, discount: 0 }],
  vatRate: 7,
  discount: 0,
  externalCustomer: false,
  note: "",
};

export interface QuotationFormProps {
  partners: Partner[];
  initial?: Partial<QuotationFormValues>;
  submitLabel: string;
  fieldError?: { field?: string; message: string } | null;
  busy?: boolean;
  onSubmit: (values: QuotationFormValues) => void;
}

export default function QuotationForm({
  partners,
  initial,
  submitLabel,
  fieldError,
  busy,
  onSubmit,
}: QuotationFormProps) {
  const [v, setV] = useState<QuotationFormValues>({
    ...EMPTY,
    ...initial,
    lines: initial?.lines && initial.lines.length ? initial.lines : EMPTY.lines,
  });

  const set = <K extends keyof QuotationFormValues>(k: K, val: QuotationFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const money = useMoneyInputs();
  const { has } = useAuth();

  // Round 8 — สาขาของลูกค้า (QUO-02 เรียกข้อมูลจากฐานข้อมูลที่เกี่ยวข้อง)
  const [sites, setSites] = useState<CustomerSite[]>([]);
  useEffect(() => {
    if (!v.partnerId) {
      setSites([]);
      return;
    }
    let alive = true;
    api
      .listCustomerSites(v.partnerId)
      .then((r) => alive && setSites(r.items))
      .catch(() => alive && setSites([]));
    return () => {
      alive = false;
    };
  }, [v.partnerId]);

  // Round 8 — อะไหล่สำหรับเลือกในรายการ (แสดงชื่อ)
  const [parts, setParts] = useState<Part[]>([]);
  const canParts = has("stock:view");
  useEffect(() => {
    if (!canParts) return;
    api
      .listParts({ activeOnly: true })
      .then((r) => setParts(r.items))
      .catch(() => setParts([]));
  }, [canParts]);

  const setLine = (i: number, patch: Partial<QuotationLine>) =>
    setV((prev) => ({
      ...prev,
      lines: prev.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    }));

  const addLine = () =>
    setV((prev) => ({
      ...prev,
      lines: [...prev.lines, { no: prev.lines.length + 1, description: "", qty: 1, unitPrice: 0, discount: 0 }],
    }));

  const removeLine = (i: number) => {
    money.reset("line-");
    setV((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, no: idx + 1 })),
    }));
  };

  const onPartner = (partnerId: string) => {
    const p = partners.find((x) => x.id === partnerId);
    setV((prev) => ({
      ...prev,
      partnerId,
      siteId: partnerId === prev.partnerId ? prev.siteId : "",
      customerName: p ? p.name : prev.customerName,
      customerPhone: p ? p.phone : prev.customerPhone,
      customerAddress: p ? p.address : prev.customerAddress,
    }));
  };

  // กติกาเดียวกับฝั่งเซิร์ฟเวอร์ (domain/quotation.ts): หักส่วนลดรายบรรทัด → หักส่วนลดท้ายบิล → คิด VAT
  const grossTotal = v.lines.reduce(
    (s, l) => s + Math.max(0, (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) - (Number(l.discount) || 0)),
    0
  );
  const subtotal = Math.max(0, grossTotal - (Number(v.discount) || 0));
  const vatAmount = Math.round((subtotal * (Number(v.vatRate) || 0)) / 100 * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;

  const { fe } = fieldErrorHelpers(fieldError, "quo");
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down("md"));
  const lineTotal = (l: QuotationLine) => Math.max(0, (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) - (Number(l.discount) || 0));
  const numInput = (key: string, label: string, value: number, onChange: (n: number) => void) => (
    <TextField
      size="small"
      label={narrow ? label : undefined}
      {...money.props(key, value, onChange, { style: { textAlign: "right" }, "aria-label": label })}
    />
  );
  const removeBtn = (i: number) => (
    <IconButton color="error" onClick={() => removeLine(i)} disabled={v.lines.length <= 1} aria-label={`ลบรายการที่ ${i + 1}`}>
      <DeleteOutlineIcon />
    </IconButton>
  );
  const pickedPartner = partners.find((p) => p.id === v.partnerId) ?? null;
  // ชนิด / เครื่อง / อะไหล่ ของรายการ (QUO-02) — ผูกรายรับรายเครื่องเมื่อใบถูกตอบรับ (QUO-03)
  const lineExtras = (l: QuotationLine, i: number) => (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
      <LineKindSelect value={l.kind ?? ""} label={`ชนิดรายการที่ ${i + 1}`} onChange={(k) => setLine(i, { kind: k || undefined })} />
      <EquipmentPicker
        equipmentId={l.equipmentId}
        serial={l.serial}
        label={`เครื่องของรายการที่ ${i + 1}`}
        onChange={(equipmentId, serial) => setLine(i, { equipmentId: equipmentId || undefined, serial: serial || undefined })}
      />
      {l.kind === "PART" || l.partId ? (
        canParts ? (
          <PartPicker
            parts={parts}
            partId={l.partId}
            partName={l.partName}
            label={`อะไหล่ของรายการที่ ${i + 1}`}
            onChange={(p) => {
              if (!l.unitPrice && p?.sellPrice) money.reset(`line-${i}-unitPrice`);
              setLine(i, {
                partId: p?.id || undefined,
                partName: p?.name || undefined,
                description: l.description || p?.name || "",
                unitPrice: l.unitPrice || p?.sellPrice || 0,
              });
            }}
          />
        ) : (
          <Typography variant="body2">ไม่มีสิทธิ์ดูรายการอะไหล่ — พิมพ์ชื่ออะไหล่ในรายละเอียด</Typography>
        )
      ) : null}
    </Stack>
  );

  return (
    <Box component="form" noValidate onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (money.check()) onSubmit(v); }}>
      {fieldError && !fieldError.field ? (
        <Alert severity="error" sx={{ mb: 2 }} role="alert">
          {fieldError.message}
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Autocomplete
            options={partners}
            value={pickedPartner}
            getOptionLabel={(p) => p.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onChange={(_, p) => onPartner(p?.id ?? "")}
            renderInput={(params) => <TextField {...params} id="quo-partner" label="เลือกคู่ค้า (ลูกค้า)" placeholder="ไม่เลือก = กรอกเอง" />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            {...fe("siteId")}
            label="สาขา / สถานที่"
            value={v.siteId ?? ""}
            onChange={(e) => set("siteId", e.target.value)}
            disabled={!v.partnerId}
            helperText={fe("siteId").helperText || (!v.partnerId ? "เลือกลูกค้าจากฐานข้อมูลก่อน" : undefined)}
          >
            <MenuItem value="">ไม่ระบุสาขา</MenuItem>
            {sites.map((st) => (
              <MenuItem key={st.id} value={st.id}>
                {[st.branchNo, st.storeName].filter(Boolean).join(" · ") || st.address || st.id}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField required {...fe("issueDate")} label="วันที่ออก" type="date" value={v.issueDate} onChange={(e) => set("issueDate", e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <TextField {...fe("validUntil")} label="ใช้ได้ถึง" type="date" value={v.validUntil} onChange={(e) => set("validUntil", e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid size={12}>
          <TextField required {...fe("customerName")} label="ชื่อลูกค้า" value={v.customerName} onChange={(e) => set("customerName", e.target.value)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField {...fe("customerPhone")} label="เบอร์โทร" type="tel" value={v.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 8 }}>
          <TextField {...fe("customerAddress")} label="ที่อยู่" value={v.customerAddress} onChange={(e) => set("customerAddress", e.target.value)} />
        </Grid>
      </Grid>

      <Typography variant="h3" component="h3" sx={{ mt: 3, mb: 1 }}>
        รายการ
      </Typography>
      {fe("lines").error ? (
        <Alert severity="error" sx={{ mb: 1 }} role="alert">
          {fe("lines").helperText}
        </Alert>
      ) : null}
      {narrow ? (
        <Stack spacing={1.5}>
          {v.lines.map((l, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography sx={{ fontWeight: 600, color: "text.primary" }}>รายการที่ {i + 1}</Typography>
                {removeBtn(i)}
              </Stack>
              <Stack spacing={1.5}>
                <TextField size="small" label="รายละเอียด" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                {lineExtras(l, i)}
                <Stack direction="row" spacing={1}>
                  {numInput(`line-${i}-qty`, "จำนวน", l.qty, (n) => setLine(i, { qty: n }))}
                  {numInput(`line-${i}-unitPrice`, "ราคา/หน่วย", l.unitPrice, (n) => setLine(i, { unitPrice: n }))}
                  {numInput(`line-${i}-discount`, "ส่วนลด", l.discount ?? 0, (n) => setLine(i, { discount: n }))}
                </Stack>
                <Typography variant="body2" sx={{ textAlign: "right" }}>
                  รวม <strong className="mono">{fmtMoney(lineTotal(l))}</strong>
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Paper variant="outlined">
          <Table size="small" aria-label="รายการในใบเสนอราคา">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }}>#</TableCell>
                <TableCell>รายการ</TableCell>
                <TableCell align="right" sx={{ width: 100 }}>จำนวน</TableCell>
                <TableCell align="right" sx={{ width: 140 }}>ราคา/หน่วย</TableCell>
                <TableCell align="right" sx={{ width: 120 }}>ส่วนลด</TableCell>
                <TableCell align="right" sx={{ width: 130 }}>รวม</TableCell>
                <TableCell sx={{ width: 56 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {v.lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell className="code">{i + 1}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={l.description}
                      onChange={(e) => setLine(i, { description: e.target.value })}
                      placeholder="รายละเอียดสินค้า/บริการ"
                      inputProps={{ "aria-label": `รายละเอียดรายการที่ ${i + 1}` }}
                    />
                    {lineExtras(l, i)}
                  </TableCell>
                  <TableCell>{numInput(`line-${i}-qty`, `จำนวน รายการที่ ${i + 1}`, l.qty, (n) => setLine(i, { qty: n }))}</TableCell>
                  <TableCell>{numInput(`line-${i}-unitPrice`, `ราคาต่อหน่วย รายการที่ ${i + 1}`, l.unitPrice, (n) => setLine(i, { unitPrice: n }))}</TableCell>
                  <TableCell>{numInput(`line-${i}-discount`, `ส่วนลด รายการที่ ${i + 1}`, l.discount ?? 0, (n) => setLine(i, { discount: n }))}</TableCell>
                  <TableCell align="right" className="mono">
                    {fmtMoney(lineTotal(l))}
                  </TableCell>
                  <TableCell align="center">{removeBtn(i)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
      <Button startIcon={<AddIcon />} onClick={addLine} sx={{ mt: 1 }}>
        เพิ่มรายการ
      </Button>

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <TextField {...fe("discount")} label="ส่วนลดท้ายบิล (บาท)" {...money.props("discount", v.discount ?? 0, (n) => set("discount", n))} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <TextField {...fe("vatRate")} label="VAT (%)" {...money.props("vatRate", v.vatRate, (n) => set("vatRate", n))} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControlLabel
            control={<Checkbox checked={!!v.externalCustomer} onChange={(e) => set("externalCustomer", e.target.checked)} />}
            label="ลูกค้าภายนอก (ไม่ผูกกับฐานข้อมูลกลาง)"
          />
          <Typography variant="body2">
            เลือกเครื่องในรายการได้เมื่อเครื่องอยู่ในฐานข้อมูล · รายการที่ไม่เลือกเครื่องจะไม่ถูกนับเป็นรายรับของเครื่องใด
          </Typography>
        </Grid>
        <Grid size={12}>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.default" }}>
            <Stack spacing={0.5} alignItems="flex-end">
              <Typography variant="body2">
                ยอดก่อนส่วนลดท้ายบิล: <b className="mono">{fmtMoney(grossTotal)}</b>
              </Typography>
              <Typography variant="body2">
                ยอดก่อน VAT: <b className="mono">{fmtMoney(subtotal)}</b>
              </Typography>
              <Typography variant="body2">
                VAT: <b className="mono">{fmtMoney(vatAmount)}</b>
              </Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 700, color: "text.primary" }}>
                รวมสุทธิ: <span className="mono">{fmtMoney(total)}</span>
              </Typography>
            </Stack>
          </Paper>
        </Grid>
        <Grid size={12}>
          <TextField {...fe("note")} label="หมายเหตุ" multiline minRows={3} value={v.note} onChange={(e) => set("note", e.target.value)} />
        </Grid>
      </Grid>

      <Button type="submit" variant="contained" disabled={busy} sx={{ mt: 3 }}>
        {busy ? "กำลังบันทึก…" : submitLabel}
      </Button>
    </Box>
  );
}
