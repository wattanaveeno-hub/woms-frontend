"use client";
// D-07A: Equipment Model Master — ประเภท → หมวดหมู่ → รุ่น + ต้นทุนมาตรฐาน
//   เพิ่ม: ผู้มี master:manage ทำได้ทันที · แก้/ปิดใช้งาน: Admin ส่งคำขออนุมัติ (Manager อนุมัติ) — ไม่ทับค่าโดยไม่ได้รับอนุมัติ
//   ไม่มีการลบ เพื่อคงการอ้างอิงในข้อมูลเครื่องเดิม
// owner decision 30 ต.ค. 69: ค่าเงินของรุ่น = ต้นทุนมาตรฐาน (ค่าอ้างอิงเปรียบเทียบ) — ไม่ใช่ค่าติดตั้ง/ราคาขาย/รายรับ
//   แสดงเฉพาะผู้มีสิทธิ์ดูต้นทุน (parts:cost_view) · ปุ่ม "อนุมัติต้นทุนมาตรฐาน" (Manager) · "ประวัติต้นทุนมาตรฐาน"
// P-09: ชื่อรุ่นหน้าตาคล้ายรายการอื่น → แสดงรายชื่อที่คล้าย · Manager ยืนยัน "เป็นคนละรุ่น" ได้ · รายการกลุ่มชื่อคล้ายให้ตรวจ
import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
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
import { costStatusLabel, STANDARD_COST_FIELD_LABEL, STANDARD_COST_LABEL, STANDARD_COST_NOT_IN_PROFIT } from "@/lib/installPrice";
import type { EquipmentModelPriceHistoryRow } from "@/lib/types";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { WomsDataTable, WomsFormSection, WomsPageHeader, WomsPermissionGate, type WomsColumn } from "@/components/woms";

const norm = (v: string) => v.trim().replace(/\s+/g, " ").toUpperCase();
type Similar = { id: string; type: string; category: string; model: string; active: boolean };
type ConfusableGroup = { type: string; category: string; skeleton: string; items: Similar[] };
/** ข้อมูล 409 CONFUSABLE_MODEL_NAME จาก API */
function confusableOf(e: unknown): { message: string; similar: Similar[]; canAcknowledge: boolean } | null {
  if (!(e instanceof ApiError) || e.code !== "CONFUSABLE_MODEL_NAME") return null;
  const b = (e.body ?? {}) as { similar?: Similar[]; canAcknowledge?: boolean };
  return { message: e.message, similar: b.similar ?? [], canAcknowledge: !!b.canAcknowledge };
}
/** แสดงอักขระที่ไม่ใช่ ASCII เป็นรหัส (U+XXXX) ต่อท้าย — ให้เห็นว่าชื่อที่ "ดูเหมือนกัน" ต่างกันตรงไหน */
function visibleName(s: string): string {
  const odd = [...s].filter((c) => c.charCodeAt(0) > 0x7e && !(c.charCodeAt(0) >= 0x0e00 && c.charCodeAt(0) <= 0x0e7f)).map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`);
  return odd.length ? `${s} [${[...new Set(odd)].join(" ")}]` : s;
}
const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

function EquipmentModelsPage() {
  const { has } = useAuth();
  const canManage = has("master:manage");
  const canApprovePrice = canManage && has("changes:approve");
  const canSeeCost = has("parts:cost_view");
  const [history, setHistory] = useState<{ item: EquipmentModelMaster; rows: EquipmentModelPriceHistoryRow[] } | null>(null);
  // P-09: คำเตือนชื่อรุ่นคล้าย (409 CONFUSABLE_MODEL_NAME) + ทำซ้ำพร้อมการยืนยัน
  const [similar, setSimilar] = useState<{ message: string; items: Similar[]; retry: (() => Promise<void>) | null; retryLabel: string } | null>(null);
  const [groups, setGroups] = useState<ConfusableGroup[]>([]);
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
      void api
        .equipmentModelConfusables()
        .then((r) => setGroups(r.groups))
        .catch(() => setGroups([]));
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
    if (!form.price.trim() || !p.ok) return setFormErr(p.ok ? `ต้องระบุ${STANDARD_COST_LABEL}` : p.message);
    setBusy(true);
    const body = { type: form.type, category: form.category, model: form.model, standardCost: p.value };
    const done = async () => {
      toast.success(`เพิ่ม ${form.model} แล้ว`);
      setForm({ type: form.type, category: form.category, model: "", price: form.price });
      await load();
    };
    try {
      await api.createEquipmentModel(body);
      await done();
    } catch (e) {
      const c = confusableOf(e);
      if (c) {
        setSimilar({
          message: c.message,
          items: c.similar,
          // ยืนยันได้เฉพาะ Manager — Admin ให้ Manager เป็นผู้เพิ่มรุ่นนี้
          retry: c.canAcknowledge
            ? async () => {
                await api.createEquipmentModel({ ...body, acknowledgeSimilar: true });
                await done();
              }
            : null,
          retryLabel: "ยืนยันว่าเป็นคนละรุ่น",
        });
      } else setFormErr(errMsg(e, "เพิ่มไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const rename = async (it: EquipmentModelMaster) => {
    const v = await dialog.prompt({
      title: `แก้ชื่อรุ่น — ${it.type} / ${it.category}`,
      label: "รุ่น",
      help: canApprovePrice ? "Manager แก้ได้ทันที" : "Admin แก้ = ส่งคำขออนุมัติให้ Manager",
      defaultValue: it.model,
      confirmLabel: "บันทึก",
      validate: (x) => (x.trim() ? null : "ต้องระบุรุ่น"),
    });
    if (v === null || v.trim() === it.model) return;
    const send = async (ack: boolean) => {
      await api.updateEquipmentModel(it.id, { model: v.trim(), updatedAt: it.updatedAt, ...(ack ? { acknowledgeSimilar: true } : {}) });
      toast.success("บันทึกแล้ว");
      await load();
    };
    try {
      await send(false);
    } catch (e) {
      if (e instanceof ApprovalPendingError) return toast.info(e.message);
      const c = confusableOf(e);
      if (c) {
        setSimilar({
          message: c.message,
          items: c.similar,
          retry: async () => {
            try {
              await send(true);
            } catch (e2) {
              if (e2 instanceof ApprovalPendingError) {
                toast.info(e2.message);
                return;
              }
              throw e2;
            }
          },
          // Manager ยืนยันเอง · Admin ส่งคำขอพร้อมคำเตือนให้ Manager ตรวจตอนอนุมัติ
          retryLabel: c.canAcknowledge ? "ยืนยันว่าเป็นคนละรุ่น" : "ส่งคำขอพร้อมคำเตือนให้ Manager ตรวจ",
        });
      } else toast.error(errMsg(e, "บันทึกไม่สำเร็จ"));
    }
  };

  const editPrice = async (it: EquipmentModelMaster) => {
    const v = await dialog.prompt({
      title: `${STANDARD_COST_LABEL} — ${it.model}`,
      label: STANDARD_COST_FIELD_LABEL,
      help: canManage && !has("changes:approve")
        ? "Admin แก้ต้นทุนมาตรฐาน = ส่งคำขออนุมัติให้ Manager (ค่าเดิมใช้ต่อจนกว่าจะอนุมัติ)"
        : "Manager แก้ต้นทุนมาตรฐาน = อนุมัติค่าใหม่ทันที (รายการเครื่องที่บันทึกไปแล้วเก็บค่าเดิม)",
      type: "number",
      defaultValue: String(it.standardCost ?? 0),
      confirmLabel: "บันทึก",
      validate: (x) => {
        const r = parseMoney(x);
        return r.ok ? null : r.message;
      },
    });
    if (v === null) return;
    const p = parseMoney(v);
    try {
      await api.updateEquipmentModel(it.id, { standardCost: p.ok ? p.value : it.standardCost ?? 0, updatedAt: it.updatedAt });
      toast.success("บันทึกต้นทุนมาตรฐานแล้ว");
      await load();
    } catch (e) {
      if (e instanceof ApprovalPendingError) return toast.info(e.message);
      toast.error(errMsg(e, "บันทึกไม่สำเร็จ"));
    }
  };

  const approvePrice = async (it: EquipmentModelMaster) => {
    const cost = it.standardCost ?? 0;
    if (
      !(await dialog.confirm({
        title: `อนุมัติต้นทุนมาตรฐาน — ${it.model}`,
        message: `ยืนยันว่า ${cost.toLocaleString("th-TH")} บาท คือ "ต้นทุนมาตรฐาน" ของ ${it.type} / ${it.category} / ${it.model} — ${STANDARD_COST_NOT_IN_PROFIT} (ไม่ใช่ราคาค่าติดตั้ง) · รายการเครื่องที่บันทึกไปแล้วไม่เปลี่ยน`,
        confirmLabel: "อนุมัติต้นทุนมาตรฐาน",
      }))
    )
      return;
    try {
      await api.approveEquipmentModelCost(it.id, { updatedAt: it.updatedAt, standardCost: cost });
      toast.success(`อนุมัติต้นทุนมาตรฐาน ${it.model} แล้ว`);
      await load();
    } catch (e) {
      toast.error(errMsg(e, "อนุมัติไม่สำเร็จ"));
    }
  };

  const openHistory = async (it: EquipmentModelMaster) => {
    try {
      setHistory({ item: it, rows: (await api.equipmentModelCostHistory(it.id)).items });
    } catch (e) {
      toast.error(errMsg(e, "โหลดประวัติต้นทุนมาตรฐานไม่สำเร็จ"));
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
    // ต้นทุนมาตรฐาน = ข้อมูลต้นทุน — คอลัมน์แสดงเฉพาะผู้มีสิทธิ์ดูต้นทุน
    ...(canSeeCost
      ? ([
          {
            key: "cost",
            label: STANDARD_COST_FIELD_LABEL,
            align: "right",
            sortValue: (i: EquipmentModelMaster) => i.standardCost ?? 0,
            render: (i: EquipmentModelMaster) => <span className="mono">{typeof i.standardCost === "number" ? i.standardCost.toLocaleString("th-TH") : "—"}</span>,
          },
        ] as WomsColumn<EquipmentModelMaster>[])
      : []),
    {
      key: "costStatus",
      label: "สถานะต้นทุนมาตรฐาน",
      sortValue: (i) => i.costStatus ?? "UNAPPROVED",
      render: (i) => (
        <Chip
          size="small"
          data-testid={`eqm-cost-status-${i.id}`}
          color={i.costStatus === "APPROVED" ? "success" : "warning"}
          variant={i.costStatus === "APPROVED" ? "filled" : "outlined"}
          label={costStatusLabel(i.costStatus)}
          title={i.costStatus === "APPROVED" && i.costApprovedBy ? `อนุมัติโดย ${i.costApprovedBy} · ฉบับที่ ${i.costVersion ?? 1}` : costStatusLabel(i.costStatus)}
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
                {canApprovePrice && i.active && i.costStatus !== "APPROVED" && typeof i.standardCost === "number" && i.standardCost > 0 ? (
                  <Button size="small" color="success" onClick={() => approvePrice(i)} data-testid={`eqm-approve-${i.id}`}>
                    อนุมัติต้นทุนมาตรฐาน
                  </Button>
                ) : null}
                {canSeeCost ? (
                  <Button size="small" onClick={() => openHistory(i)} data-testid={`eqm-history-${i.id}`}>
                    ประวัติต้นทุนมาตรฐาน
                  </Button>
                ) : null}
                {canSeeCost ? (
                  <Button size="small" onClick={() => editPrice(i)} disabled={!i.active} data-testid={`eqm-edit-cost-${i.id}`}>
                    แก้ต้นทุน
                  </Button>
                ) : null}
                <Button size="small" onClick={() => rename(i)} disabled={!i.active} data-testid={`eqm-rename-${i.id}`}>
                  แก้ชื่อรุ่น
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
      <WomsPageHeader title="รุ่นเครื่อง (ข้อมูลหลัก)" subtitle="ประเภท → หมวดหมู่ → รุ่น · ใช้กรองตัวเลือกและเติมค่าอัตโนมัติในฟอร์มเครื่อง/คิว" />
      {canSeeCost ? (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="eqm-cost-note">
          {STANDARD_COST_LABEL} = ต้นทุนอ้างอิงต่อชุด ประเภท + หมวดหมู่ + รุ่น — {STANDARD_COST_NOT_IN_PROFIT} · ไม่ใช่ราคาค่าติดตั้ง (ราคาค่าติดตั้งอยู่ที่ Model Index)
          · ระบบบันทึกค่า ณ ตอนเพิ่มเครื่องเข้าใบงานเป็นข้อมูลอ้างอิง · ดูได้เฉพาะ Admin และ Manager
        </Alert>
      ) : null}
      {groups.length > 0 ? (
        <Alert severity="warning" sx={{ mb: 2 }} data-testid="eqm-confusable-groups">
          <AlertTitle>ชื่อรุ่นหน้าตาคล้ายกัน — ตรวจว่าเป็นคนละรุ่นจริง ({groups.length} กลุ่ม)</AlertTitle>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {groups.map((g) => (
              <li key={`${g.type}|${g.category}|${g.skeleton}`}>
                {g.type} / {g.category}:{" "}
                {g.items.map((x, k) => (
                  <span key={x.id}>
                    {k ? ", " : ""}
                    <span className="mono">{visibleName(x.model)}</span>
                    {x.active ? "" : " (ปิดใช้งาน)"}
                  </span>
                ))}
              </li>
            ))}
          </Box>
        </Alert>
      ) : null}
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
              <TextField fullWidth label={STANDARD_COST_FIELD_LABEL} required value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} inputProps={{ inputMode: "decimal", "data-testid": "eqm-add-cost" }} />
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
              {i.type} / {i.category}
              {canSeeCost && typeof i.standardCost === "number" ? ` · ${STANDARD_COST_LABEL} ${i.standardCost.toLocaleString("th-TH")} บาท` : ""}
              {i.active ? "" : " · ปิดใช้งาน"}
            </Typography>
            <Chip size="small" sx={{ mt: 0.5 }} color={i.costStatus === "APPROVED" ? "success" : "warning"} variant="outlined" label={costStatusLabel(i.costStatus)} />
            {canManage ? (
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                {canApprovePrice && i.active && i.costStatus !== "APPROVED" && typeof i.standardCost === "number" && i.standardCost > 0 ? (
                  <Button size="small" color="success" onClick={() => approvePrice(i)}>
                    อนุมัติต้นทุนมาตรฐาน
                  </Button>
                ) : null}
                {canSeeCost ? (
                  <Button size="small" onClick={() => openHistory(i)}>
                    ประวัติต้นทุนมาตรฐาน
                  </Button>
                ) : null}
                {canSeeCost ? (
                  <Button size="small" onClick={() => editPrice(i)} disabled={!i.active}>
                    แก้ต้นทุน
                  </Button>
                ) : null}
                <Button size="small" onClick={() => rename(i)} disabled={!i.active}>
                  แก้ชื่อรุ่น
                </Button>
              </Stack>
            ) : null}
          </Box>
        )}
      />
      <Dialog open={!!history} onClose={() => setHistory(null)} fullWidth maxWidth="md" aria-labelledby="eqm-history-title">
        <DialogTitle id="eqm-history-title">
          ประวัติต้นทุนมาตรฐาน — {history?.item.type} / {history?.item.category} / {history?.item.model}
        </DialogTitle>
        <DialogContent data-testid="eqm-history-dialog">
          {history && history.rows.length === 0 ? <Typography variant="body2">ยังไม่มีประวัติ</Typography> : null}
          <Box component="ol" sx={{ m: 0, pl: 2 }}>
            {history?.rows.map((h) => (
              <li key={h.id}>
                <Typography variant="body2">
                  <span className="mono">{h.effectiveAt.slice(0, 16).replace("T", " ")}</span> · ฉบับที่ {h.costVersion} ·{" "}
                  {h.oldCost === null ? "" : `${h.oldCost?.toLocaleString("th-TH") ?? "—"} → `}
                  {h.newCost?.toLocaleString("th-TH") ?? "—"} บาท · {h.newStatus === "APPROVED" ? "อนุมัติแล้ว" : "ยังไม่อนุมัติ"} · ผู้ขอ {h.requestedBy || "-"}
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
      <Dialog open={!!similar} onClose={() => setSimilar(null)} fullWidth maxWidth="sm" aria-labelledby="eqm-similar-title">
        <DialogTitle id="eqm-similar-title">ชื่อรุ่นหน้าตาคล้ายรายการที่มีอยู่</DialogTitle>
        <DialogContent data-testid="eqm-similar-dialog">
          <Typography variant="body2" sx={{ mb: 1 }}>
            {similar?.message}
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {similar?.items.map((x) => (
              <li key={x.id}>
                <span className="mono">{visibleName(x.model)}</span> ({x.type} / {x.category}){x.active ? "" : " · ปิดใช้งาน"}
              </li>
            ))}
          </Box>
          {similar && !similar.retry ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              ยืนยันว่าเป็นคนละรุ่นได้เฉพาะ Manager — แจ้ง Manager ให้ตรวจและเพิ่มรุ่นนี้
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSimilar(null)}>ยกเลิก</Button>
          {similar?.retry ? (
            <Button
              color="warning"
              data-testid="eqm-similar-confirm"
              onClick={async () => {
                const r = similar.retry!;
                setSimilar(null);
                try {
                  await r();
                } catch (e) {
                  toast.error(errMsg(e, "บันทึกไม่สำเร็จ"));
                }
              }}
            >
              {similar.retryLabel}
            </Button>
          ) : null}
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
