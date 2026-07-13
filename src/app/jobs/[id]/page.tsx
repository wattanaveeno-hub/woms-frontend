"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Job, JobFormValues, Options } from "@/lib/types";
import JobForm from "@/components/JobForm";
import StatusBadge from "@/components/StatusBadge";
import JobCloseForm, { JobCloseValues } from "@/components/JobCloseForm";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [job, setJob] = useState<Job | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [j, o] = await Promise.all([api.getJob(id), api.getOptions()]);
      setJob(j);
      setOptions(o);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "โหลดงานไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (values: JobFormValues) => {
    if (!job) return;
    setBusy(true);
    setFieldError(null);
    setNotice(null);
    try {
      const updated = await api.patchJob(id, values, job.updatedAt);
      setJob(updated);
      setNotice({ kind: "ok", text: "บันทึกแล้ว" });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setNotice({ kind: "warn", text: e.message });
      } else if (e instanceof ApiError) {
        setFieldError({ field: e.field, message: e.message });
      } else {
        setFieldError({ message: "บันทึกไม่สำเร็จ" });
      }
    } finally {
      setBusy(false);
    }
  };

  const close = async (ev: JobCloseValues) => {
    if (!job) return;
    if (!confirm(`ยืนยันปิดงาน ${job.jobId}? (ลูกค้าเซ็นรับงานแล้ว)`)) return;
    setClosing(true);
    setNotice(null);
    try {
      const updated = await api.closeJob(id, job.updatedAt, ev);
      setJob(updated);
      setNotice({ kind: "ok", text: "ปิดงานและบันทึกหลักฐานแล้ว" });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setNotice({ kind: "warn", text: e.message });
        load();
      } else {
        setNotice({ kind: "warn", text: e instanceof ApiError ? e.message : "ปิดงานไม่สำเร็จ" });
      }
    } finally {
      setClosing(false);
    }
  };

  if (loadError) {
    return (
      <>
        <div className="page-head">
          <h1>ไม่พบงาน</h1>
        </div>
        <div className="alert alert-error">{loadError}</div>
        <Link href="/jobs" className="btn">
          ← กลับรายการงาน
        </Link>
      </>
    );
  }

  if (!job || !options) return <div className="state">กำลังโหลด…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="code" style={{ fontSize: 18 }}>{job.jobId}</span>
            <StatusBadge status={job.status} />
          </h1>
          <div className="detail-meta">
            <span>สร้าง: <span className="mono">{job.createdAt.slice(0, 16).replace("T", " ")}</span></span>
            <span>แก้ล่าสุด: <span className="mono">{job.updatedAt.slice(0, 16).replace("T", " ")}</span></span>
            {job.closedAt ? (
              <span>ปิดเมื่อ: <span className="mono">{job.closedAt.slice(0, 16).replace("T", " ")}</span></span>
            ) : null}
          </div>
        </div>
        <div className="head-actions">
          <Link href={`/jobs/${id}/chat`} className="btn btn-primary">
            💬 แชท / ส่งงาน
          </Link>
          <Link href="/jobs" className="btn">
            ← รายการงาน
          </Link>
        </div>
      </div>

      {notice ? (
        <div className={`alert ${notice.kind === "ok" ? "alert-ok" : "alert-warn"}`}>
          {notice.text}
          {notice.kind === "warn" ? (
            <>
              {" "}
              <button className="btn" style={{ marginLeft: 8, padding: "4px 10px" }} onClick={load}>
                รีเฟรช
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="card card-pad">
        <JobForm
          key={job.updatedAt}
          options={options}
          initial={job}
          submitLabel="บันทึกการแก้ไข"
          busy={busy}
          fieldError={fieldError}
          onSubmit={save}
        />
      </div>

      {job.status === "OPEN" ? (
        <div className="card card-pad" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>ปิดงาน + แนบหลักฐาน (ถ่ายรูป + ลูกค้าเซ็น)</h2>
          <JobCloseForm
            busy={closing}
            onSubmit={close}
            onError={(m) => setNotice({ kind: "warn", text: m })}
          />
        </div>
      ) : (
        <div className="card card-pad" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>หลักฐานการปิดงาน</h2>
          <div className="detail-meta">
            <span>ผู้เซ็นรับงาน: {job.signerName || "—"}</span>
            {job.closedAt ? <span>ปิดเมื่อ: <span className="mono">{job.closedAt.slice(0, 16).replace("T", " ")}</span></span> : null}
          </div>
          {job.closeNote ? <p style={{ marginBottom: 12 }}>หมายเหตุ: {job.closeNote}</p> : null}

          {job.signature ? (
            <div style={{ marginBottom: 12 }}>
              <div className="stat-label" style={{ marginBottom: 4 }}>ลายเซ็นลูกค้า</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={job.signature} alt="ลายเซ็น" style={{ maxWidth: 340, width: "100%", border: "1px solid var(--line)", borderRadius: 8, background: "#fff" }} />
            </div>
          ) : null}

          {job.photos && job.photos.length ? (
            <div>
              <div className="stat-label" style={{ marginBottom: 4 }}>รูปหน้างาน ({job.photos.length})</div>
              <div className="photo-grid">
                {job.photos.map((src, i) => (
                  <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="photo-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`รูป ${i + 1}`} />
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <div className="stat-label">— ไม่มีรูปแนบ —</div>
          )}
        </div>
      )}
    </>
  );
}
