"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { ChatMessage, ChatRead, Job, Submission } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/lib/AuthContext";

const POLL_MS = 4000;
const TYPING_THROTTLE_MS = 2500;

// short soft beep for incoming messages (no audio asset needed)
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.28);
    o.onended = () => ctx.close();
  } catch {
    /* ignore */
  }
}

const SUB_LABEL: Record<Submission["status"], string> = {
  PENDING: "รอตรวจ",
  CONFIRMED: "ยืนยันแล้ว",
  REJECTED: "ตีกลับ",
};

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

export default function JobChatPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user, has } = useAuth();
  const canReview = has("jobs:close");

  const [job, setJob] = useState<Job | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reviewFor, setReviewFor] = useState<{ subId: string; action: "confirm" | "reject" } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [reads, setReads] = useState<ChatRead[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const countRef = useRef(0);
  const lastMsgTsRef = useRef<string>("");
  const lastReadSentRef = useRef<string>("");
  const lastTypingSentRef = useRef(0);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  const subByMsg = useMemo(() => {
    const m = new Map<string, Submission>();
    for (const s of submissions) m.set(s.msgId, s);
    return m;
  }, [submissions]);

  // ใครอ่านถึงข้อความนี้แล้วบ้าง (ไม่นับคนส่งเอง)
  const readersOf = useCallback(
    (m: ChatMessage): string[] =>
      reads.filter((r) => r.userId !== m.userId && r.lastReadAt >= m.createdAt).map((r) => r.userName),
    [reads]
  );

  // ข้อความล่าสุดของเรา — โชว์รายชื่อคนอ่านเต็ม ๆ เฉพาะบับเบิลนี้
  const lastMineMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (!m.system && user && m.userId === user.id) return m.msgId;
    }
    return null;
  }, [messages, user]);

  // บันทึก "อ่านแล้ว" — ส่งเมื่อหน้าเปิดอยู่จริง และมีของใหม่ให้บันทึก (กัน spam ด้วย ref)
  const markRead = useCallback(() => {
    if (typeof document !== "undefined" && document.hidden) return;
    const ts = lastMsgTsRef.current || "empty";
    if (lastReadSentRef.current === ts) return;
    lastReadSentRef.current = ts;
    api
      .markRead(id)
      .then(() => {
        // ให้กระดิ่งแจ้งเตือน (Notifications) รีเฟรชทันที ไม่ต้องรอรอบถัดไป
        window.dispatchEvent(new Event("woms:chat-read"));
      })
      .catch(() => {
        lastReadSentRef.current = ""; // retry on next poll
      });
  }, [id]);

  const load = useCallback(async (withJob: boolean) => {
    try {
      const [chat, j] = await Promise.all([
        api.listChat(id),
        withJob ? api.getJob(id) : Promise.resolve(null),
      ]);
      setMessages(chat.messages);
      setSubmissions(chat.submissions);
      setTypingNames(chat.typing ?? []);
      setReads(chat.reads ?? []);
      if (j) setJob(j);
      setErr(null);

      // notify on new messages from others (skip initial load)
      const msgs = chat.messages;
      const last = msgs.length ? msgs[msgs.length - 1] : null;
      const prevTs = lastMsgTsRef.current;
      if (last) {
        if (prevTs && last.createdAt > prevTs) {
          const fresh = msgs.filter(
            (m) => m.createdAt > prevTs && !m.system && m.userId !== userIdRef.current
          );
          if (fresh.length > 0) {
            beep();
            if (document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
              const f = fresh[fresh.length - 1];
              try {
                new Notification(`💬 ${f.userName} — ${id}`, {
                  body: f.text.slice(0, 120),
                  tag: `woms-chat-${id}`,
                });
              } catch {
                /* ignore */
              }
            }
            if (document.hidden) document.title = `(${fresh.length}) ข้อความใหม่ — WOMS`;
          }
        }
        lastMsgTsRef.current = last.createdAt;
      }
      markRead();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "โหลดแชทไม่สำเร็จ");
    }
  }, [id, markRead]);

  // first load + poll
  useEffect(() => {
    load(true);
    const t = setInterval(() => load(false), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // reset title when the tab regains focus + ask notification permission once
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) {
        document.title = "WOMS — ระบบเปิด/ปิดงาน";
        markRead(); // กลับมาดูหน้านี้ = อ่านแล้ว
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markRead]);

  // typing heartbeat (throttled)
  const notifyTyping = () => {
    const now = Date.now();
    if (now - lastTypingSentRef.current > TYPING_THROTTLE_MS) {
      lastTypingSentRef.current = now;
      api.sendTyping(id).catch(() => {});
    }
  };

  // autoscroll when a new message arrives — เฉพาะเมื่อผู้ใช้อยู่ใกล้ท้ายห้อง
  // หรือข้อความใหม่ล่าสุดเป็นของเราเอง (กันเด้งลงล่างตอนกำลังไล่อ่านข้อความเก่า)
  useEffect(() => {
    if (messages.length !== countRef.current) {
      countRef.current = messages.length;
      const last = messages.length ? messages[messages.length - 1] : null;
      const lastMine = !!last && !last.system && last.userId === userIdRef.current;
      if (nearBottomRef.current || lastMine) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await api.sendChat(id, t);
      setText("");
      await load(true); // refresh job too — submission may change things
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  const fillTemplate = () => {
    setText(
      `📋 ส่งงาน ${id}\n` +
        `งาน: ${job?.jobName ?? ""}\n` +
        `ทีม: ${job?.technicianTeam ?? ""}\n` +
        `สิ่งที่ทำ: \n` +
        `ผลงาน: \n` +
        `ปัญหาที่พบ: -\n` +
        `#ส่งงาน`
    );
  };

  // เปิด/ปิดแผงตรวจงานใต้บับเบิล (แทน confirm()/prompt() เดิม)
  const toggleReview = (sub: Submission, action: "confirm" | "reject") => {
    if (reviewFor && reviewFor.subId === sub.subId && reviewFor.action === action) {
      setReviewFor(null);
    } else {
      setReviewFor({ subId: sub.subId, action });
    }
    setReviewNote("");
  };

  const doReview = async (sub: Submission) => {
    if (!reviewFor || reviewFor.subId !== sub.subId) return;
    const note = reviewNote.trim();
    setReviewing(sub.subId);
    try {
      if (reviewFor.action === "confirm") await api.confirmSubmission(sub.subId, note);
      else await api.rejectSubmission(sub.subId, note);
      setReviewFor(null);
      setReviewNote("");
      await load(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setReviewing(null);
    }
  };

  if (!job && !err) return <div className="state">กำลังโหลด…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
            💬 <span className="code" style={{ fontSize: 18 }}>{id}</span>
            {job ? <StatusBadge status={job.status} /> : null}
          </h1>
          {job ? <div className="sub">{job.jobName} · ทีม {job.technicianTeam || "—"}</div> : null}
        </div>
        <Link href={`/jobs/${id}`} className="btn">← กลับหน้างาน</Link>
      </div>

      {err ? <div className="alert alert-error">{err}</div> : null}

      <div className="card chat-card-wrap">
        <div
          className="chat-messages"
          ref={messagesRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
          }}
        >
          {messages.length === 0 ? (
            <div className="state">ยังไม่มีข้อความ — เริ่มคุยหรือกด &quot;แบบฟอร์มส่งงาน&quot; ได้เลย</div>
          ) : (
            messages.map((m) => {
              if (m.system) {
                return (
                  <div key={m.msgId} className="chat-system">
                    <span>{m.text}</span>
                    <span className="chat-system-time">{fmtTime(m.createdAt)}</span>
                  </div>
                );
              }
              const mine = user && m.userId === user.id;
              const sub = m.isSubmission ? subByMsg.get(m.msgId) : undefined;
              return (
                <div key={m.msgId} className={`chat-msg${mine ? " mine" : ""}`}>
                  <div className={`chat-bubble${m.isSubmission ? " submission" : ""}`}>
                    {!mine ? <div className="chat-name">{m.userName}</div> : null}
                    <div className="chat-text">{m.text}</div>
                    {sub ? (
                      <div className={`chat-substatus s-${sub.status.toLowerCase()}`}>
                        {sub.status === "PENDING" ? "⏳" : sub.status === "CONFIRMED" ? "✅" : "↩️"}{" "}
                        {SUB_LABEL[sub.status]}
                        {sub.reviewedBy ? ` โดย ${sub.reviewedBy}` : ""}
                        {sub.reviewNote ? ` — ${sub.reviewNote}` : ""}
                      </div>
                    ) : null}
                    {sub && sub.status === "PENDING" && canReview ? (
                      <>
                        <div className="chat-sub-actions">
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={reviewing === sub.subId}
                            onClick={() => toggleReview(sub, "confirm")}
                          >
                            ✓ ยืนยันปิดงาน
                          </button>
                          <button
                            className="btn btn-sm"
                            disabled={reviewing === sub.subId}
                            onClick={() => toggleReview(sub, "reject")}
                          >
                            ตีกลับ
                          </button>
                        </div>
                        {reviewFor && reviewFor.subId === sub.subId ? (
                          <div className="chat-review-panel">
                            <div className="chat-review-q">
                              {reviewFor.action === "confirm"
                                ? `ยืนยันส่งงานและปิดงาน ${id}?`
                                : `ตีกลับงานของ ${sub.submittedBy}?`}
                            </div>
                            <input
                              className="input"
                              placeholder={
                                reviewFor.action === "confirm"
                                  ? "หมายเหตุ (ไม่บังคับ)"
                                  : "เหตุผลที่ตีกลับ (ไม่บังคับ)"
                              }
                              value={reviewNote}
                              onChange={(e) => setReviewNote(e.target.value)}
                            />
                            <div className="chat-sub-actions">
                              <button
                                className="btn btn-primary btn-sm"
                                disabled={reviewing === sub.subId}
                                onClick={() => doReview(sub)}
                              >
                                {reviewing === sub.subId
                                  ? "กำลังบันทึก…"
                                  : reviewFor.action === "confirm"
                                  ? "✓ ยืนยัน"
                                  : "↩️ ตีกลับ"}
                              </button>
                              <button
                                className="btn btn-sm"
                                disabled={reviewing === sub.subId}
                                onClick={() => {
                                  setReviewFor(null);
                                  setReviewNote("");
                                }}
                              >
                                ยกเลิก
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    <div className="chat-time">{fmtTime(m.createdAt)}</div>
                  </div>
                  {mine
                    ? (() => {
                        const names = readersOf(m);
                        if (names.length === 0) return null;
                        const label =
                          m.msgId === lastMineMsgId
                            ? `อ่านแล้ว · ${
                                names.length <= 4
                                  ? names.join(", ")
                                  : `${names.slice(0, 4).join(", ")} +${names.length - 4}`
                              }`
                            : `อ่านแล้ว${names.length > 1 ? ` ${names.length}` : ""}`;
                        return <div className="chat-read">✓ {label}</div>;
                      })()
                    : null}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {typingNames.length > 0 ? (
          <div className="chat-typing">
            ✏️ {typingNames.join(", ")} กำลังพิมพ์
            <span className="chat-typing-dots"><i>.</i><i>.</i><i>.</i></span>
          </div>
        ) : null}

        <div className="chat-input-bar">
          <button className="btn btn-sm" type="button" onClick={fillTemplate} title="เติมแบบฟอร์มส่งงานพร้อม #ส่งงาน">
            📋 แบบฟอร์มส่งงาน
          </button>
          <textarea
            className="textarea chat-input"
            rows={text.includes("\n") ? 6 : 2}
            placeholder={'พิมพ์ข้อความ… (ใส่ #ส่งงาน หรือ #Compleate เพื่อส่งงานเข้าระบบ)'}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value.trim()) notifyTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !text.includes("\n")) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button className="btn btn-primary" disabled={sending || !text.trim()} onClick={send}>
            {sending ? "กำลังส่ง…" : "ส่ง"}
          </button>
        </div>
      </div>
    </>
  );
}
