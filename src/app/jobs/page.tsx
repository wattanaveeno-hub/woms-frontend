"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Job, JobStatus, Options } from "@/lib/types";
import { jobTypeLabel, subTypeLabel, fmtDateTime } from "@/lib/options";
import StatusBadge from "@/components/StatusBadge";

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [options, setOptions] = useState<Options | null>(null);
  const [status, setStatus] = useState<JobStatus | "">("");
  const [team, setTeam] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listJobs({
        status: status || undefined,
        team: team || undefined,
        q: q || undefined,
      });
      setJobs(res.jobs);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [status, team, q]);

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
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
