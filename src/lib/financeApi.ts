// D-11 Financial Workflow v1.0 — เรียก /api/finance (สิทธิ์จริงตรวจที่ backend)
import { ApiError, getToken, request } from "./api";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
import type { Quotation } from "./types";
import type {
  AccDocType,
  DeliveryChannel,
  FinAggState,
  FinException,
  FinPaymentChannel,
  FinPaymentState,
} from "./financeRules";

export interface FinanceSummary {
  amountDue: number;
  verifiedTotal: number;
  pendingTotal: number;
  pendingCount: number;
  rejectedCount: number;
  voidedCount: number;
  outstanding: number;
  paymentStatus: FinAggState;
  paymentStatusLabel: string;
  displayLabel: string;
  exceptions: FinException[];
  verifiedWithoutDocCount: number;
  documentCount: number;
  deliveredDocumentCount: number;
}

export interface FinanceRow {
  id: string;
  quotationNo: string;
  revision: number;
  customerName: string;
  partnerId: string;
  status: Quotation["status"];
  statusLabel: string;
  jobId: string;
  issueDate: string;
  createdBy: string;
  summary: FinanceSummary;
}

export interface FinPaymentValues {
  amount: number;
  receivedDate: string;
  channel: FinPaymentChannel;
  referenceNo: string;
  note: string;
  evidenceFileIds: string[];
}

export interface FinHistoryEntry {
  at: string;
  action: "RECORD" | "VERIFY" | "REJECT" | "RESUBMIT" | "VOID";
  byId: string;
  byName: string;
  byRole: string;
  fromStatus: FinPaymentState | "";
  toStatus: FinPaymentState;
  reason: string;
  before?: FinPaymentValues;
  after?: FinPaymentValues;
}

export interface FinPayment extends FinPaymentValues {
  id: string;
  paymentNo: string;
  quotationId: string;
  quotationNo: string;
  revision: number;
  status: FinPaymentState;
  statusLabel: string;
  channelLabel: string;
  recordedBy: string;
  recordedAt: string;
  verifiedBy: string;
  verifiedAt: string;
  rejectReason: string;
  rejectedBy: string;
  rejectedAt: string;
  voidReason: string;
  voidedBy: string;
  voidedAt: string;
  version: number;
  history: FinHistoryEntry[];
  docStatus: "PENDING" | "RECORDED";
  docStatusLabel: string;
  documentIds: string[];
}

export interface AccDocument {
  id: string;
  quotationId: string;
  quotationNo: string;
  type: AccDocType;
  typeLabel: string;
  docNo: string;
  docDate: string;
  fileIds: string[];
  paymentIds: string[];
  paymentNos: string[];
  note: string;
  status: "PENDING" | "RECORDED";
  statusLabel: string;
  recordedBy: string;
  recordedAt: string;
  delivery: { sent: boolean; sentDate: string; channel: DeliveryChannel | ""; note: string; recordedBy: string; recordedAt: string };
}

export interface FinFileMeta {
  id: string;
  quotationId: string;
  kind: "APPROVAL_EVIDENCE" | "PAYMENT_EVIDENCE" | "ACCOUNTING_DOC";
  name: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface FinanceDetail {
  quotation: Quotation;
  summary: FinanceSummary;
  payments: FinPayment[];
  documents: AccDocument[];
  files: FinFileMeta[];
}

export interface FinAuditRow {
  id: string;
  at: string;
  actorName: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId: string;
  entityLabel: string;
  summary: string;
  changes: { field: string; before: string; after: string }[];
}

export interface UploadFile {
  name: string;
  dataUrl: string;
}

const enc = encodeURIComponent;
const qs = (o: Record<string, string | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const financeApi = {
  list: (f: { q?: string; status?: string; paymentStatus?: string; pending?: boolean; exceptions?: boolean } = {}) =>
    request<{ items: FinanceRow[]; count: number }>(
      `/api/finance/quotations${qs({ q: f.q, status: f.status, paymentStatus: f.paymentStatus, pending: f.pending ? "1" : undefined, exceptions: f.exceptions ? "1" : undefined })}`
    ),
  detail: (id: string) => request<FinanceDetail>(`/api/finance/quotations/${enc(id)}`),
  history: (id: string) => request<{ items: FinAuditRow[] }>(`/api/finance/quotations/${enc(id)}/history`),
  queue: () => request<{ items: { payment: FinPayment; quotation: FinanceRow | null }[]; files: FinFileMeta[] }>("/api/finance/queue"),
  audit: (q = "") => request<{ items: FinAuditRow[] }>(`/api/finance/audit${qs({ q })}`),
  jobSummary: (jobId: string) => request<{ items: FinanceRow[] }>(`/api/finance/jobs/${enc(jobId)}/summary`),
  recordPayment: (
    qid: string,
    body: { amount: number; receivedDate: string; channel: FinPaymentChannel; referenceNo: string; note: string; evidence: UploadFile[]; idempotencyKey: string }
  ) => request<{ payment: FinPayment; replay: boolean; warnings: string[]; summary: FinanceSummary }>(`/api/finance/quotations/${enc(qid)}/payments`, { method: "POST", body: JSON.stringify(body) }),
  act: (qid: string, pid: string, verb: "verify" | "reject" | "void", reason = "") =>
    request<{ payment: FinPayment; summary: FinanceSummary }>(`/api/finance/quotations/${enc(qid)}/payments/${enc(pid)}/${verb}`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  resubmit: (
    qid: string,
    pid: string,
    body: { amount: number; receivedDate: string; channel: FinPaymentChannel; referenceNo: string; note: string; evidence: UploadFile[]; keepEvidence: boolean; reason: string }
  ) => request<{ payment: FinPayment; summary: FinanceSummary }>(`/api/finance/quotations/${enc(qid)}/payments/${enc(pid)}/resubmit`, { method: "POST", body: JSON.stringify(body) }),
  recordDocument: (
    qid: string,
    body: { type: AccDocType; docNo: string; docDate: string; paymentIds: string[]; note: string; files: UploadFile[]; idempotencyKey: string }
  ) => request<{ document: AccDocument; replay: boolean }>(`/api/finance/quotations/${enc(qid)}/documents`, { method: "POST", body: JSON.stringify(body) }),
  recordDelivery: (qid: string, docId: string, body: { sentDate: string; channel: DeliveryChannel; note: string }) =>
    request<{ document: AccDocument }>(`/api/finance/quotations/${enc(qid)}/documents/${enc(docId)}/delivery`, { method: "POST", body: JSON.stringify(body) }),
  // ใบเสนอราคา (D-11 4.1 / Q-R3-11)
  setStatus: (id: string, body: { status: string; updatedAt: string; reason?: string; approvalDate?: string; evidence?: UploadFile[] }) =>
    request<Quotation>(`/api/quotations/${enc(id)}/status`, { method: "POST", body: JSON.stringify(body) }),
  revise: (id: string, updatedAt: string) => request<Quotation>(`/api/quotations/${enc(id)}/revise`, { method: "POST", body: JSON.stringify({ updatedAt }) }),
  unlinkJob: (id: string, body: { jobId: string; reason: string; updatedAt: string }) =>
    request<Quotation>(`/api/quotations/${enc(id)}/unlink-job`, { method: "POST", body: JSON.stringify(body) }),
};

/** ดึงไฟล์ (ต้องแนบ token) เป็น object URL สำหรับแสดงในหน้า */
export async function fetchFileObjectUrl(path: string): Promise<{ url: string; type: string }> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
  if (!res.ok) {
    let msg = `เปิดไฟล์ไม่สำเร็จ (HTTP ${res.status})`;
    try {
      msg = (await res.json())?.error?.message ?? msg;
    } catch {
      /* ไม่ใช่ JSON */
    }
    throw new ApiError(res.status, "FILE", msg);
  }
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type };
}

export const finFilePath = (qid: string, fileId: string, kind: FinFileMeta["kind"]) =>
  kind === "APPROVAL_EVIDENCE" ? `/api/quotations/${enc(qid)}/files/${enc(fileId)}?inline=1` : `/api/finance/quotations/${enc(qid)}/files/${enc(fileId)}?inline=1`;
