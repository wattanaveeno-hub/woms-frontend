"use client";

// ---------------------------------------------------------------------------
// ทำรายการวางบิล — เลือกใบงานที่ปิดแล้ว ใส่ค่าแรง และลงระยะทาง "รายวัน"
// ---------------------------------------------------------------------------
// ข้อกำกับ: ค่าเดินทางคิดต่อวัน หลายใบงานในวันเดียวกันไม่คิดค่าเดินทางซ้ำ

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { AuthUser, BillableJob } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { jobTypeLabel } from "@/lib/options";

export default function NewBillPage() {
  const router = useRouter();
  const toast = useToast();
  // QA BUG-024 — backend รองรับ ?technicianId= สำหรับผู้มีสิทธิ์ bill:review (admin/manager)
  // เพื่อทำบิลแทนช่างรายอื่น แต่หน้าจอไม่เคยมีตัวเลือกช่าง จึงใช้ความสามารถนี้ไม่ได้เลย
  const { user, has } = useAuth();
  const canReview = has("bill:review");

  const [technicianId, setTechnicianId] = useState("");
  const [techs, setTechs] = useState<AuthUser[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [jobs, setJobs] = useState<BillableJob[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [labor, setLabor] = useState<Record<string, string>>({});
  const [travel, setTravel] = useState<Record<string, { distanceKm: string; travelAmount: string }>>({});
  const [expenses, setExpenses] = useState<Array<{ label: string; amount: string }>>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.billableJobs({
        from: from || undefined,
        to: to || undefined,
        technicianId: canReview && technicianId ? technicianId : undefined,
      });
      setJobs(r.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดใบงานไม่สำเร็จ");
      setJobs([]);
    }
  }, [from, to, technicianId, canReview]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canReview) return;
    api
      .listTechnicians()
      .then((r) => setTechs(r.items))
      .catch(() => setTechs([]));
  }, [canReview]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // วันที่ของใบงานที่เลือก — หนึ่งวันหนึ่งแถวค่าเดินทางเท่านั้น
  const pickedDates = useMemo(() => {
    const dates = new Set<string>();
    for (const j of jobs ?? []) if (picked.has(j.jobId) && j.jobDate) dates.add(j.jobDate);
    return [...dates].sort();
  }, [jobs, picked]);

  const totals = useMemo(() => {
    const laborTotal = [...picked].reduce((s, id) => s + (Number(labor[id]) || 0), 0);
    const travelTotal = pickedDates.reduce((s, d) => s + (Number(travel[d]?.travelAmount) || 0), 0);
    const expenseTotal = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return { laborTotal, travelTotal, expenseTotal, grand: laborTotal + travelTotal + expenseTotal };
  }, [picked, labor, pickedDates, travel, expenses]);

  const submit = async () => {
    if (!from || !to) {
      toast.error("ระบุรอบวางบิลก่อน");
      return;
    }
    if (picked.size === 0) {
      toast.error("เลือกใบงานอย่างน้อยหนึ่งใบ");
      return;
    }
    setBusy(true);
    try {
      const bill = await api.createBill({
        periodFrom: from,
        periodTo: to,
        jobIds: [...picked],
        labor: Object.fromEntries([...picked].map((id) => [id, Number(labor[id]) || 0])),
        days: pickedDates.map((d) => ({
          date: d,
          distanceKm: Number(travel[d]?.distanceKm) || 0,
          travelAmount: Number(travel[d]?.travelAmount) || 0,
          note: "",
        })),
        expenses: expenses
          .filter((e) => e.label.trim())
          .map((e, i) => ({ id: `EX-${i + 1}`, label: e.label, amount: Number(e.amount) || 0, attachment: "", note: "" })),
        note,
      });
      toast.success(`สร้างรายการวางบิล ${bill.billNo} แล้ว`);
      router.push(`/bills/${bill.id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "สร้างรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ทำรายการวางบิล</h1>
          <div className="detail-meta">
            เลือกได้เฉพาะใบงานที่ Admin ยืนยันปิดงานแล้ว และยังไม่เคยถูกวางบิล
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="form-grid">
          <label className="field">
            <span>รอบวางบิล — ตั้งแต่</span>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>ถึง</span>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          {canReview ? (
            <label className="field">
              <span>ช่างผู้วางบิล</span>
              <select
                className="select"
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
              >
                <option value="">{user ? `ตัวฉัน (${user.name})` : "ตัวฉัน"}</option>
                {techs
                  .filter((t) => t.id !== user?.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.team ? ` · ${t.team}` : ""}
                    </option>
                  ))}
              </select>
              <span className="field-hint">คุณมีสิทธิ์ตรวจบิล จึงทำบิลแทนช่างรายอื่นได้</span>
            </label>
          ) : null}
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>ใบงานที่วางบิลได้</h2>
        {jobs === null ? (
          <div className="state">กำลังโหลด…</div>
        ) : jobs.length === 0 ? (
          <div className="state">
            {/* QA BUG-023 — ข้อความเดิม "ไม่มีใบงานที่ปิดแล้วในช่วงนี้" ไม่จริง
                รายการถูกจำกัดขอบเขตให้เห็นเฉพาะใบงานของช่างที่เลือกเท่านั้น (NEG-BILN-06) */}
            ไม่มีใบงานที่ปิดแล้ว
            {canReview && technicianId
              ? `ของ ${techs.find((t) => t.id === technicianId)?.name ?? "ช่างที่เลือก"}`
              : "ของคุณ"}
            ในช่วงวันที่นี้
            <div className="sub" style={{ marginTop: 6 }}>
              รายการนี้แสดงเฉพาะใบงานที่คุณเป็นผู้รับผิดชอบหรืออยู่ทีมเดียวกัน — ไม่ใช่ใบงานทั้งบริษัท
              {canReview ? " · เปลี่ยน “ช่างผู้วางบิล” ด้านบนเพื่อดูของคนอื่น" : ""}
            </div>
          </div>
        ) : (
          <div className="table-scroll" style={{ maxHeight: 380 }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 36 }} />
                  <th>ใบงาน</th>
                  <th>ประเภท</th>
                  <th>วันที่</th>
                  <th>ลูกค้า</th>
                  <th>ค่าแรง (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.jobId} style={j.alreadyBilled ? { opacity: 0.5 } : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        checked={picked.has(j.jobId)}
                        disabled={j.alreadyBilled}
                        onChange={() => toggle(j.jobId)}
                        aria-label={`เลือก ${j.jobId}`}
                      />
                    </td>
                    <td className="mono">
                      {j.jobId}
                      {j.alreadyBilled && (
                        <span className="badge badge-off" style={{ marginLeft: 6 }}>
                          วางบิลแล้ว
                        </span>
                      )}
                    </td>
                    <td>{(jobTypeLabel as Record<string, string>)[j.jobType] ?? j.jobType}</td>
                    <td className="mono">{j.jobDate}</td>
                    <td>{j.customerName || "—"}</td>
                    <td>
                      <input
                        className="input"
                        inputMode="decimal"
                        style={{ maxWidth: 120 }}
                        value={labor[j.jobId] ?? ""}
                        disabled={!picked.has(j.jobId)}
                        onChange={(e) => setLabor({ ...labor, [j.jobId]: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>ระยะทางและค่าเดินทาง (รายวัน)</h2>
        <div className="detail-meta" style={{ marginBottom: 8 }}>
          หนึ่งวันกรอกครั้งเดียว — ถ้าวันนั้นมีหลายใบงาน ค่าเดินทางจะไม่ถูกคิดซ้ำตามจำนวนใบงาน
        </div>
        {pickedDates.length === 0 ? (
          <div className="state">เลือกใบงานก่อน ระบบจะแสดงวันที่ให้กรอก</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>ใบงานในวันนั้น</th>
                <th>ระยะทาง (กม.)</th>
                <th>ค่าเดินทาง (บาท)</th>
              </tr>
            </thead>
            <tbody>
              {pickedDates.map((d) => (
                <tr key={d}>
                  <td className="mono">{d}</td>
                  <td className="mono">
                    {(jobs ?? []).filter((j) => picked.has(j.jobId) && j.jobDate === d).length}
                  </td>
                  <td>
                    <input
                      className="input"
                      inputMode="decimal"
                      style={{ maxWidth: 120 }}
                      value={travel[d]?.distanceKm ?? ""}
                      onChange={(e) =>
                        setTravel({ ...travel, [d]: { ...(travel[d] ?? { travelAmount: "" }), distanceKm: e.target.value } })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      inputMode="decimal"
                      style={{ maxWidth: 120 }}
                      value={travel[d]?.travelAmount ?? ""}
                      onChange={(e) =>
                        setTravel({ ...travel, [d]: { ...(travel[d] ?? { distanceKm: "" }), travelAmount: e.target.value } })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="page-head" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>ค่าใช้จ่ายอื่น</h2>
          <button className="btn btn-sm" onClick={() => setExpenses([...expenses, { label: "", amount: "" }])}>
            + เพิ่มรายการ
          </button>
        </div>
        {expenses.map((e, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <input
              className="input"
              placeholder="รายการ เช่น ค่าทางด่วน"
              value={e.label}
              onChange={(ev) => setExpenses(expenses.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))}
            />
            <input
              className="input"
              inputMode="decimal"
              style={{ maxWidth: 140 }}
              placeholder="บาท"
              value={e.amount}
              onChange={(ev) => setExpenses(expenses.map((x, j) => (j === i ? { ...x, amount: ev.target.value } : x)))}
            />
            <button className="btn btn-sm btn-danger" onClick={() => setExpenses(expenses.filter((_, j) => j !== i))}>
              ลบ
            </button>
          </div>
        ))}
        <label className="field" style={{ marginTop: 8 }}>
          <span>หมายเหตุ</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>

      <div className="card card-pad">
        <div className="filters">
          <div className="stat">
            <div className="stat-num">{totals.laborTotal.toLocaleString("th-TH")}</div>
            <div className="stat-label">ค่าแรง</div>
          </div>
          <div className="stat">
            <div className="stat-num">{totals.travelTotal.toLocaleString("th-TH")}</div>
            <div className="stat-label">ค่าเดินทาง ({pickedDates.length} วัน)</div>
          </div>
          <div className="stat">
            <div className="stat-num">{totals.expenseTotal.toLocaleString("th-TH")}</div>
            <div className="stat-label">ค่าใช้จ่ายอื่น</div>
          </div>
          <div className="stat">
            <div className="stat-num">{totals.grand.toLocaleString("th-TH")}</div>
            <div className="stat-label">รวมทั้งสิ้น</div>
          </div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={busy} onClick={submit}>
          {busy ? "กำลังบันทึก…" : "บันทึกเป็นร่าง"}
        </button>
      </div>
    </>
  );
}
