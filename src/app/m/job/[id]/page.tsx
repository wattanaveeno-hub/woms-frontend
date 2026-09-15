"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Job, JobEquipmentLine } from "@/lib/types";
import { jobTypeLabel } from "@/lib/options";
import JobCloseForm, { JobCloseValues } from "@/components/JobCloseForm";
import { useToast } from "@/components/Toast";

// ปิดงานจากมือถือ พร้อมลายเซ็นลูกค้าและรูปหน้างาน
export default function MobileJobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [job, setJob] = useState<Job | null>(null);
  // เครื่องในใบงาน — อ่านจาก API เสมอ ไม่เดาจากข้อความ filterUnit
  const [equipment, setEquipment] = useState<JobEquipmentLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [j, eq] = await Promise.all([
        api.getJob(id),
        api.jobEquipment(id).catch(() => ({ items: [] as JobEquipmentLine[], count: 0 })),
      ]);
      setJob(j);
      setEquipment(eq.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const close = async (v: JobCloseValues) => {
    if (!job) return;
    setBusy(true);
    try {
      await api.closeJob(job.jobId, job.updatedAt, v);
      toast.success(`ปิดงาน ${job.jobId} แล้ว`);
      router.push("/m");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ปิดงานไม่สำเร็จ");
      load();
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!job) return <div className="state">กำลังโหลด…</div>;

  return (
    <div className="m-wrap">
      <div className="m-head">
        <div>
          <div className="code">{job.jobId}</div>
          <div className="m-title">{job.jobName}</div>
          <div className="m-sub">
            {jobTypeLabel[job.jobType]} · {job.jobDate} {job.jobTime}
          </div>
        </div>
        <Link href="/m" className="btn">
          ← กลับ
        </Link>
      </div>

      <div className="m-card">
        <div className="m-kv">
          <div className="k">ทีมช่าง</div>
          <div>{job.technicianTeam}</div>
          <div className="k">ผู้ติดต่อ</div>
          <div>{job.contactName || "—"}</div>
          <div className="k">โทร</div>
          <div>{job.phone ? <a href={`tel:${job.phone}`}>{job.phone}</a> : "—"}</div>
          <div className="k">เครื่อง{equipment.length > 1 ? ` (${equipment.length})` : ""}</div>
          <div>
            {equipment.length > 0 ? (
              equipment.map((e) => (
                <div key={e.id} style={{ marginBottom: 4 }}>
                  <span className="code">{e.serial || "—"}</span>
                  {!e.hasRealSerial ? <span className="badge badge-wexp" style={{ marginLeft: 6 }}>ยังไม่มี SN</span> : null}
                  {e.model ? <span className="m-sub"> · {e.model}</span> : null}
                  {e.note ? <div className="m-sub">{e.note}</div> : null}
                </div>
              ))
            ) : job.filterUnit ? (
              <>
                <span className="code">{job.filterUnit}</span>
                <div className="m-sub">ข้อมูลเดิม ยังไม่ผูกกับคลัง</div>
              </>
            ) : (
              "—"
            )}
          </div>
          <div className="k">สถานะ</div>
          <div>{job.status === "OPEN" ? "เปิดงาน" : "ปิดงานแล้ว"}</div>
          {job.note ? (
            <>
              <div className="k">หมายเหตุ</div>
              <div>{job.note}</div>
            </>
          ) : null}
        </div>
        {job.mapLink ? (
          <div className="m-actions">
            <a className="btn" href={job.mapLink} target="_blank" rel="noopener noreferrer">
              นำทาง
            </a>
          </div>
        ) : null}
      </div>

      {job.status === "OPEN" ? (
        <div className="m-card">
          <strong>ปิดงาน</strong>
          <JobCloseForm busy={busy} onSubmit={close} onError={(m) => toast.error(m)} />
        </div>
      ) : (
        <div className="alert alert-ok">งานนี้ปิดแล้วเมื่อ {job.closedAt.slice(0, 16).replace("T", " ")}</div>
      )}
    </div>
  );
}
