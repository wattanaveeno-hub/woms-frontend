"use client";

// ---------------------------------------------------------------------------
// ฟอร์มวางบิลช่างราย Job Machine (BILL-01..03) — ใช้ทั้งสร้างใหม่และแก้ร่าง
// ---------------------------------------------------------------------------
// จัดกลุ่มตาม JN: แต่ละ JN มีค่าใช้จ่ายร่วมหนึ่งชุด + ค่าบริการเรียงรายเครื่อง
// (ข้อเสนอ UX ใน Handoff BILL-03 — หน้าเต็มจอ รองรับมือถือและหลายเครื่อง)
// ค่าเดินทาง = ระยะทาง × ราคาต่อ กม. แสดงให้เห็นก่อนส่ง แต่ server คำนวณซ้ำเสมอ
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { billsApi, jobCostSum, type BillableMachineGroup, type JobCostInput, type TechBillV2 } from "@/lib/billsApi";
import type { AuthUser } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { parseMoney } from "@/components/FieldErrors";
import { jobTypeLabel } from "@/lib/options";
import BillEvidenceInput from "@/components/BillEvidenceInput";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { WomsFormSection, WomsStatCard, WomsStatGrid, WomsStatusChip } from "@/components/woms";

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
const COST_FIELDS = [
  ["hotel", "ค่าโรงแรม"],
  ["parking", "ค่าจอดรถ"],
  ["equipment", "ค่าอุปกรณ์"],
  ["porter", "ค่าคนยก"],
  ["other", "ค่าใช้จ่ายอื่น ๆ"],
] as const;
type CostKey = "distanceKm" | "ratePerKm" | (typeof COST_FIELDS)[number][0];
type CostDraft = Record<CostKey, string> & { note: string; attachments: string[] };
const emptyCost = (): CostDraft => ({
  distanceKm: "",
  ratePerKm: "",
  hotel: "",
  parking: "",
  equipment: "",
  porter: "",
  other: "",
  note: "",
  attachments: [],
});
const num = (s: string | undefined) => {
  const r = parseMoney(s ?? "");
  return r.ok ? r.value : 0;
};
const str = (n: number | undefined) => (n ? String(n) : "");

export default function BillMachineForm({ bill }: { bill?: TechBillV2 }) {
  const router = useRouter();
  const toast = useToast();
  const { user, has } = useAuth();
  const canReview = has("bill:review");
  const editing = !!bill;

  const [from, setFrom] = useState(bill?.periodFrom ?? "");
  const [to, setTo] = useState(bill?.periodTo ?? "");
  const [technicianId, setTechnicianId] = useState(bill && bill.technicianId !== user?.id ? bill.technicianId : "");
  const [techs, setTechs] = useState<AuthUser[]>([]);
  const [groups, setGroups] = useState<BillableMachineGroup[] | null>(null);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(() => new Set((bill?.machineItems ?? []).map((m) => m.jobEquipmentId)));
  const [fees, setFees] = useState<Record<string, string>>(() =>
    Object.fromEntries((bill?.machineItems ?? []).map((m) => [m.jobEquipmentId, str(m.serviceFee)]))
  );
  const [feeNotes, setFeeNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries((bill?.machineItems ?? []).map((m) => [m.jobEquipmentId, m.note ?? ""]))
  );
  const [costs, setCosts] = useState<Record<string, CostDraft>>(() =>
    Object.fromEntries(
      (bill?.jobCosts ?? []).map((c) => [
        c.jobId,
        {
          distanceKm: str(c.distanceKm),
          ratePerKm: str(c.ratePerKm),
          hotel: str(c.hotel),
          parking: str(c.parking),
          equipment: str(c.equipment),
          porter: str(c.porter),
          other: str(c.other),
          note: c.note ?? "",
          attachments: c.attachments ?? [],
        },
      ])
    )
  );
  const [note, setNote] = useState(bill?.note ?? "");
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "summary">("form");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await billsApi.billableMachines({
        from: editing ? undefined : from || undefined,
        to: editing ? undefined : to || undefined,
        technicianId: canReview ? (editing ? bill!.technicianId : technicianId || undefined) : undefined,
        excludeBillId: bill?.id,
      });
      setGroups(r.items);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "โหลดรายการเครื่องไม่สำเร็จ");
      setGroups([]);
    }
  }, [from, to, technicianId, canReview, editing, bill]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canReview || editing) return;
    api
      .listTechnicians()
      .then((r) => setTechs(r.items))
      .catch(() => setTechs([]));
  }, [canReview, editing]);

  const selectable = (g: BillableMachineGroup, m: BillableMachineGroup["machines"][number]) =>
    !g.lockedByBillNo && !m.billedInBillNo && m.done !== false;

  const visibleGroups = useMemo(
    () =>
      (groups ?? []).filter(
        (g) => !onlyOpen || g.machines.some((m) => picked.has(m.jobEquipmentId) || selectable(g, m))
      ),
    [groups, onlyOpen, picked]
  );

  const pickedGroups = useMemo(
    () =>
      (groups ?? [])
        .map((g) => ({ ...g, machines: g.machines.filter((m) => picked.has(m.jobEquipmentId)) }))
        .filter((g) => g.machines.length > 0),
    [groups, picked]
  );

  const totals = useMemo(() => {
    let fee = 0;
    let shared = 0;
    const byJob = pickedGroups.map((g) => {
      const f = g.machines.reduce((s, m) => s + num(fees[m.jobEquipmentId]), 0);
      const c = costs[g.jobId] ?? emptyCost();
      const sh = jobCostSum({
        distanceKm: num(c.distanceKm),
        ratePerKm: num(c.ratePerKm),
        hotel: num(c.hotel),
        parking: num(c.parking),
        equipment: num(c.equipment),
        porter: num(c.porter),
        other: num(c.other),
      });
      fee += f;
      shared += sh;
      return { jobId: g.jobId, customerName: g.customerName, machineCount: g.machines.length, fee: f, shared: sh, total: f + sh };
    });
    return { fee, shared, grand: fee + shared, byJob, machines: pickedGroups.reduce((s, g) => s + g.machines.length, 0) };
  }, [pickedGroups, fees, costs]);

  const toggle = (id: string, on?: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      const want = on ?? !next.has(id);
      if (want) next.add(id);
      else next.delete(id);
      return next;
    });

  const setCost = (jobId: string, patch: Partial<CostDraft>) =>
    setCosts((prev) => ({ ...prev, [jobId]: { ...(prev[jobId] ?? emptyCost()), ...patch } }));

  const clearIssue = (k: string) => {
    if (issues[k]) setIssues(({ [k]: _, ...rest }) => rest);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!from) errs.from = "ระบุวันเริ่มรอบ";
    if (!to) errs.to = "ระบุวันสิ้นรอบ";
    if (from && to && from > to) errs.to = "วันสิ้นรอบต้องไม่ก่อนวันเริ่มรอบ";
    // BR-12.1: ผู้ใช้ที่ไม่ใช่ช่างต้องเลือกช่างเจ้าของบิล (backend ปฏิเสธบิลที่เจ้าของไม่ใช่ช่าง)
    if (!bill && user?.role !== "tech" && !technicianId) errs.technicianId = "เลือกช่างเจ้าของบิล";
    for (const g of pickedGroups) {
      for (const m of g.machines) {
        const r = parseMoney(fees[m.jobEquipmentId] ?? "");
        if (!r.ok) errs[`fee:${m.jobEquipmentId}`] = r.message;
      }
      const c = costs[g.jobId] ?? emptyCost();
      for (const k of ["distanceKm", "ratePerKm", ...COST_FIELDS.map(([f]) => f)] as CostKey[]) {
        const r = parseMoney(c[k]);
        if (!r.ok) errs[`cost:${g.jobId}:${k}`] = r.message;
      }
    }
    setIssues(errs);
    if (Object.keys(errs).length) {
      setFormError("ตรวจช่องที่ขึ้นสีแดงก่อน");
      return false;
    }
    if (!totals.machines) {
      setFormError("เลือกเครื่องอย่างน้อยหนึ่งเครื่อง");
      return false;
    }
    setFormError(null);
    return true;
  };

  const payload = () => ({
    machineItems: pickedGroups.flatMap((g) =>
      g.machines.map((m) => ({ jobEquipmentId: m.jobEquipmentId, serviceFee: num(fees[m.jobEquipmentId]), note: feeNotes[m.jobEquipmentId] ?? "" }))
    ),
    jobCosts: pickedGroups.map((g): JobCostInput => {
      const c = costs[g.jobId] ?? emptyCost();
      return {
        jobId: g.jobId,
        distanceKm: num(c.distanceKm),
        ratePerKm: num(c.ratePerKm),
        hotel: num(c.hotel),
        parking: num(c.parking),
        equipment: num(c.equipment),
        porter: num(c.porter),
        other: num(c.other),
        note: c.note,
        attachments: c.attachments,
      };
    }),
  });

  const save = async (submit: boolean) => {
    if (!validate()) {
      setStep("form");
      return;
    }
    setBusy(true);
    try {
      let saved: TechBillV2;
      if (bill) {
        saved = await billsApi.patch(bill.id, { ...payload(), note, periodFrom: from, periodTo: to }, bill.updatedAt);
      } else {
        saved = await billsApi.create({
          periodFrom: from,
          periodTo: to,
          technicianId: canReview && technicianId ? technicianId : undefined,
          ...payload(),
          note,
        });
      }
      if (submit) {
        try {
          saved = await billsApi.setStatus(saved.id, "SUBMITTED");
        } catch (e) {
          // บันทึกเป็นร่างแล้ว แต่ส่งตรวจไม่ผ่าน — พาไปหน้าบิลร่างเพื่อแก้แล้วส่งใหม่
          toast.error(`บันทึกร่าง ${saved.billNo} แล้ว แต่ส่งตรวจไม่ผ่าน: ${e instanceof ApiError ? e.message : "ลองใหม่"}`);
          router.push(`/bills/${saved.id}`);
          return;
        }
      }
      toast.success(submit ? `ส่งตรวจบิล ${saved.billNo} แล้ว` : `บันทึกร่าง ${saved.billNo} แล้ว`);
      router.push(`/bills/${saved.id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const moneyInput = (key: string, label: string, value: string, onChange: (v: string) => void, disabled = false, width = 150) => (
    <TextField
      size="small"
      label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.value);
        clearIssue(key);
      }}
      inputProps={{ inputMode: "decimal" }}
      error={!!issues[key]}
      helperText={issues[key]}
      sx={{ width: { xs: "100%", sm: width } }}
    />
  );

  // ---------------------------------------------------------------- summary
  if (step === "summary") {
    return (
      <>
        <WomsFormSection title="ตรวจสอบก่อนบันทึก (Summary)">
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            รอบ {from} → {to} · {totals.machines} เครื่อง · {pickedGroups.length} ใบงาน — ค่าใช้จ่ายร่วมนับครั้งเดียวต่อใบงาน
          </Typography>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" aria-label="สรุปรายใบงาน">
              <TableHead>
                <TableRow>
                  <TableCell>ใบงาน</TableCell>
                  <TableCell align="right">เครื่อง</TableCell>
                  <TableCell align="right">ค่าบริการ</TableCell>
                  <TableCell align="right">ค่าใช้จ่ายร่วม</TableCell>
                  <TableCell align="right">รวม</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {totals.byJob.map((r) => (
                  <TableRow key={r.jobId}>
                    <TableCell>
                      <span className="code">{r.jobId}</span>
                      <Typography variant="body2">{r.customerName}</Typography>
                    </TableCell>
                    <TableCell align="right">{r.machineCount}</TableCell>
                    <TableCell align="right" className="mono">{baht(r.fee)}</TableCell>
                    <TableCell align="right" className="mono">{baht(r.shared)}</TableCell>
                    <TableCell align="right" className="mono"><strong>{baht(r.total)}</strong></TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={2}><strong>รวมทั้งสิ้น</strong></TableCell>
                  <TableCell align="right" className="mono">{baht(totals.fee)}</TableCell>
                  <TableCell align="right" className="mono">{baht(totals.shared)}</TableCell>
                  <TableCell align="right" className="mono"><strong>{baht(totals.grand)}</strong></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
          {pickedGroups.map((g) => (
            <Box key={g.jobId} sx={{ mt: 2 }}>
              <Typography sx={{ fontWeight: 600 }}>{g.jobId}</Typography>
              {g.machines.map((m) => (
                <Typography key={m.jobEquipmentId} variant="body2">
                  SN {m.serial || "—"} {m.model ? `· ${m.model}` : ""} — ค่าบริการ {baht(num(fees[m.jobEquipmentId]))} บาท
                  {feeNotes[m.jobEquipmentId] ? ` (${feeNotes[m.jobEquipmentId]})` : ""}
                </Typography>
              ))}
              {costs[g.jobId]?.note ? <Typography variant="body2">หมายเหตุค่าใช้จ่ายร่วม: {costs[g.jobId].note}</Typography> : null}
            </Box>
          ))}
        </WomsFormSection>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button onClick={() => setStep("form")} disabled={busy}>
            กลับไปแก้ไข
          </Button>
          <Button variant="outlined" onClick={() => save(false)} disabled={busy}>
            บันทึกเป็นร่าง
          </Button>
          <Button variant="contained" onClick={() => save(true)} disabled={busy}>
            {busy ? "กำลังบันทึก…" : "ยืนยันส่งให้ Admin ตรวจสอบ"}
          </Button>
        </Stack>
      </>
    );
  }

  // ---------------------------------------------------------------- form
  return (
    <>
      {loadError ? (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={load}>ลองใหม่</Button>}>
          {loadError}
        </Alert>
      ) : null}

      <WomsFormSection title="รอบวางบิล">
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 4 }}>
            <TextField label="ตั้งแต่" type="date" required value={from} onChange={(e) => { setFrom(e.target.value); clearIssue("from"); }} InputLabelProps={{ shrink: true }} error={!!issues.from} helperText={issues.from} />
          </Grid>
          <Grid size={{ xs: 6, md: 4 }}>
            <TextField label="ถึง" type="date" required value={to} onChange={(e) => { setTo(e.target.value); clearIssue("to"); }} InputLabelProps={{ shrink: true }} error={!!issues.to} helperText={issues.to} />
          </Grid>
          {canReview && !editing ? (
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select
                label="ช่างผู้วางบิล"
                value={technicianId}
                onChange={(e) => {
                  setTechnicianId(e.target.value);
                  setPicked(new Set());
                }}
                SelectProps={{ displayEmpty: true }}
                InputLabelProps={{ shrink: true }}
                error={!!issues.technicianId}
                helperText={issues.technicianId ?? "บิลค่าบริการเป็นของช่างเสมอ — เลือกช่างเจ้าของบิลเพื่อทำบิลแทน"}
              >
                <MenuItem value="">{user?.role === "tech" ? `ตัวฉัน (${user.name})` : "— เลือกช่างเจ้าของบิล —"}</MenuItem>
                {techs
                  .filter((t) => t.id !== user?.id)
                  .map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.name}
                      {t.team ? ` · ${t.team}` : ""}
                    </MenuItem>
                  ))}
              </TextField>
            </Grid>
          ) : null}
        </Grid>
        {!editing ? (
          <Typography variant="body2" sx={{ mt: 1 }}>
            รายการด้านล่างกรองตามวันที่เข้างานในรอบนี้
          </Typography>
        ) : null}
      </WomsFormSection>

      <WomsFormSection
        title="เลือกเครื่องที่วางบิล (จัดกลุ่มตามใบงาน)"
        actions={
          <FormControlLabel
            control={<Switch checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />}
            label="ซ่อนที่วางบิลแล้ว"
          />
        }
      >
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          แสดงเฉพาะเครื่องในใบงานที่ Admin ยืนยันปิดงานแล้ว{canReview ? "" : " และคุณเป็นผู้รับผิดชอบ"} · ค่าบริการกรอกรายเครื่อง ·
          ค่าเดินทาง/โรงแรม/จอดรถ/อุปกรณ์/คนยก/อื่น ๆ กรอกครั้งเดียวต่อใบงาน
        </Typography>
        {groups === null ? (
          <Typography variant="body2">กำลังโหลด…</Typography>
        ) : visibleGroups.length === 0 ? (
          <Alert severity="info">ไม่มีเครื่องที่วางบิลได้ในช่วงวันที่นี้</Alert>
        ) : (
          <Stack spacing={2}>
            {visibleGroups.map((g) => {
              const open = g.machines.filter((m) => selectable(g, m) || picked.has(m.jobEquipmentId));
              const allPicked = open.length > 0 && open.every((m) => picked.has(m.jobEquipmentId));
              const anyPicked = g.machines.some((m) => picked.has(m.jobEquipmentId));
              const c = costs[g.jobId] ?? emptyCost();
              const travel = Math.round(num(c.distanceKm) * num(c.ratePerKm) * 100) / 100;
              const row = totals.byJob.find((r) => r.jobId === g.jobId);
              return (
                <Card key={g.jobId} variant="outlined">
                  <CardContent>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Checkbox
                        checked={allPicked}
                        indeterminate={anyPicked && !allPicked}
                        disabled={open.length === 0}
                        onChange={(e) => open.forEach((m) => toggle(m.jobEquipmentId, e.target.checked))}
                        inputProps={{ "aria-label": `เลือกทุกเครื่องของ ${g.jobId}` }}
                      />
                      <Link href={`/jobs/${g.jobId}`} className="code">
                        {g.jobId}
                      </Link>
                      <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{g.customerName || "—"}</Typography>
                      <Typography variant="body2">
                        {(jobTypeLabel as Record<string, string>)[g.jobType] ?? g.jobType} · เข้างาน {g.jobDate || "—"}
                      </Typography>
                      {g.lockedByBillNo ? <WomsStatusChip label={`อยู่ในบิล ${g.lockedByBillNo}`} tone="neutral" /> : null}
                    </Stack>

                    <Stack spacing={1} sx={{ mt: 1, pl: { sm: 5 } }}>
                      {g.machines.map((m) => {
                        const can = selectable(g, m) || picked.has(m.jobEquipmentId);
                        const on = picked.has(m.jobEquipmentId);
                        return (
                          <Stack key={m.jobEquipmentId} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                            <FormControlLabel
                              sx={{ minWidth: 220, mr: 0 }}
                              control={<Checkbox checked={on} disabled={!can} onChange={() => toggle(m.jobEquipmentId)} />}
                              label={
                                <span>
                                  SN <span className="mono">{m.serial || "—"}</span>
                                  {m.model ? ` · ${m.model}` : ""}
                                  {m.billedInBillNo ? ` (วางบิลแล้ว ${m.billedInBillNo})` : ""}
                                  {m.done === false ? " (ยังไม่บันทึกว่าเสร็จ — วางบิลไม่ได้)" : ""}
                                </span>
                              }
                            />
                            {on ? (
                              <>
                                {moneyInput(`fee:${m.jobEquipmentId}`, "ค่าบริการ (บาท)", fees[m.jobEquipmentId] ?? "", (v) =>
                                  setFees((p) => ({ ...p, [m.jobEquipmentId]: v }))
                                )}
                                <TextField
                                  size="small"
                                  label="หมายเหตุรายเครื่อง"
                                  value={feeNotes[m.jobEquipmentId] ?? ""}
                                  onChange={(e) => setFeeNotes((p) => ({ ...p, [m.jobEquipmentId]: e.target.value }))}
                                  sx={{ flex: 1, minWidth: 160 }}
                                />
                              </>
                            ) : null}
                          </Stack>
                        );
                      })}
                    </Stack>

                    {anyPicked ? (
                      <Box sx={{ mt: 2, p: 1.5, border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "action.hover" }}>
                        <Typography sx={{ fontWeight: 600, mb: 1 }}>ค่าใช้จ่ายร่วมของใบงาน {g.jobId} (กรอกครั้งเดียว)</Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap alignItems={{ sm: "flex-start" }}>
                          {moneyInput(`cost:${g.jobId}:distanceKm`, "ระยะทาง (กม.)", c.distanceKm, (v) => setCost(g.jobId, { distanceKm: v }))}
                          {moneyInput(`cost:${g.jobId}:ratePerKm`, "ราคาต่อ กม.", c.ratePerKm, (v) => setCost(g.jobId, { ratePerKm: v }))}
                          <TextField size="small" label="ค่าเดินทาง (คำนวณ)" value={baht(travel)} disabled sx={{ width: { xs: "100%", sm: 150 } }} />
                          {COST_FIELDS.map(([k, label]) => (
                            <Box key={k}>{moneyInput(`cost:${g.jobId}:${k}`, label, c[k], (v) => setCost(g.jobId, { [k]: v } as Partial<CostDraft>))}</Box>
                          ))}
                        </Stack>
                        <TextField
                          size="small"
                          label="หมายเหตุค่าใช้จ่ายร่วม"
                          value={c.note}
                          onChange={(e) => setCost(g.jobId, { note: e.target.value })}
                          sx={{ mt: 1 }}
                          fullWidth
                        />
                        <Box sx={{ mt: 1 }}>
                          <BillEvidenceInput
                            value={c.attachments}
                            onChange={(v) => setCost(g.jobId, { attachments: v })}
                            max={5}
                            label="แนบใบเสร็จ/หลักฐาน"
                          />
                        </Box>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="body2">
                          ใบงานนี้: ค่าบริการ {baht(row?.fee ?? 0)} + ค่าใช้จ่ายร่วม {baht(row?.shared ?? 0)} = <strong>{baht(row?.total ?? 0)}</strong> บาท
                        </Typography>
                      </Box>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}
      </WomsFormSection>

      <WomsFormSection title="หมายเหตุของบิล">
        <TextField label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} fullWidth multiline minRows={2} />
      </WomsFormSection>

      <WomsStatGrid>
        <WomsStatCard value={String(totals.machines)} label="เครื่องที่เลือก" hint={`${pickedGroups.length} ใบงาน`} />
        <WomsStatCard value={baht(totals.fee)} label="ค่าบริการรายเครื่อง" />
        <WomsStatCard value={baht(totals.shared)} label="ค่าใช้จ่ายร่วม (ครั้งเดียวต่อใบงาน)" />
        <WomsStatCard value={baht(totals.grand)} label="รวมทั้งสิ้น" tone="primary" />
      </WomsStatGrid>

      {formError ? (
        <Alert severity="error" sx={{ mb: 2 }} role="alert">
          {formError}
        </Alert>
      ) : null}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button variant="outlined" disabled={busy} onClick={() => save(false)}>
          บันทึกเป็นร่าง
        </Button>
        <Button
          variant="contained"
          size="large"
          disabled={busy}
          onClick={() => {
            if (validate()) setStep("summary");
          }}
        >
          ตรวจสอบสรุปก่อนส่ง
        </Button>
      </Stack>
    </>
  );
}
