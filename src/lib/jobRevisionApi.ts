// ---------------------------------------------------------------------------
// Q-R3-13 แก้ไขหลังปิดงาน · Q-R3-12 รายการติดตาม — เรียก API
// ---------------------------------------------------------------------------
import { request } from "@/lib/api";
import type { RevisionSignatureStatus, RevisionStatus, SignerType } from "@/lib/jobRevisionRules";

export interface RevisionDiff {
  field: string;
  before: string;
  after: string;
}
export interface RevisionResign {
  signerType: SignerType;
  signerTypeLabel: string;
  signerName: string;
  capturedById: string;
  capturedBy: string;
  capturedByRole: string;
  /** ADV4-05: อุปกรณ์ที่ใช้บันทึก (ไม่มี = รายการก่อน R4) */
  captureDevice?: { userAgent: string; ip: string; source: string };
  at: string;
  coverageHash: string;
  signoffId: string;
  /** P-08: ASSIGNED ช่างในใบงาน · COLLECTOR ช่างเก็บลายเซ็นที่ Manager มอบหมาย · CLOSER ผู้ปิดงาน */
  capturedVia?: "ASSIGNED" | "COLLECTOR" | "CLOSER";
}
/** P-08 ช่างเก็บลายเซ็น */
export interface SignatureCollector {
  technicianId: string;
  technicianName: string;
  reason: string;
  designatedById: string;
  designatedBy: string;
  designatedAt: string;
  activeAssignedTechnicianIds: string[];
  replacedAt?: string;
  replacedById?: string;
}
/** P-07 ผลการแก้อะไหล่ที่ใช้จริง (unitCost = null สำหรับผู้ไม่มี parts:cost_view) */
export interface PartsEffect {
  lineId: string;
  serial: string;
  op: "ADD" | "UPDATE" | "REMOVE";
  before: { partCode: string; partName: string; qty: number; unit: string; unitCost: number | null; note: string } | null;
  after: { partCode: string; partName: string; qty: number; unit: string; unitCost: number | null; note: string } | null;
}
export interface JobRevision {
  revisionId: string;
  jobId: string;
  revisionNo: number | null;
  requestNo: number;
  status: RevisionStatus;
  statusLabel: string;
  reason: string;
  diff: RevisionDiff[];
  changedFields: string[];
  baseRevisionNo: number;
  requestedById: string;
  requestedBy: string;
  requestedByRole: string;
  requestedAt: string;
  decidedById: string;
  decidedBy: string;
  decidedAt: string;
  decisionNote: string;
  /** ADV11B-02: null สำหรับผู้ไม่มี parts:cost_view (hash ของสำเนาที่มีต้นทุนจริง ใช้เดาต้นทุนได้) */
  snapshotHash: string | null;
  signedChanged: boolean;
  signatureStatus: RevisionSignatureStatus;
  signatureStatusLabel: string;
  requiredSigners: SignerType[];
  supersededSignatures: Array<{ signerType: SignerType; source: string; ref: string; fromRevisionNo: number }>;
  resigns: RevisionResign[];
  pmFollowUpId: string;
  installDateChanges: Array<{ lineId: string; serial: string; before: string; after: string }>;
  partsEffects?: PartsEffect[];
  signatureCollector?: SignatureCollector | null;
  signatureCollectorHistory?: SignatureCollector[];
}
export interface JobRevisionList {
  jobId: string;
  status: string;
  currentRevisionNo: number;
  revisionSignatureStatus: string;
  pending: JobRevision | null;
  items: JobRevision[];
  count: number;
}

export interface FollowUp {
  followUpId: string;
  type: string;
  typeLabel: string;
  status: "OPEN" | "RESOLVED";
  statusLabel: string;
  title: string;
  detail: string;
  jobId: string;
  contractNo: string;
  contractStatus: string;
  serial: string;
  equipmentStatus: string;
  salesPerson: string;
  salesUnresolved: boolean;
  createdAt: string;
  createdBy: string;
  resolvedAt: string;
  resolvedBy: string;
  resolutionNote: string;
}

const base = (jobId: string) => `/api/jobs/${encodeURIComponent(jobId)}/revisions`;

export const jobRevisionApi = {
  list: (jobId: string) => request<JobRevisionList>(base(jobId)),
  request: (jobId: string, reason: string, changes: Record<string, unknown>) =>
    request<JobRevision>(base(jobId), { method: "POST", body: JSON.stringify({ reason, changes }) }),
  decide: (jobId: string, revisionId: string, decision: "APPROVE" | "REJECT", note: string) =>
    request<JobRevision>(`${base(jobId)}/${encodeURIComponent(revisionId)}/decide`, { method: "POST", body: JSON.stringify({ decision, note }) }),
  withdraw: (jobId: string, revisionId: string) =>
    request<JobRevision>(`${base(jobId)}/${encodeURIComponent(revisionId)}/withdraw`, { method: "POST" }),
  resign: (jobId: string, revisionId: string, body: { signerType: SignerType; signerName?: string; signature: string }) =>
    request<{ revision: JobRevision; completed: boolean }>(`${base(jobId)}/${encodeURIComponent(revisionId)}/resign`, { method: "POST", body: JSON.stringify(body) }),
  /** P-08 Manager มอบหมายช่างเก็บลายเซ็น */
  designateCollector: (jobId: string, revisionId: string, technicianId: string, reason: string) =>
    request<{ revision: JobRevision; collector: SignatureCollector; previous: SignatureCollector | null }>(
      `${base(jobId)}/${encodeURIComponent(revisionId)}/signature-collector`,
      { method: "POST", body: JSON.stringify({ technicianId, reason }) }
    ),
  followUps: (status?: "OPEN" | "RESOLVED") => request<{ items: FollowUp[]; count: number; open: number }>(`/api/follow-ups${status ? `?status=${status}` : ""}`),
  resolveFollowUp: (id: string, note: string) =>
    request<FollowUp>(`/api/follow-ups/${encodeURIComponent(id)}/resolve`, { method: "POST", body: JSON.stringify({ note }) }),
};
