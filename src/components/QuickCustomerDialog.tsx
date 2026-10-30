"use client";

// FB-02 — สร้างลูกค้าใหม่ (พร้อมสาขาแรก) จากหน้าเปิดคิว/เปิดงาน โดยไม่ต้องออกจากหน้าเดิม
// บันทึกเข้าฐานข้อมูลลูกค้าจริงแล้วคืนให้ฟอร์มเลือกผูกทันที — ค่าที่กรอกไว้ในฟอร์มคิวไม่หาย (dialog แยก state)
import { useEffect, useState } from "react";
import { NEW_CUSTOMER_CODE_MAX, newCustomerCodeProblem } from "@/lib/customerCode";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
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

export default function QuickCustomerDialog({
  open,
  initialName = "",
  onClose,
  onCreated,
}: {
  open: boolean;
  initialName?: string;
  onClose: () => void;
  onCreated: (partner: Partner, site: CustomerSite | null) => void;
}) {
  const theme = useTheme();
  const full = useMediaQuery(theme.breakpoints.down("sm"));
  const [v, setV] = useState(EMPTY);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setV({ ...EMPTY, name: initialName, storeName: initialName });
      setErr(null);
    }
  }, [open, initialName]);

  const set = (k: keyof typeof EMPTY, val: string) => setV((p) => ({ ...p, [k]: val }));
  const fe = (f: string) => (err?.field && (err.field === f || err.field === `site.${f}`) ? err.message : undefined);

  const save = async () => {
    if (!v.name.trim()) return setErr({ field: "name", message: "ต้องระบุชื่อลูกค้า/บริษัท" });
    if (v.branchNo && !/^\d{2}$/.test(v.branchNo)) return setErr({ field: "branchNo", message: "รหัสสาขาต้องเป็นตัวเลข 2 หลัก เช่น 00, 01" });
    const lat = v.lat.trim() === "" ? 0 : Number(v.lat);
    const lng = v.lng.trim() === "" ? 0 : Number(v.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      return setErr({ field: "lat", message: "ละติจูด/ลองจิจูดไม่ถูกต้อง (เช่น 13.7563, 100.5018)" });
    }
    // D-06: รหัสลูกค้าใหม่ ≤ 4 ตัว (A-Z / 0-9)
    const codeProblem = newCustomerCodeProblem(v.customerCode);
    if (codeProblem) return setErr({ field: "customerCode", message: codeProblem });
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

  const tf = (k: keyof typeof EMPTY, label: string, extra: Record<string, unknown> = {}) => (
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

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md" fullScreen={full}>
      <DialogTitle>เพิ่มลูกค้าใหม่</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>
          บันทึกเข้าฐานข้อมูลลูกค้าและเลือกให้คิวนี้ทันที — ข้อมูลอื่นที่กรอกในหน้าเปิดคิวยังอยู่ครบ
        </Typography>
        {err && !err.field ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {err.message}
          </Alert>
        ) : null}
        {err?.field && !(err.field.replace(/^site\./, "") in EMPTY) ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {err.message}
          </Alert>
        ) : null}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          ข้อมูลลูกค้า
        </Typography>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 8 }}>{tf("name", "ชื่อลูกค้า / บริษัท *", { autoFocus: true })}</Grid>
          <Grid size={{ xs: 12, sm: 4 }}>{tf("customerCode", "รหัสลูกค้า (≤ 4 ตัว A-Z/0-9)", { inputProps: { maxLength: NEW_CUSTOMER_CODE_MAX } })}</Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField select fullWidth size="small" label="ประเภท" value={v.customerKind} onChange={(e) => set("customerKind", e.target.value)} helperText=" ">
              <MenuItem value="">— ไม่ระบุ —</MenuItem>
              <MenuItem value="COMPANY">บริษัท/นิติบุคคล</MenuItem>
              <MenuItem value="PERSON">บุคคล</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>{tf("taxId", "เลขผู้เสียภาษี (13 หลัก)", { inputProps: { inputMode: "numeric", maxLength: 13 } })}</Grid>
          <Grid size={{ xs: 12, sm: 4 }}>{tf("contactPerson", "ผู้ติดต่อ")}</Grid>
          <Grid size={{ xs: 12, sm: 4 }}>{tf("phone", "เบอร์โทร", { type: "tel" })}</Grid>
        </Grid>
        <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>
          สาขา / ร้าน / สถานที่ติดตั้ง
        </Typography>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 3 }}>
            {tf("branchNo", "รหัสสาขา (2 หลัก)", { inputProps: { inputMode: "numeric", maxLength: 2 } })}
          </Grid>
          <Grid size={{ xs: 12, sm: 9 }}>{tf("storeName", "ชื่อร้าน / สาขา")}</Grid>
          <Grid size={12}>{tf("address", "ที่อยู่", { placeholder: "เลขที่ ถนน" })}</Grid>
          <Grid size={{ xs: 12, sm: 4 }}>{tf("subdistrict", "ตำบล/แขวง")}</Grid>
          <Grid size={{ xs: 12, sm: 4 }}>{tf("district", "อำเภอ/เขต")}</Grid>
          <Grid size={{ xs: 12, sm: 4 }}>{tf("province", "จังหวัด")}</Grid>
          <Grid size={{ xs: 12, sm: 4 }}>{tf("postcode", "รหัสไปรษณีย์", { inputProps: { inputMode: "numeric", maxLength: 5 } })}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{tf("mapLink", "ลิงก์ Map (Google Maps)", { placeholder: "https://maps.google.com/..." })}</Grid>
          <Grid size={{ xs: 6, sm: 3 }}>{tf("lat", "ละติจูด", { inputProps: { inputMode: "decimal" } })}</Grid>
          <Grid size={{ xs: 6, sm: 3 }}>{tf("lng", "ลองจิจูด", { inputProps: { inputMode: "decimal" } })}</Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={save} disabled={busy}>
          {busy ? "กำลังบันทึก…" : "บันทึกและเลือกลูกค้านี้"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
