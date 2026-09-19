"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Job, JobEquipmentLine } from "@/lib/types";
import { jobTypeLabel } from "@/lib/options";
import JobCloseForm, { JobCloseValues } from "@/components/JobCloseForm";
import { useToast } from "@/components/Toast";
import { RESCHEDULE_REASON_LABEL } from "@/lib/types";
import type { RescheduleReason } from "@/lib/types";
import { bangkokDateTime } from "@/lib/date";

// ปิดงานจากมือถือ พร้อมลายเซ็นลูกค้าและรูปหน้างาน
export default function MobileJobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [job, setJob] = useState<Job | null>(null);
  // เครื่องในใบงาน — อ่านจาก API เสมอ ไม่เดาจากข้อความ filterUnit
  const [equipment, setEquipment] = useState<JobEquipmentLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ---- แจ้ง Admin / รับทราบงาน (เพิ่มรอบ Requirement.xlsx) ----
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<RescheduleReason>("LATE");
  const [reportNote, setReportNote] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const load = useCallback(async () => {
    try {
      const [j, eq] = await Promise.all([
        api.getJob(id),
        api.jobEquipment(id).catch(() => ({ items: [] as JobEquipmentLine[], count: 0 })),
      ]);
      setJob(j);
      setEquipment(eq.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const close = async (v: JobCloseValues) => {
    if (!job) return;
    setBusy(true);
    try {
      await api.closeJob(job.jobId, job.updatedAt, v);
      toast.success(`ปิดงาน ${job.jobId} แล้ว`);
      router.push("/m");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ปิดงานไม่สำเร็จ");
      load();
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!job) return <div className="state">กำลังโหลด…</div>;

  const setStage = async (stage: "ACKNOWLEDGED" | "IN_PROGRESS") => {
    if (!job) return;
    setBusy(true);
    try {
      setJob(await api.setJobStage(job.jobId, stage));
      toast.success(stage === "ACKNOWLEDGED" ? "รับทราบงานแล้ว" : "เริ่มดำเนินการแล้ว");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "อัปเดตไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const sendReport = async () => {
    if (!job) return;
    if (reason === "POSTPONE" && !newDate) {
      toast.error("ขอเลื่อนวันต้องระบุวันนัดใหม่");
      return;
    }
    setBusy(true);
    try {
      const r = await api.requestReschedule(job.jobId, {
        reason,
        note: reportNote,
        requestedDate: newDate,
        requestedTime: newTime,
      });
      setJob(r.job);
      setReportOpen(false);
      setReportNote("");
      toast.success("ส่งเรื่องให้แอดมินแล้ว");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ส่งเรื่องไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const pendingReq = (job.rescheduleRequests ?? []).filter((r) => r.status === "PENDING");

  return (
    <div className="m-wrap">
      <div className="m-head">
        <div>
          <div className="code">{job.jobId}</div>
          <div className="m-title">{job.jobName}</div>
          <div className="m-sub">
            {jobTypeLabel[job.jobType]} · {job.jobDate} {job.jobTime}
          </div>
        </div>
        <Link href="/m" className="btn">
          ← กลับ
        </Link>
      </div>

      {job.status === "OPEN" && (
        <div className="m-card">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!job.acknowledgedAt && (
              <button className="btn" disabled={busy} onClick={() => setStage("ACKNOWLEDGED")}>
                รับทราบงาน
              </button>
            )}
            {!job.startedAt && (
              <button className="btn" disabled={busy} onClick={() => setStage("IN_PROGRESS")}>
                เริ่มดำเนินการ
              </button>
            )}
            <button className="btn" disabled={busy} onClick={() => setReportOpen((v) => !v)}>
              แจ้งแอดมิน
            </button>
          </div>

          {job.acknowledgedAt ? (
            <div className="m-sub" style={{ marginTop: 6 }}>
              รับทราบแล้วเมื่อ {bangkokDateTime(job.acknowledgedAt)}
            </div>
          ) : null}

          {pendingReq.length > 0 && (
            <div className="alert alert-warn" style={{ marginTop: 8 }}>
              ส่งเรื่องให้แอดมินแล้ว — {RESCHEDULE_REASON_LABEL[pendingReq[0].reason]} · รอผลพิจารณา
            </div>
          )}

          {reportOpen && (
            <div style={{ marginTop: 10 }}>
              <label className="field">
                <span>เรื่องที่แจ้ง</span>
                <select className="select" value={reason} onChange={(e) => setReason(e.target.value as RescheduleReason)}>
                  <option value="LATE">{RESCHEDULE_REASON_LABEL.LATE}</option>
                  <option value="IN_PROGRESS">{RESCHEDULE_REASON_LABEL.IN_PROGRESS}</option>
                  <option value="POSTPONE">{RESCHEDULE_REASON_LABEL.POSTPONE}</option>
                </select>
              </label>
              {reason === "POSTPONE" && (
                <>
                  <label className="field">
                    <span>วันนัดใหม่</span>
                    <input type="date" className="input" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>เวลานัดใหม่</span>
                    <input type="time" className="input" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                  </label>
                </>
              )}
              <label className="field">
                <span>รายละเอียด</span>
                <input className="input" value={reportNote} onChange={(e) => setReportNote(e.target.value)} />
              </label>
              <button className="btn btn-primary" disabled={busy} onClick={sendReport}>
                ส่งเรื่อง
              </button>
            </div>
          )}
        </div>
      )}

      <div className="m-card">
        <div className="m-kv">
          <div className="k">ทีมช่าง</div>
          <div>{job.technicianTeam}</div>
          <div className="k">ผู้ติดต่อ</div>
          <div>{job.contactName || "—"}</div>
          <div className="k">โทร</div>
          <div>{job.phone ? <a href={`tel:${job.phone}`}>{job.phone}</a> : "—"}</div>
          <div className="k">เครื่อง{equipment.length > 1 ? ` (${equipment.length})` : ""}</div>
          <div>
            {equipment.length > 0 ? (
              equipment.map((e) => (
                <div key={e.id} style={{ marginBottom: 4 }}>
                  <span className="code">{e.serial || "—"}</span>
                  {!e.hasRealSerial ? <span className="badge badge-wexp" style={{ marginLeft: 6 }}>ยังไม่มี SN</span> : null}
                  {e.model ? <span className="m-sub"> · {e.model}</span> : null}
                  {e.note ? <div className="m-sub">{e.note}</div> : null}
                </div>
              ))
            ) : job.filterUnit ? (
              <>
                <span className="code">{job.filterUnit}</span>
                <div className="m-sub">ข้อมูลเดิม ยังไม่ผูกกับคลัง</div>
              </>
            ) : (
              "—"
            )}
          </div>
          <div className="k">สถานะ</div>
          <div>{job.status === "OPEN" ? "เปิดงาน" : "ปิดงานแล้ว"}</div>
          {job.note ? (
            <>
              <div className="k">หมายเหตุ</div>
              <div>{job.note}</div>
            </>
          ) : null}
        </div>
        {job.mapLink ? (
          <div className="m-actions">
            <a className="btn" href={job.mapLink} target="_blank" rel="noopener noreferrer">
              นำทาง
            </a>
          </div>
        ) : null}
      </div>

      {job.status === "OPEN" ? (
        <div className="m-card">
          <strong>ปิดงาน</strong>
          <JobCloseForm busy={busy} onSubmit={close} onError={(m) => toast.error(m)} />
        </div>
      ) : (
        <div className="alert alert-ok">งานนี้ปิดแล้วเมื่อ {bangkokDateTime(job.closedAt)}</div>
      )}
    </div>
  );
}
