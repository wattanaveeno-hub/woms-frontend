"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { setJobPrefill } from "@/lib/jobPrefill";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { Equipment, EquipmentFormValues, Options } from "@/lib/types";
import EquipmentForm from "@/components/EquipmentForm";
import { EquipmentStatusBadge, WarrantyBadge, NeedsSerialBadge, NoContractBadge } from "@/components/EquipmentBadges";
import EquipmentHistory from "@/components/EquipmentHistory";
import EquipmentTimeline from "@/components/EquipmentTimeline";
import EquipmentFinanceCard from "@/components/EquipmentFinanceCard";
import EquipmentPmCard from "@/components/EquipmentPmCard";
import EquipmentContractCard from "@/components/EquipmentContractCard";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { bangkokDateTime } from "@/lib/date";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import AddTaskIcon from "@mui/icons-material/AddTask";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { WomsErrorState, WomsFormSection, WomsKeyValue, WomsLoadingState, WomsPageHeader } from "@/components/woms";

export default function EquipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { has } = useAuth();
  const toast = useToast();
  const dialog = useDialog();

  const [eq, setEq] = useState<Equipment | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settingSerial, setSettingSerial] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [jobAnchor, setJobAnchor] = useState<HTMLElement | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);

  // MCH-03: เปิดงานจากหน้าเครื่อง — ส่ง id เครื่องไปหน้าเปิดงาน (ผู้ใช้ยังต้องกดบันทึกเอง)
  const startJob = (jobType: string) => {
    setJobPrefill({ equipmentIds: [id], jobType });
    setJobAnchor(null);
    router.push("/jobs/new");
  };

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [e, o] = await Promise.all([api.getEquipment(id), api.getOptions()]);
      setEq(e);
      setOptions(o);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (values: EquipmentFormValues) => {
    if (!eq) return;
    setBusy(true);
    setFieldError(null);
    try {
      const updated = await api.patchEquipment(id, values, eq.updatedAt);
      setEq(updated);
      toast.success("บันทึกแล้ว");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error(e.message);
        load();
      } else if (e instanceof ApiError) {
        setFieldError({ field: e.field, message: e.message });
        toast.error(e.message);
      } else {
        setFieldError({ message: "บันทึกไม่สำเร็จ" });
        toast.error("บันทึกไม่สำเร็จ");
      }
    } finally {
      setBusy(false);
    }
  };

  // ลง Serial จริงแทนเลขชั่วคราว (TMP-) — ระบบบันทึกไว้ในประวัติเครื่องให้ด้วย
  const setRealSerial = async () => {
    if (!eq || settingSerial) return;
    const serial = await dialog.prompt({
      title: "ลง Serial จริงของเครื่องนี้",
      message: `เลขชั่วคราวปัจจุบัน ${eq.serial} — เมื่อลง Serial จริงแล้วระบบจะบันทึกไว้ในประวัติเครื่อง`,
      label: "Serial จริง",
      help: "ตรงตามเลขที่ติดอยู่บนตัวเครื่อง · ห้ามซ้ำกับเครื่องอื่น (ไม่สนตัวพิมพ์เล็ก/ใหญ่)",
      required: true,
      confirmLabel: "ลง Serial",
    });
    if (serial === null) return;
    setSettingSerial(true);
    try {
      const updated = await api.setEquipmentSerial(id, serial.trim());
      setEq(updated);
      toast.success(`ลง Serial ${updated.serial} แล้ว`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ลง Serial ไม่สำเร็จ");
    } finally {
      setSettingSerial(false);
    }
  };

  const remove = async () => {
    if (!eq || deleting) return;
    if (
      !(await dialog.confirm({
        title: `ลบเครื่อง ${eq.serial}?`,
        message: "การลบเครื่องย้อนกลับไม่ได้ — เครื่องที่เคยอยู่ในใบงาน แผน PM หรือสัญญาลบไม่ได้ ถ้าเลิกใช้งานแล้ว ให้ตั้งสถานะเป็น “ปลดระวาง” แทน",
        confirmLabel: "ยืนยันลบเครื่อง",
        danger: true,
      }))
    )
      return;
    setDeleting(true);
    try {
      await api.deleteEquipment(id);
      toast.success(`ลบเครื่อง ${eq.serial} แล้ว`);
      router.push("/equipment");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ลบไม่สำเร็จ");
      setDeleting(false);
    }
  };

  const back = (
    <Button component={Link} href="/equipment" startIcon={<ArrowBackIcon />}>
      คลังเครื่อง
    </Button>
  );

  if (loadError) {
    return (
      <>
        <WomsPageHeader title="ไม่พบเครื่อง" actions={back} />
        <WomsErrorState message={loadError} onRetry={load} />
      </>
    );
  }

  if (!eq || !options) return <WomsLoadingState rows={6} />;

  return (
    <>
      <WomsPageHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap component="span">
            <Box component="span" className="code" sx={{ fontSize: 20 }}>
              {eq.serial}
            </Box>
            <EquipmentStatusBadge status={eq.status} />
            <WarrantyBadge status={eq.warrantyStatus} />
            {eq.needsSerial ? <NeedsSerialBadge /> : null}
            {eq.rentalWithoutContract ? <NoContractBadge /> : null}
          </Stack>
        }
        subtitle={`รุ่น: ${eq.model || "—"}${eq.machineType ? ` · ${eq.machineType}` : ""}${eq.category ? ` · ${eq.category}` : ""}`}
        actions={
          <>
            {back}
            {has("jobs:create") ? (
              <>
                <Button variant="contained" startIcon={<AddTaskIcon />} onClick={(e) => setJobAnchor(e.currentTarget)} aria-haspopup="menu">
                  เปิดงานจากเครื่องนี้
                </Button>
                <Menu anchorEl={jobAnchor} open={!!jobAnchor} onClose={() => setJobAnchor(null)}>
                  <ListSubheader>เลือกประเภทงาน</ListSubheader>
                  {(options.jobTypes ?? []).map((t) => (
                    <MenuItem key={t.value} onClick={() => startJob(t.value)}>
                      {t.label}
                    </MenuItem>
                  ))}
                  {!options.jobTypes?.length ? <MenuItem disabled>โหลดประเภทงานไม่สำเร็จ</MenuItem> : null}
                </Menu>
              </>
            ) : null}
            {has("equipment:edit") && !eq.replacedById ? (
              <Button variant="outlined" startIcon={<SwapHorizIcon />} onClick={() => setReplaceOpen(true)}>
                เปลี่ยนเครื่องทดแทน
              </Button>
            ) : null}
          </>
        }
      />

      {eq.replacedById ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          เครื่องนี้ถูกเปลี่ยนทดแทนด้วยเครื่อง{" "}
          <Link href={`/equipment/${eq.replacedById}`} className="code">
            {eq.replacedBySerial || eq.replacedById}
          </Link>
          {eq.replacedAt ? ` เมื่อ ${eq.replacedAt}` : ""} — ประวัติของแต่ละเครื่องแยกกัน
        </Alert>
      ) : null}
      {eq.replacesId ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          เครื่องนี้ใช้แทนเครื่อง{" "}
          <Link href={`/equipment/${eq.replacesId}`} className="code">
            {eq.replacesSerial || eq.replacesId}
          </Link>
          {eq.replacedAt ? ` เมื่อ ${eq.replacedAt}` : ""}
        </Alert>
      ) : null}

      <ReplaceDialog
        open={replaceOpen}
        equipment={eq}
        onClose={() => setReplaceOpen(false)}
        onDone={(updated) => {
          setReplaceOpen(false);
          setEq(updated);
          toast.success("บันทึกการเปลี่ยนเครื่องทดแทนแล้ว");
        }}
      />

      {eq.needsSerial ? (
        <Alert
          severity="error"
          sx={{ mb: 2, alignItems: "center" }}
          action={
            has("equipment:edit") ? (
              <Button variant="contained" color="error" onClick={setRealSerial} disabled={settingSerial}>
                {settingSerial ? "กำลังบันทึก…" : "ลง Serial จริง"}
              </Button>
            ) : undefined
          }
        >
          Pending Serial — เครื่องนี้ยังไม่ได้ลง Serial จริง ใช้เลขชั่วคราว <span className="mono">{eq.serial}</span> (ลง SN จริงแล้วยังเป็นเครื่องเดิม ประวัติเดิม)
        </Alert>
      ) : null}

      {/* MCH-02 การ์ดข้อมูลเครื่อง: ข้อมูลหลัก · ร้านปัจจุบัน · ปุ่มไปข้อมูลลูกค้า · ประกัน Supplier / บริษัท */}
      <WomsFormSection title="ข้อมูลเครื่อง">
        <WomsKeyValue
          items={[
            [
              "ผู้ถือครอง",
              eq.customerId ? (
                <Link href={`/partners/${eq.customerId}`}>{eq.customerName || "(ไม่ระบุชื่อ)"}</Link>
              ) : (
                <>
                  {eq.holderName || eq.customerName || "—"}
                  {eq.holderIsDefault ? " (เครื่องว่าง)" : ""}
                </>
              ),
            ],
            ["ร้าน / สาขาปัจจุบัน", eq.currentBranch || eq.siteLabel || "—"],
            ["ที่อยู่ติดตั้ง", eq.addressFull || eq.location || "—"],
            ["ประเภทเครื่อง", eq.machineType || "—"],
            ["เครื่องกรอง", eq.filterUnit || "—"],
            ["วันที่รับเข้า", <span key="in" className="mono">{eq.inboundDate || "—"}</span>],
            [
              "อายุเครื่อง",
              eq.machineAgeDays != null
                ? `${eq.machineAgeDays.toLocaleString("th-TH")} วัน (นับจากวันรับเข้า · ฐานการนับรอยืนยัน Q-13)`
                : "— (ยังไม่มีวันที่รับเข้า)",
            ],
            ["วันที่ติดตั้ง", <span key="d" className="mono">{eq.installDate || "—"}</span>],
            [
              "จำนวนวันใช้งาน",
              eq.daysInUse != null
                ? `${eq.daysInUse.toLocaleString("th-TH")} วัน (นับจากวันติดตั้ง · ฐานการนับรอยืนยัน Q-13)`
                : "— (ยังไม่มีวันที่ติดตั้ง)",
            ],
            ["ประกัน Supplier", WarrantyList(eq.warranties.filter((w) => w.provider === "BRAND"), "ยังไม่มีประกัน Supplier")],
            ["ประกันบริษัท (ETE)", WarrantyList(eq.warranties.filter((w) => w.provider === "AGENT"), "ยังไม่มีประกันบริษัท")],
            eq.warranties.some((w) => w.provider === "OTHER")
              ? ["ประกันอื่น ๆ", WarrantyList(eq.warranties.filter((w) => w.provider === "OTHER"), "")]
              : null,
            eq.warehouse ? ["คลัง", eq.warehouse] : null,
            eq.supplier ? ["Supplier ที่รับเข้า", eq.supplier] : null,
            eq.zone ? ["โซน", eq.zone] : null,
            ["หมายเหตุ", eq.note || "—"],
            ["แก้ล่าสุด", <span key="u" className="mono">{bangkokDateTime(eq.updatedAt)}</span>],
          ]}
        />
        {eq.customerId ? (
          <Button component={Link} href={`/partners/${eq.customerId}`} size="small" sx={{ mt: 1 }}>
            ไปข้อมูลลูกค้า
          </Button>
        ) : null}
      </WomsFormSection>

      <WomsFormSection title="แก้ไขข้อมูลเครื่อง">
        <EquipmentForm
          key={eq.updatedAt}
          options={options}
          initial={eq}
          submitLabel="บันทึกการแก้ไข"
          busy={busy}
          fieldError={fieldError}
          onSubmit={save}
          extraActions={
            has("equipment:delete") ? (
              <Button color="error" variant="outlined" startIcon={<DeleteOutlineIcon />} onClick={remove} disabled={deleting}>
                {deleting ? "กำลังลบ…" : "ลบเครื่อง"}
              </Button>
            ) : undefined
          }
        />
      </WomsFormSection>

      <EquipmentContractCard equipmentId={id} rentalWithoutContract={eq.rentalWithoutContract} />
      {/* รอบ PM — ค่าที่ derive ทั้งหมดมาจาก backend */}
      <EquipmentPmCard equipment={eq} onSaved={setEq} />

      <EquipmentFinanceCard equipmentId={id} />

      {/* ไทม์ไลน์รวม (ประวัติเครื่อง + ใบงาน) — แท็บและการกรองทำที่ backend */}
      <EquipmentTimeline equipment={eq} />

      {/* CORE-04 / BR-13.2: ประวัติผู้ถือครอง (สร้างจากประวัติเครื่อง ไม่มีตารางซ้ำ) */}
      <HoldingHistory equipmentId={id} version={eq.updatedAt} />

      {/* ประวัติดิบ + ฟอร์มย้ายเครื่อง + แก้หมายเหตุ — ของเดิม ไม่ถูกตัดออก */}
      <EquipmentHistory equipment={eq} options={options} onMoved={setEq} />
    </>
  );
}

function WarrantyList(list: Equipment["warranties"], empty: string) {
  if (!list.length) return empty || "—";
  return (
    <Stack spacing={0.5}>
      {list.map((w, i) => (
        <span key={i}>
          {w.providerName ? `${w.providerName} · ` : ""}
          {w.start ? `เริ่ม ${w.start} · ` : ""}
          {w.months ? `${w.months} เดือน · ` : ""}
          หมด <span className="mono">{w.end || "—"}</span> <WarrantyBadge status={w.status} />
        </span>
      ))}
    </Stack>
  );
}

type HoldingPeriod = { customerName: string; partnerId: string; siteId: string; siteLabel: string; from: string; to: string };

/** ประวัติผู้ถือครอง — GET /api/customers/equipment/:id/holding (มีอยู่แล้วที่ backend แต่เดิมไม่มีหน้าใดเรียก) */
function HoldingHistory({ equipmentId, version }: { equipmentId: string; version: string }) {
  const [periods, setPeriods] = useState<HoldingPeriod[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setError(null);
    api
      .equipmentHolding(equipmentId)
      .then((r) => {
        if (!cancelled) setPeriods(((r as { periods?: HoldingPeriod[] }).periods ?? []) as HoldingPeriod[]);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "โหลดประวัติผู้ถือครองไม่สำเร็จ");
      });
    return () => {
      cancelled = true;
    };
  }, [equipmentId, version]);

  return (
    <WomsFormSection title="ประวัติผู้ถือครอง">
      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : periods === null ? (
        <Typography variant="body2">กำลังโหลด…</Typography>
      ) : !periods.length ? (
        <Typography variant="body2">ยังไม่มีประวัติผู้ถือครอง</Typography>
      ) : (
        <Stack spacing={1}>
          {[...periods].reverse().map((p, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
              <Typography sx={{ fontWeight: 600, color: "text.primary" }}>
                {p.partnerId ? (
                  <Link href={`/partners/${p.partnerId}`}>{p.customerName || "(ไม่ระบุชื่อ)"}</Link>
                ) : (
                  p.customerName || "ETE (เครื่องว่าง)"
                )}
              </Typography>
              <Typography variant="body2">
                <span className="mono">{p.from || "—"}</span> ถึง <span className="mono">{p.to || "ปัจจุบัน"}</span>
                {p.siteLabel ? ` · ${p.siteLabel}` : ""}
              </Typography>
            </Paper>
          ))}
        </Stack>
      )}
    </WomsFormSection>
  );
}

/** MCH-04: เลือกเครื่องใหม่ที่มาแทนเครื่องนี้ — ทั้งสองเครื่องยังเป็นคนละระเบียน ประวัติแยกกัน */
function ReplaceDialog({
  open,
  equipment,
  onClose,
  onDone,
}: {
  open: boolean;
  equipment: Equipment;
  onClose: () => void;
  onDone: (updatedOld: Equipment) => void;
}) {
  const [candidates, setCandidates] = useState<Equipment[]>([]);
  const [picked, setPicked] = useState<Equipment | null>(null);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    setNote("");
    setError(null);
    setDate(new Date().toISOString().slice(0, 10));
    api
      .listEquipment({})
      .then((r) => setCandidates(r.items.filter((e) => e.id !== equipment.id && !e.replacesId && !e.replacedById)))
      .catch(() => setCandidates([]));
  }, [open, equipment.id]);

  const submit = async () => {
    if (!picked) {
      setError("เลือกเครื่องใหม่ก่อน");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api.replaceEquipment(equipment.id, { newEquipmentId: picked.id, date, note });
      onDone(r.old);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>เปลี่ยนเครื่องทดแทน {equipment.serial}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2">
            ระบบเก็บเครื่องเดิมและเครื่องใหม่แยกกัน (ตัวตนและประวัติไม่รวมกัน) · สถานะเครื่องและการผูกสัญญาให้แก้ตามจริงภายหลัง
            (การปรับสถานะหลังสิ้นสุดเช่าซื้อรอยืนยัน Q-14)
          </Typography>
          <Autocomplete
            options={candidates}
            value={picked}
            onChange={(_, v) => setPicked(v)}
            getOptionLabel={(e) => `${e.serial} · ${e.model || "-"}${e.holderName ? ` · ${e.holderName}` : ""}`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => <TextField {...params} label="เครื่องใหม่" required />}
          />
          <TextField label="วันที่เปลี่ยน" type="date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="เหตุผล / หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy}>
          {busy ? "กำลังบันทึก…" : "บันทึกการเปลี่ยนเครื่อง"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
