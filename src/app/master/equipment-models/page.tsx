"use client";
// D-07A: Equipment Model Master — ประเภท → หมวดหมู่ → รุ่น + ราคามาตรฐาน
//   เพิ่ม: ผู้มี master:manage ทำได้ทันที · แก้/ปิดใช้งาน: Admin ส่งคำขออนุมัติ (Manager อนุมัติ) — ไม่ทับราคาโดยไม่ได้รับอนุมัติ
//   ไม่มีการลบ เพื่อคงการอ้างอิงในข้อมูลเครื่องเดิม
// Q-R3-14: ราคา = "ราคาติดตั้งมาตรฐาน" (ไม่ใช่ราคาขายเครื่อง) · ใช้คิดรายรับงานใหม่เฉพาะเมื่อ Manager อนุมัติ (ปุ่ม "อนุมัติราคา")
//   ราคาตัวอย่าง/ที่เพิ่มใหม่ = ยังไม่อนุมัติ · ดูประวัติราคา (เดิม/ใหม่ ผู้ขอ ผู้อนุมัติ วันที่มีผล) ได้ที่ปุ่ม "ประวัติ"
import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { api, ApiError, ApprovalPendingError } from "@/lib/api";
import type { EquipmentModelMaster } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { parseMoney } from "@/components/FieldErrors";
import { loadEquipmentModelRows } from "@/components/EquipmentModelFields";
import { INSTALL_PRICE_LABEL, priceStatusLabel } from "@/lib/installPrice";
import type { EquipmentModelPriceHistoryRow } from "@/lib/types";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { WomsDataTable, WomsFormSection, WomsPageHeader, WomsPermissionGate, type WomsColumn } from "@/components/woms";

const norm = (v: string) => v.trim().replace(/\s+/g, " ").toUpperCase();
const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

function EquipmentModelsPage() {
  const { has } = useAuth();
  const canManage = has("master:manage");
  const canApprovePrice = canManage && has("changes:approve");
  const [history, setHistory] = useState<{ item: EquipmentModelMaster; rows: EquipmentModelPriceHistoryRow[] } | null>(null);
  const toast = useToast();
  const dialog = useDialog();
  const [items, setItems] = useState<EquipmentModelMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [fType, setFType] = useState("");
  const [fCat, setFCat] = useState("");
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ type: "", category: "", model: "", price: "" });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems((await api.listEquipmentModels(showInactive)).items);
      void loadEquipmentModelRows(true);
    } catch (e) {
      setError(errMsg(e, "โหลดข้อมูลไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [showInactive]);
  useEffect(() => {
    void load();
  }, [load]);

  const types = useMemo(() => [...new Set(items.map((i) => i.type))].sort((a, b) => a.localeCompare(b, "th")), [items]);
  const cats = useMemo(() => [...new Set(items.filter((i) => !fType || i.type === fType).map((i) => i.category))].sort((a, b) => a.localeCompare(b, "th")), [items, fType]);
  const formCats = useMemo(() => [...new Set(items.filter((i) => !form.type || norm(i.type) === norm(form.type)).map((i) => i.category))], [items, form.type]);
  const rows = items.filter(
    (i) => (!fType || i.type === fType) && (!fCat || i.category === fCat) && (!q.trim() || norm(i.model).includes(norm(q)))
  );

  const add = async () => {
    setFormErr(null);
    const p = parseMoney(form.price);
    if (!form.type.trim() || !form.category.trim() || !form.model.trim()) return setFormErr("กรอกประเภท หมวดหมู่ และรุ่นให้ครบ");
    if (!form.price.trim() || !p.ok) return setFormErr(p.ok ? `ต้องระบุ${INSTALL_PRICE_LABEL}` : p.message);
    setBusy(true);
    try {
      await api.createEquipmentModel({ type: form.type, category: form.category, model: form.model, standardPrice: p.value });
      toast.success(`เพิ่ม ${form.model} แล้ว`);
      setForm({ type: form.type, category: form.category, model: "", price: form.price });
      await load();
    } catch (e) {
      setFormErr(errMsg(e, "เพิ่มไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const editPrice = async (it: EquipmentModelMaster) => {
    const v = await dialog.prompt({
      title: `${INSTALL_PRICE_LABEL} — ${it.model}`,
      label: "ราคาค่าติดตั้ง (บาท) — ไม่ใช่ราคาขายเครื่อง",
      help: canManage && !has("changes:approve")
        ? "Admin แก้ราคา = ส่งคำขออนุมัติให้ Manager (ราคาเดิมใช้ต่อจนกว่าจะอนุมัติ)"
        : "Manager แก้ราคา = อนุมัติราคาใหม่เป็นราคาติดตั้งมาตรฐานทันที (งานที่บันทึกไปแล้วใช้ราคาเดิม)",
      type: "number",
      defaultValue: String(it.standardPrice ?? 0),
      confirmLabel: "บันทึก",
      validate: (x) => {
        const r = parseMoney(x);
        return r.ok ? null : r.message;
      },
    });
    if (v === null) return;
    const p = parseMoney(v);
    try {
      await api.updateEquipmentModel(it.id, { standardPrice: p.ok ? p.value : it.standardPrice ?? 0, updatedAt: it.updatedAt });
      toast.success("บันทึกราคาแล้ว");
      await load();
    } catch (e) {
      if (e instanceof ApprovalPendingError) return toast.info(e.message);
      toast.error(errMsg(e, "บันทึกไม่สำเร็จ"));
    }
  };

  const approvePrice = async (it: EquipmentModelMaster) => {
    const price = it.standardPrice ?? 0;
    if (
      !(await dialog.confirm({
        title: `อนุมัติ${INSTALL_PRICE_LABEL} — ${it.model}`,
        message: `ยืนยันว่า ${price.toLocaleString("th-TH")} บาท คือ "ราคาค่าติดตั้งมาตรฐาน" ของ ${it.type} / ${it.category} / ${it.model} (ไม่ใช่ราคาขายเครื่อง) และให้ใช้คิดรายรับติดตั้งของงานใหม่ตั้งแต่นี้ไป — งานที่บันทึกไปแล้วไม่เปลี่ยน`,
        confirmLabel: "อนุมัติราคา",
      }))
    )
      return;
    try {
      await api.approveEquipmentModelPrice(it.id, { updatedAt: it.updatedAt, standardPrice: price });
      toast.success(`อนุมัติราคาติดตั้งมาตรฐาน ${it.model} แล้ว`);
      await load();
    } catch (e) {
      toast.error(errMsg(e, "อนุมัติไม่สำเร็จ"));
    }
  };

  const openHistory = async (it: EquipmentModelMaster) => {
    try {
      setHistory({ item: it, rows: (await api.equipmentModelPriceHistory(it.id)).items });
    } catch (e) {
      toast.error(errMsg(e, "โหลดประวัติราคาไม่สำเร็จ"));
    }
  };

  const toggle = async (it: EquipmentModelMaster) => {
    if (
      !(await dialog.confirm({
        title: `${it.active ? "ปิด" : "เปิด"}ใช้งาน ${it.model}?`,
        message: it.active ? "ปิดใช้งานแล้วจะไม่อยู่ในตัวเลือก แต่เครื่องที่อ้างรุ่นนี้อยู่แล้วไม่เปลี่ยน" : "เปิดใช้งานอีกครั้ง",
        confirmLabel: "ยืนยัน",
      }))
    )
      return;
    try {
      await api.setEquipmentModelActive(it.id, !it.active, it.updatedAt);
      toast.success("บันทึกแล้ว");
      await load();
    } catch (e) {
      if (e instanceof ApprovalPendingError) return toast.info(e.message);
      toast.error(errMsg(e, "บันทึกไม่สำเร็จ"));
    }
  };

  const columns: WomsColumn<EquipmentModelMaster>[] = [
    { key: "type", label: "ประเภท", sortValue: (i) => i.type, render: (i) => i.type },
    { key: "category", label: "หมวดหมู่", sortValue: (i) => i.category, render: (i) => i.category },
    {
      key: "model",
      label: "รุ่น",
      sortValue: (i) => i.model,
      render: (i) => (
        <span className="mono">
          {i.model} {i.active ? null : <Chip size="small" label="ปิดใช้งาน" sx={{ ml: 0.5 }} />}
        </span>
      ),
    },
    { key: "price", label: `${INSTALL_PRICE_LABEL} (บาท)`, align: "right", sortValue: (i) => i.standardPrice ?? 0, render: (i) => <span className="mono">{typeof i.standardPrice === "number" ? i.standardPrice.toLocaleString("th-TH") : "—"}</span> },
    {
      key: "priceStatus",
      label: "สถานะราคา",
      sortValue: (i) => i.priceStatus ?? "UNAPPROVED",
      render: (i) => (
        <Chip
          size="small"
          data-testid={`eqm-price-status-${i.id}`}
          color={i.priceStatus === "APPROVED" ? "success" : "warning"}
          variant={i.priceStatus === "APPROVED" ? "filled" : "outlined"}
          label={i.priceStatus === "APPROVED" ? "อนุมัติแล้ว" : "ยังไม่อนุมัติ"}
          title={i.priceStatus === "APPROVED" && i.priceApprovedBy ? `อนุมัติโดย ${i.priceApprovedBy} · ฉบับที่ ${i.priceVersion ?? 1}` : priceStatusLabel(i.priceStatus)}
        />
      ),
    },
    ...(canManage
      ? [
          {
            key: "act",
            label: "จัดการ",
            align: "right",
            render: (i: EquipmentModelMaster) => (
              <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ "& .MuiButton-root": { whiteSpace: "nowrap", minWidth: 0 } }}>
                {canApprovePrice && i.active && i.priceStatus !== "APPROVED" && typeof i.standardPrice === "number" && i.standardPrice > 0 ? (
                  <Button size="small" color="success" onClick={() => approvePrice(i)} data-testid={`eqm-approve-${i.id}`}>
                    อนุมัติราคา
                  </Button>
                ) : null}
                <Button size="small" onClick={() => openHistory(i)} data-testid={`eqm-history-${i.id}`}>
                  ประวัติ
                </Button>
                <Button size="small" onClick={() => editPrice(i)} disabled={!i.active}>
                  แก้ราคา
                </Button>
                <Button size="small" color={i.active ? "error" : "primary"} onClick={() => toggle(i)}>
                  {i.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                </Button>
              </Stack>
            ),
          } as WomsColumn<EquipmentModelMaster>,
        ]
      : []),
  ];

  return (
    <>
      <WomsPageHeader title="รุ่นเครื่อง (ข้อมูลหลัก)" subtitle={`ประเภท → หมวดหมู่ → รุ่น + ${INSTALL_PRICE_LABEL} · ใช้กรองตัวเลือกและเติมค่าอัตโนมัติในฟอร์มเครื่อง/คิว`} />
      <Alert severity="info" sx={{ mb: 2 }} data-testid="eqm-price-note">
        {INSTALL_PRICE_LABEL} = ราคาค่าติดตั้ง/บริการต่อชุด ประเภท + หมวดหมู่ + รุ่น (ไม่ใช่ราคาขายเครื่อง) · ใช้คิดรายรับติดตั้งของงานใหม่เฉพาะราคาที่
        Manager อนุมัติแล้ว — ระบบบันทึกราคา ณ ตอนเพิ่มเครื่องเข้าใบงาน งานเดิมไม่ถูกคำนวณใหม่ · ราคาตัวอย่างที่นำเข้ายังไม่อนุมัติ
      </Alert>
      {canManage ? (
        <WomsFormSection title="เพิ่มรุ่น">
          <Grid container spacing={1.5} data-testid="eqm-add-form">
            <Grid size={{ xs: 12, sm: 3 }}>
              <Autocomplete freeSolo options={types} inputValue={form.type} onInputChange={(_, v) => setForm((f) => ({ ...f, type: v }))} renderInput={(p) => <TextField {...p} label="ประเภท" required inputProps={{ ...p.inputProps, "data-testid": "eqm-add-type" }} />} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Autocomplete freeSolo options={formCats} inputValue={form.category} onInputChange={(_, v) => setForm((f) => ({ ...f, category: v }))} renderInput={(p) => <TextField {...p} label="หมวดหมู่" required inputProps={{ ...p.inputProps, "data-testid": "eqm-add-category" }} />} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField fullWidth label="รุ่น" required value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} inputProps={{ "data-testid": "eqm-add-model" }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 2 }}>
              <TextField fullWidth label={`${INSTALL_PRICE_LABEL} (บาท)`} required value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} inputProps={{ inputMode: "decimal", "data-testid": "eqm-add-price" }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 1 }}>
              <Button variant="contained" fullWidth sx={{ height: "100%" }} onClick={add} disabled={busy} data-testid="eqm-add-submit">
                เพิ่ม
              </Button>
            </Grid>
            {formErr ? (
              <Grid size={12}>
                <Alert severity="error" data-testid="eqm-add-error">
                  {formErr}
                </Alert>
              </Grid>
            ) : null}
          </Grid>
        </WomsFormSection>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>
          ดูได้อย่างเดียว — เพิ่ม/แก้ไขโดยผู้ดูแลข้อมูลพื้นฐาน
        </Alert>
      )}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ my: 2 }} alignItems={{ sm: "center" }}>
        <TextField select size="small" label="ประเภท" value={fType} onChange={(e) => (setFType(e.target.value), setFCat(""))} sx={{ minWidth: 180 }} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
          <MenuItem value="">ทั้งหมด</MenuItem>
          {types.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="หมวดหมู่" value={fCat} onChange={(e) => setFCat(e.target.value)} sx={{ minWidth: 180 }} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
          <MenuItem value="">ทั้งหมด</MenuItem>
          {cats.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>
        <TextField size="small" label="ค้นหารุ่น" value={q} onChange={(e) => setQ(e.target.value)} />
        <FormControlLabel control={<Switch checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />} label="แสดงที่ปิดใช้งาน" />
      </Stack>
      <WomsDataTable
        caption="รุ่นเครื่อง"
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        columns={columns}
        rowKey={(i) => i.id}
        pageSize={25}
        emptyTitle="ยังไม่มีรุ่นในข้อมูลหลัก"
        renderCard={(i) => (
          <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
            <Typography sx={{ fontWeight: 600 }}>{i.model}</Typography>
            <Typography variant="body2">
              {i.type} / {i.category}{typeof i.standardPrice === "number" ? ` · ${INSTALL_PRICE_LABEL} ${i.standardPrice.toLocaleString("th-TH")} บาท` : ""}{i.active ? "" : " · ปิดใช้งาน"}
            </Typography>
            <Chip size="small" sx={{ mt: 0.5 }} color={i.priceStatus === "APPROVED" ? "success" : "warning"} variant="outlined" label={priceStatusLabel(i.priceStatus)} />
            {canManage ? (
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                {canApprovePrice && i.active && i.priceStatus !== "APPROVED" && typeof i.standardPrice === "number" && i.standardPrice > 0 ? (
                  <Button size="small" color="success" onClick={() => approvePrice(i)}>
                    อนุมัติราคา
                  </Button>
                ) : null}
                <Button size="small" onClick={() => openHistory(i)}>
                  ประวัติ
                </Button>
                <Button size="small" onClick={() => editPrice(i)} disabled={!i.active}>
                  แก้ราคา
                </Button>
              </Stack>
            ) : null}
          </Box>
        )}
      />
      <Dialog open={!!history} onClose={() => setHistory(null)} fullWidth maxWidth="md" aria-labelledby="eqm-history-title">
        <DialogTitle id="eqm-history-title">
          ประวัติ{INSTALL_PRICE_LABEL} — {history?.item.type} / {history?.item.category} / {history?.item.model}
        </DialogTitle>
        <DialogContent data-testid="eqm-history-dialog">
          {history && history.rows.length === 0 ? <Typography variant="body2">ยังไม่มีประวัติ</Typography> : null}
          <Box component="ol" sx={{ m: 0, pl: 2 }}>
            {history?.rows.map((h) => (
              <li key={h.id}>
                <Typography variant="body2">
                  <span className="mono">{h.effectiveAt.slice(0, 16).replace("T", " ")}</span> · ฉบับที่ {h.priceVersion} ·{" "}
                  {h.oldPrice === null ? "" : `${h.oldPrice?.toLocaleString("th-TH") ?? "—"} → `}
                  {h.newPrice?.toLocaleString("th-TH") ?? "—"} บาท · {h.newStatus === "APPROVED" ? "อนุมัติแล้ว" : "ยังไม่อนุมัติ"} · ผู้ขอ {h.requestedBy || "-"}
                  {h.approvedBy ? ` · ผู้อนุมัติ ${h.approvedBy}` : ""}
                  {h.requestNo ? ` · ${h.requestNo}` : ""} — {h.note}
                </Typography>
              </li>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistory(null)}>ปิด</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default function Page() {
  return (
    <WomsPermissionGate anyOf={["master:manage", "master:view"]}>
      <EquipmentModelsPage />
    </WomsPermissionGate>
  );
}
