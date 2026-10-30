"use client";

// ---------------------------------------------------------------------------
// Q-R3-13 (อนุมัติ Option B แบบควบคุม) — แก้ไขหลังปิดงาน บนหน้ารายละเอียดใบงานที่ปิดแล้ว
//   · ปุ่ม "ขอแก้ไขหลังปิดงาน" (ผู้มีสิทธิ์ปิดงาน) → กรอกเหตุผล + ค่าที่ขอแก้ (ข้อมูลยังไม่เปลี่ยนจนกว่า Manager อนุมัติ)
//   · ประวัติการแก้ไข: ฉบับปิดงาน (ต้นฉบับ) และทุกคำขอ — ใคร เมื่อไร เพราะอะไร ผลการพิจารณา สถานะลายเซ็น
//   · Manager พิจารณา (อนุมัติ/ไม่อนุมัติ พร้อมเหตุผล) — ผู้ขอพิจารณาคำขอตนเองไม่ได้
//   · ลงนามใหม่: ลูกค้าเซ็นพร้อมกรอกชื่อของตนเอง (ระบบไม่เติมชื่อช่าง) · ช่างผู้รับผิดชอบลงนามด้วยบัญชีตนเอง
// กติกาทั้งหมดตรวจซ้ำที่ backend (routes/jobRevisions.ts)
import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
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
import { ApiError } from "@/lib/api";
import type { Job, JobEquipmentLine } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import SignaturePad from "@/components/SignaturePad";
import { WomsFormSection } from "@/components/woms";
import { bangkokDateTime } from "@/lib/date";
import { isInstallType } from "@/lib/installType";
import { jobRevisionApi, JobRevision, JobRevisionList } from "@/lib/jobRevisionApi";
import {
  RevisionForm,
  SIGNER_TYPE_LABELS,
  SignerType,
  buildRevisionChanges,
  canDecideRevision,
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
  // ADV4-05: ผู้ขอแก้ไขฉบับนี้ไม่เห็นปุ่มบันทึกลายเซ็นลูกค้า (backend ปฏิเสธ 403 อยู่แล้ว)
  const myResign = current && user ? resignActionsFor(missing, job as any, user.id, has, current.requestedById) : [];

  const openRequest = () => {
    setForm(initialRevisionForm(job, lines as any));
    setFormError("");
    setReqOpen(true);
  };
  const submitRequest = async () => {
    if (!form) return;
    const changes = buildRevisionChanges(form, job, lines as any, install);
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
      const p = customerNameProblem(signerName, [user?.name ?? "", (job as any).closedByName ?? "", resign.rev.requestedBy ?? "", ...technicianNames]);
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
              {r.diff?.length ? (
                <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                  {r.diff.map((d, i) => (
                    <li key={i}>
                      <Typography variant="body2">
                        <span className="code">{d.field}</span>: {d.before || "—"} → <strong>{d.after || "—"}</strong>
                      </Typography>
                    </li>
                  ))}
                </Box>
              ) : null}
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
            แก้ได้เฉพาะหมายเหตุปิดงาน รายละเอียดงานรายเครื่อง{install ? " และวันที่ติดตั้งจริง" : ""} · ข้อมูลการเงิน (ใบเสนอราคา/รับชำระ/สัญญา/บิล) ต้องใช้ขั้นตอน D-11 ·
            เมื่อ Manager อนุมัติ ระบบเก็บฉบับเดิมไว้ และต้องให้ลูกค้า + ช่างลงนามใหม่
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
              <Box component="ul" sx={{ m: 0, mb: 1.5, pl: 2.5 }}>
                {decide.rev.diff.map((d, i) => (
                  <li key={i}>
                    <Typography variant="body2">
                      <span className="code">{d.field}</span>: {d.before || "—"} → <strong>{d.after || "—"}</strong>
                    </Typography>
                  </li>
                ))}
              </Box>
              {decide.decision === "APPROVE" ? (
                <Alert severity="warning" sx={{ mb: 1.5 }}>
                  อนุมัติแล้วข้อมูลใบงานจะเปลี่ยนเป็นฉบับใหม่ (ฉบับเดิมเก็บไว้) และต้องให้ลูกค้า + ช่างลงนามใหม่
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

      {/* ---- ลงนามใหม่ ---- */}
      <Dialog open={!!resign} onClose={() => !busy && setResign(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {resign?.signerType === "CUSTOMER" ? "ลูกค้าลงนามรับทราบฉบับแก้ไข" : "ช่างลงนามยืนยันฉบับแก้ไข"} r{resign?.rev.revisionNo}
        </DialogTitle>
        <DialogContent dividers>
          {resign ? (
            <Stack spacing={1.5}>
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {resign.rev.diff.map((d, i) => (
                  <li key={i}>
                    <Typography variant="body2">
                      <span className="code">{d.field}</span>: {d.before || "—"} → <strong>{d.after || "—"}</strong>
                    </Typography>
                  </li>
                ))}
              </Box>
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
