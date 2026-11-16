"use client";

// คิวของฉัน (มือถือช่าง) — ตามดีไซน์ ENTECH Redesign "มือถือช่าง: คิวของฉัน"
// แบ่งตามสิ่งที่ช่างต้องทำ: ต้องตอบ / รอคนอื่น / เปิดงานแล้ว · ปุ่มอยู่ในการ์ด ไม่ต้องเปิดตาราง
// เป็นการแสดงผลเท่านั้น: การเสนอวัน/แจ้งไม่สะดวกทำในหน้ารายละเอียดคิวเหมือนเดิม และสิทธิ์ตรวจที่ backend
import { useMemo, useState } from "react";
import Link from "next/link";
import type { ServiceQueue } from "@/lib/serviceQueueApi";
import type { SqStatus } from "@/lib/serviceQueueRules";
import { queueNoLabel, TIME_PERIOD_LABEL, type TimePeriod } from "@/lib/serviceQueueRules";
import { typeLabel } from "@/components/serviceQueue/QueueBits";
import { thaiDayLabel } from "@/lib/date";

type Group = "answer" | "waiting" | "released";

const GROUP_OF: Partial<Record<SqStatus, Group>> = {
  WAIT_TECH: "answer",
  WAIT_ASSIGN: "waiting",
  TECH_REPLIED: "waiting",
  WAIT_CUSTOMER: "waiting",
  READY_TO_OPEN: "waiting",
  RELEASED: "released",
};

const WAIT_CHIP: Partial<Record<SqStatus, { label: string; cls: string }>> = {
  WAIT_ASSIGN: { label: "รอจัดช่าง", cls: "c-open" },
  TECH_REPLIED: { label: "รอแอดมินรับคิว", cls: "c-info" },
  WAIT_CUSTOMER: { label: "รอลูกค้ายืนยัน", cls: "c-open" },
  READY_TO_OPEN: { label: "รอแอดมินเปิดงาน", cls: "c-info" },
  RELEASED: { label: "เป็นใบงานแล้ว", cls: "c-done" },
};

function when(date: string, time: string, period: string): string {
  if (!date) return "";
  const p = TIME_PERIOD_LABEL[period as TimePeriod];
  return `${thaiDayLabel(date)}${time ? ` ${time}` : ""}${p && period !== "UNDEFINED" ? ` · ${p}` : ""}`;
}

function place(r: ServiceQueue): string {
  return [r.jobName, r.siteSubdistrict].filter(Boolean).join(" · ");
}

export default function TechQueueList({ rows }: { rows: ServiceQueue[] }) {
  const [view, setView] = useState<"all" | Group>("all");
  const groups = useMemo(() => {
    const g: Record<Group, ServiceQueue[]> = { answer: [], waiting: [], released: [] };
    for (const r of rows) {
      const k = GROUP_OF[r.status];
      if (k) g[k].push(r);
    }
    return g;
  }, [rows]);
  const total = groups.answer.length + groups.waiting.length + groups.released.length;
  const show = (k: Group) => view === "all" || view === k;

  const pills: { key: "all" | Group; label: string; n: number }[] = [
    { key: "all", label: "ทั้งหมด", n: total },
    { key: "answer", label: "ต้องตอบ", n: groups.answer.length },
    { key: "waiting", label: "รอคนอื่น", n: groups.waiting.length },
    { key: "released", label: "เปิดงานแล้ว", n: groups.released.length },
  ];

  return (
    <div className="tq">
      <div className="tq-views" role="tablist" aria-label="สถานะคิว">
        {pills.map((p) => (
          <button key={p.key} type="button" role="tab" aria-selected={view === p.key} className={`tq-view${view === p.key ? " on" : ""}`} onClick={() => setView(p.key)}>
            {p.label} {p.n}
          </button>
        ))}
      </div>

      {total === 0 ? <div className="tq-empty">ยังไม่มีคิวที่ส่งถึงคุณ</div> : null}

      {show("answer") && groups.answer.length ? (
        <>
          <h2 className="tq-h2">ต้องตอบ <span className="tq-chip c-red">{groups.answer.length}</span></h2>
          {groups.answer.map((r) => {
            const pref = when(r.preferredDate, r.preferredTime, "");
            const cur = when(r.current?.date ?? "", r.current?.time ?? "", r.current?.period ?? "");
            const slot = cur || pref;
            return (
              <section key={r.id} className="tq-card sel" aria-label={`คิว ${queueNoLabel(r)}`}>
                <div className="tq-head">
                  <span className="tq-code">{queueNoLabel(r)}</span>
                  <span className={`tq-chip ${slot ? "c-info" : "c-open"}`}>{slot ? "รอคุณตอบ" : "ยังไม่มีวันนัด"}</span>
                </div>
                <Link href={`/service-queue/${r.id}`} style={{ color: "inherit", textDecoration: "none", display: "block" }}>
                  <b className="tq-title">{typeLabel(r.jobType)}</b>
                  <div className="tq-sub">{place(r)}{r.ownerSaleName ? ` · เซลล์ ${r.ownerSaleName}` : ""}</div>
                </Link>
                {/* UAT 2026-11-16: วันที่ลูกค้าสะดวก (จากหน้าเปิดคิว) แสดงให้ช่างเห็นเสมอ */}
                {pref ? (
                  <div className="tq-box" data-testid="tq-preferred">
                    <span className="tq-lab">ลูกค้าสะดวก</span>
                    <div style={{ fontWeight: 700 }}>{pref}</div>
                  </div>
                ) : null}
                {cur ? (
                  <div className="tq-box">
                    <span className="tq-lab">วันที่เสนอไว้</span>
                    <div style={{ fontWeight: 700 }}>{cur}</div>
                  </div>
                ) : null}
                {!slot ? <div className="tq-note">แอดมินขอให้คุณเสนอวันที่สะดวก</div> : null}
                <div className="tq-acts">
                  <Link className="tq-btn" href={`/service-queue/${r.id}`}>แจ้งไม่สะดวก</Link>
                  <Link className="tq-btn pri" href={`/service-queue/${r.id}`}>{slot ? "รับคิว / เสนอวัน" : "เสนอวัน"}</Link>
                </div>
              </section>
            );
          })}
        </>
      ) : null}

      {(["waiting", "released"] as const).map((k) =>
        show(k) && groups[k].length ? (
          <div key={k} className="tq-group">
            <h2 className="tq-h2">{k === "waiting" ? "รอคนอื่น" : "เปิดงานแล้ว"}</h2>
            {groups[k].map((r) => {
              const chip = WAIT_CHIP[r.status];
              const slot = when(r.current?.date ?? "", r.current?.time ?? "", r.current?.period ?? "");
              const href = r.status === "RELEASED" && r.jobId ? `/jobs/${encodeURIComponent(r.jobId)}` : `/service-queue/${r.id}`;
              return (
                <Link key={r.id} className="tq-row" href={href}>
                  <span className="tq-main">
                    <span className="tq-code">{queueNoLabel(r)}{r.jobId ? ` · ${r.jobId}` : ""}</span>
                    <b>{typeLabel(r.jobType)}</b>
                    <span className="tq-sub">{place(r)}</span>
                    <span className="tq-sub small">{slot || "ยังไม่มีวันนัด"}</span>
                  </span>
                  {chip ? <span className={`tq-chip ${chip.cls}`}>{chip.label}</span> : null}
                </Link>
              );
            })}
          </div>
        ) : null
      )}

    </div>
  );
}
