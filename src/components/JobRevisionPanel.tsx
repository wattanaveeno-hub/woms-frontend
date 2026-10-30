"use client";

// ---------------------------------------------------------------------------
// Q-R3-13 (อนุมัติ Option B แบบควบคุม) — แก้ไขหลังปิดงาน บนหน้ารายละเอียดใบงานที่ปิดแล้ว
//   · ปุ่ม "ขอแก้ไขหลังปิดงาน" (ผู้มีสิทธิ์ปิดงาน) → กรอกเหตุผล + ค่าที่ขอแก้ (ข้อมูลยังไม่เปลี่ยนจนกว่า Manager อนุมัติ)
//   · ประวัติการแก้ไข: ฉบับปิดงาน (ต้นฉบับ) และทุกคำขอ — ใคร เมื่อไร เพราะอะไร ผลการพิจารณา สถานะลายเซ็น
//   · Manager พิจารณา (อนุมัติ/ไม่อนุมัติ พร้อมเหตุผล) — ผู้ขอพิจารณาคำขอตนเองไม่ได้
//   · ลงนามใหม่: ลูกค้าเซ็นพร้อมกรอกชื่อของตนเอง (ระบบไม่เติมชื่อช่าง) · ช่างผู้รับผิดชอบลงนามด้วยบัญชีตนเอง
//   · P-07: คำขอมีส่วน "อะไหล่ที่ใช้" (เพิ่ม/แก้/ลบ รายเครื่อง) — ต้นทุนกรอก/เห็นเฉพาะผู้มีสิทธิ์ (API ซ่อนให้ผู้อื่นอยู่แล้ว)
//     JobPartsCard บนใบงานที่ปิดแล้วเปิดฟอร์มนี้ผ่าน event "woms:revision-request" (ส่วนอะไหล่)
//   · P-08: Manager "มอบหมายช่างเก็บลายเซ็น" บนฉบับที่รอลงนามใหม่ — ผู้ถูกมอบหมายเห็นปุ่มลงนามใหม่ (มือถือ/เดสก์ท็อป)
// กติกาทั้งหมดตรวจซ้ำที่ backend (routes/jobRevisions.ts)
import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { api, ApiError } from "@/lib/api";
import type { AuthUser, Job, JobEquipmentLine, Part } from "@/lib/types";
import { partsApi, type JobLineParts } from "@/lib/partsApi";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import SignaturePad from "@/components/SignaturePad";
import { WomsFormSection } from "@/components/woms";
import { bangkokDateTime } from "@/lib/date";
import { isInstallType } from "@/lib/installType";
import { jobRevisionApi, JobRevision, JobRevisionList } from "@/lib/jobRevisionApi";
import {
  PartsLineDraft,
  RevisionForm,
  SIGNER_TYPE_LABELS,
  SignerType,
  buildPartsChanges,
  buildRevisionChanges,
  canDecideRevision,
  canDesignateCollector,
  collectorFormProblem,
  initialPartsDraft,
  revisionFieldLabel,
  canRequestRevision,
  customerNameProblem,
  initialRevisionForm,
  missingSigners,
  resignActionsFor,
  revisionFormProblem,
} from "@/lib/jobRevisionRules";

interface Props {
  job: Job;
  lines: JobEquipmentLine[];
  technicianNames: string[];
  /** หลังอนุมัติ/ลงนาม — ให้หน้าใบงานโหลดข้อมูลใหม่ */
  onChanged: () => void;
}

/** รายการผลต่าง (ข้อความต้นทุนถูกตัดที่ API สำหรับผู้ไม่มีสิทธิ์) */
function DiffList({ diff, sx }: { diff: Array<{ field: string; before: string; after: string }>; sx?: object }) {
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5, ...(sx ?? {}) }}>
      {diff.map((d, i) => (
        <li key={i} data-testid={d.field.startsWith("partsUsed[") ? "revision-diff-parts" : undefined}>
          <Typography variant="body2">
            <span className="code">{revisionFieldLabel(d.field)}</span>: {d.before || "—"} → <strong>{d.after || "—"}</strong>
          </Typography>
        </li>
      ))}
    </Box>
  );
}

/** event ที่ JobPartsCard ส่งเพื่อเปิดฟอร์มขอแก้ไข (ใบงานที่ปิดแล้ว) */
export const REVISION_REQUEST_EVENT = "woms:revision-request";

const statusColor = (s: string): "default" | "warning" | "success" | "error" | "info" =>
  s === "REQUESTED" ? "warning" : s === "APPROVED" ? "success" : s === "REJECTED" ? "error" : s === "ORIGINAL" ? "info" : "default";

export default function JobRevisionPanel({ job, lines, technicianNames, onChanged }: Props) {
  const { user, has } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<JobRevisionList | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  // ---- คำขอแก้ไข ----
  const [reqOpen, setReqOpen] = useState(false);
  const [form, setForm] = useState<RevisionForm | null>(null);
  const [formError, setFormError] = useState("");
  // ---- พิจารณา ----
  const [decide, setDecide] = useState<{ rev: JobRevision; decision: "APPROVE" | "REJECT" } | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  // ---- ลงนามใหม่ ----
  const [resign, setResign] = useState<{ rev: JobRevision; signerType: SignerType } | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signature, setSignature] = useState("");
  const [resignError, setResignError] = useState("");
  // ---- P-07 อะไหล่ ----
  const [partsLines, setPartsLines] = useState<JobLineParts[]>([]);
  const [partsDraft, setPartsDraft] = useState<PartsLineDraft[]>([]);
  const [partOptions, setPartOptions] = useState<Part[]>([]);
  // ---- P-08 ช่างเก็บลายเซ็น ----
  const [collectorOpen, setCollectorOpen] = useState(false);
  const [techs, setTechs] = useState<AuthUser[]>([]);
  const [collectorTech, setCollectorTech] = useState("");
  const [collectorReason, setCollectorReason] = useState("");
  const [collectorError, setCollectorError] = useState("");
  const canEditCost = has("parts:cost_edit");
  const showCost = has("parts:cost_view");

  const install = isInstallType(job.jobType);
  const load = useCallback(async () => {
    try {
      setData(await jobRevisionApi.list(job.jobId));
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "โหลดประวัติการแก้ไขไม่สำเร็จ");
    }
  }, [job.jobId]);
  useEffect(() => {
    void load();
  }, [load, job.updatedAt]);

  const current = useMemo(() => {
    const cur = data?.currentRevisionNo ?? 0;
    return cur ? data?.items.find((r) => r.revisionNo === cur) ?? null : null;
  }, [data]);
  const missing = current ? missingSigners(current) : [];
  // ADV5-01: ปุ่มบันทึกลายเซ็นลูกค้าเฉพาะช่างที่ได้รับมอบหมายในใบงานนี้ (ลูกค้าเซ็นที่หน้างาน) — backend ตอบ 403 กับคนอื่น
  const collectorId = current?.signatureCollector?.technicianId ?? "";
  const myResign =
    current && user ? resignActionsFor(missing, job as any, user.id, has, { role: user.role, decidedById: current.decidedById, collectorId }) : [];

  const openRequest = useCallback(() => {
    setForm(initialRevisionForm(job, lines as any));
    setFormError("");
    setPartsDraft([]);
    setReqOpen(true);
    // P-07: รายการอะไหล่ปัจจุบันรายเครื่อง + รายชื่ออะไหล่ (ผู้ไม่มีสิทธิ์ดูคลังจะไม่มีตัวเลือกเพิ่ม — แก้/ลบรายการเดิมได้)
    partsApi
      .jobLines(job.jobId)
      .then((r) => {
        setPartsLines(r.items);
        setPartsDraft(initialPartsDraft(r.items as any));
      })
      .catch(() => {
        setPartsLines([]);
        setPartsDraft([]);
      });
    api
      .listParts({ activeOnly: true })
      .then((r) => setPartOptions(r.items))
      .catch(() => setPartOptions([]));
  }, [job, lines]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ jobId?: string }>).detail;
      if (!d?.jobId || d.jobId === job.jobId) openRequest();
    };
    window.addEventListener(REVISION_REQUEST_EVENT, onOpen);
    return () => window.removeEventListener(REVISION_REQUEST_EVENT, onOpen);
  }, [job.jobId, openRequest]);

  // รายการเครื่องโหลดแยกจากใบงาน — เปิดฟอร์มก่อนโหลดเสร็จ ให้เติมเครื่องเมื่อมาถึง (ยังไม่ได้แก้อะไรในส่วนเครื่อง)
  useEffect(() => {
    if (!reqOpen || !lines.length) return;
    setForm((f) => (f && f.lines.length === 0 ? { ...f, lines: initialRevisionForm(job, lines as any).lines } : f));
  }, [reqOpen, lines, job]);

  const updatePartsLine = (lineId: string, fn: (l: PartsLineDraft) => PartsLineDraft) =>
    setPartsDraft((ds) => ds.map((d) => (d.lineId === lineId ? fn(d) : d)));

  const submitRequest = async () => {
    if (!form) return;
    const base = buildRevisionChanges(form, job, lines as any, install);
    const parts = buildPartsChanges(partsDraft, partsLines as any, canEditCost);
    if (parts.problem) return setFormError(parts.problem);
    const changes = { ...base, ...(parts.changes.length ? { partsChanges: parts.changes } : {}) };
    const p = revisionFormProblem(form, changes);
    if (p) return setFormError(p);
    setBusy(true);
    try {
      await jobRevisionApi.request(job.jobId, form.reason.trim(), changes);
      toast.success("ส่งคำขอแก้ไขหลังปิดงานแล้ว — ข้อมูลยังไม่เปลี่ยนจนกว่า Manager อนุมัติ");
      setReqOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "ส่งคำขอไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const submitDecision = async () => {
    if (!decide) return;
    if (decisionNote.trim().length < 3) return toast.error("ต้องระบุเหตุผลการพิจารณา");
    setBusy(true);
    try {
      await jobRevisionApi.decide(job.jobId, decide.rev.revisionId, decide.decision, decisionNote.trim());
      toast.success(decide.decision === "APPROVE" ? "อนุมัติแล้ว — สร้างฉบับแก้ไขใหม่" : "ไม่อนุมัติคำขอแล้ว");
      setDecide(null);
      setDecisionNote("");
      await load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "บันทึกการพิจารณาไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (rev: JobRevision) => {
    setBusy(true);
    try {
      await jobRevisionApi.withdraw(job.jobId, rev.revisionId);
      toast.success("ยกเลิกคำขอแล้ว");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ยกเลิกคำขอไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const openCollector = () => {
    setCollectorTech(collectorId);
    setCollectorReason("");
    setCollectorError("");
    setCollectorOpen(true);
    api
      .listTechnicians()
      .then((r) => setTechs(r.items.filter((t) => (t as any).active !== false)))
      .catch(() => setTechs([]));
  };
  const submitCollector = async () => {
    if (!current) return;
    const p = collectorFormProblem(collectorTech, collectorReason);
    if (p) return setCollectorError(p);
    setBusy(true);
    try {
      const r = await jobRevisionApi.designateCollector(job.jobId, current.revisionId, collectorTech, collectorReason.trim());
      toast.success(`มอบหมาย ${r.collector.technicianName} เก็บลายเซ็นแล้ว — ไม่เปลี่ยนช่างผู้รับผิดชอบของใบงาน`);
      setCollectorOpen(false);
      await load();
    } catch (e) {
      setCollectorError(e instanceof ApiError ? e.message : "มอบหมายไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const openResign = (rev: JobRevision, signerType: SignerType) => {
    // ลายเซ็นลูกค้า: ช่องชื่อเริ่มว่างเสมอ — ไม่เติมชื่อช่างหรือชื่อผู้เซ็นเดิม
    setSignerName("");
    setSignature("");
    setResignError("");
    setResign({ rev, signerType });
  };
  const submitResign = async () => {
    if (!resign) return;
    if (!signature) return setResignError("กรุณาลงนามในกรอบ");
    if (resign.signerType === "CUSTOMER") {
      const p = customerNameProblem(signerName, [user?.name ?? "", (job as any).closedByName ?? "", resign.rev.requestedBy ?? "", resign.rev.decidedBy ?? "", ...technicianNames]);
      if (p) return setResignError(p);
    }
    setBusy(true);
    try {
      const r = await jobRevisionApi.resign(job.jobId, resign.rev.revisionId, {
        signerType: resign.signerType,
        ...(resign.signerType === "CUSTOMER" ? { signerName: signerName.trim() } : {}),
        signature,
      });
      toast.success(r.completed ? "ลงนามใหม่ครบแล้ว" : `บันทึกลายเซ็น${SIGNER_TYPE_LABELS[resign.signerType]}แล้ว`);
      setResign(null);
      // P-08: ช่างเก็บลายเซ็น (ไม่ได้อยู่ในใบงาน) เห็นใบงานเฉพาะระหว่างรอลงนาม — ลงนามครบแล้วกลับหน้ารายการงาน
      if (r.completed && (job as any).signatureCollectorAccess) {
        window.location.assign(window.location.pathname.startsWith("/m/") ? "/m" : "/");
        return;
      }
      await load();
      onChanged();
    } catch (e) {
      setResignError(e instanceof ApiError ? e.message : "บันทึกลายเซ็นไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  if (job.status !== "CLOSED") return null;
  const pending = data?.pending ?? null;
  const showRequest = canRequestRevision(job.status, has, !!pending);
  const items = data?.items ?? [];

  return (
    <WomsFormSection
      title="การแก้ไขหลังปิดงาน"
      actions={
        showRequest ? (
          <Button variant="outlined" onClick={openRequest} data-testid="revision-request-open">
            ขอแก้ไขหลังปิดงาน
          </Button>
        ) : undefined
      }
    >
      {loadError ? <Alert severity="warning">{loadError}</Alert> : null}
      {current && current.signatureStatus === "PENDING_RESIGN" ? (
        <Alert severity="warning" sx={{ mb: 2 }} data-testid="revision-resign-pending">
          <strong>รอลงนามใหม่</strong> — ฉบับแก้ไข r{current.revisionNo} เปลี่ยนข้อมูลที่ลงนามไว้ ลายเซ็นเดิมไม่ครอบคลุมฉบับนี้ (ยังเก็บไว้เป็นประวัติ) ·
          ขาด: {missing.map((t) => SIGNER_TYPE_LABELS[t]).join(", ")}
          {myResign.length ? (
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              {myResign.map((t) => (
                <Button key={t} size="small" variant="contained" color="warning" onClick={() => openResign(current, t)} data-testid={`resign-${t}`}>
                  {t === "CUSTOMER" ? "ให้ลูกค้าลงนามใหม่" : "ช่างลงนามยืนยันฉบับใหม่"}
                </Button>
              ))}
            </Stack>
          ) : null}
          {missing.includes("CUSTOMER") && !myResign.includes("CUSTOMER") ? (
            <Typography variant="body2" sx={{ mt: 1 }} data-testid="resign-customer-onsite-hint">
              ลายเซ็นลูกค้าต้องบันทึกที่หน้างานโดยช่างที่ได้รับมอบหมายในใบงานนี้ หรือช่างเก็บลายเซ็นที่ Manager มอบหมาย (จากบัญชีของช่าง)
            </Typography>
          ) : null}
          {current.signatureCollector ? (
            <Typography variant="body2" sx={{ mt: 1 }} data-testid="revision-collector">
              ช่างเก็บลายเซ็น: <strong>{current.signatureCollector.technicianName}</strong> (มอบหมายโดย {current.signatureCollector.designatedBy} ·{" "}
              {bangkokDateTime(current.signatureCollector.designatedAt)} · {current.signatureCollector.reason})
            </Typography>
          ) : null}
          {canDesignateCollector(current, has) ? (
            <Button size="small" variant="outlined" color="warning" sx={{ mt: 1 }} onClick={openCollector} data-testid="revision-collector-open">
              มอบหมายช่างเก็บลายเซ็น
            </Button>
          ) : null}
        </Alert>
      ) : current && current.signatureStatus === "RESIGNED" ? (
        <Alert severity="success" sx={{ mb: 2 }} data-testid="revision-resigned">
          ฉบับแก้ไข r{current.revisionNo} ลงนามใหม่ครบแล้ว
        </Alert>
      ) : null}
      {pending ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          มีคำขอแก้ไขรอ Manager พิจารณา (คำขอที่ {pending.requestNo} โดย {pending.requestedBy}) — ข้อมูลใบงานยังเป็นฉบับเดิม
        </Alert>
      ) : null}
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          ยังไม่มีการแก้ไขหลังปิดงาน — ข้อมูลที่แสดงคือฉบับ ณ ปิดงาน
        </Typography>
      ) : (
        <Stack spacing={1.25} data-testid="revision-history">
          {items.map((r) => (
            <Box key={r.revisionId} sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.25 }} data-testid={`revision-row-${r.status}`}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {r.status === "ORIGINAL" ? "r0 · ฉบับปิดงาน" : r.revisionNo !== null ? `r${r.revisionNo} · คำขอที่ ${r.requestNo}` : `คำขอที่ ${r.requestNo}`}
                </Typography>
                <Chip size="small" color={statusColor(r.status)} label={r.statusLabel} />
                {r.status === "APPROVED" ? (
                  <Chip
                    size="small"
                    variant="outlined"
                    color={r.signatureStatus === "PENDING_RESIGN" ? "warning" : r.signatureStatus === "RESIGNED" ? "success" : "default"}
                    label={r.signatureStatusLabel}
                  />
                ) : null}
              </Stack>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {r.status === "ORIGINAL" ? "ปิดงานโดย" : "ขอโดย"} {r.requestedBy || "—"}
                {r.requestedAt ? <> · <span className="mono">{bangkokDateTime(r.requestedAt)}</span></> : null}
                {r.reason && r.status !== "ORIGINAL" ? <> · เหตุผล: {r.reason}</> : null}
              </Typography>
              {r.decidedAt && r.status !== "ORIGINAL" ? (
                <Typography variant="body2">
                  {r.status === "WITHDRAWN" ? "ยกเลิกโดย" : "พิจารณาโดย"} {r.decidedBy} · <span className="mono">{bangkokDateTime(r.decidedAt)}</span>
                  {r.decisionNote ? <> · {r.decisionNote}</> : null}
                </Typography>
              ) : null}
              {r.diff?.length ? <DiffList diff={r.diff} sx={{ mt: 0.5 }} /> : null}
              {r.supersededSignatures?.length ? (
                <Typography variant="body2" color="warning.main" sx={{ mt: 0.5 }}>
                  ลายเซ็นที่ไม่ครอบคลุมฉบับนี้: {r.supersededSignatures.map((s) => `${SIGNER_TYPE_LABELS[s.signerType]} (ฉบับ r${s.fromRevisionNo})`).join(", ")} — เก็บไว้เป็นประวัติ ไม่ถูกลบ
                </Typography>
              ) : null}
              {r.resigns?.length ? (
                <Typography variant="body2" sx={{ mt: 0.5 }} data-testid="revision-resigns">
                  ลงนามใหม่: {r.resigns.map((s) => `${s.signerTypeLabel} ${s.signerName} (บันทึกโดย ${s.capturedBy} · ${bangkokDateTime(s.at)}${s.captureDevice?.userAgent ? ` · อุปกรณ์ ${s.captureDevice.userAgent.slice(0, 60)}` : ""})`).join(" · ")}
                </Typography>
              ) : null}
              {r.installDateChanges?.length && r.status === "APPROVED" ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  วันที่ติดตั้งเปลี่ยน — ระบบไม่คำนวณแผน PM ใหม่อัตโนมัติ (มีรายการติดตามให้ Admin ตรวจฐาน PM)
                </Typography>
              ) : null}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                {user && canDecideRevision(r, user.id, has) ? (
                  <>
                    <Button size="small" variant="contained" onClick={() => setDecide({ rev: r, decision: "APPROVE" })} data-testid="revision-approve">
                      อนุมัติ
                    </Button>
                    <Button size="small" color="error" variant="outlined" onClick={() => setDecide({ rev: r, decision: "REJECT" })} data-testid="revision-reject">
                      ไม่อนุมัติ
                    </Button>
                  </>
                ) : null}
                {r.status === "REQUESTED" && user && r.requestedById === user.id ? (
                  <Button size="small" disabled={busy} onClick={() => void withdraw(r)}>
                    ยกเลิกคำขอ
                  </Button>
                ) : null}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {/* ---- คำขอแก้ไข ---- */}
      <Dialog open={reqOpen} onClose={() => !busy && setReqOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>ขอแก้ไขหลังปิดงาน {job.jobId}</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            แก้ได้เฉพาะหมายเหตุปิดงาน รายละเอียดงานรายเครื่อง{install ? " วันที่ติดตั้งจริง" : ""} และอะไหล่ที่ใช้ · ข้อมูลการเงิน (ใบเสนอราคา/รับชำระ/สัญญา/บิล) ต้องใช้ขั้นตอน D-11 ·
            เมื่อ Manager อนุมัติ ระบบเก็บฉบับเดิมไว้ · แก้ข้อมูลที่ลงนามไว้ต้องให้ลูกค้า + ช่างลงนามใหม่ (อะไหล่ไม่อยู่ในข้อมูลที่ลงนาม)
          </Alert>
          {form ? (
            <Stack spacing={2}>
              <TextField
                label="เหตุผลการขอแก้ไข *"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                multiline
                minRows={2}
                inputProps={{ "data-testid": "revision-reason" }}
              />
              <TextField
                label="หมายเหตุปิดงาน"
                value={form.closeNote}
                onChange={(e) => setForm({ ...form, closeNote: e.target.value })}
                multiline
                minRows={2}
                inputProps={{ "data-testid": "revision-closeNote" }}
              />
              {form.lines.map((l, i) => (
                <Box key={l.lineId} sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.25 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    เครื่อง <span className="code">{l.serial}</span>
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <TextField
                      label="รายละเอียดงานที่ทำ"
                      value={l.resultNote}
                      fullWidth
                      onChange={(e) => {
                        const next = [...form.lines];
                        next[i] = { ...l, resultNote: e.target.value };
                        setForm({ ...form, lines: next });
                      }}
                      inputProps={{ "data-testid": `revision-resultNote-${i}` }}
                    />
                    {install ? (
                      <TextField
                        label="วันที่ติดตั้งเสร็จจริง"
                        type="date"
                        value={l.installedOn}
                        InputLabelProps={{ shrink: true }}
                        onChange={(e) => {
                          const next = [...form.lines];
                          next[i] = { ...l, installedOn: e.target.value };
                          setForm({ ...form, lines: next });
                        }}
                        inputProps={{ "data-testid": `revision-installedOn-${i}` }}
                      />
                    ) : null}
                  </Stack>
                </Box>
              ))}
              {/* ---- P-07 อะไหล่ที่ใช้ ---- */}
              {partsDraft.length ? (
                <Box data-testid="revision-parts-section">
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    อะไหล่ที่ใช้ (รายเครื่อง){canEditCost ? "" : " · ต้นทุนแก้ได้เฉพาะ Admin/Manager"}
                  </Typography>
                  <Stack spacing={1.25}>
                    {partsDraft.map((pl) => (
                      <Box key={pl.lineId} sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.25 }} data-testid={`revision-parts-line-${pl.serial}`}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                          เครื่อง <span className="code">{pl.serial || "—"}</span>
                        </Typography>
                        <Stack spacing={1}>
                          {pl.uses.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                              ยังไม่มีอะไหล่ที่ใช้
                            </Typography>
                          ) : null}
                          {pl.uses.map((u, ui) => (
                            <Stack key={u.useId} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                              <Typography variant="body2" sx={{ minWidth: 160, textDecoration: u.remove ? "line-through" : "none" }}>
                                <span className="mono">{u.partCode}</span> {u.partName}
                              </Typography>
                              <TextField
                                size="small"
                                label={`จำนวน (${u.unit})`}
                                value={u.qty}
                                disabled={u.remove}
                                inputProps={{ inputMode: "decimal", "data-testid": `revision-part-qty-${pl.serial}-${ui}` }}
                                onChange={(e) => updatePartsLine(pl.lineId, (l) => ({ ...l, uses: l.uses.map((x) => (x.useId === u.useId ? { ...x, qty: e.target.value } : x)) }))}
                                sx={{ maxWidth: 140 }}
                              />
                              {canEditCost ? (
                                <TextField
                                  size="small"
                                  label="ต้นทุน/หน่วย"
                                  value={u.unitCost}
                                  disabled={u.remove}
                                  inputProps={{ inputMode: "decimal" }}
                                  onChange={(e) => updatePartsLine(pl.lineId, (l) => ({ ...l, uses: l.uses.map((x) => (x.useId === u.useId ? { ...x, unitCost: e.target.value } : x)) }))}
                                  sx={{ maxWidth: 140 }}
                                />
                              ) : null}
                              <TextField
                                size="small"
                                label="หมายเหตุ"
                                value={u.note}
                                disabled={u.remove}
                                onChange={(e) => updatePartsLine(pl.lineId, (l) => ({ ...l, uses: l.uses.map((x) => (x.useId === u.useId ? { ...x, note: e.target.value } : x)) }))}
                              />
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={u.remove}
                                    onChange={(e) => updatePartsLine(pl.lineId, (l) => ({ ...l, uses: l.uses.map((x) => (x.useId === u.useId ? { ...x, remove: e.target.checked } : x)) }))}
                                    inputProps={{ "aria-label": `ลบ ${u.partCode}` }}
                                  />
                                }
                                label="ลบรายการ"
                              />
                            </Stack>
                          ))}
                          {pl.adds.map((a) => {
                            const selected = partOptions.find((p) => p.id === a.partId) ?? null;
                            const setAdd = (patch: Partial<typeof a>) =>
                              updatePartsLine(pl.lineId, (l) => ({ ...l, adds: l.adds.map((x) => (x.key === a.key ? { ...x, ...patch } : x)) }));
                            return (
                              <Stack key={a.key} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} data-testid="revision-part-add-row">
                                <Autocomplete
                                  size="small"
                                  options={partOptions}
                                  value={selected}
                                  getOptionLabel={(p) => `${p.code} · ${p.name}`}
                                  isOptionEqualToValue={(x, y) => x.id === y.id}
                                  onChange={(_e, p) => setAdd({ partId: p?.id ?? "", unit: p?.unit ?? "" })}
                                  renderInput={(params) => <TextField {...params} label="อะไหล่ที่เพิ่ม" />}
                                  sx={{ minWidth: 220, flex: 1 }}
                                />
                                <TextField size="small" label="จำนวน" value={a.qty} inputProps={{ inputMode: "decimal" }} onChange={(e) => setAdd({ qty: e.target.value })} sx={{ maxWidth: 120 }} />
                                {canEditCost ? (
                                  <TextField size="small" label="ต้นทุน/หน่วย" value={a.unitCost} inputProps={{ inputMode: "decimal" }} onChange={(e) => setAdd({ unitCost: e.target.value })} sx={{ maxWidth: 140 }} />
                                ) : null}
                                <TextField size="small" label="หมายเหตุ" value={a.note} onChange={(e) => setAdd({ note: e.target.value })} />
                                <Button size="small" color="error" onClick={() => updatePartsLine(pl.lineId, (l) => ({ ...l, adds: l.adds.filter((x) => x.key !== a.key) }))}>
                                  เอาออก
                                </Button>
                              </Stack>
                            );
                          })}
                          {partOptions.length ? (
                            <Box>
                              <Button
                                size="small"
                                onClick={() =>
                                  updatePartsLine(pl.lineId, (l) => ({
                                    ...l,
                                    adds: [...l.adds, { key: `${Date.now()}-${l.adds.length}`, partId: "", qty: "1", unit: "", unitCost: "", note: "" }],
                                  }))
                                }
                                data-testid={`revision-part-add-${pl.serial}`}
                              >
                                + เพิ่มอะไหล่
                              </Button>
                            </Box>
                          ) : null}
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                  {!showCost ? (
                    <Typography variant="caption" color="text.secondary">
                      ไม่แสดงต้นทุนอะไหล่ตามสิทธิ์ของคุณ (D-18)
                    </Typography>
                  ) : null}
                </Box>
              ) : null}
              {formError ? <Alert severity="error">{formError}</Alert> : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReqOpen(false)} disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant="contained" onClick={() => void submitRequest()} disabled={busy} data-testid="revision-request-submit">
            ส่งคำขอให้ Manager พิจารณา
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---- Manager พิจารณา ---- */}
      <Dialog open={!!decide} onClose={() => !busy && setDecide(null)} fullWidth maxWidth="sm">
        <DialogTitle>{decide?.decision === "APPROVE" ? "อนุมัติคำขอแก้ไขหลังปิดงาน" : "ไม่อนุมัติคำขอแก้ไข"}</DialogTitle>
        <DialogContent dividers>
          {decide ? (
            <>
              <Typography variant="body2" sx={{ mb: 1 }}>
                คำขอที่ {decide.rev.requestNo} โดย {decide.rev.requestedBy} — {decide.rev.reason}
              </Typography>
              <DiffList diff={decide.rev.diff} sx={{ mb: 1.5 }} />
              {decide.decision === "APPROVE" ? (
                <Alert severity="warning" sx={{ mb: 1.5 }}>
                  อนุมัติแล้วข้อมูลใบงานจะเปลี่ยนเป็นฉบับใหม่ (ฉบับเดิมเก็บไว้) · ถ้าแก้ข้อมูลที่ลงนามไว้ ต้องให้ลูกค้า + ช่างลงนามใหม่ (แก้เฉพาะอะไหล่ไม่ต้องลงนามใหม่)
                </Alert>
              ) : null}
              <TextField
                label="เหตุผลการพิจารณา *"
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                fullWidth
                multiline
                minRows={2}
                inputProps={{ "data-testid": "revision-decision-note" }}
              />
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDecide(null)} disabled={busy}>
            ปิด
          </Button>
          <Button
            variant="contained"
            color={decide?.decision === "APPROVE" ? "primary" : "error"}
            onClick={() => void submitDecision()}
            disabled={busy}
            data-testid="revision-decision-submit"
          >
            {decide?.decision === "APPROVE" ? "ยืนยันอนุมัติ" : "ยืนยันไม่อนุมัติ"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---- P-08 มอบหมายช่างเก็บลายเซ็น ---- */}
      <Dialog open={collectorOpen} onClose={() => !busy && setCollectorOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>มอบหมายช่างเก็บลายเซ็น r{current?.revisionNo}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Alert severity="info">
              ช่างที่เลือกจะบันทึกลายเซ็นลูกค้า (ลูกค้ากรอกชื่อและเซ็นเอง) และลงนามฝั่งช่างในนามตนเองได้ · ไม่เปลี่ยนช่างผู้รับผิดชอบของใบงาน ·
              มอบหมายใหม่จะแทนคนเดิม (เก็บประวัติไว้)
            </Alert>
            <TextField
              select
              label="ช่างที่ใช้งานอยู่ *"
              value={collectorTech}
              onChange={(e) => setCollectorTech(e.target.value)}
              inputProps={{ "data-testid": "collector-tech" }}
              SelectProps={{ SelectDisplayProps: { "data-testid": "collector-tech-select" } as any }}
            >
              {techs.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="เหตุผล *"
              value={collectorReason}
              onChange={(e) => setCollectorReason(e.target.value)}
              multiline
              minRows={2}
              inputProps={{ "data-testid": "collector-reason" }}
            />
            {collectorError ? <Alert severity="error" data-testid="collector-error">{collectorError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCollectorOpen(false)} disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant="contained" onClick={() => void submitCollector()} disabled={busy} data-testid="collector-submit">
            มอบหมาย
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---- ลงนามใหม่ ---- */}
      <Dialog open={!!resign} onClose={() => !busy && setResign(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {resign?.signerType === "CUSTOMER" ? "ลูกค้าลงนามรับทราบฉบับแก้ไข" : "ช่างลงนามยืนยันฉบับแก้ไข"} r{resign?.rev.revisionNo}
        </DialogTitle>
        <DialogContent dividers>
          {resign ? (
            <Stack spacing={1.5}>
              <DiffList diff={resign.rev.diff} />
              {resign.signerType === "CUSTOMER" ? (
                <>
                  <Alert severity="info">
                    ส่งอุปกรณ์ให้ลูกค้ากรอกชื่อและเซ็นเอง — ช่างลงนามแทนลูกค้าไม่ได้ · ระบบบันทึกว่า {user?.name} เป็นผู้บันทึก
                  </Alert>
                  <TextField
                    label="ชื่อลูกค้า/ผู้ตรวจรับที่ลงนาม *"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    autoComplete="off"
                    inputProps={{ "data-testid": "resign-signer-name" }}
                  />
                  <SignaturePad onChange={setSignature} hint="ให้ลูกค้าเซ็นในกรอบด้านบน" />
                </>
              ) : (
                <>
                  <Alert severity="info">ลงนามในนาม <strong>{user?.name}</strong> (บัญชีที่เข้าสู่ระบบ) ยืนยันข้อมูลฉบับแก้ไขนี้</Alert>
                  <SignaturePad onChange={setSignature} hint="ช่างผู้รับผิดชอบเซ็นในกรอบด้านบน" />
                </>
              )}
              {resignError ? <Alert severity="error" data-testid="resign-error">{resignError}</Alert> : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResign(null)} disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant="contained" disabled={busy || !signature} onClick={() => void submitResign()} data-testid="resign-submit">
            บันทึกลายเซ็น
          </Button>
        </DialogActions>
      </Dialog>
    </WomsFormSection>
  );
}
