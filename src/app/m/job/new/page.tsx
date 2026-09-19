"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { JobFormValues, JobType, Options } from "@/lib/types";
import { jobTypeLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";
import { bangkokToday } from "@/lib/date";

const TYPES: JobType[] = ["INSTALL", "PM", "CM", "PM_CM", "REMOVE"];

// เปิดงานจากหน้างานด้วยมือถือ — ฟอร์มสั้น กรอกเท่าที่จำเป็น
export default function MobileNewJobPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [options, setOptions] = useState<Options | null>(null);
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState<JobFormValues>({
    jobType: "CM",
    jobSubType: "",
    jobName: "",
    technicianTeam: "",
    salesPerson: "",
    model: "",
    filterUnit: "",
    contactName: "",
    phone: "",
    jobDate: bangkokToday(), // วันนัดเริ่มต้น = วันทำงานไทย
    jobTime: new Date().toTimeString().slice(0, 5), // เวลาของเครื่องช่างที่หน้างาน
    mapLink: "",
    note: "",
  });

  useEffect(() => {
    api
      .getOptions()
      .then((o) => {
        setOptions(o);
        setV((prev) => ({
          ...prev,
          technicianTeam: prev.technicianTeam || user?.team || o.teams[0] || "",
        }));
      })
      .catch(() => setOptions(null));
  }, [user?.team]);

  const set = <K extends keyof JobFormValues>(k: K, val: JobFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("อุปกรณ์นี้ไม่รองรับ GPS");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        set("mapLink", `https://maps.google.com/?q=${p.coords.latitude.toFixed(6)},${p.coords.longitude.toFixed(6)}`);
        toast.success("แนบพิกัดหน้างานแล้ว");
      },
      () => toast.error("อ่านตำแหน่งไม่ได้")
    );
  };

  const submit = async () => {
    if (!v.jobName.trim()) return toast.error("ต้องระบุชื่องาน");
    if (!v.technicianTeam.trim()) return toast.error("ต้องระบุทีมช่าง");
    if (v.jobType === "REMOVE" && !v.jobSubType) return toast.error("งานซ่อมถอนต้องเลือกประเภทย่อย");
    setBusy(true);
    try {
      const job = await api.createJob(v);
      toast.success(`เปิดงาน ${job.jobId} แล้ว`);
      router.push(`/m/job/${encodeURIComponent(job.jobId)}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "เปิดงานไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="m-wrap">
      <div className="m-head">
        <div className="m-title">เปิดงานใหม่</div>
        <Link href="/m" className="btn">
          ← กลับ
        </Link>
      </div>

      <div className="m-card">
        <div className="field">
          <label>ประเภทงาน</label>
          <select className="select" value={v.jobType} onChange={(e) => set("jobType", e.target.value as JobType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {jobTypeLabel[t]}
              </option>
            ))}
          </select>
        </div>

        {v.jobType === "REMOVE" ? (
          <div className="field">
            <label>ประเภทย่อย</label>
            <select className="select" value={v.jobSubType} onChange={(e) => set("jobSubType", e.target.value as JobFormValues["jobSubType"])}>
              <option value="">— เลือก —</option>
              <option value="PICKUP_REPAIR">ยกเครื่องซ่อม</option>
              <option value="RETURN">ยกเครื่องคืน</option>
            </select>
          </div>
        ) : null}

        <div className="field">
          <label>ชื่องาน</label>
          <input className="input" value={v.jobName} onChange={(e) => set("jobName", e.target.value)} placeholder="เช่น ซ่อมเครื่องกรองน้ำ ลูกค้า A" />
        </div>

        <div className="field">
          <label>ทีมช่าง</label>
          <input className="input" list="m-team-options" value={v.technicianTeam} onChange={(e) => set("technicianTeam", e.target.value)} />
          <datalist id="m-team-options">
            {(options?.teams ?? []).map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>

        <div className="field">
          <label>Serial / เครื่อง</label>
          <input className="input" value={v.filterUnit} onChange={(e) => set("filterUnit", e.target.value)} />
          <span className="sub">
            พิมพ์เป็นข้อความได้ตามเดิม — ถ้าต้องผูกกับเครื่องในคลังหรือใส่หลายเครื่อง ทำที่หน้าใบงานบนเดสก์ท็อป
          </span>
        </div>

        <div className="field">
          <label>ผู้ติดต่อ</label>
          <input className="input" value={v.contactName} onChange={(e) => set("contactName", e.target.value)} />
        </div>

        <div className="field">
          <label>เบอร์โทร</label>
          <input className="input" inputMode="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>

        <div className="field">
          <label>วันที่ / เวลา</label>
          <div className="toolbar" style={{ marginTop: 0 }}>
            <input className="input" type="date" value={v.jobDate} onChange={(e) => set("jobDate", e.target.value)} />
            <input className="input" type="time" value={v.jobTime} onChange={(e) => set("jobTime", e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>พิกัดหน้างาน</label>
          <div className="toolbar" style={{ marginTop: 0 }}>
            <input className="input" value={v.mapLink} onChange={(e) => set("mapLink", e.target.value)} placeholder="ลิงก์แผนที่" />
            <button className="btn" type="button" onClick={useMyLocation}>
              ตำแหน่งฉัน
            </button>
          </div>
        </div>

        <div className="field">
          <label>หมายเหตุ</label>
          <textarea className="textarea" value={v.note} onChange={(e) => set("note", e.target.value)} />
        </div>

        <div className="m-actions">
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "กำลังเปิดงาน…" : "เปิดงาน"}
          </button>
        </div>
      </div>
    </div>
  );
}
