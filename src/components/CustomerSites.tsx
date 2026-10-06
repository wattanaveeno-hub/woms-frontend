"use client";

// ---------------------------------------------------------------------------
// จัดการสาขา / ร้าน / สถานที่ติดตั้งของลูกค้าหนึ่งราย
// ---------------------------------------------------------------------------
// ที่มา: ชีต "FUN-NOFUN REQ" โมดูล "ระบบฐานข้อมูลลูกค้า" (MUST-HAVE)
//   "ระบบจะต้องรองรับลูกค้าหนึ่งรายที่มีหลายร้านหรือหลายสถานที่ติดตั้งได้"
// โครงสร้างชื่อฟิลด์อ้างอิงชีต Sheet2: S_NAME (ชื่อร้าน) + B_NUM (เลขสาขา)

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { CustomerSite, CustomerSiteFormValues } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { useAuth } from "@/lib/AuthContext";
import { branchNoError } from "@/lib/uiRules";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid2";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import { WomsDataTable, WomsErrorState, WomsFormSection, WomsStatusChip, type WomsColumn } from "@/components/woms";

const EMPTY: CustomerSiteFormValues = {
  branchNo: "",
  storeName: "",
  contactPerson: "",
  phone: "",
  address: "",
  district: "",
  province: "",
  postcode: "",
  zone: "",
  lat: 0,
  lng: 0,
  active: true,
  note: "",
};

export default function CustomerSites({ partnerId }: { partnerId: string }) {
  const toast = useToast();
  const dialog = useDialog();
  const { has } = useAuth();
  const canCreate = has("partners:create");
  const canEdit = has("partners:edit");
  const canDelete = has("partners:delete");

  const [sites, setSites] = useState<CustomerSite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerSiteFormValues>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [branchErr, setBranchErr] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<{ field?: string; message: string } | null>(null);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  // CUS-02 — เครื่องตาม SN ของแต่ละสาขา (หนึ่งสาขามีหลายเครื่อง กดไปประวัติเครื่องได้)
  const [machinesBySite, setMachinesBySite] = useState<Map<string, Array<{ id: string; serial: string }>>>(new Map());

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.listCustomerSites(partnerId);
      setSites(r.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดสาขาไม่สำเร็จ");
      setSites([]);
    }
    try {
      const eq = await api.partnerEquipment(partnerId);
      const m = new Map<string, Array<{ id: string; serial: string }>>();
      for (const e of eq.items) {
        if (!e.siteId) continue;
        const list = m.get(e.siteId) ?? [];
        list.push({ id: e.id, serial: e.serial });
        m.set(e.siteId, list);
      }
      setMachinesBySite(m);
    } catch {
      // รายการเครื่องแสดงแยกในการ์ด "เครื่องของลูกค้า" อยู่แล้ว — โหลดไม่ได้ไม่ทำให้ตารางสาขาพัง
      setMachinesBySite(new Map());
    }
  }, [partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  const startAdd = () => {
    setBranchErr(null);
    setFormErr(null);
    setEditingId(null);
    setForm(EMPTY);
    setShowForm(true);
  };

  const startEdit = (s: CustomerSite) => {
    setBranchErr(null);
    setFormErr(null);
    setEditingId(s.id);
    setForm({
      branchNo: s.branchNo,
      storeName: s.storeName,
      contactPerson: s.contactPerson,
      phone: s.phone,
      address: s.address,
      district: s.district,
      province: s.province,
      postcode: s.postcode,
      zone: s.zone,
      lat: s.lat,
      lng: s.lng,
      active: s.active,
      note: s.note,
    });
    setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    // CUS-02 — ตรวจรหัสสาขาก่อนส่ง (ค่าเดิมของข้อมูลเก่าที่ไม่ได้แก้ ไม่บังคับ)
    const original = editingId ? sites?.find((x) => x.id === editingId)?.branchNo : undefined;
    const bErr = branchNoError(form.branchNo, original);
    setBranchErr(bErr);
    setFormErr(null);
    if (bErr) return;
    if (!form.storeName.trim() && !form.branchNo.trim()) {
      setFormErr({ field: "storeName", message: "ต้องระบุชื่อร้านหรือเลขสาขาอย่างน้อยหนึ่งอย่าง" });
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        const current = sites?.find((s) => s.id === editingId);
        await api.patchCustomerSite(partnerId, editingId, form, current?.updatedAt ?? "");
        toast.success("บันทึกสาขาแล้ว");
      } else {
        await api.createCustomerSite(partnerId, form);
        toast.success("เพิ่มสาขาแล้ว");
      }
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (err) {
      // ข้อความจาก backend ชี้ช่องได้ → แสดงใต้ช่องนั้น (ค่าที่กรอกยังอยู่)
      if (err instanceof ApiError && err.field) setFormErr({ field: err.field.split(".").pop(), message: err.message });
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: CustomerSite) => {
    if (
      !(await dialog.confirm({
        title: `ลบสาขา ${s.label || s.branchNo}?`,
        message: "ถ้ามีเครื่องผูกอยู่ ระบบจะปิดการใช้งานแทนการลบ เพื่อไม่ให้ประวัติขาด",
        confirmLabel: "ยืนยันลบสาขา",
        danger: true,
      }))
    ) {
      return;
    }
    try {
      const r = (await api.deleteCustomerSite(partnerId, s.id)) as any;
      if (r && r.deleted === false) {
        toast.warning(`ปิดการใช้งานสาขาแล้ว เพราะมีข้อมูลอ้างอิงอยู่ ${r.referenceCount ?? r.equipmentCount} รายการ`);
      } else {
        toast.success("ลบสาขาแล้ว");
      }
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  };

  const set = <K extends keyof CustomerSiteFormValues>(k: K, v: CustomerSiteFormValues[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const fErr = (f: string) => (formErr?.field === f ? formErr.message : undefined);
  const actions = (st: CustomerSite) =>
    canEdit || canDelete ? (
      <Stack direction="row" spacing={0.5}>
        {canEdit ? (
          <Button size="small" onClick={() => startEdit(st)}>
            แก้ไข
          </Button>
        ) : null}
        {canDelete ? (
          <Button size="small" color="error" onClick={() => remove(st)}>
            ลบ
          </Button>
        ) : null}
      </Stack>
    ) : null;
  const statusChip = (st: CustomerSite) => (
    <WomsStatusChip label={st.active ? "ใช้งาน" : "ปิดใช้งาน"} tone={st.active ? "success" : "neutral"} />
  );
  const mapCell = (st: CustomerSite) =>
    st.lat || st.lng ? (
      <Button
        size="small"
        component="a"
        href={`https://www.google.com/maps?q=${st.lat},${st.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        startIcon={<PlaceOutlinedIcon />}
        sx={{ fontFamily: "monospace" }}
      >
        {st.lat.toFixed(5)}, {st.lng.toFixed(5)}
      </Button>
    ) : (
      "-"
    );
  const machinesCell = (st: CustomerSite) => {
    const list = machinesBySite.get(st.id) ?? [];
    if (!list.length) return "-";
    return (
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        {list.map((m) => (
          <Link key={m.id} href={`/equipment/${m.id}`} className="code">
            {m.serial}
          </Link>
        ))}
      </Stack>
    );
  };
  const columns: WomsColumn<CustomerSite>[] = [
    // รหัสสาขาเป็นข้อความ — เรียงแบบข้อความ ("00" มาก่อน "01") ไม่แปลงเป็นตัวเลข
    { key: "branch", label: "สาขา", sortValue: (st) => st.branchNo || "", render: (st) => <span className="mono">{st.branchNo || "-"}</span> },
    { key: "store", label: "ชื่อร้าน", sortValue: (st) => st.storeName || "", render: (st) => st.storeName || "-" },
    { key: "contact", label: "ผู้ติดต่อ", hideBelowLg: true, render: (st) => st.contactPerson || "-" },
    { key: "phone", label: "เบอร์โทร", render: (st) => <span className="mono">{st.phone || "-"}</span> },
    { key: "addr", label: "ที่อยู่", hideBelowLg: true, render: (st) => st.addressFull || "-" },
    { key: "map", label: "พิกัด", hideBelowLg: true, render: mapCell },
    { key: "machines", label: "เครื่อง (SN)", sortValue: (st) => machinesBySite.get(st.id)?.length ?? 0, render: machinesCell },
    { key: "zone", label: "โซน", render: (st) => st.zone || "-" },
    { key: "status", label: "สถานะ", render: statusChip },
    ...(canEdit || canDelete ? [{ key: "act", label: "จัดการ", render: actions } as WomsColumn<CustomerSite>] : []),
  ];
  const g = { xs: 12, sm: 6 } as const;

  return (
    <WomsFormSection
      title={`สาขา / ร้าน / สถานที่ติดตั้ง${sites ? ` (${sites.length})` : ""}`}
      actions={
        canCreate ? (
          <Button variant="outlined" startIcon={<AddIcon />} onClick={startAdd}>
            เพิ่มสาขา
          </Button>
        ) : undefined
      }
    >
      {error ? (
        <WomsErrorState message={error} onRetry={load} />
      ) : (
        <WomsDataTable
          caption="สาขาของลูกค้า"
          rows={sites ?? []}
          loading={sites === null}
          columns={columns}
          rowKey={(st) => st.id}
          pageSize={10}
          initialSort={{ key: "branch", dir: "asc" }}
          emptyTitle="ยังไม่มีสาขา"
          emptyDescription={`ลูกค้ารายนี้ยังไม่ได้แยกร้าน/สถานที่ติดตั้ง${canCreate ? " กด “เพิ่มสาขา” เพื่อเริ่ม" : ""}`}
          renderCard={(st) => (
            <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                <Typography sx={{ fontWeight: 600, color: "text.primary" }}>
                  <span className="mono">{st.branchNo || "-"}</span> · {st.storeName || "-"}
                </Typography>
                {statusChip(st)}
              </Stack>
              <Typography variant="body2">
                {[st.contactPerson, st.phone].filter(Boolean).join(" · ") || "-"}
              </Typography>
              <Typography variant="body2">
                {st.addressFull || "-"}
                {st.zone ? ` · โซน ${st.zone}` : ""}
              </Typography>
              {st.lat || st.lng ? <Box>{mapCell(st)}</Box> : null}
              {machinesBySite.get(st.id)?.length ? (
                <Box sx={{ mt: 0.5 }}>
                  <Typography variant="body2" component="span">
                    เครื่อง:{" "}
                  </Typography>
                  {machinesCell(st)}
                </Box>
              ) : null}
              {actions(st)}
            </Box>
          )}
        />
      )}

      <Dialog open={showForm} onClose={busy ? undefined : () => setShowForm(false)} fullScreen={fullScreen} maxWidth="md" aria-labelledby="site-form-title">
        <Box component="form" noValidate onSubmit={submit}>
          <DialogTitle id="site-form-title">{editingId ? "แก้ไขสาขา" : "เพิ่มสาขา"}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={g}>
                <TextField
                  id="site-branchNo"
                  label="เลขสาขา"
                  value={form.branchNo}
                  onChange={(e) => {
                    set("branchNo", e.target.value);
                    setBranchErr(null);
                  }}
                  placeholder="เช่น 00, 01"
                  // เก็บเป็นข้อความเสมอ — ไม่ใช้ type=number เพื่อไม่ตัดเลข 0 นำหน้า
                  inputProps={{ inputMode: "numeric" }}
                  error={!!(branchErr || fErr("branchNo"))}
                  helperText={branchErr || fErr("branchNo") || "ตัวเลข 2 หลัก เช่น 00 หรือ 01"}
                />
              </Grid>
              <Grid size={g}>
                <TextField
                  id="site-storeName"
                  label="ชื่อร้าน / ชื่อสาขา"
                  value={form.storeName}
                  onChange={(e) => set("storeName", e.target.value)}
                  placeholder="เช่น Happy cafe Siam"
                  error={!!fErr("storeName")}
                  helperText={fErr("storeName") || "ต้องมีชื่อร้านหรือเลขสาขาอย่างน้อยหนึ่งอย่าง"}
                />
              </Grid>
              <Grid size={g}>
                <TextField label="ผู้ติดต่อ" value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} />
              </Grid>
              <Grid size={g}>
                <TextField label="เบอร์โทร" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} error={!!fErr("phone")} helperText={fErr("phone")} />
              </Grid>
              <Grid size={12}>
                <TextField label="ที่อยู่" value={form.address} onChange={(e) => set("address", e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="อำเภอ/เขต" value={form.district} onChange={(e) => set("district", e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="จังหวัด" value={form.province} onChange={(e) => set("province", e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="รหัสไปรษณีย์"
                  inputProps={{ inputMode: "numeric" }}
                  value={form.postcode}
                  onChange={(e) => set("postcode", e.target.value)}
                  error={!!fErr("postcode")}
                  helperText={fErr("postcode")}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="โซนบริการ" value={form.zone} onChange={(e) => set("zone", e.target.value)} />
              </Grid>
              <Grid size={{ xs: 6, sm: 4 }}>
                <TextField label="ละติจูด" inputProps={{ inputMode: "decimal" }} value={form.lat || ""} onChange={(e) => set("lat", Number(e.target.value) || 0)} />
              </Grid>
              <Grid size={{ xs: 6, sm: 4 }}>
                <TextField label="ลองจิจูด" inputProps={{ inputMode: "decimal" }} value={form.lng || ""} onChange={(e) => set("lng", Number(e.target.value) || 0)} />
              </Grid>
              <Grid size={12}>
                <TextField label="หมายเหตุ" value={form.note} onChange={(e) => set("note", e.target.value)} />
              </Grid>
              {editingId ? (
                <Grid size={12}>
                  <FormControlLabel control={<Switch checked={form.active} onChange={(e) => set("active", e.target.checked)} />} label="ใช้งานอยู่" />
                </Grid>
              ) : null}
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              disabled={busy}
            >
              ยกเลิก
            </Button>
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? "กำลังบันทึก…" : editingId ? "บันทึกการแก้ไข" : "เพิ่มสาขา"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </WomsFormSection>
  );
}
