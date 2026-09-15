"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { Equipment } from "@/lib/types";
import { PmBadge } from "@/components/EquipmentBadges";
import { setJobPrefill } from "@/lib/jobPrefill";
import { useToast } from "@/components/Toast";

/**
 * การ์ด PM ของเครื่อง
 *
 * ค่าที่แสดงทั้งหมด (nextPmDate / pmStatus / pmDaysLeft) มาจาก backend
 * หน้าเว็บไม่คำนวณเองแม้แต่ค่าเดียว — แก้ได้เฉพาะ "รอบ PM" กับ "วัน PM ล่าสุด"
 */
export default function EquipmentPmCard({
  equipment,
  onSaved,
}: {
  equipment: Equipment;
  onSaved: (updated: Equipment) => void;
}) {
  const { has } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const canEdit = has("equipment:edit");
  const canCreateJob = has("jobs:create");

  const [open, setOpen] = useState(false);
  const [interval, setIntervalMonths] = useState(String(equipment.pmIntervalMonths || ""));
  const [lastPm, setLastPm] = useState(equipment.lastPmDate || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const months = Number(interval || 0);
    if (!Number.isInteger(months) || months < 0) {
      setError("รอบ PM ต้องเป็นจำนวนเต็มไม่ติดลบ (0 = ยังไม่ตั้งรอบ)");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patchEquipment(
        equipment.id,
        { pmIntervalMonths: months, lastPmDate: lastPm } as any,
        equipment.updatedAt
      );
      onSaved(updated); // ค่าที่ derive ทั้งหมดมาจาก response ของ backend
      setOpen(false);
      toast.success("บันทึกรอบ PM แล้ว");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  // ส่งเครื่องนี้ไปหน้าเปิดงานพร้อมตั้งประเภทงานเป็น PM — ไม่บันทึกงานให้อัตโนมัติ
  const createPmJob = () => {
    setJobPrefill({ equipmentIds: [equipment.id], jobType: "PM" });
    router.push("/jobs/new");
  };

  const notConfigured = equipment.pmStatus === "NOT_CONFIGURED";

  return (
    <div className="card card-pad" style={{ marginTop: 18 }}>
      <div className="toolbar" style={{ marginTop: 0, justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>
          การบำรุงรักษาตามรอบ (PM) <PmBadge status={equipment.pmStatus} />
        </h2>
        <div className="head-actions">
          {canCreateJob ? (
            <button className="btn" onClick={createPmJob}>
              สร้างงาน PM
            </button>
          ) : null}
          {canEdit ? (
            <button className="btn" onClick={() => setOpen((o) => !o)} disabled={busy}>
              {open ? "ปิด" : notConfigured ? "ตั้งรอบ PM" : "แก้รอบ PM"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div> : null}

      <div className="detail-meta" style={{ marginTop: 10 }}>
        <span>
          รอบ PM:{" "}
          <strong>{equipment.pmIntervalMonths > 0 ? `ทุก ${equipment.pmIntervalMonths} เดือน` : "ยังไม่ตั้ง"}</strong>
        </span>
        <span>
          PM ล่าสุด: <span className="mono">{equipment.lastPmDate || "— ยังไม่เคยทำ —"}</span>
        </span>
        {equipment.nextPmDate ? (
          <span>
            ครบกำหนดถัดไป: <span className="mono">{equipment.nextPmDate}</span>
          </span>
        ) : null}
        {equipment.nextPmDate ? (
          <span style={{ color: equipment.pmDaysLeft < 0 ? "var(--danger)" : undefined }}>
            {equipment.pmDaysLeft >= 0
              ? `เหลืออีก ${equipment.pmDaysLeft} วัน`
              : `เกินกำหนดมาแล้ว ${Math.abs(equipment.pmDaysLeft)} วัน`}
          </span>
        ) : null}
      </div>

      {notConfigured ? (
        <div className="sub" style={{ marginTop: 8 }}>
          {equipment.pmIntervalMonths > 0
            ? "ตั้งรอบไว้แล้วแต่ยังไม่เคยบันทึกวันทำ PM — ระบบจะยังไม่นับว่าเกินกำหนด วันครบกำหนดจะเริ่มนับหลังปิดใบงาน PM ใบแรก (หรือกรอกวัน PM ล่าสุดไว้เป็นจุดตั้งต้น)"
            : "ยังไม่ได้ตั้งรอบ PM ของเครื่องนี้"}
        </div>
      ) : null}

      {open && canEdit ? (
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 12 }}>
          <div className="form-grid">
            <div className="field">
              <label>รอบ PM (เดือน)</label>
              <input
                className="input"
                type="number"
                min={0}
                step={1}
                value={interval}
                onChange={(e) => setIntervalMonths(e.target.value)}
                placeholder="เช่น 6 · ใส่ 0 = ยังไม่ตั้งรอบ"
              />
            </div>
            <div className="field">
              <label>วันที่ทำ PM ล่าสุด</label>
              <input
                className="input"
                type="date"
                value={lastPm}
                onChange={(e) => setLastPm(e.target.value)}
              />
              <span className="sub">
                ใส่ไว้เป็นจุดตั้งต้นได้ — หลังจากนี้ระบบจะเลื่อนให้เองเมื่อปิดใบงาน PM
              </span>
            </div>
          </div>
          <div className="toolbar">
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? "กำลังบันทึก…" : "บันทึกรอบ PM"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
