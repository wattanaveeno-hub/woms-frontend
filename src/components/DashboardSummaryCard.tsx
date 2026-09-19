"use client";

// ---------------------------------------------------------------------------
// สรุปผลรวมของแดชบอร์ด (DASH-FN-001..010)
// ---------------------------------------------------------------------------
// ที่มา: ชีตหลัก โมดูล "ระบบการสรุปผล" — ตามประเภทงาน สถานะ ช่วงเวลา ช่าง
//        PM ที่ดำเนินการแล้ว/ค้าง · สต๊อกและมูลค่าคงเหลือ · กรอง · Export
//
// ทุกตัวเลขมาจาก /api/dashboard/summary ซึ่งนับจากรายการจริง
// และแสดง "จำนวนรายการต้นทางที่ใช้นับ" ไว้ให้กระทบยอดกับหน้ารายการได้

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import type { AuthUser, DashboardSummary, Options } from "@/lib/types";
import { jobTypeLabel, statusLabel } from "@/lib/options";

const num = (n: number) => n.toLocaleString("th-TH");

export default function DashboardSummaryCard() {
  const { has } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [jobType, setJobType] = useState("");
  const [team, setTeam] = useState("");
  // QA BUG-032 — AC-DASH-02 กำหนดตัวกรอง 5 ตัว แต่หน้าจอมี 4 (ขาด technicianId)
  // ทั้งที่ backend รองรับพารามิเตอร์นี้อยู่แล้ว
  const [technicianId, setTechnicianId] = useState("");
  const [techs, setTechs] = useState<AuthUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.dashboardSummary({
        from: from || undefined,
        to: to || undefined,
        jobType: jobType || undefined,
        team: team || undefined,
        technicianId: technicianId || undefined,
      });
      setData(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดสรุปผลไม่สำเร็จ");
    }
  }, [from, to, jobType, team, technicianId]);

  useEffect(() => {
    load();
    api.getOptions().then(setOptions).catch(() => setOptions(null));
    api
      .listTechnicians()
      .then((r) => setTechs(r.items))
      .catch(() => setTechs([]));
  }, [load]);

  const exportQuery = () => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (jobType) p.set("jobType", jobType);
    if (team) p.set("team", team);
    if (technicianId) p.set("technicianId", technicianId);
    return p.toString() ? `?${p}` : "";
  };

  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <div className="page-head" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>สรุปผล</h2>
        <button
          className="btn"
          onClick={() =>
            downloadFile(`/api/dashboard/export.xlsx${exportQuery()}`, "woms-dashboard.xlsx").catch((e) =>
              toast.error(e.message)
            )
          }
        >
          Export Excel
        </button>
      </div>

      <div className="form-grid" style={{ marginBottom: 12 }}>
        <label className="field">
          <span>ตั้งแต่วันที่</span>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          <span>ถึงวันที่</span>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="field">
          <span>ประเภทงาน</span>
          <select className="select" value={jobType} onChange={(e) => setJobType(e.target.value)}>
            <option value="">ทุกประเภท</option>
            {(options?.jobTypes ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>ทีมช่าง</span>
          <select className="select" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">ทุกทีม</option>
            {(options?.teams ?? []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>ช่าง</span>
          <select
            className="select"
            value={technicianId}
            onChange={(e) => setTechnicianId(e.target.value)}
          >
            <option value="">ทุกคน</option>
            {techs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.team ? ` · ${t.team}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {!data ? (
        <div className="state">กำลังโหลด…</div>
      ) : (
        <>
          <div className="filters" style={{ marginBottom: 12 }}>
            <div className="stat">
              <div className="stat-num">{num(data.jobs.total)}</div>
              <div className="stat-label">ใบงานในช่วงที่เลือก</div>
            </div>
            <div className="stat">
              <div className="stat-num">{num(data.pm.done)}</div>
              <div className="stat-label">PM ดำเนินการแล้ว</div>
            </div>
            <div className="stat">
              <div className="stat-num">{num(data.pm.openJobs)}</div>
              <div className="stat-label">PM ค้างดำเนินการ</div>
            </div>
            <div className="stat">
              <div className="stat-num">{num(data.pm.overdue)}</div>
              <div className="stat-label">เครื่องเกินกำหนด PM</div>
            </div>
            <div className="stat">
              <div className="stat-num">{num(data.jobs.revenueTotal)}</div>
              <div className="stat-label">รายรับจากใบงาน (บาท)</div>
            </div>
            <div className="stat">
              <div className="stat-num">{num(data.jobs.net)}</div>
              <div className="stat-label">ผลต่างสุทธิ (บาท)</div>
            </div>
          </div>

          <div className="form-grid">
            <div>
              <h3 style={{ fontSize: 15 }}>ตามประเภทงาน</h3>
              <table className="table">
                <tbody>
                  {Object.entries(data.jobs.byType).map(([k, v]) => (
                    <tr key={k}>
                      <td>{(jobTypeLabel as Record<string, string>)[k] ?? k}</td>
                      <td className="mono">{num(v)}</td>
                    </tr>
                  ))}
                  {Object.keys(data.jobs.byType).length === 0 && (
                    <tr>
                      <td colSpan={2}>ไม่มีข้อมูล</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div>
              <h3 style={{ fontSize: 15 }}>ตามสถานะ</h3>
              <table className="table">
                <tbody>
                  {Object.entries(data.jobs.byStatus).map(([k, v]) => (
                    <tr key={k}>
                      <td>{(statusLabel as Record<string, string>)[k] ?? k}</td>
                      <td className="mono">{num(v)}</td>
                    </tr>
                  ))}
                  {Object.keys(data.jobs.byStatus).length === 0 && (
                    <tr>
                      <td colSpan={2}>ไม่มีข้อมูล</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div>
              <h3 style={{ fontSize: 15 }}>ตามทีมช่าง</h3>
              <table className="table">
                <tbody>
                  {Object.entries(data.jobs.byTechnicianTeam).map(([k, v]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td className="mono">{num(v)}</td>
                    </tr>
                  ))}
                  {Object.keys(data.jobs.byTechnicianTeam).length === 0 && (
                    <tr>
                      <td colSpan={2}>ไม่มีข้อมูล</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {data.stock && has("stock:view") && (
            <div className="alert" style={{ marginTop: 12 }}>
              <strong>สต๊อกอะไหล่</strong> — {num(data.stock.parts)} รายการ · คงเหลือรวม {num(data.stock.totalQty)} ·
              ต่ำกว่าจุดสั่งซื้อ {num(data.stock.belowReorder)} รายการ ·{" "}
              {data.stock.totalValue === null ? (
                <span>มูลค่า: ยังคำนวณไม่ได้ ({data.stock.valuationNote})</span>
              ) : (
                <span>มูลค่าคงเหลือ {num(data.stock.totalValue)} บาท</span>
              )}
            </div>
          )}

          {data.contracts && has("contracts:view") && (
            <div className="alert" style={{ marginTop: 8 }}>
              <strong>สัญญา</strong> — ใช้งานอยู่ {num(data.contracts.active)} · ใกล้หมดอายุ{" "}
              {num(data.contracts.expiring)} · หมดอายุ {num(data.contracts.expired)} · ค้างชำระ{" "}
              {num(data.contracts.overdue)}
            </div>
          )}

          <div className="detail-meta" style={{ marginTop: 10 }}>
            ตัวเลขข้างต้นนับจากใบงานจริง {num(data.sources.jobsMatchedFilter)} ใบ (จากทั้งหมด{" "}
            {num(data.sources.jobsScanned)} ใบ) และเครื่อง {num(data.sources.equipmentScanned)} เครื่อง ·
            วันที่ของเซิร์ฟเวอร์ {data.serverDate}
          </div>
        </>
      )}
    </div>
  );
}
