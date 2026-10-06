"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { MasterItem, MasterKind } from "@/lib/types";
import { masterLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";
import BulkImport from "@/components/BulkImport";
import { useDialog } from "@/components/Dialog";
import { parseMoney } from "@/components/FieldErrors";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { WomsDataTable, WomsFormSection, type WomsColumn } from "@/components/woms";

export default function MasterManager({ kind }: { kind: MasterKind }) {
  const label = masterLabel[kind];
  const toast = useToast();

  const dialog = useDialog();
  const [items, setItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // add form
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);
  // IDX-01 — รุ่นใหม่กรอกประเภทเครื่อง + ราคาค่าติดตั้ง/บริการมาตรฐานได้ในขั้นตอนเดียว (ไม่บังคับ)
  const [newType, setNewType] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [priceErr, setPriceErr] = useState<string | null>(null);

  // inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const msg = (e: unknown, fallback: string) =>
    e instanceof ApiError ? e.message : fallback;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listMaster(kind);
      setItems(res.items);
    } catch (e) {
      // keep the load failure inline (persistent) since the table has no data to show
      setError(msg(e, "โหลดข้อมูลไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const v = newValue.trim();
    if (!v) return;
    let price = 0;
    if (kind === "model" && newPrice.trim()) {
      const parsed = parseMoney(newPrice);
      if (!parsed.ok) {
        setPriceErr(parsed.message);
        return;
      }
      price = parsed.value;
    }
    setPriceErr(null);
    setAdding(true);
    try {
      const created = await api.createMaster(kind, v);
      if (kind === "model" && (newType.trim() || price)) {
        try {
          await api.setModelIndex(created.id, newType.trim(), price);
        } catch (e) {
          // รุ่นถูกเพิ่มแล้ว — แจ้งให้ตั้งประเภท/ราคาจากปุ่มในตารางอีกครั้ง ไม่ลบรุ่นทิ้ง
          toast.error(`เพิ่มรุ่นแล้ว แต่บันทึกประเภท/ราคาไม่สำเร็จ: ${msg(e, "ลองใหม่จากปุ่ม “ประเภท/ราคา”")}`);
        }
      }
      setNewValue("");
      setNewType("");
      setNewPrice("");
      await load();
      toast.success(`เพิ่ม${label} "${v}" แล้ว`);
    } catch (e) {
      toast.error(msg(e, "เพิ่มไม่สำเร็จ"));
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (item: MasterItem) => {
    setEditId(item.id);
    setEditValue(item.value);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditValue("");
  };

  const saveEdit = async (id: string) => {
    const v = editValue.trim();
    if (!v) return;
    const old = items.find((x) => x.id === id)?.value;
    if (old === v) return cancelEdit();
    // การเปลี่ยนชื่อค่า master มีผลย้อนหลัง: backend เปลี่ยนข้อความในข้อมูลที่อ้างถึงค่านี้ทั้งหมด
    // (renameReferences — รวมใบงานที่ปิดแล้ว) จึงต้องบอกผู้ใช้ก่อน ไม่ให้เกิดขึ้นเงียบ ๆ
    if (
      !(await dialog.confirm({
        title: `เปลี่ยน "${old}" เป็น "${v}"?`,
        message: `ระบบจะเปลี่ยนข้อความ${label}นี้ในข้อมูลเดิมทั้งหมดที่ใช้ค่านี้ด้วย (รวมใบงาน/เครื่องที่บันทึกไปแล้ว) — ถ้าต้องการแค่เพิ่มตัวเลือกใหม่ ให้ใช้ "เพิ่ม" แทน`,
        confirmLabel: "เปลี่ยนชื่อ",
      }))
    )
      return;
    setSavingId(id);
    try {
      await api.updateMaster(kind, id, v);
      cancelEdit();
      await load();
      toast.success("บันทึกแล้ว");
    } catch (e) {
      toast.error(msg(e, "บันทึกไม่สำเร็จ"));
    } finally {
      setSavingId(null);
    }
  };

  // IDX-01: แก้ประเภทเครื่อง + ราคามาตรฐานของรุ่น (ใช้ dialog 2 ขั้นเพื่อไม่ต้องเพิ่มฟอร์มใหม่)
  const editIndex = async (item: MasterItem) => {
    const type = await dialog.prompt({
      title: `ประเภทเครื่องของรุ่น ${item.value}`,
      label: "ประเภทเครื่อง",
      help: "เช่น เครื่องทำน้ำแข็ง, ตู้นอน, ตู้ยืน",
      defaultValue: item.machineType ?? "",
      confirmLabel: "ถัดไป",
    });
    if (type === null) return;
    const price = await dialog.prompt({
      title: `ราคาค่าติดตั้ง/บริการมาตรฐาน — ${item.value}`,
      label: "ราคา (บาท)",
      help: "เป็นราคามาตรฐานของงานบริการ ไม่ใช่ราคาขายเครื่อง",
      type: "number",
      defaultValue: String(item.standardPrice ?? 0),
      confirmLabel: "บันทึก",
      // กติกาเงินเดียวทั้งระบบ (QA BUG-011) — ไม่รับ 1e5 / abc
      validate: (v) => {
        const r = parseMoney(v);
        return r.ok ? null : r.message;
      },
    });
    if (price === null) return;
    setSavingId(item.id);
    try {
      const parsed = parseMoney(price);
      await api.setModelIndex(item.id, type.trim(), parsed.ok ? parsed.value : 0);
      await load();
      toast.success("บันทึก Model Index แล้ว");
    } catch (e) {
      toast.error(msg(e, "บันทึกไม่สำเร็จ"));
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (item: MasterItem) => {
    if (deletingId) return;
    if (
      !(await dialog.confirm({
        title: `ลบ "${item.value}"?`,
        message: "ลบได้เฉพาะค่าที่ไม่มีใบงาน เครื่อง สัญญา หรือผู้ใช้อ้างอิงอยู่ — ถ้ายังมีการใช้งาน ระบบจะแจ้งจำนวนที่อ้างอิงไว้",
        confirmLabel: "ยืนยันลบ",
        danger: true,
      }))
    )
      return;
    setDeletingId(item.id);
    try {
      await api.deleteMaster(kind, item.id);
      await load();
      toast.success(`ลบ "${item.value}" แล้ว`);
    } catch (e) {
      toast.error(msg(e, "ลบไม่สำเร็จ"));
    } finally {
      setDeletingId(null);
    }
  };

  const valueCell = (it: MasterItem) =>
    editId === it.id ? (
      <TextField
        size="small"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && savingId !== it.id) saveEdit(it.id);
          if (e.key === "Escape") cancelEdit();
        }}
        autoFocus
        inputProps={{ "aria-label": `แก้ไข${label}` }}
      />
    ) : (
      it.value
    );
  const actions = (it: MasterItem) =>
    editId === it.id ? (
      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
        <Button size="small" variant="contained" onClick={() => saveEdit(it.id)} disabled={savingId === it.id || !editValue.trim()}>
          {savingId === it.id ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
        <Button size="small" onClick={cancelEdit}>
          ยกเลิก
        </Button>
      </Stack>
    ) : (
      <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
        <Button size="small" onClick={() => startEdit(it)}>
          แก้ไข
        </Button>
        {kind === "model" ? (
          <Button size="small" onClick={() => editIndex(it)} disabled={savingId === it.id}>
            ประเภท/ราคา
          </Button>
        ) : null}
        <Button size="small" color="error" onClick={() => remove(it)} disabled={deletingId === it.id}>
          {deletingId === it.id ? "กำลังลบ…" : "ลบ"}
        </Button>
      </Stack>
    );
  const columns: WomsColumn<MasterItem>[] = [
    { key: "value", label, sortValue: (it) => it.value, render: valueCell },
    ...(kind === "model"
      ? ([
          { key: "type", label: "ประเภทเครื่อง", sortValue: (it: MasterItem) => it.machineType || "", render: (it: MasterItem) => it.machineType || "—" },
          {
            key: "price",
            label: "ราคามาตรฐาน (บาท)",
            align: "right",
            sortValue: (it: MasterItem) => it.standardPrice ?? 0,
            render: (it: MasterItem) => <span className="mono">{(it.standardPrice ?? 0).toLocaleString("th-TH")}</span>,
          },
        ] as WomsColumn<MasterItem>[])
      : []),
    { key: "act", label: "จัดการ", align: "right", render: actions },
  ];

  return (
    <>
      <WomsFormSection
        title={`เพิ่ม${label}`}
        actions={
          <BulkImport<string>
            label={label}
            templateName={`master-${kind}-template.xlsx`}
            perm="master:manage"
            headers={[label]}
            example={[`ตัวอย่าง${label}`]}
            toValues={(r) => {
              const v = (r[label] || Object.values(r)[0] || "").trim();
              return v ? { ok: true, value: v } : { ok: false, error: "ค่าว่าง" };
            }}
            create={(v) => api.createMaster(kind, v)}
            onDone={load}
          />
        }
      >
        <Stack
          component="form"
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            if (!adding) add();
          }}
        >
          <TextField label={`ชื่อ${label}ใหม่`} value={newValue} onChange={(e) => setNewValue(e.target.value)} />
          {kind === "model" ? (
            <>
              <TextField label="ประเภทเครื่อง" placeholder="เช่น เครื่องทำน้ำแข็ง, ตู้นอน" value={newType} onChange={(e) => setNewType(e.target.value)} />
              <TextField
                label="ราคาติดตั้ง/บริการมาตรฐาน (บาท)"
                inputProps={{ inputMode: "decimal" }}
                value={newPrice}
                onChange={(e) => {
                  setNewPrice(e.target.value);
                  setPriceErr(null);
                }}
                error={!!priceErr}
                helperText={priceErr || "ไม่ใช่ราคาขายเครื่อง"}
              />
            </>
          ) : null}
          <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={adding || !newValue.trim()} sx={{ flexShrink: 0, minHeight: 40 }}>
            {adding ? "กำลังเพิ่ม…" : "เพิ่ม"}
          </Button>
        </Stack>
      </WomsFormSection>

      <WomsDataTable
        caption={label}
        rows={items}
        loading={loading}
        error={error}
        onRetry={load}
        columns={columns}
        rowKey={(it) => it.id}
        pageSize={25}
        emptyTitle={`ยังไม่มี${label} — เพิ่มรายการแรกด้านบน`}
        renderCard={(it) => (
          <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
            <Typography component="div" sx={{ fontWeight: 600, color: "text.primary" }}>
              {valueCell(it)}
            </Typography>
            {kind === "model" ? (
              <Typography variant="body2">
                {it.machineType || "—"} · {(it.standardPrice ?? 0).toLocaleString("th-TH")} บาท
              </Typography>
            ) : null}
            <Box sx={{ mt: 1 }}>{actions(it)}</Box>
          </Box>
        )}
      />
    </>
  );
}
