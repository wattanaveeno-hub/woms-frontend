"use client";

// ---------------------------------------------------------------------------
// อะไหล่ที่ใช้ในใบงาน — บันทึก "รายเครื่อง" (Round 8: PART-03 / BR-04.2 / JOB-01 งานเปลี่ยนอะไหล่)
// ---------------------------------------------------------------------------
// Admin เลือกอะไหล่ (หรือเพิ่มใหม่ถ้ายังไม่มี) + จำนวน + ราคาซื้อ/ต้นทุนต่อหน่วย ต่อเครื่องในใบงาน
// ช่างเห็นอย่างเดียว (ไม่มีสิทธิ์ jobs:edit) — ไม่ใช่การเบิกจากคลังช่างแบบเดิม (BR-04.2)
// ประวัติการเบิกจากคลังของระบบเดิม (ถ้ามี) ยังแสดงแบบอ่านอย่างเดียวด้านล่าง
import { useCallback, useEffect, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid2";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { parseMoney } from "@/components/FieldErrors";
import type { Part, StockTransaction } from "@/lib/types";
import { bangkokDateTime } from "@/lib/date";
import { baht, partsApi, type JobLineParts, type JobPartUse } from "@/lib/partsApi";
import PartForm from "@/components/PartForm";
import { WomsDataTable, WomsFormSection, type WomsColumn } from "@/components/woms";

const cardBox = { border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 } as const;

type Draft = { partId: string; qty: string; unitCost: string; note: string };
const EMPTY_DRAFT: Draft = { partId: "", qty: "1", unitCost: "", note: "" };

function parseQty(s: string): number | null {
  const n = Number(s.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function JobPartsCard({ jobId }: { jobId: string; closed?: boolean }) {
  const { has } = useAuth();
  const toast = useToast();
  const dialog = useDialog();
  const canEdit = has("jobs:edit");
  const canCreatePart = has("stock:manage");
  // ต้นทุนเป็นข้อมูลการเงินของบริษัท — ช่าง (เห็นเฉพาะงานตัวเอง) ไม่ต้องเห็นราคาซื้อ
  const showCost = has("jobs:view_all");

  const [lines, setLines] = useState<JobLineParts[] | null>(null);
  const [legacy, setLegacy] = useState<StockTransaction[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ lineId: string; use: JobPartUse; qty: string; unitCost: string; note: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await partsApi.jobLines(jobId);
      setLines(r.items);
    } catch (e) {
      // ไม่มีสิทธิ์ดูใบงานนี้ → ซ่อนการ์ด
      setLines([]);
      if (e instanceof ApiError && e.status !== 403) toast.error(e.message);
    }
    api
      .jobParts(jobId)
      .then((r) => setLegacy(r.items))
      .catch(() => setLegacy([]));
    if (canEdit) {
      api
        .listParts({ activeOnly: true })
        .then((r) => setParts(r.items))
        .catch(() => setParts([]));
    }
  }, [jobId, canEdit, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const draftOf = (lineId: string) => drafts[lineId] ?? EMPTY_DRAFT;
  const setDraft = (lineId: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [lineId]: { ...(d[lineId] ?? EMPTY_DRAFT), ...patch } }));

  const replaceLine = (line: JobLineParts) =>
    setLines((ls) => (ls ?? []).map((l) => (l.lineId === line.lineId ? line : l)));

  const add = async (lineId: string) => {
    const d = draftOf(lineId);
    if (!d.partId) return toast.error("เลือกอะไหล่ก่อน");
    const qty = parseQty(d.qty);
    if (qty === null) return toast.error("จำนวนต้องมากกว่า 0");
    const cost = parseMoney(d.unitCost);
    if (!cost.ok) return toast.error(`ราคาซื้อ: ${cost.message}`);
    setBusyLine(lineId);
    try {
      const r = await partsApi.addUse(jobId, lineId, { partId: d.partId, qty, unitCost: cost.value, note: d.note });
      replaceLine(r.line);
      setDrafts((x) => ({ ...x, [lineId]: EMPTY_DRAFT }));
      toast.success(`บันทึกอะไหล่ ${r.use.partCode} แล้ว`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusyLine(null);
    }
  };

  const remove = async (lineId: string, u: JobPartUse) => {
    const ok = await dialog.confirm({
      title: `ลบรายการ ${u.partCode}?`,
      message: `${u.partName} × ${u.qty} ${u.unit} — ระบบจะเก็บประวัติการลบไว้ใน Audit Log`,
      confirmLabel: "ลบรายการ",
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await partsApi.removeUse(jobId, lineId, u.id);
      replaceLine(r.line);
      toast.success("ลบรายการแล้ว");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ลบไม่สำเร็จ");
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const qty = parseQty(editing.qty);
    if (qty === null) return toast.error("จำนวนต้องมากกว่า 0");
    const cost = parseMoney(editing.unitCost);
    if (!cost.ok) return toast.error(`ราคาซื้อ: ${cost.message}`);
    try {
      const r = await partsApi.updateUse(jobId, editing.lineId, editing.use.id, { qty, unitCost: cost.value, note: editing.note });
      replaceLine(r.line);
      setEditing(null);
      toast.success("แก้ไขรายการแล้ว");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "แก้ไขไม่สำเร็จ");
    }
  };

  if (lines === null) return null;
  if (lines.length === 0 && legacy.length === 0) return null;

  const useCols = (lineId: string): WomsColumn<JobPartUse>[] => [
    {
      key: "part",
      label: "อะไหล่",
      sortValue: (u) => u.partCode,
      render: (u) => (
        <>
          <span className="mono">{u.partCode}</span>{" "}
          <Typography component="span" variant="body2">
            {u.partName}
          </Typography>
        </>
      ),
    },
    { key: "qty", label: "จำนวน", align: "right", render: (u) => <span className="mono">{u.qty} {u.unit}</span> },
    ...(showCost
      ? ([
          { key: "cost", label: "ราคาซื้อ/หน่วย", align: "right", render: (u) => <span className="mono">{baht(u.unitCost)}</span> },
          { key: "total", label: "รวม", align: "right", render: (u) => <span className="mono">{baht(u.qty * u.unitCost)}</span> },
        ] as WomsColumn<JobPartUse>[])
      : []),
    { key: "note", label: "หมายเหตุ", hideBelowLg: true, render: (u) => u.note || "—" },
    { key: "by", label: "บันทึกโดย", hideBelowLg: true, render: (u) => `${u.recordedBy} · ${bangkokDateTime(u.recordedAt)}` },
    ...(canEdit
      ? ([
          {
            key: "act",
            label: "",
            align: "right",
            render: (u) => (
              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                <IconButton
                  size="small"
                  aria-label="แก้ไข"
                  onClick={() => setEditing({ lineId, use: u, qty: String(u.qty), unitCost: String(u.unitCost), note: u.note })}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" aria-label="ลบ" color="error" onClick={() => remove(lineId, u)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            ),
          },
        ] as WomsColumn<JobPartUse>[])
      : []),
  ];

  const legacyCols: WomsColumn<StockTransaction>[] = [
    { key: "at", label: "เวลา", render: (t) => <span className="mono">{bangkokDateTime(t.at)}</span> },
    { key: "part", label: "อะไหล่", render: (t) => `${t.partCode} ${t.partName}` },
    { key: "qty", label: "จำนวน", align: "right", render: (t) => <span className="mono">{t.move === "RETURN" ? "+" : "-"}{t.qty}</span> },
    { key: "by", label: "ผู้เบิก", render: (t) => t.byName },
  ];

  return (
    <WomsFormSection title="อะไหล่ที่ใช้ (รายเครื่อง)">
      {lines.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          ใบงานนี้ยังไม่มีเครื่อง — เพิ่มเครื่องในใบงานก่อนจึงบันทึกอะไหล่รายเครื่องได้
        </Typography>
      ) : null}

      <Stack spacing={2}>
        {lines.map((line) => {
          const d = draftOf(line.lineId);
          const selected = parts.find((p) => p.id === d.partId) ?? null;
          return (
            <Box key={line.lineId} sx={cardBox}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
                <Typography sx={{ fontWeight: 600, color: "text.primary" }}>
                  เครื่อง <span className="mono">{line.serial || "—"}</span>
                  {line.model ? ` · ${line.model}` : ""}
                </Typography>
                {showCost ? (
                  <Typography variant="body2" className="mono">
                    ต้นทุนอะไหล่ {baht(line.partsCost)} บาท
                  </Typography>
                ) : null}
              </Stack>

              <WomsDataTable
                caption={`อะไหล่ของเครื่อง ${line.serial}`}
                rows={line.partsUsed}
                columns={useCols(line.lineId)}
                rowKey={(u) => u.id}
                pageSize={10}
                emptyTitle="ยังไม่มีอะไหล่ที่ใช้กับเครื่องนี้"
                renderCard={(u) => (
                  <Box sx={cardBox}>
                    <Typography sx={{ color: "text.primary" }}>
                      <span className="mono">{u.partCode}</span> {u.partName} · <strong className="mono">{u.qty} {u.unit}</strong>
                    </Typography>
                    <Typography variant="body2">
                      {showCost ? `${baht(u.unitCost)} บาท/หน่วย · ` : ""}
                      {u.recordedBy} · {bangkokDateTime(u.recordedAt)}
                    </Typography>
                    {canEdit ? (
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Button size="small" startIcon={<EditIcon />} onClick={() => setEditing({ lineId: line.lineId, use: u, qty: String(u.qty), unitCost: String(u.unitCost), note: u.note })}>
                          แก้ไข
                        </Button>
                        <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => remove(line.lineId, u)}>
                          ลบ
                        </Button>
                      </Stack>
                    ) : null}
                  </Box>
                )}
              />

              {canEdit ? (
                <Grid container spacing={1.5} sx={{ mt: 1 }} alignItems="flex-start">
                  <Grid size={{ xs: 12, md: 5 }}>
                    <Autocomplete
                      options={parts}
                      value={selected}
                      getOptionLabel={(p) => `${p.code} · ${p.name}`}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      onChange={(_e, p) => setDraft(line.lineId, { partId: p?.id ?? "" })}
                      renderInput={(params) => <TextField {...params} label="อะไหล่ (รหัส · ชื่อ)" />}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 2 }}>
                    <TextField
                      label={`จำนวน${selected?.unit ? ` (${selected.unit})` : ""}`}
                      value={d.qty}
                      inputProps={{ inputMode: "decimal" }}
                      onChange={(e) => setDraft(line.lineId, { qty: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 2 }}>
                    <TextField
                      label="ราคาซื้อ/หน่วย (บาท)"
                      value={d.unitCost}
                      inputProps={{ inputMode: "decimal" }}
                      onChange={(e) => setDraft(line.lineId, { unitCost: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField label="หมายเหตุ" value={d.note} onChange={(e) => setDraft(line.lineId, { note: e.target.value })} />
                  </Grid>
                  <Grid size={12}>
                    <Stack direction="row" spacing={1}>
                      <Button variant="contained" disabled={busyLine === line.lineId} onClick={() => add(line.lineId)}>
                        {busyLine === line.lineId ? "กำลังบันทึก…" : "บันทึกอะไหล่"}
                      </Button>
                      {canCreatePart ? (
                        <Button startIcon={<AddIcon />} onClick={() => setCreatingFor(line.lineId)}>
                          ไม่มีในรายการ? เพิ่มอะไหล่ใหม่
                        </Button>
                      ) : null}
                    </Stack>
                  </Grid>
                </Grid>
              ) : null}
            </Box>
          );
        })}
      </Stack>

      {legacy.length > 0 ? (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            ประวัติการเบิกจากคลัง (ระบบเดิม · อ่านอย่างเดียว)
          </Typography>
          <WomsDataTable
            caption="ประวัติการเบิกจากคลัง"
            rows={legacy}
            columns={legacyCols}
            rowKey={(t) => t.id}
            pageSize={5}
            renderCard={(t) => (
              <Box sx={cardBox}>
                <Typography variant="body2">
                  {t.partCode} {t.partName} · {t.qty} · {t.byName} · {bangkokDateTime(t.at)}
                </Typography>
              </Box>
            )}
          />
        </Box>
      ) : null}

      <Dialog open={!!creatingFor} onClose={() => setCreatingFor(null)} maxWidth="sm" fullWidth>
        <DialogTitle>เพิ่มอะไหล่ใหม่</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <PartForm
              onCancel={() => setCreatingFor(null)}
              onSaved={(p) => {
                setParts((ps) => [...ps, p].sort((a, b) => a.code.localeCompare(b.code)));
                if (creatingFor) setDraft(creatingFor, { partId: p.id });
                setCreatingFor(null);
                toast.success(`เพิ่มอะไหล่ ${p.code} แล้ว — กรอกจำนวนและราคาซื้อแล้วกดบันทึก`);
              }}
            />
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle>แก้ไข {editing?.use.partCode}</DialogTitle>
        <DialogContent>
          {editing ? (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <TextField label={`จำนวน (${editing.use.unit})`} value={editing.qty} inputProps={{ inputMode: "decimal" }} onChange={(e) => setEditing({ ...editing, qty: e.target.value })} />
              <TextField label="ราคาซื้อ/หน่วย (บาท)" value={editing.unitCost} inputProps={{ inputMode: "decimal" }} onChange={(e) => setEditing({ ...editing, unitCost: e.target.value })} />
              <TextField label="หมายเหตุ" value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>ยกเลิก</Button>
          <Button variant="contained" onClick={saveEdit}>
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>
    </WomsFormSection>
  );
}
