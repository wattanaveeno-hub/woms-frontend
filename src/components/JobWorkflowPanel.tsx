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
import { useDialog } from "@/components/Dialog";
import type { Job, JobStage, RescheduleReason } from "@/lib/types";
import { JOB_STAGE_LABEL, RESCHEDULE_REASON_LABEL } from "@/lib/types";
import { bangkokDateTime } from "@/lib/date";
import { MONEY_MAX, parseMoney, useFieldErrors } from "@/components/FieldErrors";

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
  const dialog = useDialog();
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
  // QA BUG-011 — ช่องเงินเคยเป็น text ที่ไม่ตรวจอะไรเลย: "abc" → 0 เงียบ ๆ, "1e5" → 100,000 เงียบ ๆ
  const finErr = useFieldErrors("fin");

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

  /**
   * QA BUG-011 — ตรวจที่หน้าเว็บด้วยกติกาเดียวกับที่ backend เพิ่งบังคับไว้
   * และแสดงข้อความผิดพลาด "ข้างช่องที่ผิด" ไม่ใช่กลืนหายหรือขึ้นเป็น toast ลอย ๆ
   */
  const saveFinance = async () => {
    finErr.clear();
    const rev = parseMoney(revenue);
    if (!rev.ok) {
      finErr.setIssue("revenueAmount", rev.message);
      return;
    }
    const cst = parseMoney(cost);
    if (!cst.ok) {
      finErr.setIssue("costAmount", cst.message);
      return;
    }
    setBusy(true);
    try {
      const updated = await api.setJobFinance(
        job.jobId,
        { revenueAmount: rev.value, costAmount: cst.value, financeNote },
        job.updatedAt
      );
      onChanged(updated);
      await loadStage();
      toast.success("บันทึกยอดแล้ว");
    } catch (e) {
      if (!finErr.fromApi(e, ["revenueAmount", "costAmount", "financeNote"])) {
        toast.error(e instanceof ApiError ? e.message : "บันทึกยอดไม่สำเร็จ");
      }
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
          ยกเลิกเมื่อ {bangkokDateTime(job.cancelledAt)}
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
              onClick={async () => {
                // QA BUG-016 — การยกเลิกใบงานย้อนกลับไม่ได้ แต่เดิมมีแค่กล่องถามเหตุผล
                // ไม่มีขั้นยืนยัน (ขณะที่ "ปิดงาน" ซึ่งเบากว่ากลับมี confirm)
                // กล่องนี้ถามเหตุผล + ยืนยัน ในขั้นตอนเดียว และปุ่มยืนยันเป็นสีอันตราย
                const r = await dialog.prompt({
                  title: `ยกเลิกใบงาน ${job.jobId}?`,
                  message: "การยกเลิกใบงานย้อนกลับไม่ได้ — ใบงานจะแก้ไขต่อไม่ได้และวางบิลไม่ได้",
                  label: "เหตุผลที่ยกเลิก",
                  help: "เหตุผลนี้จะถูกบันทึกไว้บนใบงานอย่างถาวร",
                  type: "textarea",
                  required: true,
                  confirmLabel: "ยืนยันยกเลิกใบงาน",
                  cancelLabel: "ไม่ยกเลิก",
                  danger: true,
                  validate: (v) => (v.trim().length < 3 ? "ต้องระบุเหตุผลอย่างน้อย 3 ตัวอักษร" : null),
                });
                if (r === null) return;
                act(() => api.cancelJob(job.jobId, r.trim(), job.updatedAt), "ยกเลิกใบงานแล้ว");
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
                  <td className="mono">{bangkokDateTime(r.requestedAt)}</td>
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
            <div className="field">
              <label htmlFor={finErr.fid("revenueAmount")}>รายรับจากลูกค้า (บาท)</label>
              <input
                id={finErr.fid("revenueAmount")}
                {...finErr.aria("revenueAmount")}
                className="input"
                type="number"
                min={0}
                max={MONEY_MAX}
                step="0.01"
                inputMode="decimal"
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
              />
              {finErr.errFor("revenueAmount") ?? (
                <span className="field-hint">ตัวเลขเท่านั้น ไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง</span>
              )}
            </div>
            <div className="field">
              <label htmlFor={finErr.fid("costAmount")}>ค่าใช้จ่าย (บาท)</label>
              <input
                id={finErr.fid("costAmount")}
                {...finErr.aria("costAmount")}
                className="input"
                type="number"
                min={0}
                max={MONEY_MAX}
                step="0.01"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
              {finErr.errFor("costAmount") ?? (
                <span className="field-hint">ตัวเลขเท่านั้น ไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง</span>
              )}
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor={finErr.fid("financeNote")}>หมายเหตุ</label>
              <input
                id={finErr.fid("financeNote")}
                {...finErr.aria("financeNote")}
                className="input"
                value={financeNote}
                onChange={(e) => setFinanceNote(e.target.value)}
              />
              {finErr.errFor("financeNote") ?? <span className="field-hint">&nbsp;</span>}
            </div>
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 10 }}
            disabled={busy}
            onClick={saveFinance}
          >
            {busy ? "กำลังบันทึก…" : "บันทึกยอด"}
          </button>
          {job.financeBy ? (
            <div className="detail-meta" style={{ marginTop: 6 }}>
              บันทึกล่าสุดโดย {job.financeBy} เมื่อ {bangkokDateTime(job.financeAt)}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
