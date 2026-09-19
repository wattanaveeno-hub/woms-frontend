"use client";

// ---------------------------------------------------------------------------
// แผงจัดการสถานะใบงาน (เพิ่มรอบ Requirement.xlsx)
// ---------------------------------------------------------------------------
// ครอบคลุมสิ่งที่ชีตหลักระบุแต่ระบบเดิมไม่มี:
//   * การยกเลิกงาน (เดิมมีแค่เปิด/ปิด)
//   * ช่างรับทราบงาน / กำลังดำเนินการ (TECH-FN-005, TECH-FN-006)
//   * ช่างแจ้ง Admin เมื่อเข้าไม่ทัน / ขอเลื่อนวัน และ Admin อนุมัติ
//   * Admin บันทึกรายรับ/ค่าใช้จ่ายของใบงาน
//
// หมายเหตุ: "ช่างส่งตรวจ" ยังใช้ทางเดิมคือแท็ก #ส่งงาน ในห้องแชทของใบงาน
// แผงนี้จึงแสดงขั้น SUBMITTED ให้เห็น แต่ไม่สร้างช่องทางส่งงานซ้ำซ้อน

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import type { Job, JobStage, RescheduleReason } from "@/lib/types";
import { JOB_STAGE_LABEL, RESCHEDULE_REASON_LABEL } from "@/lib/types";

const REASONS: RescheduleReason[] = ["LATE", "IN_PROGRESS", "POSTPONE"];

export default function JobWorkflowPanel({
  job,
  onChanged,
}: {
  job: Job;
  onChanged: (job: Job) => void;
}) {
  const { has } = useAuth();
  const toast = useToast();
  const canEdit = has("jobs:edit");
  const canClose = has("jobs:close");

  const [stage, setStage] = useState<JobStage | null>(null);
  const [busy, setBusy] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [reason, setReason] = useState<RescheduleReason>("LATE");
  const [note, setNote] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [revenue, setRevenue] = useState(String(job.revenueAmount ?? 0));
  const [cost, setCost] = useState(String(job.costAmount ?? 0));
  const [financeNote, setFinanceNote] = useState(job.financeNote ?? "");

  const loadStage = useCallback(async () => {
    try {
      const r = await api.jobStage(job.jobId);
      setStage(r.stage);
    } catch {
      setStage(null);
    }
  }, [job.jobId]);

  useEffect(() => {
    loadStage();
  }, [loadStage]);

  const act = async (fn: () => Promise<Job>, okMsg: string) => {
    setBusy(true);
    try {
      const updated = await fn();
      onChanged(updated);
      await loadStage();
      toast.success(okMsg);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const pending = (job.rescheduleRequests ?? []).filter((r) => r.status === "PENDING");
  const history = (job.rescheduleRequests ?? []).filter((r) => r.status !== "PENDING");
  const active = job.status === "OPEN";

  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <div className="page-head" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>
          ขั้นของงาน{stage ? `: ${JOB_STAGE_LABEL[stage]}` : ""}
        </h2>
      </div>

      {stage === "SUBMITTED" && (
        <div className="alert alert-warn">
          ช่างส่งตรวจแล้ว — รอผู้ตรวจยืนยันปิดงานในห้องแชทของใบงานนี้ (สถานะใบงานยังเป็น “เปิดงาน” จนกว่าจะยืนยัน)
        </div>
      )}
      {job.status === "CANCELLED" && (
        <div className="alert alert-error">
          ยกเลิกเมื่อ {(job.cancelledAt ?? "").slice(0, 16).replace("T", " ")}
          {job.cancelledBy ? ` โดย ${job.cancelledBy}` : ""}
          {job.cancelReason ? ` — ${job.cancelReason}` : ""}
        </div>
      )}

      {active && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {canClose && stage !== "ACKNOWLEDGED" && stage !== "IN_PROGRESS" && stage !== "SUBMITTED" && (
            <button className="btn" disabled={busy} onClick={() => act(() => api.setJobStage(job.jobId, "ACKNOWLEDGED"), "รับทราบงานแล้ว")}>
              รับทราบงาน
            </button>
          )}
          {canClose && stage !== "IN_PROGRESS" && stage !== "SUBMITTED" && (
            <button className="btn" disabled={busy} onClick={() => act(() => api.setJobStage(job.jobId, "IN_PROGRESS"), "เริ่มดำเนินการแล้ว")}>
              เริ่มดำเนินการ
            </button>
          )}
          {canClose && (
            <button className="btn" disabled={busy} onClick={() => setShowReschedule((v) => !v)}>
              แจ้ง Admin / ขอเลื่อนนัด
            </button>
          )}
          {canEdit && (
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={() => {
                const r = prompt("เหตุผลที่ยกเลิกใบงานนี้:")?.trim();
                if (!r) return;
                act(() => api.cancelJob(job.jobId, r, job.updatedAt), "ยกเลิกใบงานแล้ว");
              }}
            >
              ยกเลิกใบงาน
            </button>
          )}
        </div>
      )}

      {showReschedule && active && (
        <div className="card card-pad" style={{ marginBottom: 12 }}>
          <div className="form-grid">
            <label className="field">
              <span>เรื่องที่แจ้ง</span>
              <select className="select" value={reason} onChange={(e) => setReason(e.target.value as RescheduleReason)}>
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {RESCHEDULE_REASON_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>วันนัดใหม่{reason === "POSTPONE" ? " (จำเป็น)" : " (ถ้ามี)"}</span>
              <input type="date" className="input" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </label>
            <label className="field">
              <span>เวลานัดใหม่</span>
              <input type="time" className="input" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            </label>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span>รายละเอียด</span>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 10 }}
            disabled={busy}
            onClick={() =>
              act(async () => {
                const r = await api.requestReschedule(job.jobId, {
                  reason,
                  note,
                  requestedDate: newDate,
                  requestedTime: newTime,
                });
                setShowReschedule(false);
                setNote("");
                return r.job;
              }, "ส่งเรื่องให้ Admin แล้ว")
            }
          >
            ส่งเรื่อง
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="alert alert-warn">
          <strong>คำขอที่รอพิจารณา</strong>
          {pending.map((r) => (
            <div key={r.id} style={{ marginTop: 6 }}>
              {RESCHEDULE_REASON_LABEL[r.reason]} โดย {r.requestedBy}
              {r.requestedDate ? ` — ขอเลื่อนเป็น ${r.requestedDate}${r.requestedTime ? ` ${r.requestedTime}` : ""}` : ""}
              {r.note ? ` · ${r.note}` : ""}
              {canEdit && (
                <span style={{ marginLeft: 8 }}>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={busy}
                    onClick={() =>
                      act(() => api.decideReschedule(job.jobId, r.id, "APPROVED"), "อนุมัติแล้ว — เลื่อนวันนัดให้เรียบร้อย")
                    }
                  >
                    อนุมัติ
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ marginLeft: 6 }}
                    disabled={busy}
                    onClick={() => act(() => api.decideReschedule(job.jobId, r.id, "REJECTED"), "ปฏิเสธคำขอแล้ว")}
                  >
                    ปฏิเสธ
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <details style={{ marginBottom: 12 }}>
          <summary>ประวัติคำขอ ({history.length})</summary>
          <table className="table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>เมื่อ</th>
                <th>เรื่อง</th>
                <th>ผู้แจ้ง</th>
                <th>ผล</th>
                <th>ผู้พิจารณา</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.requestedAt.slice(0, 16).replace("T", " ")}</td>
                  <td>
                    {RESCHEDULE_REASON_LABEL[r.reason]}
                    {r.requestedDate ? ` → ${r.requestedDate}` : ""}
                  </td>
                  <td>{r.requestedBy}</td>
                  <td>{r.status === "APPROVED" ? "อนุมัติ" : "ปฏิเสธ"}</td>
                  <td>
                    {r.decidedBy}
                    {r.decisionNote ? ` · ${r.decisionNote}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {canEdit && job.status !== "CANCELLED" && (
        <div className="card card-pad">
          <h3 style={{ marginTop: 0, fontSize: 16 }}>รายรับ / ค่าใช้จ่ายของใบงานนี้</h3>
          <div className="detail-meta" style={{ marginBottom: 8 }}>
            ยอดของใบงานนี้เท่านั้น — ไม่รวมค่าเช่าตามสัญญาและไม่รวมค่าวางบิลช่าง เพื่อไม่ให้ถูกนับซ้ำในสรุปรายเครื่อง
          </div>
          <div className="form-grid">
            <label className="field">
              <span>รายรับจากลูกค้า (บาท)</span>
              <input className="input" inputMode="decimal" value={revenue} onChange={(e) => setRevenue(e.target.value)} />
            </label>
            <label className="field">
              <span>ค่าใช้จ่าย (บาท)</span>
              <input className="input" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
            </label>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span>หมายเหตุ</span>
              <input className="input" value={financeNote} onChange={(e) => setFinanceNote(e.target.value)} />
            </label>
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 10 }}
            disabled={busy}
            onClick={() =>
              act(
                () =>
                  api.setJobFinance(
                    job.jobId,
                    {
                      revenueAmount: Number(revenue) || 0,
                      costAmount: Number(cost) || 0,
                      financeNote,
                    },
                    job.updatedAt
                  ),
                "บันทึกยอดแล้ว"
              )
            }
          >
            บันทึกยอด
          </button>
          {job.financeBy ? (
            <div className="detail-meta" style={{ marginTop: 6 }}>
              บันทึกล่าสุดโดย {job.financeBy} เมื่อ {(job.financeAt ?? "").slice(0, 16).replace("T", " ")}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
