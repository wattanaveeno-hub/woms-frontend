"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { CalendarResponse, Options } from "@/lib/types";
import { jobTypeLabel } from "@/lib/options";

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const DOW = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

export default function CalendarPage() {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [team, setTeam] = useState("");
  const [options, setOptions] = useState<Options | null>(null);
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const from = iso(days[0]);
  const to = iso(days[6]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.calendar({ from, to, team: team || undefined });
      setData(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดปฏิทินไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [from, to, team]);

  useEffect(() => {
    api.getOptions().then(setOptions).catch(() => setOptions(null));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const cols = `160px repeat(7, 1fr)`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ปฏิทินงาน</h1>
          <div className="sub">แยกตามทีมช่าง · <span className="mono">{from} → {to}</span></div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            ← สัปดาห์ก่อน
          </button>
          <button className="btn" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            สัปดาห์นี้
          </button>
          <button className="btn" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            สัปดาห์หน้า →
          </button>
        </div>
      </div>

      <div className="filters">
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
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="cal-scroll">
        <div className="cal-grid">
          {/* header row */}
          <div className="cal-row cal-head">
            <div className="cal-team">ทีมช่าง</div>
            <div className="cal-daycols" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
              {days.map((d, i) => (
                <div key={i} className="cal-dayhead">
                  {DOW[i]} {d.getDate()}/{d.getMonth() + 1}
                </div>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="state">กำลังโหลด…</div>
          ) : !data || data.lanes.length === 0 ? (
            <div className="state">ไม่มีงานในสัปดาห์นี้</div>
          ) : (
            data.lanes.map((lane) => (
              <div key={lane.team} className="cal-row" style={{ gridTemplateColumns: "160px 1fr" }}>
                <div className="cal-team">{lane.team}</div>
                <div className="cal-days" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                  {days.map((d) => {
                    const key = iso(d);
                    const evs = lane.events.filter((e) => e.date === key);
                    return (
                      <div key={key} className="cal-daycell">
                        {evs.map((e) => (
                          <a
                            key={e.jobId}
                            className={`cal-event ${e.status === "CLOSED" ? "closed" : ""}`}
                            onClick={() => router.push(`/jobs/${e.jobId}`)}
                          >
                            <span className="t">{e.time || ""}</span> {jobTypeLabel[e.jobType]} · {e.title}
                          </a>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
