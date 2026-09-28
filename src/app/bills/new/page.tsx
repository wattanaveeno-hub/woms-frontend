"use client";

import { WomsPermissionGate } from "@/components/woms/WomsPermissionGate";
// ---------------------------------------------------------------------------
// ทำรายการวางบิล — เลือกใบงานที่ปิดแล้ว ใส่ค่าแรง และลงระยะทาง "รายวัน"
// ---------------------------------------------------------------------------
// ข้อกำกับ: ค่าเดินทางคิดต่อวัน หลายใบงานในวันเดียวกันไม่คิดค่าเดินทางซ้ำ

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { AuthUser, BillableJob } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { jobTypeLabel } from "@/lib/options";
import { parseMoney } from "@/components/FieldErrors";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid2";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  WomsDataTable,
  WomsFormSection,
  WomsPageHeader,
  WomsStatCard,
  WomsStatGrid,
  WomsStatusChip,
  type WomsColumn,
} from "@/components/woms";

type DayRow = { date: string; count: number };

function NewBillPageInner() {
  const router = useRouter();
  const toast = useToast();
  // QA BUG-024 — backend รองรับ ?technicianId= สำหรับผู้มีสิทธิ์ bill:review (admin/manager)
  // เพื่อทำบิลแทนช่างรายอื่น แต่หน้าจอไม่เคยมีตัวเลือกช่าง จึงใช้ความสามารถนี้ไม่ได้เลย
  const { user, has } = useAuth();
  const canReview = has("bill:review");

  const [technicianId, setTechnicianId] = useState("");
  const [techs, setTechs] = useState<AuthUser[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [jobs, setJobs] = useState<BillableJob[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [labor, setLabor] = useState<Record<string, string>>({});
  const [travel, setTravel] = useState<Record<string, { distanceKm: string; travelAmount: string }>>({});
  const [expenses, setExpenses] = useState<Array<{ label: string; amount: string }>>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // QA BUG-011 (กติกาเดียวกับช่องเงินอื่นทั้งระบบ) — เดิมช่องเงินในหน้านี้แปลง "abc" เป็น 0 และ "1e5" เป็น 100,000 เงียบ ๆ
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.billableJobs({
        from: from || undefined,
        to: to || undefined,
        technicianId: canReview && technicianId ? technicianId : undefined,
      });
      setJobs(r.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดใบงานไม่สำเร็จ");
      setJobs([]);
    }
  }, [from, to, technicianId, canReview]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canReview) return;
    api
      .listTechnicians()
      .then((r) => setTechs(r.items))
      .catch(() => setTechs([]));
  }, [canReview]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // วันที่ของใบงานที่เลือก — หนึ่งวันหนึ่งแถวค่าเดินทางเท่านั้น
  const pickedDates = useMemo(() => {
    const dates = new Set<string>();
    for (const j of jobs ?? []) if (picked.has(j.jobId) && j.jobDate) dates.add(j.jobDate);
    return [...dates].sort();
  }, [jobs, picked]);

  const totals = useMemo(() => {
    const laborTotal = [...picked].reduce((s, id) => s + (Number(labor[id]) || 0), 0);
    const travelTotal = pickedDates.reduce((s, d) => s + (Number(travel[d]?.travelAmount) || 0), 0);
    const expenseTotal = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return { laborTotal, travelTotal, expenseTotal, grand: laborTotal + travelTotal + expenseTotal };
  }, [picked, labor, pickedDates, travel, expenses]);

  const submit = async () => {
    setFormError(null);
    const errs: Record<string, string> = {};
    if (!from) errs.from = "ระบุวันเริ่มรอบ";
    if (!to) errs.to = "ระบุวันสิ้นรอบ";
    const money = (key: string, raw: string | undefined) => {
      const r = parseMoney(raw ?? "");
      if (!r.ok) errs[key] = r.message;
    };
    [...picked].forEach((id) => money(`labor:${id}`, labor[id]));
    pickedDates.forEach((d) => {
      money(`km:${d}`, travel[d]?.distanceKm);
      money(`travel:${d}`, travel[d]?.travelAmount);
    });
    expenses.forEach((e, i) => money(`exp:${i}`, e.amount));
    setIssues(errs);
    if (Object.keys(errs).length) {
      setFormError("ตรวจช่องที่ขึ้นสีแดงก่อนบันทึก");
      return;
    }
    if (picked.size === 0) {
      setFormError("เลือกใบงานอย่างน้อยหนึ่งใบ");
      return;
    }
    setBusy(true);
    try {
      const bill = await api.createBill({
        periodFrom: from,
        periodTo: to,
        jobIds: [...picked],
        labor: Object.fromEntries([...picked].map((id) => [id, Number(labor[id]) || 0])),
        days: pickedDates.map((d) => ({
          date: d,
          distanceKm: Number(travel[d]?.distanceKm) || 0,
          travelAmount: Number(travel[d]?.travelAmount) || 0,
          note: "",
        })),
        expenses: expenses
          .filter((e) => e.label.trim())
          .map((e, i) => ({ id: `EX-${i + 1}`, label: e.label, amount: Number(e.amount) || 0, attachment: "", note: "" })),
        note,
      });
      toast.success(`สร้างรายการวางบิล ${bill.billNo} แล้ว`);
      router.push(`/bills/${bill.id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "สร้างรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const err = (k: string) => issues[k];
  const moneyField = (key: string, label: string, value: string, onChange: (v: string) => void, disabled = false) => (
    <TextField
      size="small"
      label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.value);
        if (issues[key]) setIssues(({ [key]: _, ...rest }) => rest);
      }}
      inputProps={{ inputMode: "decimal" }}
      error={!!err(key)}
      helperText={err(key)}
      sx={{ maxWidth: 180 }}
    />
  );

  const jobCols: WomsColumn<BillableJob>[] = [
    {
      key: "job",
      label: "ใบงาน",
      sortValue: (j) => j.jobId,
      render: (j) => (
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <Link href={`/jobs/${j.jobId}`} className="code">
            {j.jobId}
          </Link>
          {j.alreadyBilled ? <WomsStatusChip label="วางบิลแล้ว" tone="neutral" /> : null}
        </Stack>
      ),
    },
    { key: "type", label: "ประเภท", render: (j) => (jobTypeLabel as Record<string, string>)[j.jobType] ?? j.jobType },
    { key: "date", label: "วันที่", sortValue: (j) => j.jobDate, render: (j) => <span className="mono">{j.jobDate}</span> },
    { key: "cust", label: "ลูกค้า", render: (j) => j.customerName || "—" },
    {
      key: "labor",
      label: "ค่าแรง (บาท)",
      render: (j) => moneyField(`labor:${j.jobId}`, "ค่าแรง", labor[j.jobId] ?? "", (v) => setLabor((prev) => ({ ...prev, [j.jobId]: v })), !picked.has(j.jobId)),
    },
  ];

  const dayRows: DayRow[] = pickedDates.map((d) => ({
    date: d,
    count: (jobs ?? []).filter((j) => picked.has(j.jobId) && j.jobDate === d).length,
  }));
  const setTravelField = (d: string, k: "distanceKm" | "travelAmount", v: string) =>
    setTravel((prev) => ({ ...prev, [d]: { ...(prev[d] ?? { distanceKm: "", travelAmount: "" }), [k]: v } }));
  const dayInputs = (r: DayRow) => (
    <Stack direction="row" spacing={1}>
      {moneyField(`km:${r.date}`, "ระยะทาง (กม.)", travel[r.date]?.distanceKm ?? "", (v) => setTravelField(r.date, "distanceKm", v))}
      {moneyField(`travel:${r.date}`, "ค่าเดินทาง (บาท)", travel[r.date]?.travelAmount ?? "", (v) => setTravelField(r.date, "travelAmount", v))}
    </Stack>
  );
  const dayCols: WomsColumn<DayRow>[] = [
    { key: "date", label: "วันที่", render: (r) => <span className="mono">{r.date}</span> },
    { key: "count", label: "ใบงานในวันนั้น", align: "right", render: (r) => r.count },
    { key: "inputs", label: "ระยะทาง / ค่าเดินทาง", render: dayInputs },
  ];

  return (
    <>
      <WomsPageHeader
        title="ทำรายการวางบิล"
        subtitle="เลือกได้เฉพาะใบงานที่ Admin ยืนยันปิดงานแล้ว และยังไม่เคยถูกวางบิล"
        actions={
          <Button component={Link} href="/bills" startIcon={<ArrowBackIcon />}>
            รายการวางบิล
          </Button>
        }
      />

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={load}>ลองใหม่</Button>}>
          {error}
        </Alert>
      ) : null}

      <WomsFormSection title="รอบวางบิล">
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 4 }}>
            <TextField label="ตั้งแต่" type="date" required value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} error={!!err("from")} helperText={err("from")} />
          </Grid>
          <Grid size={{ xs: 6, md: 4 }}>
            <TextField label="ถึง" type="date" required value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} error={!!err("to")} helperText={err("to")} />
          </Grid>
          {canReview ? (
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select
                label="ช่างผู้วางบิล"
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                SelectProps={{ displayEmpty: true }}
                InputLabelProps={{ shrink: true }}
                helperText="คุณมีสิทธิ์ตรวจบิล จึงทำบิลแทนช่างรายอื่นได้"
              >
                <MenuItem value="">{user ? `ตัวฉัน (${user.name})` : "ตัวฉัน"}</MenuItem>
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
      </WomsFormSection>

      <WomsFormSection title="ใบงานที่วางบิลได้">
        <WomsDataTable
          caption="ใบงานที่วางบิลได้"
          rows={jobs ?? []}
          loading={jobs === null}
          columns={jobCols}
          rowKey={(j) => j.jobId}
          pageSize={50}
          // QA BUG-023 — รายการถูกจำกัดขอบเขตให้เห็นเฉพาะใบงานของช่างที่เลือกเท่านั้น (NEG-BILN-06)
          emptyTitle={`ไม่มีใบงานที่ปิดแล้ว${
            canReview && technicianId ? `ของ ${techs.find((t) => t.id === technicianId)?.name ?? "ช่างที่เลือก"}` : "ของคุณ"
          }ในช่วงวันที่นี้`}
          emptyDescription={`รายการนี้แสดงเฉพาะใบงานที่คุณเป็นผู้รับผิดชอบหรืออยู่ทีมเดียวกัน — ไม่ใช่ใบงานทั้งบริษัท${
            canReview ? " · เปลี่ยน “ช่างผู้วางบิล” ด้านบนเพื่อดูของคนอื่น" : ""
          }`}
          selection={{
            isSelected: (j) => picked.has(j.jobId),
            onToggle: (j) => toggle(j.jobId),
            onTogglePage: (rows, all) =>
              setPicked((prev) => {
                const next = new Set(prev);
                rows.forEach((r) => (all ? next.add(r.jobId) : next.delete(r.jobId)));
                return next;
              }),
            label: (j) => `เลือก ${j.jobId}`,
            isDisabled: (j) => !!j.alreadyBilled,
          }}
          renderCard={(j) => (
            <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5, opacity: j.alreadyBilled ? 0.6 : 1 }}>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <span className="code">{j.jobId}</span>
                {j.alreadyBilled ? <WomsStatusChip label="วางบิลแล้ว" tone="neutral" /> : null}
              </Stack>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {(jobTypeLabel as Record<string, string>)[j.jobType] ?? j.jobType} · {j.jobDate} · {j.customerName || "—"}
              </Typography>
              {picked.has(j.jobId)
                ? moneyField(`labor:${j.jobId}`, "ค่าแรง (บาท)", labor[j.jobId] ?? "", (v) => setLabor((prev) => ({ ...prev, [j.jobId]: v })))
                : null}
            </Box>
          )}
        />
      </WomsFormSection>

      <WomsFormSection title="ระยะทางและค่าเดินทาง (รายวัน)">
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          หนึ่งวันกรอกครั้งเดียว — ถ้าวันนั้นมีหลายใบงาน ค่าเดินทางจะไม่ถูกคิดซ้ำตามจำนวนใบงาน
        </Typography>
        <WomsDataTable
          caption="ค่าเดินทางรายวัน"
          rows={dayRows}
          columns={dayCols}
          rowKey={(r) => r.date}
          pageSize={31}
          emptyTitle="เลือกใบงานก่อน ระบบจะแสดงวันที่ให้กรอก"
          renderCard={(r) => (
            <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
              <Typography sx={{ color: "text.primary", mb: 1 }}>
                <span className="mono">{r.date}</span> · {r.count} ใบงาน
              </Typography>
              {dayInputs(r)}
            </Box>
          )}
        />
      </WomsFormSection>

      <WomsFormSection
        title="ค่าใช้จ่ายอื่น"
        actions={
          <Button size="small" startIcon={<AddIcon />} onClick={() => setExpenses([...expenses, { label: "", amount: "" }])}>
            เพิ่มรายการ
          </Button>
        }
      >
        <Stack spacing={1.5}>
          {expenses.map((e, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
              <TextField
                size="small"
                label="รายการ"
                placeholder="เช่น ค่าทางด่วน"
                value={e.label}
                onChange={(ev) => setExpenses(expenses.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))}
              />
              {moneyField(`exp:${i}`, "บาท", e.amount, (v) => setExpenses(expenses.map((x, j) => (j === i ? { ...x, amount: v } : x))))}
              <IconButton color="error" aria-label={`ลบค่าใช้จ่ายรายการที่ ${i + 1}`} onClick={() => setExpenses(expenses.filter((_, j) => j !== i))}>
                <DeleteOutlineIcon />
              </IconButton>
            </Stack>
          ))}
          <TextField label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} />
        </Stack>
      </WomsFormSection>

      <WomsStatGrid>
        <WomsStatCard value={totals.laborTotal.toLocaleString("th-TH")} label="ค่าแรง" />
        <WomsStatCard value={totals.travelTotal.toLocaleString("th-TH")} label={`ค่าเดินทาง (${pickedDates.length} วัน)`} />
        <WomsStatCard value={totals.expenseTotal.toLocaleString("th-TH")} label="ค่าใช้จ่ายอื่น" />
        <WomsStatCard value={totals.grand.toLocaleString("th-TH")} label="รวมทั้งสิ้น" tone="primary" />
      </WomsStatGrid>

      {formError ? (
        <Alert severity="error" sx={{ mb: 2 }} role="alert">
          {formError}
        </Alert>
      ) : null}
      <Button variant="contained" size="large" disabled={busy} onClick={submit}>
        {busy ? "กำลังบันทึก…" : "บันทึกเป็นร่าง"}
      </Button>
    </>
  );
}

// เปิด URL ตรงโดยไม่มีสิทธิ์ → แสดงข้อความแทนฟอร์มที่บันทึกไม่ได้ (backend บังคับสิทธิ์อีกชั้นเสมอ)
export default function NewBillPage() {
  return (
    <WomsPermissionGate perm="bill:create" backHref="/bills">
      <NewBillPageInner />
    </WomsPermissionGate>
  );
}
