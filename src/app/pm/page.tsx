"use client";

// ---------------------------------------------------------------------------
// ระบบจัดการ PM — ตาราง PM รายเดือน
// ---------------------------------------------------------------------------
// PM-FN-001 "จัดทำตาราง PM รายเดือนแยกตามช่างหรือผู้รับผิดชอบได้"
// PM-FN-005 "แสดงตาราง PM ล่วงหน้าได้"  (เลือกเดือนล่วงหน้าได้จากช่องเดือน)
// ชีตหลัก   "ส่งตาราง PM ประจำเดือนให้ช่างได้ โดยให้ Admin เป็นคน Aprove"

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import type { AuthUser, PmCandidate, PmPlan } from "@/lib/types";
import { PM_PLAN_STATUS_LABEL } from "@/lib/types";

function thisMonth(): string {
  const d = new Date();
  // ใช้เวลาไทยเพื่อให้ตรงกับฝั่งเซิร์ฟเวอร์เสมอ
  const bkk = new Date(d.getTime() + (7 * 60 + d.getTimezoneOffset()) * 60_000);
  return `${bkk.getFullYear()}-${String(bkk.getMonth() + 1).padStart(2, "0")}`;
}

export default function PmPage() {
  const { has } = useAuth();
  const toast = useToast();
  const canManage = has("pm:manage");

  const [month, setMonth] = useState(thisMonth());
  const [plans, setPlans] = useState<PmPlan[] | null>(null);
  const [candidates, setCandidates] = useState<PmCandidate[] | null>(null);
  const [techs, setTechs] = useState<AuthUser[]>([]);
  const [techId, setTechId] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setPlans(null);
    try {
      const r = await api.listPmPlans({ month });
      setPlans(r.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดตาราง PM ไม่สำเร็จ");
      setPlans([]);
    }
    if (canManage) {
      try {
        const [c, t] = await Promise.all([api.pmCandidates({ month }), api.listTechnicians()]);
        setCandidates(c.items);
        setTechs(t.items);
      } catch {
        setCandidates([]);
      }
    }
  }, [month, canManage]);

  useEffect(() => {
    load();
  }, [load]);

  // เครื่องที่อยู่ในตารางของเดือนนี้แล้ว ไม่ควรถูกเลือกซ้ำ
  const alreadyPlanned = useMemo(() => {
    const s = new Set<string>();
    for (const p of plans ?? []) for (const it of p.items) if (it.equipmentId) s.add(it.equipmentId);
    return s;
  }, [plans]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const createPlan = async () => {
    if (!techId) {
      toast.error("เลือกช่าง/ผู้รับผิดชอบก่อน");
      return;
    }
    setBusy(true);
    try {
      const plan = await api.createPmPlan({
        month,
        technicianId: techId,
        equipmentIds: [...picked],
      });
      toast.success(`สร้างตาราง PM เดือน ${plan.month} ของ ${plan.technicianName} แล้ว`);
      setPicked(new Set());
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "สร้างตารางไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ตาราง PM รายเดือน</h1>
          <div className="detail-meta">
            แยกตามช่าง/ผู้รับผิดชอบ · ช่างจะเห็นตารางหลังผู้ดูแลอนุมัติและกดส่งแล้วเท่านั้น
          </div>
        </div>
        <label className="field" style={{ margin: 0 }}>
          <span>เดือน</span>
          <input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>ตารางของเดือน {month}</h2>
        {plans === null ? (
          <div className="state">กำลังโหลด…</div>
        ) : plans.length === 0 ? (
          <div className="state">ยังไม่มีตาราง PM ของเดือนนี้</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>ผู้รับผิดชอบ</th>
                  <th>ทีม</th>
                  <th>สถานะ</th>
                  <th>ในแผน</th>
                  <th>เปิดใบงาน</th>
                  <th>ทำแล้ว</th>
                  <th>ตัดออก</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td>{p.technicianName}</td>
                    <td>{p.team || "-"}</td>
                    <td>
                      <span className="badge">{PM_PLAN_STATUS_LABEL[p.status] ?? p.status}</span>
                    </td>
                    <td className="mono">{p.counts.PLANNED}</td>
                    <td className="mono">{p.counts.JOB_CREATED}</td>
                    <td className="mono">{p.counts.DONE}</td>
                    <td className="mono">{p.counts.SKIPPED}</td>
                    <td>
                      <Link className="btn btn-sm" href={`/pm/${p.id}`}>
                        เปิด
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canManage && (
        <div className="card card-pad">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>
            เครื่องที่ถึง/ใกล้ถึงกำหนด PM ในเดือน {month}
            {candidates ? ` (${candidates.length})` : ""}
          </h2>
          <div className="detail-meta" style={{ marginBottom: 10 }}>
            รายการนี้คำนวณจากรอบ PM ของเครื่องในคลัง (รวมงานที่ค้างจากเดือนก่อน) — เลือกแล้วสร้างเป็นตารางของช่างหนึ่งคน
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <select className="select" value={techId} onChange={(e) => setTechId(e.target.value)} style={{ maxWidth: 260 }}>
              <option value="">— เลือกช่าง/ผู้รับผิดชอบ —</option>
              {techs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.team ? ` · ${t.team}` : ""}
                </option>
              ))}
            </select>
            {/* QA BUG-020 — ปุ่มนี้เคยกดได้ทั้งที่ป้ายเขียนว่า "0 เครื่อง" (B-07) */}
            <button
              className="btn btn-primary"
              disabled={busy || !techId || picked.size === 0}
              onClick={createPlan}
            >
              {busy ? "กำลังสร้าง…" : `สร้างตาราง (${picked.size} เครื่อง)`}
            </button>
            {!busy && (!techId || picked.size === 0) ? (
              <span className="field-hint">
                {!techId
                  ? "เลือกช่างผู้รับผิดชอบก่อน"
                  : "ยังไม่ได้เลือกเครื่อง — ติ๊กเครื่องที่ต้องการอย่างน้อย 1 เครื่อง"}
              </span>
            ) : null}
          </div>

          {candidates === null ? (
            <div className="state">กำลังโหลด…</div>
          ) : candidates.length === 0 ? (
            <div className="state">ไม่มีเครื่องที่ถึงกำหนด PM ในเดือนนี้</div>
          ) : (
            <div style={{ overflowX: "auto", maxHeight: 460 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }} />
                    <th>Serial</th>
                    <th>รุ่น</th>
                    <th>ลูกค้า</th>
                    <th>สาขา</th>
                    <th>โซน</th>
                    <th>ครบกำหนด</th>
                    <th>Package PM</th>
                    <th>สัญญา</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => {
                    const planned = alreadyPlanned.has(c.equipmentId);
                    return (
                      <tr key={c.equipmentId} style={planned ? { opacity: 0.55 } : undefined}>
                        <td>
                          <input
                            type="checkbox"
                            checked={picked.has(c.equipmentId)}
                            disabled={planned}
                            onChange={() => toggle(c.equipmentId)}
                            aria-label={`เลือก ${c.serial}`}
                          />
                        </td>
                        <td className="mono">{c.serial}</td>
                        <td>{c.model}</td>
                        <td>{c.customerName || "-"}</td>
                        <td>{c.siteLabel || "-"}</td>
                        <td>{c.zone || "-"}</td>
                        <td className="mono">
                          {c.dueDate}
                          {c.pmDaysLeft < 0 && (
                            <span className="badge badge-off" style={{ marginLeft: 6 }}>
                              เกิน {Math.abs(c.pmDaysLeft)} วัน
                            </span>
                          )}
                        </td>
                        <td>{c.pmPackage || "-"}</td>
                        <td className="mono">
                          {c.contractNo || "-"}
                          {planned && (
                            <span className="pill" style={{ marginLeft: 6 }}>
                              อยู่ในตารางแล้ว
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
