"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Contract, DocumentFormValues, DocumentType, PaymentMethod } from "@/lib/types";
import { documentTypeLabel, fmtMoney, paymentMethodLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";
import { bangkokToday } from "@/lib/date";
import { parseMoney } from "@/components/FieldErrors";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid2";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { WomsFormSection, WomsPageHeader } from "@/components/woms";
import { WomsPermissionGate } from "@/components/woms/WomsPermissionGate";

const TYPES: DocumentType[] = [
  "INVOICE",
  "RECEIPT",
  "TAX_INVOICE",
  "DELIVERY_NOTE",
  "CONTRACT",
  "WARRANTY_CARD",
];
const METHODS: PaymentMethod[] = ["CASH", "TRANSFER", "CHEQUE", "CARD", "CREDIT", "OTHER"];

// ช่องตัวเลขเก็บเป็น string แล้ว parse ตอนบันทึก — เดิมใช้ type=number + Number() จึงรับ 1e5 ได้
type Line = { description: string; qty: string; unitPrice: string };
type Form = Omit<DocumentFormValues, "lines" | "discount" | "vatRate"> & { lines: Line[]; discount: string; vatRate: string };
const emptyLine = (): Line => ({ description: "", qty: "1", unitPrice: "0" });
const num = (raw: string) => {
  const r = parseMoney(raw);
  return r.ok ? r.value : 0;
};


// ออกเอกสารทั่วไป (ใบแจ้งหนี้ / ใบส่งของ / ใบรับประกัน / หนังสือสัญญา ฯลฯ)
// ใบเสร็จของงวดสัญญาให้ออกจากหน้าสัญญาโดยตรง เพื่อให้ผูกกับงวดอัตโนมัติ
function NewDocumentPageInner() {
  const router = useRouter();
  const toast = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);
  const [numErr, setNumErr] = useState<Record<string, string>>({});

  const [v, setV] = useState<Form>({
    type: "DELIVERY_NOTE",
    issueDate: bangkokToday(), // วันที่เอกสาร = วันทำงานตามเวลาไทย
    contractId: "",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    customerTaxId: "",
    serial: "",
    model: "",
    lines: [emptyLine()],
    discount: "0",
    vatRate: "0",
    paymentMethod: "CASH",
    paymentRef: "",
    note: "",
  });

  useEffect(() => {
    api
      .listContracts({})
      .then((r) => setContracts(r.items))
      .catch(() => setContracts([]));
  }, []);

  const set = <K extends keyof Form>(k: K, val: Form[K]) => setV((prev) => ({ ...prev, [k]: val }));

  const setLine = (i: number, patch: Partial<Line>) =>
    setV((prev) => ({
      ...prev,
      lines: prev.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    }));

  const onContract = (contractId: string) => {
    const c = contracts.find((x) => x.id === contractId);
    setV((prev) => ({
      ...prev,
      contractId,
      customerName: c?.customerName ?? prev.customerName,
      customerPhone: c?.customerPhone ?? prev.customerPhone,
      customerAddress: c?.customerAddress ?? prev.customerAddress,
      serial: c?.serial ?? prev.serial,
      model: c?.model ?? prev.model,
    }));
  };

  const subtotal = v.lines.reduce((s, l) => s + num(l.qty) * num(l.unitPrice), 0) - num(v.discount);
  const vatAmount = (subtotal * num(v.vatRate)) / 100;

  const validateNumbers = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    v.lines.forEach((l, i) => {
      if (!l.description.trim()) return; // บรรทัดว่างถูกตัดทิ้งตอนส่งอยู่แล้ว
      const q = parseMoney(l.qty);
      if (!q.ok) errs[`qty${i}`] = q.message;
      else if (q.value <= 0) errs[`qty${i}`] = "จำนวนต้องมากกว่า 0";
      const p = parseMoney(l.unitPrice);
      if (!p.ok) errs[`price${i}`] = p.message;
    });
    const d = parseMoney(v.discount);
    if (!d.ok) errs.discount = d.message;
    const r = parseMoney(v.vatRate);
    if (!r.ok) errs.vatRate = r.message;
    else if (r.value > 100) errs.vatRate = "VAT ต้องไม่เกิน 100%";
    return errs;
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const errs = validateNumbers();
    setNumErr(errs);
    if (Object.keys(errs).length) {
      toast.error("กรุณาแก้ไขช่องตัวเลขที่ไม่ถูกต้อง");
      return;
    }
    setBusy(true);
    setFieldError(null);
    try {
      const payload: DocumentFormValues = {
        ...v,
        lines: v.lines
          .filter((l) => l.description.trim())
          .map((l) => ({ description: l.description, qty: num(l.qty), unitPrice: num(l.unitPrice) })),
        discount: num(v.discount),
        vatRate: num(v.vatRate),
      };
      const doc = await api.createDocument(payload);
      toast.success(`ออก${documentTypeLabel[doc.type]} ${doc.docNo} แล้ว`);
      router.push(`/documents/${doc.id}`);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldError({ field: e.field, message: e.message });
        toast.error(e.message);
      } else {
        toast.error("ออกเอกสารไม่สำเร็จ");
      }
    } finally {
      setBusy(false);
    }
  };

  const fe = (field: string) =>
    fieldError?.field === field ? { error: true, helperText: fieldError.message } : {};
  const ne = (key: string) => (numErr[key] ? { error: true, helperText: numErr[key] } : {});

  return (
    <>
      <WomsPageHeader
        title="ออกเอกสาร"
        subtitle="ใบแจ้งหนี้ · ใบส่งของ · ใบรับประกัน · หนังสือสัญญา"
        actions={
          <Button component={Link} href="/documents" startIcon={<ArrowBackIcon />}>
            รายการเอกสาร
          </Button>
        }
      />

      {fieldError && !fieldError.field ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {fieldError.message}
        </Alert>
      ) : null}

      <Paper component="form" noValidate onSubmit={submit} variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select label="ประเภทเอกสาร" value={v.type} onChange={(e) => set("type", e.target.value as DocumentType)}>
              {TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {documentTypeLabel[t]}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="วันที่เอกสาร" type="date" value={v.issueDate} onChange={(e) => set("issueDate", e.target.value)} InputLabelProps={{ shrink: true }} {...fe("issueDate")} />
          </Grid>
          <Grid size={12}>
            <TextField select label="อ้างอิงสัญญา (ถ้ามี)" value={v.contractId} onChange={(e) => onContract(e.target.value)} {...fe("contractId")}>
              <MenuItem value="">— ไม่อ้างอิงสัญญา —</MenuItem>
              {contracts.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.contractNo} · {c.customerName} {c.serial ? `· ${c.serial}` : ""}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="ชื่อลูกค้า" value={v.customerName} onChange={(e) => set("customerName", e.target.value)} {...fe("customerName")} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="เลขผู้เสียภาษี"
              value={v.customerTaxId}
              onChange={(e) => set("customerTaxId", e.target.value)}
              inputProps={{ inputMode: "numeric", maxLength: 13 }}
              {...fe("customerTaxId")}
            />
          </Grid>
          <Grid size={12}>
            <TextField label="ที่อยู่ลูกค้า" value={v.customerAddress} onChange={(e) => set("customerAddress", e.target.value)} {...fe("customerAddress")} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Serial เครื่อง" value={v.serial} onChange={(e) => set("serial", e.target.value)} {...fe("serial")} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="รุ่น" value={v.model} onChange={(e) => set("model", e.target.value)} {...fe("model")} />
          </Grid>
        </Grid>

        <Box sx={{ mt: 3 }}>
          <WomsFormSection title="รายการ">
            <Stack spacing={1.5}>
              {v.lines.map((l, i) => (
                <Grid container spacing={1} key={i} alignItems="flex-start">
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField label={`รายละเอียด #${i + 1}`} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 4, md: 2 }}>
                    <TextField label="จำนวน" value={l.qty} inputProps={{ inputMode: "decimal" }} onChange={(e) => setLine(i, { qty: e.target.value })} {...ne(`qty${i}`)} />
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <TextField label="ราคา/หน่วย" value={l.unitPrice} inputProps={{ inputMode: "decimal" }} onChange={(e) => setLine(i, { unitPrice: e.target.value })} {...ne(`price${i}`)} />
                  </Grid>
                  <Grid size={{ xs: 2, md: 1 }}>
                    <IconButton
                      aria-label={`ลบรายการ ${i + 1}`}
                      color="error"
                      onClick={() => setV((p) => ({ ...p, lines: p.lines.filter((_, idx) => idx !== i) }))}
                      disabled={v.lines.length === 1}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
              <Box>
                <Button startIcon={<AddIcon />} onClick={() => setV((p) => ({ ...p, lines: [...p.lines, emptyLine()] }))}>
                  เพิ่มรายการ
                </Button>
                {fieldError?.field === "lines" ? (
                  <Typography variant="body2" color="error">
                    {fieldError.message}
                  </Typography>
                ) : null}
              </Box>
            </Stack>
          </WomsFormSection>
        </Box>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="ส่วนลดท้ายบิล (บาท)" value={v.discount} inputProps={{ inputMode: "decimal" }} onChange={(e) => set("discount", e.target.value)} {...ne("discount")} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="VAT (%)" value={v.vatRate} inputProps={{ inputMode: "decimal" }} onChange={(e) => set("vatRate", e.target.value)} {...ne("vatRate")} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select label="วิธีชำระเงิน" value={v.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value as PaymentMethod)}>
              {METHODS.map((m) => (
                <MenuItem key={m} value={m}>
                  {paymentMethodLabel[m]}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="อ้างอิงการชำระ" placeholder="เลขที่โอน / เลขเช็ค" value={v.paymentRef} onChange={(e) => set("paymentRef", e.target.value)} />
          </Grid>
          <Grid size={12}>
            <TextField label="หมายเหตุ" multiline minRows={2} value={v.note} onChange={(e) => set("note", e.target.value)} />
          </Grid>
          <Grid size={12}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.5, sm: 3 }}>
              <Typography>รวมก่อนภาษี: {fmtMoney(subtotal)} บาท</Typography>
              <Typography>ภาษี: {fmtMoney(vatAmount)} บาท</Typography>
              <Typography sx={{ fontWeight: 700, color: "text.primary" }}>รวมทั้งสิ้น: {fmtMoney(subtotal + vatAmount)} บาท</Typography>
            </Stack>
          </Grid>
          <Grid size={12}>
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? "กำลังออกเอกสาร…" : "ออกเอกสาร"}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </>
  );
}

export default function NewDocumentPage() {
  return (
    <WomsPermissionGate perm="documents:create" backHref="/documents">
      <NewDocumentPageInner />
    </WomsPermissionGate>
  );
}
