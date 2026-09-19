"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { CalendarResponse, Options } from "@/lib/types";
import { jobTypeLabel } from "@/lib/options";
import { addDaysISO, bangkokToday, dayMonthLabel, startOfWeekISO } from "@/lib/date";

// ปฏิทินทำงานบนวันที่แบบ date-only (YYYY-MM-DD) ล้วน ๆ
//
// เดิมสร้างวันของสัปดาห์เป็น Date แบบเวลาเครื่อง แล้วแปลงเป็นช่วง query ด้วย toISOString()
// ซึ่งเป็นเวลา UTC — เบราว์เซอร์ที่ตั้งเป็นเวลาไทย (UTC+7) จึงถามข้อมูลย้อนไป 1 วัน
// (หัวคอลัมน์ 14–20 แต่ query 13–19) ทำให้งานวันอาทิตย์ท้ายสัปดาห์หายไปทั้งวัน
// และงานที่ดึงมาได้ก็ตกคอลัมน์เพี้ยนไปหนึ่งช่อง
//
// ตอนนี้ช่วง query · หัวคอลัมน์ · คีย์ของช่องในตาราง มาจากสตริงชุดเดียวกัน
// จึงตรงกันโดยโครงสร้าง ไม่มีการแปลงผ่าน Date ให้เลื่อนวันได้อีก
const DOW = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

export default function CalendarPage() {
  const router = useRouter();
  // ยึด "วันนี้" ตามเวลาไทย ไม่ใช่เขตเวลาที่ตั้งไว้ในเครื่องผู้ใช้
  const [weekStart, setWeekStart] = useState<string>(() => startOfWeekISO(bangkokToday()));
  const [team, setTeam] = useState("");
  const [options, setOptions] = useState<Options | null>(null);
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)),
    [weekStart]
  );
  const from = days[0];
  const to = days[6];

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
          <button className="btn" onClick={() => setWeekStart(addDaysISO(weekStart, -7))}>
            ← สัปดาห์ก่อน
          </button>
          <button className="btn" onClick={() => setWeekStart(startOfWeekISO(bangkokToday()))}>
            สัปดาห์นี้
          </button>
          <button className="btn" onClick={() => setWeekStart(addDaysISO(weekStart, 7))}>
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
                <div key={d} className="cal-dayhead">
                  {DOW[i]} {dayMonthLabel(d)}
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
                    // คีย์ของช่อง = วันที่เดียวกับที่ใช้ query และที่แสดงบนหัวคอลัมน์
                    const evs = lane.events.filter((e) => e.date === d);
                    return (
                      <div key={d} className="cal-daycell">
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
