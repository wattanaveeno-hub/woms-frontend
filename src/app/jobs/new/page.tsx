"use client";

import { WomsPermissionGate } from "@/components/woms/WomsPermissionGate";
import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { JobFormValues, Options } from "@/lib/types";
import JobForm, { StepBadge } from "@/components/JobForm";
import { pickJobFormValues } from "@/lib/jobView";
import JobEquipmentSection, { PendingItem } from "@/components/JobEquipmentSection";
import { takeJobPrefill } from "@/lib/jobPrefill";
import { pasteExtraNote } from "@/lib/jobView";
import { lineFieldIssues } from "@/lib/jobLineRules";
import PasteJobTextDialog from "@/components/PasteJobTextDialog";
import type { ParsedJobText } from "@/lib/jobTextParser";
import { jobTypeLabel } from "@/lib/options";
import type { JobType } from "@/lib/types";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { WomsFormSummary } from "@/components/woms/WomsFormSummary";
import { JOB_FORM_SECTION_ORDER, jobRequirements } from "@/lib/formRequirements";
import { WomsErrorState, WomsLoadingState, WomsPageHeader } from "@/components/woms";

let seq = 0;
const nextKey = () => `n${++seq}`;

function NewJobPageInner() {
  const router = useRouter();
  const { has } = useAuth();
  const [options, setOptions] = useState<Options | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);

  // เครื่องที่จะผูกกับใบงาน — ยังไม่ถูกเขียนลงฐานข้อมูลจนกว่าจะกดบันทึก
  const [pending, setPending] = useState<PendingItem[]>([]);
  // Idempotency-Key ของการเปิดงานจากหน้านี้ (หนึ่งหน้า = หนึ่งใบงาน)
  const submitKey = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k${Date.now()}${Math.random().toString(36).slice(2)}`
  );
  // ประเภทงานปัจจุบันในฟอร์ม — ส่งให้ส่วนเครื่องเพื่อแสดงเฉพาะช่องที่เกี่ยวข้อง (AT-04)
  const [jobType, setJobType] = useState<string>("");
  const [missing, setMissing] = useState<string[]>([]);
  const [prefillReady, setPrefillReady] = useState(false);
  const consumed = useRef(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  // เปิดร่างไม่ได้ (ส่งไปแล้ว/ลบแล้ว/ไม่มีสิทธิ์) — ไม่ใช่ปัญหาโหลดตัวเลือก จึงแยกข้อความ และให้เริ่มใบงานใหม่แทน
  const [draftError, setDraftError] = useState<string | null>(null);
  const loadOptions = () => {
    setLoadError(null);
    api
      .getOptions()
      .then(setOptions)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "โหลดตัวเลือกไม่สำเร็จ"));
  };
  useEffect(loadOptions, []);
  // ค่าเริ่มต้นของฟอร์มจาก prefill — คำนวณครั้งเดียวตอน prefill พร้อม
  const [initial, setInitial] = useState<Partial<JobFormValues> | undefined>(undefined);

  // รับเครื่องที่เลือกมาจากหน้าคลัง (Phase 4) — เก็บแค่ id แล้วดึงข้อมูลล่าสุดจาก backend เสมอ
  useEffect(() => {
    if (consumed.current) return; // React StrictMode ใน dev เรียก effect ซ้ำ
    consumed.current = true;

    // เปิดร่างเดิมต่อ (/jobs/new?draft=<id>) — ร่างมาก่อน prefill จากหน้าคลัง
    const draftId = new URLSearchParams(window.location.search).get("draft");
    if (draftId) {
      api
        .getJobDraft(draftId)
        .then((d) => {
          if (d.status !== "DRAFT") {
            setDraftError(d.jobId ? `ร่างนี้เปิดเป็นใบงาน ${d.jobId} แล้ว` : "ร่างนี้ถูกลบแล้วหรือกำลังถูกส่ง");
            return;
          }
          setDraft({ id: d.id, version: d.version, title: d.title });
          if (d.values.jobType) setJobType(d.values.jobType);
          setInitial(d.values);
          setPending(
            d.equipment.map((e) => ({
              ...(e as Partial<PendingItem>),
              key: nextKey(),
              displaySerial: String(e.displaySerial ?? e.serial ?? ""),
              displayModel: String(e.displayModel ?? e.model ?? ""),
              hasRealSerial: e.hasRealSerial !== false,
            }))
          );
          setPrefillReady(true);
        })
        .catch((e) => setDraftError(e instanceof ApiError ? e.message : "โหลดร่างใบงานไม่สำเร็จ"));
      return;
    }

    const prefill = takeJobPrefill();
    if (!prefill) {
      setPrefillReady(true);
      return;
    }
    (async () => {
      const items: PendingItem[] = [];
      const gone: string[] = [];
      for (const id of prefill.equipmentIds) {
        try {
          const e = await api.getEquipment(id);
          items.push({
            key: nextKey(),
            equipmentId: e.id,
            displaySerial: e.serial,
            displayModel: e.model,
            hasRealSerial: e.hasRealSerial,
          });
        } catch {
          gone.push(id); // ถูกลบไปแล้ว หรือไม่มีสิทธิ์ดู → ตัดออกและแจ้งให้เห็น
        }
      }
      setPending(items);
      setMissing(gone);
      // ใส่เฉพาะคีย์ที่มีค่าจริง — key ที่เป็น undefined จะไปทับค่าเริ่มต้นของฟอร์ม
      if (prefill.jobType) setJobType(prefill.jobType);
      setInitial({
        ...(prefill.jobType ? { jobType: prefill.jobType as JobFormValues["jobType"] } : {}),
        ...(items[0]?.displayModel ? { model: items[0].displayModel } : {}),
      });
      setPrefillReady(true);
    })();
  }, []);

  // ---- วางข้อความจาก LINE (JOB-01 / MCH-03) ----
  const latest = useRef<JobFormValues | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [pasteOpen, setPasteOpen] = useState(false);
  // สรุปใบงานด้านขวา (อัปเดตตามที่กรอก)
  const [live, setLive] = useState<Partial<JobFormValues>>({});
  const applyParsed = async (p: ParsedJobText) => {
    const cur: Partial<JobFormValues> = latest.current ?? initial ?? {};
    const filled: string[] = [];
    const warn: string[] = [...p.warnings];
    const next: Partial<JobFormValues> = { ...cur };
    const fill = <K extends keyof JobFormValues>(k: K, val: JobFormValues[K] | undefined, label: string) => {
      if (val === undefined || val === "" || (Array.isArray(val) && !val.length)) return;
      const now = cur[k];
      if (now !== undefined && now !== "" && !(Array.isArray(now) && !now.length)) return; // ไม่ทับค่าที่กรอกไว้
      next[k] = val;
      filled.push(label);
    };
    fill("jobType", p.jobType as JobFormValues["jobType"], "ประเภทงาน");
    fill("jobName", p.shopName, "ชื่องาน");
    fill("salesPerson", p.salesPerson, "เซลล์");
    fill("model", p.model, "รุ่น");
    fill("contactName", p.contactName, "ติดต่อ");
    fill("phone", p.phone, "เบอร์");
    fill("jobDate", p.jobDate, "วันที่");
    fill("jobTime", p.jobTime, "เวลา");
    fill("mapLink", p.mapLink, "แผนที่");
    // D-16: ข้อความเครื่องกรองจาก LINE ลงหมายเหตุเสมอ (เดิมทิ้งเงียบ ๆ เมื่อมีเครื่องในรายการแล้ว)
    const extra = pasteExtraNote(p);
    if (extra && !(cur.note ?? "").includes(extra)) {
      next.note = [cur.note, extra].filter(Boolean).join("\n");
      filled.push("หมายเหตุ");
    }
    // ทีมช่าง: ตรงกับรายชื่อทีม → ใส่ทีม · ไม่ตรง → ลองจับคู่ชื่อช่าง (ตัด "ช่าง"/"คุณ") เป็นผู้รับผิดชอบ
    if (p.technicianTeam) {
      if (options?.teams.includes(p.technicianTeam)) fill("technicianTeam", p.technicianTeam, "ทีมช่าง");
      else {
        const name = p.technicianTeam.replace(/^(ช่าง|ชาง|คุณ)\s*/, "").trim();
        try {
          const techs = (await api.listTechnicians()).items.filter((t) => t.active !== false && name && t.name.includes(name));
          if (techs.length === 1 && !(cur.technicianIds ?? []).length) {
            next.technicianIds = [techs[0].id];
            if (!cur.technicianTeam && techs[0].team) next.technicianTeam = techs[0].team;
            filled.push(`ช่าง ${techs[0].name}`);
          } else warn.push(`ช่าง “${p.technicianTeam}” ไม่ตรงกับรายชื่อในระบบ — เลือกเอง`);
        } catch {
          warn.push(`ช่าง “${p.technicianTeam}” — เลือกเอง`);
        }
      }
    }
    // SN: เพิ่มเครื่องที่พบในคลังแบบตรงตัว (ไม่สร้างเครื่องใหม่จาก SN ที่ไม่รู้จัก)
    const added: PendingItem[] = [];
    for (const sn of p.serials) {
      try {
        const res = await api.listEquipment({ q: sn });
        const hit = res.items.find((e) => e.serial.toUpperCase() === sn.toUpperCase());
        if (!hit) {
          warn.push(`ไม่พบ SN ${sn} ในระบบ — เพิ่มเครื่องเอง`);
          continue;
        }
        if (pending.some((x) => x.equipmentId === hit.id)) continue;
        added.push({ key: nextKey(), equipmentId: hit.id, displaySerial: hit.serial, displayModel: hit.model, hasRealSerial: hit.hasRealSerial });
      } catch {
        warn.push(`ค้นหา SN ${sn} ไม่สำเร็จ`);
      }
    }
    if (added.length) {
      setPending((prev) => [...prev, ...added]);
      filled.push(`เครื่อง ${added.length} ตัว`);
    }
    if (next.jobType) setJobType(next.jobType);
    setInitial(next);
    setFormKey((k) => k + 1);
    setPasteOpen(false);
    setNotice(
      [filled.length ? `ใส่ข้อมูลแล้ว: ${filled.join(", ")}` : "ไม่มีช่องว่างที่ใส่ได้", ...warn].join(" · ") +
        (p.customerCode ? ` · เลือกลูกค้าโดยค้นรหัส ${p.customerCode}` : "")
    );
  };

  // ร่างที่กำลังแก้ (null = ยังไม่เคยบันทึกร่าง)
  const [draft, setDraft] = useState<{ id: string; version: number; title: string } | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const draftEquipment = () => pending.map(({ key: _k, ...item }) => item as Record<string, unknown>);

  const saveDraft = async (values: JobFormValues) => {
    setDraftBusy(true);
    setFieldError(null);
    setNotice(null);
    try {
      const d = draft
        ? await api.updateJobDraft(draft.id, values, draftEquipment(), draft.version)
        : await api.createJobDraft(values, draftEquipment());
      setDraft({ id: d.id, version: d.version, title: d.title });
      if (!draft) window.history.replaceState(null, "", `/jobs/new?draft=${d.id}`);
      setNotice(`บันทึกร่าง “${d.title}” แล้ว — ยังไม่ออกเลขงานและยังไม่แจ้งช่าง`);
    } catch (e) {
      setFieldError({ message: e instanceof ApiError ? e.message : "บันทึกร่างไม่สำเร็จ" });
    } finally {
      setDraftBusy(false);
    }
  };

  const submit = async (values: JobFormValues) => {
    // JOB-01 / AT-04: ตรวจข้อมูลรายเครื่องกับประเภทงานก่อนส่ง (backend ตรวจซ้ำ)
    for (const [i, p] of pending.entries()) {
      const issues = lineFieldIssues(values.jobType, p);
      if (issues.length) {
        setFieldError({ message: `เครื่องที่ ${i + 1} (${p.displaySerial || "ยังไม่มี SN"}): ${issues.map((x) => x.message).join(" · ")}` });
        return;
      }
    }
    setBusy(true);
    setFieldError(null);
    try {
      if (draft) {
        // ส่งร่าง: backend บันทึกค่าล่าสุดลงร่าง แล้วเปิดงานผ่านเส้นทางเดียวกับ POST /api/jobs
        const r = await api.submitJobDraft(draft.id, values, draftEquipment(), draft.version);
        router.push(`/jobs/${r.job.jobId}`);
        return;
      }
      // backend เป็นผู้ตั้ง filterUnit / equipmentCount / เลข TMP / ประวัติ ทั้งหมดใน transaction เดียว
      // คีย์เดิมตลอดการส่งซ้ำของฟอร์มนี้ — ส่งซ้ำหลังเน็ตหลุดได้ใบงานเดิม (ไม่พึ่งการปิดปุ่มอย่างเดียว)
      const job = await api.createJob(
        values,
        // ตัดเฉพาะค่าที่ใช้แสดงผลในหน้าเว็บ — ข้อมูลรายเครื่อง (ประเภท เครื่องกรอง ประกัน PM ส่วนลด) ส่งไปด้วย (JOB-01)
        pending.map(({ key: _k, displaySerial: _s, displayModel: _m, hasRealSerial: _r, ...item }) => item),
        submitKey.current
      );
      router.push(`/jobs/${job.jobId}`);
    } catch (e) {
      if (e instanceof ApiError) setFieldError({ field: e.field, message: e.message });
      else setFieldError({ message: "บันทึกไม่สำเร็จ" });
      // ส่งร่างไม่ผ่าน: backend อาจบันทึกค่าล่าสุดลงร่างไปแล้ว (version เปลี่ยน) — อ่าน version ใหม่ไว้แก้ต่อ
      if (draft) {
        api
          .getJobDraft(draft.id)
          .then((d) => setDraft({ id: d.id, version: d.version, title: d.title }))
          .catch(() => undefined);
      }
      setBusy(false);
    }
  };

  return (
    <>
      <WomsPageHeader
        title="เปิดงานใหม่"
        subtitle="กรอก 4 ขั้นแล้วกด “เปิดงาน” — ระบบออกรหัสงานให้อัตโนมัติ"
        back={{ href: "/jobs", label: "งานทั้งหมด" }}
      />
      {/* Redesign: ทางลัดวางข้อความ LINE อยู่บนสุดของฟอร์ม (เดิมซ่อนเป็นปุ่มเล็กบนหัวหน้า) */}
      <Paper
        variant="outlined"
        sx={{ p: 2, mb: 2, display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", bgcolor: "#f3faf4", borderColor: "#cfe3d4" }}
      >
        <ContentPasteIcon sx={{ color: "primary.main" }} />
        <Box sx={{ flex: "1 1 260px" }}>
          <Typography sx={{ fontWeight: 600, color: "text.primary" }}>มีข้อความจาก LINE?</Typography>
          <Typography variant="body2">วางข้อความที่ลูกค้าส่งมา ระบบเติมชื่อ เบอร์ ที่อยู่ และประเภทงานให้ แล้วค่อยตรวจทาน</Typography>
        </Box>
        <Button variant="outlined" onClick={() => setPasteOpen(true)}>
          วางข้อความ LINE
        </Button>
      </Paper>
      <PasteJobTextDialog
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onApply={applyParsed}
        jobTypeLabel={(v) => jobTypeLabel[v as JobType] ?? v}
      />

      {draftError ? (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => (window.location.href = "/jobs/new")}>
              เริ่มใบงานใหม่
            </Button>
          }
        >
          {draftError}
        </Alert>
      ) : null}
      {draft ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          กำลังแก้ร่าง “{draft.title}” — กด “เปิดงาน” เพื่อตรวจข้อมูลครบชุดและออกเลขงาน
        </Alert>
      ) : null}
      {notice ? (
        <Alert severity="success" role="status" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      ) : null}
      {missing.length ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          มี {missing.length} เครื่องที่เลือกไว้ไม่พบในระบบแล้ว — ระบบตัดออกให้ กรุณาตรวจรายการอีกครั้ง
        </Alert>
      ) : null}

      {draftError ? null : options && prefillReady ? (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
        <Box sx={{ flex: "999 1 560px", minWidth: 0 }}>
        <JobForm
          isNew
          // ไม่ remount เมื่อเพิ่ม/เอาเครื่องออก — เดิมใช้ key ตามรายการเครื่อง ทำให้ค่าที่พิมพ์ไว้หายทั้งฟอร์ม
          options={options}
          initial={initial}
          submitLabel="เปิดงาน"
          hideActions
          busy={busy}
          fieldError={fieldError}
          onSubmit={submit}
          equipmentLinked={pending.length > 0}
          linkedModels={[...new Set(pending.map((p) => p.displayModel).filter(Boolean))].join(", ")}
          onJobTypeChange={setJobType}
          onSaveDraft={saveDraft}
          draftBusy={draftBusy}
          onValuesChange={(vals) => {
            latest.current = vals;
            setLive(vals);
          }}
          key={formKey}
          // การ์ดที่ 3 "รายละเอียดเครื่อง" (JOB-01 เครื่องในงาน) — อยู่ก่อนปุ่มบันทึก
          machineSection={(legacyFields) => (
            <Box id="job-equipment-section" sx={{ scrollMarginTop: 80 }}>
            <JobEquipmentSection
              mode="create"
              title="เครื่องในงานนี้"
              titlePrefix={<StepBadge n={4} done={pending.length > 0} />}
              jobType={jobType}
              options={options}
              canEdit={has("jobs:create")}
              pending={pending}
              onPendingChange={setPending}
              footer={legacyFields}
            />
            </Box>
          )}
        />
        </Box>
        <JobSummaryAside
          values={live}
          machines={pending.length}
          options={options}
          busy={busy}
          draftBusy={draftBusy}
          onSaveDraft={() => {
            const cur = latest.current;
            if (!cur) return;
            saveDraft(pickJobFormValues({ ...cur, jobSubType: cur.jobType === "REMOVE" ? cur.jobSubType : "" }));
          }}
        />
        </Box>
      ) : loadError ? (
        <WomsErrorState message={loadError} onRetry={loadOptions} />
      ) : (
        <WomsLoadingState rows={5} />
      )}
    </>
  );
}

/**
 * สรุปใบงานด้านขวา (MOM-02) — แต่ละส่วนกดแล้วพาไป + focus ช่องแรกที่ยังขาด
 * นับเฉพาะช่องบังคับจริง (lib/formRequirements · กติกาเดียวกับ JobForm.submit) · ช่องไม่บังคับแสดง "ไม่บังคับ" ไม่ใช่สีเตือน
 */
function JobSummaryAside({
  values: v,
  machines,
  options,
  busy,
  draftBusy,
  onSaveDraft,
}: {
  values: Partial<JobFormValues>;
  machines: number;
  options: Options;
  busy: boolean;
  draftBusy: boolean;
  onSaveDraft: () => void;
}) {
  const typeLabel = v.jobType ? options.jobTypes.find((t) => t.value === v.jobType)?.label ?? jobTypeLabel[v.jobType as JobType] ?? v.jobType : "";
  const rows = jobRequirements({ ...v, equipmentCount: machines }, { isNew: true, hasSalespeople: (options.salespeople?.length ?? 0) > 0 });
  return (
    <Box sx={{ flex: "1 1 280px", minWidth: 0, position: { lg: "sticky" }, top: { lg: 80 } }}>
      <WomsFormSummary
        title="สรุปใบงาน"
        rows={rows}
        order={JOB_FORM_SECTION_ORDER}
        fieldId={(f) => `job-${f}`}
        sections={{
          customer: { label: "ลูกค้าและหน้างาน", anchorId: "job-installAddress", value: [v.contactName, v.installAddress].filter(Boolean).join(" · ") },
          job: { label: "ต้องการให้ช่างทำอะไร", anchorId: "job-jobType", value: [typeLabel, v.jobName].filter(Boolean).join(" · ") },
          schedule: { label: "นัดและทีมช่าง", anchorId: "job-jobDate", value: [[v.jobDate, v.jobTime].filter(Boolean).join(" "), v.technicianTeam].filter(Boolean).join(" · ") },
          machines: { label: "เครื่อง", anchorId: "job-equipment-section", value: machines ? `${machines} เครื่อง` : "ไม่บังคับ · เพิ่มภายหลังได้" },
        }}
        actions={
          <>
            {/* ENTECH design: ปุ่มหลักอยู่ในการ์ดสรุป · submit ผูกกับฟอร์มด้วย form="job-form" (ตรวจข้อมูลชุดเดิม) */}
            <Button type="submit" form="job-form" variant="contained" size="large" disabled={busy || draftBusy} data-testid="job-submit">
              {busy ? "กำลังบันทึก…" : "เปิดงาน"}
            </Button>
            <Button variant="outlined" disabled={busy || draftBusy} onClick={onSaveDraft} data-testid="job-save-draft">
              {draftBusy ? "กำลังบันทึกร่าง…" : "บันทึกร่าง"}
            </Button>
          </>
        }
        footnote="กดเปิดงานตอนยังไม่ครบได้ ระบบจะบอกทุกช่องที่ต้องแก้ · ร่างยังไม่ออกเลขงานและยังไม่แจ้งช่าง เปิดต่อได้จากหน้างานทั้งหมด"
      />
    </Box>
  );
}

// เปิด URL ตรงโดยไม่มีสิทธิ์ → แสดงข้อความแทนฟอร์มที่บันทึกไม่ได้ (backend บังคับสิทธิ์อีกชั้นเสมอ)
export default function NewJobPage() {
  return (
    <WomsPermissionGate perm="jobs:create" backHref="/jobs">
      <NewJobPageInner />
    </WomsPermissionGate>
  );
}
