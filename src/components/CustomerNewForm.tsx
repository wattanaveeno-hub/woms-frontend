"use client";

// ---------------------------------------------------------------------------
// เพิ่มลูกค้า (ENTECH redesign · CustomerNew) — ลูกค้าเป็น / ข้อมูลหลัก / จุดติดตั้งแรก / แถบบันทึก
//   บันทึกลูกค้า + สาขาแรกในคำขอเดียว (POST /api/partners/quick — ย้อนลูกค้าให้ถ้าสาขาบันทึกไม่ได้)
//   รหัสลูกค้า 8 หลัก ตรวจซ้ำทันที (CustomerCodeField) · เบอร์โทรซ้ำกับลูกค้าเดิม = เตือน ไม่บล็อก
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { api, ApiError } from "@/lib/api";
import type { CustomerKind, Partner } from "@/lib/types";
import { newCustomerCodeProblem } from "@/lib/customerCode";
import CustomerCodeField, { type CustomerCodeStatus } from "@/components/CustomerCodeField";
import { tokens as t } from "@/theme/tokens";

type Kind = Exclude<CustomerKind, "">;
const KINDS: Array<{ value: Kind; label: string; hint: string; nameLabel: string }> = [
  { value: "PERSON", label: "บุคคล", hint: "บ้าน ร้านค้าเล็ก", nameLabel: "ชื่อลูกค้า" },
  { value: "COMPANY", label: "บริษัท / ห้าง", hint: "ต้องมีเลขผู้เสียภาษี", nameLabel: "ชื่อบริษัท" },
  { value: "AGENCY", label: "หน่วยงาน", hint: "โรงเรียน ราชการ", nameLabel: "ชื่อหน่วยงาน" },
];

const EMPTY = {
  kind: "COMPANY" as Kind,
  name: "",
  taxId: "",
  taxOffice: "HQ" as "HQ" | "BRANCH",
  taxBranchNo: "",
  customerType: "IN" as "IN" | "OUT",
  customerCode: "",
  contactPerson: "",
  phone: "",
  branchNo: "00",
  storeName: "",
  siteAddress: "",
  sameBilling: true,
  billingAddress: "",
};
type V = typeof EMPTY;
type Field = keyof V;

const digits = (s: string) => s.replace(/\D/g, "");

function Section({ title, children, first }: { title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <Box component="section" sx={{ p: { xs: 2, sm: 3 }, display: "flex", flexDirection: "column", gap: 2, borderTop: first ? 0 : `1px solid ${t.line}` }}>
      <Typography variant="h2">{title}</Typography>
      {children}
    </Box>
  );
}

/** ป้ายเหนือช่อง (ENTECH DS .f label) — ช่องกรอกไม่ใช้ป้ายลอยของ MUI */
function Lab({ htmlFor, children, req }: { htmlFor: string; children: React.ReactNode; req?: boolean }) {
  return (
    <Box component="label" htmlFor={htmlFor} sx={{ display: "block", fontSize: 13, fontWeight: 600, color: t.slate, mb: 0.5 }}>
      {children}
      {req ? <Box component="i" sx={{ color: t.danger, fontStyle: "normal" }}> *</Box> : null}
    </Box>
  );
}

const grid = { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: "16px 24px" } as const;
const full = { gridColumn: "1 / -1" } as const;

export default function CustomerNewForm({ backHref, onCreated }: { backHref: string; onCreated: (p: Partner) => void }) {
  const [v, setV] = useState<V>(EMPTY);
  const [errs, setErrs] = useState<Partial<Record<Field | "form", string>>>({});
  const [busy, setBusy] = useState(false);
  const [codeStatus, setCodeStatus] = useState<CustomerCodeStatus>("idle");
  const [dupPhone, setDupPhone] = useState<{ id: string; name: string } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);

  const set = <K extends Field>(k: K, val: V[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    if (errs[k]) setErrs((e) => ({ ...e, [k]: undefined }));
  };
  const kindMeta = KINDS.find((k) => k.value === v.kind)!;
  const needsTax = v.kind === "COMPANY";
  const showTaxOffice = v.kind !== "PERSON";

  // เบอร์ซ้ำกับลูกค้าเดิม — เตือนอย่างเดียว (ลูกค้าคนละรายใช้เบอร์ร่วมกันได้ เช่น สำนักงานเดียวกัน)
  useEffect(() => {
    const d = digits(v.phone);
    setDupPhone(null);
    if (d.length < 9) return;
    let alive = true;
    const h = window.setTimeout(() => {
      api
        // ค้นด้วยเบอร์ตามที่พิมพ์ (ระบบค้นข้อความตรงตัว) แล้วเทียบเฉพาะตัวเลข
        .searchCustomers(v.phone.trim())
        .then((r) => {
          if (!alive) return;
          const hit = r.customers.find((c) => digits(c.phone || "") === d);
          setDupPhone(hit ? { id: hit.id, name: hit.name } : null);
        })
        .catch(() => undefined);
    }, 450);
    return () => {
      alive = false;
      window.clearTimeout(h);
    };
  }, [v.phone]);

  const validate = (): boolean => {
    const e: Partial<Record<Field, string>> = {};
    if (!v.name.trim()) e.name = `ต้องระบุ${kindMeta.nameLabel}`;
    if (needsTax && !v.taxId.trim()) e.taxId = "บริษัท/ห้าง ต้องระบุเลขผู้เสียภาษี";
    if (v.taxId.trim() && !/^\d{13}$/.test(digits(v.taxId))) e.taxId = "เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก";
    if (showTaxOffice && v.taxOffice === "BRANCH" && !/^\d{5}$/.test(v.taxBranchNo.trim())) e.taxBranchNo = "เลขสาขาตามภาษีเป็นตัวเลข 5 หลัก เช่น 00001";
    if (!v.customerCode.trim()) e.customerCode = "ต้องระบุรหัสลูกค้า 8 หลัก — กรอกเองหรือกด “ใช้เลขถัดไป”";
    else {
      const p = newCustomerCodeProblem(v.customerCode);
      if (p) e.customerCode = p;
      else if (codeStatus === "taken") e.customerCode = "รหัสลูกค้านี้ถูกใช้แล้ว เลือกรหัสอื่นหรือกด “ใช้เลขถัดไป”";
    }
    if (!v.contactPerson.trim()) e.contactPerson = "ต้องระบุผู้ติดต่อ";
    if (!v.phone.trim()) e.phone = "ต้องระบุเบอร์โทร";
    else if (!/^[0-9+\-\s()]{6,20}$/.test(v.phone.trim())) e.phone = "รูปแบบเบอร์ไม่ถูกต้อง";
    if (v.branchNo.trim() && !/^\d{2}$/.test(v.branchNo.trim())) e.branchNo = "รหัสสาขาเป็นตัวเลข 2 หลัก เช่น 00 หรือ 01";
    setErrs(e);
    const first = Object.keys(e)[0];
    if (first) document.getElementById(`cn-${first}`)?.focus();
    return !first;
  };

  const submit = async (again: boolean) => {
    setSaved(null);
    if (!validate()) return;
    setBusy(true);
    const name = v.name.trim();
    const siteAddress = v.siteAddress.trim();
    try {
      const r = await api.quickCreateCustomer({
        source: "customers",
        name,
        customerCode: v.customerCode.trim(),
        customerKind: v.kind,
        taxId: digits(v.taxId),
        taxBranch: showTaxOffice && v.taxId.trim() ? (v.taxOffice === "HQ" ? "สำนักงานใหญ่" : `สาขา ${v.taxBranchNo.trim()}`) : "",
        customerType: v.customerType,
        phone: v.phone.trim(),
        contactPerson: v.contactPerson.trim(),
        address: v.sameBilling ? siteAddress : v.billingAddress.trim(),
        site: {
          branchNo: v.branchNo.trim() || "00",
          storeName: v.storeName.trim() || name,
          contactPerson: v.contactPerson.trim(),
          phone: v.phone.trim(),
          address: siteAddress,
        },
      });
      if (again) {
        setSaved(`บันทึก ${r.partner.customerCode ? `${r.partner.customerCode} · ` : ""}${r.partner.name} แล้ว — กรอกลูกค้ารายถัดไปได้เลย`);
        setV({ ...EMPTY, kind: v.kind, customerType: v.customerType });
        setErrs({});
        setFormKey((k) => k + 1);
        requestAnimationFrame(() => nameRef.current?.focus());
      } else {
        onCreated(r.partner);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        const f = (e.field ?? "").replace(/^site\./, "");
        const map: Record<string, Field> = { name: "name", taxId: "taxId", customerCode: "customerCode", phone: "phone", contactPerson: "contactPerson", branchNo: "branchNo", storeName: "storeName", address: "siteAddress" };
        if (map[f]) setErrs({ [map[f]]: e.message });
        else setErrs({ form: e.message });
      } else setErrs({ form: "บันทึกไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  const tf = (k: Field, label: string, extra: Record<string, unknown> = {}, help?: string) => {
    const req = label.endsWith(" *");
    return (
      <Box>
        <Lab htmlFor={`cn-${k}`} req={req}>{req ? label.slice(0, -2) : label}</Lab>
        <TextField
          id={`cn-${k}`}
          value={v[k] as string}
          onChange={(e) => set(k, e.target.value as never)}
          error={!!errs[k]}
          helperText={errs[k] ?? help ?? undefined}
          {...extra}
        />
      </Box>
    );
  };

  return (
    <Box>
      {dupPhone ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <b>อาจซ้ำกับลูกค้าเดิม:</b> {dupPhone.name} เบอร์โทรเดียวกัน{" "}
          <Link href={`/partners/${dupPhone.id}?from=customers`} style={{ fontWeight: 600 }}>
            เปิดดู
          </Link>
        </Alert>
      ) : null}
      {saved ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaved(null)}>
          {saved}
        </Alert>
      ) : null}
      {errs.form ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errs.form}
        </Alert>
      ) : null}

      <Paper variant="outlined" component="form" noValidate onSubmit={(e: React.FormEvent) => (e.preventDefault(), void submit(false))} key={formKey}>
        <Section title="ลูกค้าเป็น" first>
          <Box role="radiogroup" aria-label="ประเภทลูกค้า" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
            {KINDS.map((k) => {
              const on = v.kind === k.value;
              return (
                <ButtonBase
                  key={k.value}
                  role="radio"
                  aria-checked={on}
                  onClick={() => set("kind", k.value)}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 0.5,
                    minHeight: 64,
                    px: on ? "15px" : 2,
                    py: on ? "11px" : 1.5,
                    border: on ? `2px solid ${t.accent}` : `1px solid ${t.lineStrong}`,
                    borderRadius: "12px",
                    bgcolor: on ? t.accentBg : t.surface,
                    textAlign: "left",
                    fontFamily: "inherit",
                    "&:hover": { bgcolor: on ? t.accentBg : "#f8fafb" },
                    "&.Mui-focusVisible": { outline: `2px solid ${t.accent}`, outlineOffset: 2 },
                  }}
                >
                  <Box component="b" sx={{ fontSize: 15, color: t.ink }}>{k.label}</Box>
                  <Box component="small" sx={{ fontSize: 12, color: t.slate2 }}>{k.hint}</Box>
                </ButtonBase>
              );
            })}
          </Box>
        </Section>

        <Section title="ข้อมูลหลัก">
          <Box sx={grid}>
            <Box sx={full}>{tf("name", `${kindMeta.nameLabel} *`, { inputRef: nameRef })}</Box>
            {tf("taxId", `เลขผู้เสียภาษี${needsTax ? " *" : ""}`, { inputProps: { inputMode: "numeric", maxLength: 17 } }, "13 หลัก · ใช้ออกใบกำกับภาษี")}
            {showTaxOffice ? (
              <Box>
              <Lab htmlFor="cn-taxOffice">สำนักงาน</Lab>
              <Box sx={{ display: "flex", gap: 1 }}>
                <TextField select id="cn-taxOffice" SelectProps={{ inputProps: { "aria-label": "สำนักงาน" } }} value={v.taxOffice} onChange={(e) => set("taxOffice", e.target.value as "HQ" | "BRANCH")} sx={{ flex: "1 1 50%" }}>
                  <MenuItem value="HQ">สำนักงานใหญ่</MenuItem>
                  <MenuItem value="BRANCH">สาขา</MenuItem>
                </TextField>
                {v.taxOffice === "BRANCH" ? (
                  <TextField
                    id="cn-taxBranchNo"
                    placeholder="เลขสาขา 5 หลัก"
                    inputProps={{ inputMode: "numeric", maxLength: 5, "aria-label": "เลขสาขาตามภาษี 5 หลัก" }}
                    value={v.taxBranchNo}
                    onChange={(e) => set("taxBranchNo", e.target.value.replace(/\D/g, "").slice(0, 5))}
                    error={!!errs.taxBranchNo}
                    helperText={errs.taxBranchNo}
                    sx={{ flex: "1 1 50%" }}
                  />
                ) : null}
              </Box>
              </Box>
            ) : (
              <Box />
            )}
            <Box>
              <Typography component="div" sx={{ fontSize: 13, fontWeight: 600, color: t.slate, mb: 0.5 }}>
                ลูกค้าใน / นอก<Box component="i" sx={{ color: t.danger, fontStyle: "normal" }}> *</Box>
              </Typography>
              <ToggleButtonGroup exclusive size="small" aria-label="ลูกค้าในหรือนอก" value={v.customerType} onChange={(_e, val) => val && set("customerType", val)}>
                <ToggleButton value="IN">ใน (IN)</ToggleButton>
                <ToggleButton value="OUT">นอก (OUT)</ToggleButton>
              </ToggleButtonGroup>
              <Typography sx={{ fontSize: 12, color: t.slate2, mt: 0.5 }}>นอก = เครื่องที่ไม่ได้ซื้อ/เช่าจากเรา</Typography>
            </Box>
            <Box>
              <Lab htmlFor="cn-customerCode" req>รหัสลูกค้า (8 หลัก)</Lab>
              <CustomerCodeField
                labelOutside
                id="cn-customerCode"
                value={v.customerCode}
                onChange={(c) => set("customerCode", c)}
                error={errs.customerCode}
                onStatus={setCodeStatus}
                required
              />
            </Box>
            {tf("contactPerson", "ผู้ติดต่อ *")}
            <Box>
              <Lab htmlFor="cn-phone" req>เบอร์โทร</Lab>
              <TextField
                id="cn-phone"
                type="tel"
                inputProps={{ inputMode: "tel" }}
                value={v.phone}
                onChange={(e) => set("phone", e.target.value)}
                error={!!errs.phone || !!dupPhone}
                helperText={errs.phone ?? (dupPhone ? `เบอร์นี้มีในลูกค้า ${dupPhone.name} แล้ว` : undefined)}
              />
            </Box>
          </Box>
        </Section>

        <Section title="จุดติดตั้งแรก">
          <Box sx={grid}>
            {tf("branchNo", "รหัสสาขา (2 หลัก)", { inputProps: { inputMode: "numeric", maxLength: 2 } }, "00 = สาขาแรก/สำนักงานใหญ่")}
            {tf("storeName", "ชื่อสาขา", { placeholder: v.name.trim() || "เช่น สำนักงานใหญ่ บางนา" }, "เว้นว่าง = ใช้ชื่อลูกค้า")}
            <Box sx={full}>{tf("siteAddress", "ที่อยู่ติดตั้ง", { placeholder: "บ้านเลขที่ ถนน แขวง เขต", multiline: true, minRows: 2 }, "เพิ่มสาขาอื่นได้ภายหลังในหน้าลูกค้า")}</Box>
            <Box sx={full}>
              <FormControlLabel
                sx={{ m: 0, "& .MuiFormControlLabel-label": { fontSize: 14 } }}
                control={<Checkbox size="small" checked={v.sameBilling} onChange={(e) => set("sameBilling", e.target.checked)} sx={{ p: 0.5, mr: 1 }} />}
                label="ใช้ที่อยู่นี้เป็นที่อยู่ออกบิลด้วย"
              />
            </Box>
            {!v.sameBilling ? <Box sx={full}>{tf("billingAddress", "ที่อยู่ออกบิล", { multiline: true, minRows: 2 })}</Box> : null}
          </Box>
        </Section>

        {/* ENTECH DS .savebar */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, justifyContent: "flex-end", alignItems: "center", px: { xs: 2, sm: 3 }, py: 2, borderTop: `1px solid ${t.line}`, bgcolor: t.surface2, borderRadius: "0 0 12px 12px" }}>
          <Button component={Link} href={backHref} variant="outlined" disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant="outlined" disabled={busy} onClick={() => void submit(true)}>
            บันทึก แล้วเพิ่มอีก
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? "กำลังบันทึก…" : "บันทึกลูกค้า"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
