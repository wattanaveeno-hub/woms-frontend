"use client";

// FB-02 — สร้างลูกค้าใหม่ (พร้อมสาขาแรก) จากหน้าเปิดคิว/เปิดงาน โดยไม่ต้องออกจากหน้าเดิม
// บันทึกเข้าฐานข้อมูลลูกค้าจริงแล้วคืนให้ฟอร์มเลือกผูกทันที — ค่าที่กรอกไว้ในฟอร์มคิวไม่หาย (dialog แยก state)
//
// ปรับให้ใช้ง่าย (15 พ.ย. 2569 · ข้อมูลครบเท่าเดิมทุกช่อง):
//   · เติมให้จากฟอร์มเปิดคิว/เปิดงาน (ชื่อร้าน ผู้ติดต่อ เบอร์ ที่อยู่ ลิงก์แผนที่) — ไม่ต้องพิมพ์ซ้ำ
//   · วางลิงก์ Google Maps → ดึงพิกัด + ตำบล/แขวง อำเภอ/เขต จังหวัด รหัสไปรษณีย์ (ลิงก์ย่อ maps.app.goo.gl ใช้ได้)
//   · ค้นตำบลหรือรหัสไปรษณีย์ช่องเดียว → เติมอีก 3 ช่องให้ (ฐานข้อมูลที่อยู่ไทยในระบบ)
//   · ข้อมูลบริษัท (รหัสลูกค้า/ประเภท/เลขผู้เสียภาษี) และพิกัด ยังกรอก/แก้ได้ครบ
import { useCallback, useEffect, useRef, useState } from "react";
import SiteAddressFields, { type SiteAddressValues } from "@/components/SiteAddressFields";
import { newCustomerCodeProblem } from "@/lib/customerCode";
import CustomerCodeField, { type CustomerCodeStatus } from "@/components/CustomerCodeField";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { api, ApiError } from "@/lib/api";
import type { CustomerSite, Partner } from "@/lib/types";

const EMPTY = {
  name: "",
  customerCode: "",
  customerKind: "",
  taxId: "",
  contactPerson: "",
  phone: "",
  branchNo: "",
  storeName: "",
  address: "",
  subdistrict: "",
  district: "",
  province: "",
  postcode: "",
  mapLink: "",
  lat: "",
  lng: "",
};
type Values = typeof EMPTY;

/** ค่าที่ฟอร์มเปิดคิว/เปิดงานกรอกไว้แล้ว — ใช้เติมให้ (ผู้ใช้แก้ได้) */
export type QuickCustomerInitial = Partial<Pick<Values, "storeName" | "contactPerson" | "phone" | "address" | "mapLink">>;

export default function QuickCustomerDialog({
  open,
  initialName = "",
  initial,
  onClose,
  onCreated,
}: {
  open: boolean;
  initialName?: string;
  initial?: QuickCustomerInitial;
  onClose: () => void;
  onCreated: (partner: Partner, site: CustomerSite | null) => void;
}) {
  const theme = useTheme();
  const full = useMediaQuery(theme.breakpoints.down("sm"));
  const [v, setV] = useState<Values>(EMPTY);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [codeStatus, setCodeStatus] = useState<CustomerCodeStatus>("idle");
  // ชื่อร้าน/สาขา: ตามชื่อลูกค้าจนกว่าผู้ใช้จะแก้เอง
  const storeTouched = useRef(false);
  // เปลี่ยนทุกครั้งที่เปิดหน้าต่าง → ช่องที่อยู่ดึงจากลิงก์แผนที่ที่เติมมา (เติมเฉพาะช่องว่าง)
  const [openKey, setOpenKey] = useState(0);
  const patchAddress = useCallback((patch: Partial<SiteAddressValues>) => setV((p) => ({ ...p, ...patch })), []);

  useEffect(() => {
    if (!open) return;
    const name = initialName.trim();
    const init = initial ?? {};
    setV({
      ...EMPTY,
      name,
      storeName: (init.storeName ?? "").trim() || name,
      contactPerson: (init.contactPerson ?? "").trim(),
      phone: (init.phone ?? "").trim(),
      address: (init.address ?? "").trim(),
      mapLink: (init.mapLink ?? "").trim(),
    });
    storeTouched.current = !!(init.storeName ?? "").trim();
    setErr(null);
    setOpenKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k: keyof Values, val: string) =>
    setV((p) => {
      const next = { ...p, [k]: val };
      if (k === "name" && !storeTouched.current) next.storeName = val;
      return next;
    });
  const fe = (f: string) => (err?.field && (err.field === f || err.field === `site.${f}`) ? err.message : undefined);

  const save = async () => {
    if (!v.name.trim()) return setErr({ field: "name", message: "ต้องระบุชื่อลูกค้า/บริษัท" });
    if (v.branchNo && !/^\d{2}$/.test(v.branchNo)) return setErr({ field: "branchNo", message: "รหัสสาขาต้องเป็นตัวเลข 2 หลัก เช่น 00, 01" });
    if (v.postcode && !/^\d{5}$/.test(v.postcode.trim())) return setErr({ field: "postcode", message: "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก" });
    const lat = v.lat.trim() === "" ? 0 : Number(v.lat);
    const lng = v.lng.trim() === "" ? 0 : Number(v.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      return setErr({ field: "lat", message: "ละติจูด/ลองจิจูดไม่ถูกต้อง (เช่น 13.7563, 100.5018)" });
    }
    // รหัสลูกค้าใหม่ 8 หลัก (A-Z / 0-9) · ไม่ระบุก็ได้
    const codeProblem = newCustomerCodeProblem(v.customerCode);
    if (codeProblem) return setErr({ field: "customerCode", message: codeProblem });
    if (codeStatus === "taken") return setErr({ field: "customerCode", message: "รหัสลูกค้านี้ถูกใช้แล้ว เลือกรหัสอื่นหรือกด “ใช้เลขถัดไป”" });
    setBusy(true);
    setErr(null);
    try {
      const hasSite = [v.branchNo, v.storeName, v.address, v.subdistrict, v.district, v.province, v.postcode, v.mapLink].some((x) => x.trim()) || lat || lng;
      const r = await api.quickCreateCustomer({
        name: v.name.trim(),
        customerCode: v.customerCode.trim(),
        customerKind: v.customerKind,
        taxId: v.taxId.trim(),
        phone: v.phone.trim(),
        contactPerson: v.contactPerson.trim(),
        address: [v.address, v.subdistrict, v.district, v.province, v.postcode].map((x) => x.trim()).filter(Boolean).join(" "),
        site: hasSite
          ? {
              branchNo: v.branchNo.trim(),
              storeName: v.storeName.trim() || v.name.trim(),
              contactPerson: v.contactPerson.trim(),
              phone: v.phone.trim(),
              address: v.address.trim(),
              // D-15: ตำบล/แขวงของสาขา เป็นช่องแยก (ไม่ต่อเข้าที่อยู่สาขา)
              subdistrict: v.subdistrict.trim(),
              district: v.district.trim(),
              province: v.province.trim(),
              postcode: v.postcode.trim(),
              mapLink: v.mapLink.trim(),
              lat,
              lng,
            }
          : undefined,
      });
      onCreated(r.partner, r.site);
    } catch (e) {
      setErr(e instanceof ApiError ? { field: e.field, message: e.message } : { message: "บันทึกลูกค้าไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  const tf = (k: keyof Values, label: string, extra: Record<string, unknown> = {}) => (
    <TextField
      fullWidth
      size="small"
      label={label}
      value={v[k]}
      onChange={(e) => set(k, e.target.value)}
      error={!!fe(k)}
      helperText={fe(k) ?? " "}
      {...extra}
    />
  );
  const section = (title: string, hint: string, children: React.ReactNode, testid?: string) => (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: 2 }} data-testid={testid}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {hint}
      </Typography>
      {children}
    </Paper>
  );
  const unknownFieldError = err?.field && !(err.field.replace(/^site\./, "") in EMPTY);
  const prefilled = !!(initial && Object.values(initial).some((x) => (x ?? "").trim()));

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md" fullScreen={full}>
      <DialogTitle sx={{ pb: 0.5 }}>เพิ่มลูกค้าใหม่</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          บันทึกเข้าฐานข้อมูลลูกค้าแล้วเลือกให้งานนี้ทันที · ช่องที่มี * ต้องกรอก ที่เหลือกรอกภายหลังได้
          {prefilled ? " · เติมข้อมูลจากหน้าเปิดงานให้แล้ว ตรวจแล้วแก้ได้" : ""}
        </Typography>
        {err && (!err.field || unknownFieldError) ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {err.message}
          </Alert>
        ) : null}

        {section(
          "1 · ลูกค้า",
          "ชื่อที่ใช้ออกเอกสาร และคนที่ติดต่อได้",
          <Grid container spacing={1.5}>
            <Grid size={12}>{tf("name", "ชื่อลูกค้า / บริษัท *", { autoFocus: true, inputProps: { "data-testid": "qc-name" } })}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{tf("contactPerson", "ผู้ติดต่อ")}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{tf("phone", "เบอร์โทร", { type: "tel", inputProps: { inputMode: "tel" } })}</Grid>
            <Grid size={{ xs: 12, sm: 5 }}>
              {open ? (
                <CustomerCodeField
                  size="small"
                  value={v.customerCode}
                  onChange={(code) => {
                    set("customerCode", code);
                    if (err?.field === "customerCode") setErr(null);
                  }}
                  error={fe("customerCode")}
                  onStatus={setCodeStatus}
                />
              ) : null}
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField select fullWidth size="small" label="ประเภท" value={v.customerKind} onChange={(e) => set("customerKind", e.target.value)} helperText=" ">
                <MenuItem value="">— ไม่ระบุ —</MenuItem>
                <MenuItem value="COMPANY">บริษัท/นิติบุคคล</MenuItem>
                <MenuItem value="PERSON">บุคคล</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>{tf("taxId", "เลขผู้เสียภาษี (13 หลัก)", { inputProps: { inputMode: "numeric", maxLength: 13 } })}</Grid>
          </Grid>,
          "qc-section-customer"
        )}

        {section(
          "2 · สถานที่ติดตั้ง (สาขาแรก)",
          "วางลิงก์ Google Maps ระบบเติมพิกัด ตำบล อำเภอ จังหวัด และรหัสไปรษณีย์ให้ · หรือค้นจากชื่อตำบล/รหัสไปรษณีย์",
          <SiteAddressFields
            value={v}
            onChange={patchAddress}
            fieldError={fe}
            testIdPrefix="qc"
            autoLookupKey={openKey}
            between={
              <>
                <Grid size={{ xs: 12, sm: 9 }}>
                  {tf("storeName", "ชื่อร้าน / สาขา", {
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      storeTouched.current = true;
                      set("storeName", e.target.value);
                    },
                  })}
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>{tf("branchNo", "รหัสสาขา (2 หลัก)", { placeholder: "00", inputProps: { inputMode: "numeric", maxLength: 2 } })}</Grid>
              </>
            }
          />,
          "qc-section-site"
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={save} disabled={busy} data-testid="qc-save">
          {busy ? "กำลังบันทึก…" : "บันทึกและเลือกลูกค้านี้"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
