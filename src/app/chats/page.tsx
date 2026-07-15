"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { ChatRoomSummary, JobStatus } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";

// แสดงเวลาท้องถิ่นของผู้ใช้ — วันนี้ → "HH:mm" / วันอื่น → "DD/MM HH:mm"
function fmtTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const time = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return time;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm} ${time}`;
}

export default function ChatsPage() {
  const [rooms, setRooms] = useState<ChatRoomSummary[]>([]);
  const [unreadRooms, setUnreadRooms] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await api.chatRooms();
        if (!active) return;
        setRooms(res.items);
        setUnreadRooms(res.unreadRooms);
        setError(null);
      } catch (e) {
        if (!active) return;
        setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 30_000);
    const onRefresh = () => load();
    window.addEventListener("focus", onRefresh);
    window.addEventListener("woms:chat-read", onRefresh);
    return () => {
      active = false;
      clearInterval(t);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("woms:chat-read", onRefresh);
    };
  }, []);

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? rooms.filter((r) =>
        [r.jobId, r.jobName, r.lastText, r.lastFrom].some((s) =>
          (s || "").toLowerCase().includes(needle)
        )
      )
    : rooms;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>แชทงาน</h1>
          <div className="sub">
            {rooms.length} ห้อง · ยังไม่อ่าน {unreadRooms} ห้อง
          </div>
        </div>
      </div>

      <div className="filters">
        <div className="field" style={{ flex: 1 }}>
          <label>ค้นหา</label>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหา รหัสงาน / ชื่องาน / ข้อความ"
          />
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card">
        {loading ? (
          <div className="state">กำลังโหลด…</div>
        ) : rooms.length === 0 ? (
          <div className="state">ยังไม่มีห้องแชท — เปิดห้องแรกได้จากหน้างาน</div>
        ) : filtered.length === 0 ? (
          <div className="state">ไม่พบห้องที่ตรงกับคำค้น</div>
        ) : (
          filtered.map((r) => (
            <Link
              key={r.jobId}
              href={`/jobs/${r.jobId}/chat`}
              className={`chat-room${r.unread ? " unread" : ""}`}
            >
              <span className="chat-room-dot" />
              <div className="chat-room-main">
                <div className="chat-room-top">
                  <span className="code">{r.jobId}</span>
                  {r.jobStatus ? <StatusBadge status={r.jobStatus as JobStatus} /> : null}
                  <span className="chat-room-name">{r.jobName || "(ไม่พบข้อมูลงาน)"}</span>
                </div>
                <div className="chat-room-last">
                  {(r.lastSystem ? "ระบบ" : r.lastFrom) + ": " + r.lastText}
                </div>
              </div>
              <span className="chat-room-time">{fmtTime(r.lastAt)}</span>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
