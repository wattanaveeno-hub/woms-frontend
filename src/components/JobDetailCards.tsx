"use client";

// ---------------------------------------------------------------------------
// JOB-02 หน้าใบงาน — "แสดงการ์ดรายละเอียดงาน ลูกค้า และเครื่องตามฟอร์มเปิดงาน"
// ---------------------------------------------------------------------------
// การ์ดเป็นมุมมองอ่านอย่างเดียว แยกจากฟอร์ม (ฟอร์มใช้ตอนเปิดงานและหน้าแก้ไข /jobs/[id]/edit)
// หัวข้อและลำดับฟิลด์ตามการ์ดของ JOB-01 ใน Developer Handoff:
//   รายละเอียดงาน  : ประเภทงาน ประเภทลูกค้า เซลล์ผู้รับผิดชอบ ทีมช่าง วันที่ เวลา หมายเหตุ
//   รายละเอียดลูกค้า: รหัสลูกค้า ชื่อบริษัท รหัสสาขา ชื่อร้าน/สาขา ที่อยู่ ผู้ติดต่อ เบอร์ Map ละติจูด ลองจิจูด
//   เครื่องในงาน   : JobEquipmentSection (SN ประเภท รุ่น เครื่องกรอง PM ประกัน)
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { CustomerSite, Job, Partner } from "@/lib/types";
import { jobTypeLabel, subTypeLabel } from "@/lib/options";
import { customerCardFields } from "@/lib/jobView";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { WomsFormSection, WomsKeyValue } from "@/components/woms";

const dash = (v?: string | null) => (v && String(v).trim() ? v : "—");
const CUSTOMER_TYPE_LABEL: Record<string, string> = { IN: "ลูกค้าใน", OUT: "ลูกค้านอก" };

export function JobInfoCard({ job, technicianNames }: { job: Job; technicianNames: string[] }) {
  const sub = job.jobSubType ? subTypeLabel[job.jobSubType as keyof typeof subTypeLabel] : "";
  return (
    <WomsFormSection title="รายละเอียดงาน">
      <WomsKeyValue
        items={[
          ["เลขใบงาน", <span key="id" className="code">{job.jobId}</span>],
          ["ประเภทงาน", `${jobTypeLabel[job.jobType] ?? job.jobType}${sub ? ` · ${sub}` : ""}`],
          ["ประเภทลูกค้า", dash(CUSTOMER_TYPE_LABEL[job.customerType ?? ""])],
          ["เซลล์ผู้รับผิดชอบ", dash(job.salesPerson)],
          ["ทีมช่าง", dash(job.technicianTeam)],
          ["ช่างผู้รับผิดชอบ", technicianNames.length ? technicianNames.join(", ") : "—"],
          ["วันที่นัด", <span key="d" className="mono">{dash(job.jobDate)}</span>],
          ["เวลา", <span key="t" className="mono">{dash(job.jobTime)}</span>],
          ["ชื่องาน", dash(job.jobName)],
          ["หมายเหตุ", <span key="n" style={{ whiteSpace: "pre-wrap" }}>{dash(job.note)}</span>],
          job.status === "HOLD" && job.holdReason ? ["เหตุผลพักงาน", job.holdReason] : null,
          job.status === "CANCELLED" && job.cancelReason ? ["เหตุผลยกเลิก", job.cancelReason] : null,
        ]}
      />
    </WomsFormSection>
  );
}

export function CustomerInfoCard({ job }: { job: Job }) {
  const { has } = useAuth();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [site, setSite] = useState<CustomerSite | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  // D-03: ช่าง (ไม่มี partners:view) อ่านจาก snapshot ในใบงานเท่านั้น — ไม่ยิงคำขอที่รู้อยู่แล้วว่าได้ 403
  const canReadMaster = has("partners:view");

  useEffect(() => {
    let alive = true;
    setPartner(null);
    setSite(null);
    setLoadError(null);
    if (!job.customerId || !canReadMaster) return;
    // D-17: โหลดไม่สำเร็จต้องบอกผู้ใช้ (เดิม catch เงียบ → เห็น "—" โดยไม่รู้สาเหตุ)
    const fail = (e: unknown) => {
      if (!alive) return;
      if (e instanceof ApiError && e.status === 403) return; // ไม่มีสิทธิ์ = ใช้ snapshot ในใบงาน
      setLoadError(e instanceof ApiError ? e.message : "โหลดข้อมูลลูกค้าไม่สำเร็จ");
    };
    api.getPartner(job.customerId).then((p) => alive && setPartner(p)).catch(fail);
    if (job.siteId) {
      api
        .listCustomerSites(job.customerId)
        .then((r) => alive && setSite(r.items.find((s) => s.id === job.siteId) ?? null))
        .catch(fail);
    }
    return () => {
      alive = false;
    };
  }, [job.customerId, job.siteId, canReadMaster, retry]);

  // snapshot ในใบงานมาก่อน (ชื่อ ณ วันที่เปิดงาน) · ค่าสดเป็น fallback ของใบงานเก่า
  const f = customerCardFields(job, partner, site);
  const lat = f.lat;
  const lng = f.lng;
  return (
    <WomsFormSection title="รายละเอียดลูกค้า">
      {loadError ? (
        <Alert
          severity="warning"
          sx={{ mb: 1.5 }}
          action={
            <Button color="inherit" size="small" onClick={() => setRetry((n) => n + 1)}>
              ลองใหม่
            </Button>
          }
        >
          โหลดข้อมูลลูกค้าไม่สำเร็จ — แสดงเฉพาะข้อมูลที่บันทึกในใบงาน ({loadError})
        </Alert>
      ) : null}
      <WomsKeyValue
        items={[
          [
            "รหัสลูกค้า",
            partner && canReadMaster ? (
              <Link key="c" href={`/partners/${partner.id}`} className="code">
                {dash(f.customerCode)}
              </Link>
            ) : (
              <span key="c" className="code">{dash(f.customerCode)}</span>
            ),
          ],
          ["ชื่อบริษัท", dash(f.customerName)],
          ["รหัสสาขา", <span key="b" className="code">{dash(f.branchNo)}</span>],
          ["ชื่อร้าน/สาขา", dash(f.storeName)],
          ["ที่อยู่ติดตั้ง", dash(f.address)],
          ["ผู้ติดต่อ", dash(job.contactName)],
          ["เบอร์โทร", job.phone ? <a key="p" href={`tel:${job.phone}`}>{job.phone}</a> : "—"],
          [
            "Map",
            job.mapLink ? (
              <a key="m" href={job.mapLink} target="_blank" rel="noopener noreferrer">
                เปิดแผนที่
              </a>
            ) : (
              "—"
            ),
          ],
          ["ละติจูด / ลองจิจูด", lat || lng ? <span key="ll" className="mono">{`${lat}, ${lng}`}</span> : "—"],
        ]}
      />
      {!job.customerId ? (
        <Typography variant="body2" sx={{ mt: 1 }}>
          ใบงานนี้ยังไม่ผูกกับฐานข้อมูลลูกค้า — แสดงเฉพาะข้อมูลที่บันทึกในใบงาน
        </Typography>
      ) : null}
    </WomsFormSection>
  );
}
