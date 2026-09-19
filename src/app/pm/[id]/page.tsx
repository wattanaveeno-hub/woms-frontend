"use client";

// ---------------------------------------------------------------------------
// ตาราง PM รายเดือนของช่างหนึ่งคน — รายละเอียดและการจัดการ
// ---------------------------------------------------------------------------
// PM-FN-003 "สร้างใบงานจากรายการ PM ได้"  (+ ชีตหลัก: ต้องกันการสร้างซ้ำ)
// ชีตหลัก   "Admin เลือกจัดการงานภายในตาราง PM เดือนนั้นได้ เช่น การเพิ่ม ลด งาน"
// ชีตหลัก   "ส่งตาราง PM ประจำเดือนให้ช่างได้ โดยให้ Admin เป็นคน Aprove"

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import type { PmPlan } from "@/lib/types";
import { PM_ITEM_STATUS_LABEL, PM_PLAN_STATUS_LABEL } from "@/lib/types";
import { parseISODate } from "@/components/FieldErrors";

export default function PmPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { has } = useAuth();
  const toast = useToast();
  const dialog = useDialog();
  const canManage = has("pm:manage");
  const canApprove = has("pm:approve");

  const [plan, setPlan] = useState<PmPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPlan(await api.getPmPlan(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดตารางไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (status: PmPlan["status"]) => {
    let reason = "";
    if (status === "CANCELLED") {
      const r = await dialog.prompt({
        title: "ยกเลิกตาราง PM นี้?",
        message: "ตารางที่ยกเลิกแล้วเดินสถานะต่อไม่ได้",
        label: "เหตุผลที่ยกเลิก",
        type: "textarea",
        required: true,
        confirmLabel: "ยืนยันยกเลิกตาราง",
        cancelLabel: "ไม่ยกเลิก",
        danger: true,
      });
      if (r === null) return;
      reason = r.trim();
    }
    setBusy(true);
    try {
      setPlan(await api.setPmPlanStatus(id, status, reason));
      toast.success("อัปเดตสถานะแล้ว");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "อัปเดตไม่สำเร็จ");
      load();
    } finally {
      setBusy(false);
    }
  };

  const createJob = async (itemId: string) => {
    setBusyItem(itemId);
    try {
      const r = await api.createPmJob(id, itemId);
      setPlan(r.plan);
      toast.success(`เปิดใบงาน ${r.job.jobId} แล้ว`);
    } catch (e) {
      // 409 = มีคนเปิดไปแล้ว (กันซ้ำที่ฐานข้อมูล) — แสดงข้อความจริงจากเซิร์ฟเวอร์
      toast.error(e instanceof ApiError ? e.message : "เปิดใบงานไม่สำเร็จ");
      load();
    } finally {
      setBusyItem(null);
    }
  };

  const skip = async (itemId: string) => {
    const raw = await dialog.prompt({
      title: "ตัดงานนี้ออกจากแผน",
      label: "เหตุผลที่ตัดออก",
      type: "textarea",
      required: true,
      confirmLabel: "ตัดออกจากแผน",
    });
    if (raw === null) return;
    const reason = raw.trim();
    setBusyItem(itemId);
    try {
      setPlan(await api.skipPmPlanItem(id, itemId, reason));
      toast.success("ตัดออกจากแผนแล้ว");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ตัดออกไม่สำเร็จ");
    } finally {
      setBusyItem(null);
    }
  };

  const reschedule = async (itemId: string, current: string) => {
    // QA BUG-019 — เดิมเป็น prompt() ที่ตรวจแค่รูปแบบสตริง จึงรับ 2026-13-45 (วันที่ที่ไม่มีจริง)
    // ตอนนี้เป็น <input type="date"> ซึ่งเลือกวันที่ที่มีอยู่จริงเท่านั้น
    // และยังตรวจซ้ำด้วย parseISODate เผื่อผู้ใช้พิมพ์เอง
    const raw = await dialog.prompt({
      title: "แก้วันนัดในแผน",
      label: "วันที่นัดใหม่",
      help: "เลือกจากปฏิทิน — ระบบจะใช้วันนี้ตอนเปิดใบงานและตอนแจ้งเตือน",
      type: "date",
      defaultValue: current,
      required: true,
      confirmLabel: "บันทึกวันนัด",
      validate: (v) => {
        const r = parseISODate(v);
        return r.ok ? null : r.message;
      },
    });
    if (raw === null) return;
    const date = raw.trim();
    setBusyItem(itemId);
    try {
      setPlan(await api.schedulePmPlanItem(id, itemId, date));
      toast.success("อัปเดตวันนัดแล้ว");
    } catch (e) {
      // backend ตรวจวันที่อีกชั้น (BUG-019) — ข้อความจากเซิร์ฟเวอร์ต้องถึงผู้ใช้เสมอ
      toast.error(e instanceof ApiError ? e.message : "อัปเดตวันนัดไม่สำเร็จ");
      load();
    } finally {
      setBusyItem(null);
    }
  };

  if (error) {
    return (
      <>
        <div className="alert alert-error">{error}</div>
        <Link href="/pm" className="btn">
          ← กลับตาราง PM
        </Link>
      </>
    );
  }
  if (!plan) return <div className="state">กำลังโหลด…</div>;

  const editable = plan.status !== "CLOSED" && plan.status !== "CANCELLED";

  return (
    <>
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
            PM {plan.month} · {plan.technicianName}
            <span className="badge">{PM_PLAN_STATUS_LABEL[plan.status] ?? plan.status}</span>
          </h1>
          <div className="detail-meta">
            {plan.team ? `ทีม ${plan.team} · ` : ""}
            {plan.total} รายการ · ในแผน {plan.counts.PLANNED} · เปิดใบงาน {plan.counts.JOB_CREATED} · ทำแล้ว{" "}
            {plan.counts.DONE} · ตัดออก {plan.counts.SKIPPED}
            {plan.approvedBy ? ` · อนุมัติโดย ${plan.approvedBy}` : ""}
          </div>
        </div>
        <Link href="/pm" className="btn">
          ← ตาราง PM
        </Link>
      </div>

      {plan.status === "DRAFT" && (
        <div className="alert alert-warn">
          ตารางยังเป็นร่าง — ช่างยังมองไม่เห็น และยังเปิดใบงานจากตารางนี้ไม่ได้ จนกว่าจะอนุมัติ
        </div>
      )}
      {plan.status === "APPROVED" && (
        <div className="alert">อนุมัติแล้ว — กด “ส่งให้ช่าง” เพื่อให้ช่างเห็นตารางนี้ในระบบช่าง</div>
      )}
      {plan.status === "CANCELLED" && plan.cancelReason && (
        <div className="alert alert-error">ยกเลิกแล้ว — {plan.cancelReason}</div>
      )}

      {canManage && (
        <div className="card card-pad" style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {plan.status === "DRAFT" && canApprove && (
            <button className="btn btn-primary" disabled={busy} onClick={() => setStatus("APPROVED")}>
              อนุมัติตาราง
            </button>
          )}
          {plan.status === "APPROVED" && canApprove && (
            <>
              <button className="btn btn-primary" disabled={busy} onClick={() => setStatus("SENT")}>
                ส่งให้ช่าง
              </button>
              <button className="btn" disabled={busy} onClick={() => setStatus("DRAFT")}>
                ถอนการอนุมัติ
              </button>
            </>
          )}
          {plan.status === "SENT" && (
            <button className="btn" disabled={busy} onClick={() => setStatus("CLOSED")}>
              ปิดรอบเดือน
            </button>
          )}
          {editable && (
            <button className="btn btn-danger" disabled={busy} onClick={() => setStatus("CANCELLED")}>
              ยกเลิกตาราง
            </button>
          )}
        </div>
      )}

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Serial</th>
                <th>รุ่น</th>
                <th>ลูกค้า / สาขา</th>
                <th>ครบกำหนด</th>
                <th>วันนัดในแผน</th>
                <th>สถานะ</th>
                <th>ใบงาน</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {plan.items.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 8 : 7}>
                    <div className="state">ยังไม่มีรายการในตารางนี้</div>
                  </td>
                </tr>
              )}
              {plan.items.map((it) => (
                <tr key={it.id} style={it.status === "SKIPPED" ? { opacity: 0.55 } : undefined}>
                  <td className="mono">
                    {it.equipmentId ? <Link href={`/equipment/${it.equipmentId}`}>{it.serial}</Link> : it.serial}
                  </td>
                  <td>{it.model || "-"}</td>
                  <td>
                    {it.customerName || "-"}
                    {it.siteLabel ? <div className="detail-meta">{it.siteLabel}</div> : null}
                  </td>
                  <td className="mono">{it.dueDate || "-"}</td>
                  <td className="mono">
                    {it.plannedDate || "-"}
                    {it.plannedTime ? ` ${it.plannedTime}` : ""}
                  </td>
                  <td>
                    <span className="badge">{PM_ITEM_STATUS_LABEL[it.status] ?? it.status}</span>
                    {it.skipReason ? <div className="detail-meta">{it.skipReason}</div> : null}
                  </td>
                  <td className="mono">
                    {it.jobId ? <Link href={`/jobs/${it.jobId}`}>{it.jobId}</Link> : "-"}
                  </td>
                  {canManage && (
                    <td style={{ whiteSpace: "nowrap" }}>
                      {!it.jobId && it.status !== "SKIPPED" && plan.status !== "DRAFT" && editable && (
                        <button
                          className="btn btn-sm btn-primary"
                          disabled={busyItem === it.id}
                          onClick={() => createJob(it.id)}
                        >
                          {busyItem === it.id ? "กำลังเปิด…" : "เปิดใบงาน"}
                        </button>
                      )}
                      {!it.jobId && it.status !== "SKIPPED" && editable && (
                        <>
                          <button
                            className="btn btn-sm"
                            style={{ marginLeft: 6 }}
                            disabled={busyItem === it.id}
                            onClick={() => reschedule(it.id, it.plannedDate || it.dueDate)}
                          >
                            แก้วันนัด
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            style={{ marginLeft: 6 }}
                            disabled={busyItem === it.id}
                            onClick={() => skip(it.id)}
                          >
                            ตัดออก
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
