"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import Pagination, { usePagination } from "@/components/Pagination";
import type { JobDateScope, JobListItem, JobStatus, Options } from "@/lib/types";
import { jobTypeLabel, subTypeLabel, fmtDateTime } from "@/lib/options";
import StatusBadge from "@/components/StatusBadge";
import { useUrlFilters } from "@/lib/urlFilters";

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobListItem[]>([]); // รายการไม่มีรูป/ลายเซ็น (Phase 9.1)
  const { page, setPage, pageCount, pageItems, total } = usePagination(jobs, 10);
  const [options, setOptions] = useState<Options | null>(null);
  /*
   * QA BUG-009 — ตัวกรองสะท้อนลง URL แล้ว ทำให้ส่งลิงก์/bookmark/F5/ปุ่ม Back ใช้งานได้จริง
   * `dateScope` ยังเป็นช่วงวันนัดที่เซิร์ฟเวอร์เป็นคนเทียบให้ (ใช้โดยการ์ดบนแดชบอร์ด)
   */
  const [f, setF] = useUrlFilters({ status: "", dateScope: "", team: "", q: "" });
  const status = f.status as JobStatus | "";
  const dateScope = f.dateScope as JobDateScope | "";
  const team = f.team;
  const q = f.q;
  const setStatus = (v: JobStatus | "") => setF({ status: v });
  const setTeam = (v: string) => setF({ team: v });
  const setQ = (v: string) => setF({ q: v });
  const [qDebounced, setQDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadSeqRef = useRef(0);

  // หน่วงคำค้น ~350ms กันยิง API ทุกตัวอักษร (ทีม/สถานะยังกรองทันที)
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    // กันคำตอบที่มาช้าทับผลลัพธ์ใหม่กว่า — นับรอบไว้ แล้วเช็คก่อน set state
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.listJobs({
        status: status || undefined,
        team: team || undefined,
        dateScope: dateScope || undefined,
        q: qDebounced || undefined,
      });
      if (seq !== loadSeqRef.current) return;
      setJobs(res.jobs);
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [status, team, dateScope, qDebounced]);

  useEffect(() => {
    api.getOptions().then(setOptions).catch(() => setOptions(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>งานทั้งหมด</h1>
          <div className="sub">{jobs.length} งาน</div>
        </div>
        <Link href="/jobs/new" className="btn btn-primary">
          + เปิดงาน
        </Link>
      </div>

      <div className="filters">
        <div className="field">
          <label>สถานะ</label>
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as JobStatus | "")}
          >
            <option value="">ทั้งหมด</option>
            <option value="OPEN">เปิดงาน</option>
            <option value="CLOSED">ปิดงาน</option>
            {/* QA BUG-013 — backend รับ OPEN/CLOSED/CANCELLED แต่ UI เคยให้เลือกได้แค่ 2
                ใบงานที่ถูกยกเลิกจึงกรองหาไม่ได้เลยจากหน้ารายการ */}
            <option value="CANCELLED">ยกเลิก</option>
          </select>
        </div>
        <div className="field">
          <label>ช่วงวันนัด</label>
          <select
            className="select"
            value={dateScope}
            onChange={(e) => {
              const v = e.target.value as JobDateScope | "";
              // นิยามของช่วงวันนัดรวม "ยังเปิดอยู่" อยู่แล้ว
              setF(v ? { dateScope: v, status: "OPEN" } : { dateScope: "" });
            }}
          >
            <option value="">ทั้งหมด</option>
            <option value="TODAY">นัดวันนี้</option>
            <option value="OVERDUE">เลยกำหนดนัด</option>
          </select>
        </div>
        <div className="field">
          <label>ทีมช่าง</label>
          {options?.teams.length ? (
            <select className="select" value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">ทุกทีม</option>
              {options.teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          ) : (
            <input className="input" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="ทีม" />
          )}
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>ค้นหา</label>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ชื่องาน / ผู้ติดต่อ / รุ่น / รหัสงาน"
          />
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card">
        {loading ? (
          <div className="state">กำลังโหลด…</div>
        ) : jobs.length === 0 ? (
          <div className="state">
            ยังไม่มีงานที่ตรงเงื่อนไข — <Link href="/jobs/new">เปิดงานแรก</Link>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>รหัสงาน</th>
                <th>ประเภท</th>
                <th>ชื่องาน</th>
                <th>ทีมช่าง</th>
                <th>วัน/เวลา</th>
                <th>สถานะ</th>
                <th style={{ width: 52 }}></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((j) => (
                <tr
                  key={j.jobId}
                  className="row-link"
                  onClick={() => router.push(`/jobs/${j.jobId}`)}
                >
                  <td className="code">{j.jobId}</td>
                  <td>
                    <span className="pill">
                      {jobTypeLabel[j.jobType]}
                      {j.jobSubType ? ` · ${subTypeLabel[j.jobSubType as "PICKUP_REPAIR" | "RETURN"]}` : ""}
                    </span>
                  </td>
                  <td>{j.jobName}</td>
                  <td>{j.technicianTeam || "—"}</td>
                  <td className="mono" style={{ fontSize: 13 }}>{fmtDateTime(j.jobDate, j.jobTime)}</td>
                  <td>
                    <StatusBadge status={j.status} />
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/jobs/${j.jobId}/chat`}
                      className="btn btn-sm"
                      title="เปิดแชท / ส่งงาน"
                      aria-label={`เปิดแชทงาน ${j.jobId}`}
                    >
                      💬
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pagination page={page} pageCount={pageCount} total={total} onPage={setPage} />
    </>
  );
}
