import type {
  JobDraft,
  CustomerImportResult,
  PmStatus,
  JobEquipmentLine,
  JobEquipmentLineFields,
  PmItemRow,
  JobEquipmentInput,
  TimelineItem,
  TimelineTab,
  EquipmentJobRow,
  Job,
  JobListItem,
  Options,
  JobFormValues,
  JobStatus,
  JobDateScope,
  CalendarResponse,
  MasterItem,
  MasterKind,
  Equipment,
  EquipmentStatus,
  EquipmentFormValues,
  EquipmentEvent,
  MoveEquipmentValues,
  WarrantyPreset,
  WarrantyPresetFormValues,
  EquipmentSummary,
  EquipmentDashboard,
  JobDashboard,
  WarrantyStatus,
  Contract,
  ContractType,
  ContractStatus,
  ContractFormValues,
  Partner,
  PartnerType,
  PartnerFormValues,
  Quotation,
  QuotationStatus,
  QuotationFormValues,
  InventoryRow,
  AuthUser,
  Role,
  ChatMessage,
  Submission,
  SubmissionStatus,
  ChatRead,
  UnreadChat,
  ChatRoomSummary,
  SalesDocument,
  DocumentType,
  DocumentStatus,
  DocumentFormValues,
  IssueReceiptValues,
  Slot,
  SlotStatus,
  SuggestedSlot,
  Booking,
  BookingType,
  BookingStatus,
  BookingFormValues,
  TechnicianPosition,
  BookingEta,
  GeofenceResult,
  CustomerSite,
  CustomerSiteFormValues,
  CustomerSearchResult,
  CustomerSummaryResponse,
  HoldingPeriod,
  AuditLog,
  AuditAction,
  AuditEntity,
  CompanyProfile,
  ImportReport,
  JobStage,
  RescheduleReason,
  RescheduleRequest,
  PmPlan,
  PmCandidate,
  PmPlanStatus,
  AppNotification,
  NotificationKind,
  Part,
  StockLocation,
  StockMove,
  StockTransaction,
  StockBalancesResponse,
  ValuationMethod,
  TechBill,
  BillStatus,
  BillableJob,
  BillSummaryRow,
  BillDayItem,
  BillExpenseItem,
  BillJobItem,
  EquipmentFinance,
  DashboardSummary,
  ChangeRequest,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

const TOKEN_KEY = "woms_token";
export function getToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
}
export function setToken(t: string): void {
  if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken(): void {
  if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  code: string;
  field?: string;
  status: number;
  /** เนื้อหาคำตอบทั้งก้อน — บาง endpoint ส่งรายละเอียดเพิ่ม เช่น รายงานข้อผิดพลาดรายแถวของการนำเข้า */
  body?: unknown;
  constructor(status: number, code: string, message: string, field?: string, body?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
    this.body = body;
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK", "เชื่อมต่อ backend ไม่ได้ — ตรวจว่า API รันอยู่ที่ " + BASE);
  }
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    if (body === null) {
      throw new ApiError(res.status, "ERROR", `เซิร์ฟเวอร์ตอบผิดปกติ (HTTP ${res.status})`);
    }
    const err = (body as { error?: { code?: string; message?: string; field?: string } })?.error ?? {};
    throw new ApiError(res.status, err.code ?? "ERROR", err.message ?? "เกิดข้อผิดพลาด", err.field, body);
  }
  // VFB แถว 21 — Admin แก้/ลบข้อมูลเดิม: เซิร์ฟเวอร์บันทึกเป็นคำขอรออนุมัติ (HTTP 202) ข้อมูลยังไม่เปลี่ยน
  // โยนเป็น ApprovalPendingError เพื่อให้หน้าฟอร์มทุกหน้า "ไม่" ทำเหมือนบันทึกสำเร็จ (ไม่ปิดฟอร์ม/ไม่ย้ายหน้า)
  // และ Toast แสดงข้อความนี้เป็นการแจ้งข้อมูล (สีฟ้า) แทน error
  if (res.status === 202 && body && (body as any).approvalRequired) {
    const msg = String((body as any).message ?? "ส่งคำขอให้ผู้อนุมัติแล้ว — ข้อมูลยังไม่เปลี่ยนจนกว่าจะได้รับอนุมัติ");
    APPROVAL_PENDING_MESSAGES.add(msg);
    throw new ApprovalPendingError(msg, (body as any).changeRequest);
  }
  return body as T;
}

/** ข้อความ "ส่งคำขออนุมัติแล้ว" ที่ Toast ใช้แยกจาก error จริง */
export const APPROVAL_PENDING_MESSAGES = new Set<string>();

export class ApprovalPendingError extends ApiError {
  changeRequest: ChangeRequest | undefined;
  constructor(message: string, changeRequest?: ChangeRequest) {
    super(202, "APPROVAL_PENDING", message);
    this.changeRequest = changeRequest;
  }
}

/**
 * ดาวน์โหลดไฟล์จาก API (Excel / PDF)
 *
 * ต้องแนบ token เองเพราะเปิดด้วย <a href> ธรรมดาไม่ได้ — ระบบใช้ Bearer token
 * อ่านเป็น blob แล้วสั่งบันทึก ไม่แปลงเป็นข้อความ (ไฟล์จะพังทันทีถ้าทำแบบนั้น)
 */
export async function downloadFile(
  path: string,
  fallbackName: string,
  // Round 8 — ดาวน์โหลดผลจาก POST ได้ (เช่น รายงานผลตรวจนำเข้าลูกค้า) · ไม่ส่ง = GET เหมือนเดิม
  post?: { body: unknown }
): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: post ? "POST" : "GET",
    headers: {
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(post ? { "Content-Type": "application/json" } : {}),
    },
    ...(post ? { body: JSON.stringify(post.body) } : {}),
    cache: "no-store",
  });
  if (!res.ok) {
    let msg = `ดาวน์โหลดไม่สำเร็จ (HTTP ${res.status})`;
    try {
      const body = await res.json();
      msg = body?.error?.message ?? msg;
    } catch {
      /* ไม่ใช่ JSON — ใช้ข้อความเริ่มต้น */
    }
    throw new ApiError(res.status, "DOWNLOAD", msg);
  }
  const disp = res.headers.get("Content-Disposition") ?? "";
  const m = /filename="?([^"]+)"?/.exec(disp);
  const name = m?.[1] ?? fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * เปิดไฟล์ (PDF/รูป) ในแท็บใหม่ — ต้องแนบ Bearer token จึงอ่านเป็น blob แล้วเปิดเป็น object URL
 * เปิดแท็บก่อน await เพื่อไม่ให้เบราว์เซอร์มือถือบล็อก popup
 */
export async function openFileInline(path: string): Promise<void> {
  const win = window.open("", "_blank");
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
      cache: "no-store",
    });
    if (!res.ok) throw new ApiError(res.status, "DOWNLOAD", `เปิดไฟล์ไม่สำเร็จ (HTTP ${res.status})`);
    const url = URL.createObjectURL(await res.blob());
    if (win) win.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    win?.close();
    throw e;
  }
}

/** อ่านไฟล์ที่ผู้ใช้เลือกเป็น base64 (ตัดส่วนหัว data: ออก) เพื่อส่งให้ backend ตรวจเอง */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    r.readAsDataURL(file);
  });
}

export const api = {
  getOptions: () => request<Options>("/api/meta/options"),

  listJobs: (
    params: { status?: JobStatus; team?: string; q?: string; dateScope?: JobDateScope } = {}
  ) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.team) qs.set("team", params.team);
    // ช่วงวันนัด: เซิร์ฟเวอร์เป็นคนเทียบวันที่ ไม่ให้เบราว์เซอร์กรองเอง
    if (params.dateScope) qs.set("dateScope", params.dateScope);
    if (params.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs}` : "";
    // รายการใบงานไม่มีรูป/ลายเซ็น (ดู JobListItem) — ต้องการหลักฐานให้เปิดใบงานนั้นด้วย getJob()
    return request<{ jobs: JobListItem[]; count: number }>(`/api/jobs${suffix}`);
  },

  getJob: (id: string) => request<Job>(`/api/jobs/${encodeURIComponent(id)}`),

  // equipment[] เป็น optional — ถ้าไม่ส่ง backend จะทำงานแบบเดิมทุกประการ
  // ---- ร่างใบงาน (JOB-01 บันทึกร่าง) — ร่างไม่ใช้เลข JN ไม่แจ้งช่าง ----
  listJobDrafts: (mine = false) =>
    request<{ items: JobDraft[]; count: number }>(`/api/job-drafts${mine ? "?mine=1" : ""}`),
  getJobDraft: (id: string) => request<JobDraft>(`/api/job-drafts/${encodeURIComponent(id)}`),
  createJobDraft: (values: Partial<JobFormValues>, equipment: Record<string, unknown>[]) =>
    request<JobDraft>("/api/job-drafts", { method: "POST", body: JSON.stringify({ values, equipment }) }),
  updateJobDraft: (id: string, values: Partial<JobFormValues>, equipment: Record<string, unknown>[], version: number) =>
    request<JobDraft>(`/api/job-drafts/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ values, equipment, version }),
    }),
  deleteJobDraft: (id: string) => request<JobDraft>(`/api/job-drafts/${encodeURIComponent(id)}`, { method: "DELETE" }),
  submitJobDraft: (id: string, values: Partial<JobFormValues>, equipment: Record<string, unknown>[], version: number) =>
    request<{ draft: JobDraft; job: Job }>(`/api/job-drafts/${encodeURIComponent(id)}/submit`, {
      method: "POST",
      body: JSON.stringify({ values, equipment, version }),
    }),

  /**
   * idempotencyKey: คีย์เดียวต่อ "ความตั้งใจเปิดงาน 1 ครั้ง" — กดซ้ำ/เน็ตหลุดแล้วส่งใหม่ด้วยคีย์เดิม
   * backend คืนใบงานเดิม (ไม่เปิดใบที่สอง)
   */
  createJob: (values: JobFormValues, equipment?: JobEquipmentInput[], idempotencyKey?: string) =>
    request<Job>("/api/jobs", {
      method: "POST",
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      body: JSON.stringify(equipment && equipment.length ? { ...values, equipment } : values),
    }),

  jobEquipment: (jobId: string) =>
    request<{ items: JobEquipmentLine[]; count: number }>(
      `/api/jobs/${encodeURIComponent(jobId)}/equipment`
    ),

  addJobEquipment: (jobId: string, item: JobEquipmentInput) =>
    request<JobEquipmentLine>(`/api/jobs/${encodeURIComponent(jobId)}/equipment`, {
      method: "POST",
      body: JSON.stringify(item),
    }),

  // Round 8 (JOB-01) — แก้ข้อมูลรายเครื่อง (Admin)
  patchJobEquipmentLine: (jobId: string, lineId: string, values: Partial<JobEquipmentLineFields>) =>
    request<JobEquipmentLine>(
      `/api/jobs/${encodeURIComponent(jobId)}/equipment/${encodeURIComponent(lineId)}`,
      { method: "PATCH", body: JSON.stringify(values) }
    ),

  // Round 8 (JOB-03) — รูป SN + รูปงานของเครื่องหนึ่งตัว (แทนที่ทั้งชุดของเครื่องนั้น)
  // ---- VFB แถว 7–9: ผลรายเครื่อง / เอกสารแทน SN / ความพร้อมปิดงาน ----
  completeJobLine: (jobId: string, lineId: string, note = "") =>
    request<JobEquipmentLine>(
      `/api/jobs/${encodeURIComponent(jobId)}/equipment/${encodeURIComponent(lineId)}/complete`,
      { method: "POST", body: JSON.stringify({ note }) }
    ),
  reopenJobLine: (jobId: string, lineId: string, reason: string) =>
    request<JobEquipmentLine>(
      `/api/jobs/${encodeURIComponent(jobId)}/equipment/${encodeURIComponent(lineId)}/reopen`,
      { method: "POST", body: JSON.stringify({ reason }) }
    ),
  setJobLineNoSnRef: (
    jobId: string,
    lineId: string,
    v: { kind: "DELIVERY_NOTE" | "INVOICE"; docNo?: string; documentId?: string; photos?: string[]; note?: string }
  ) =>
    request<JobEquipmentLine>(
      `/api/jobs/${encodeURIComponent(jobId)}/equipment/${encodeURIComponent(lineId)}/no-sn-ref`,
      { method: "PUT", body: JSON.stringify(v) }
    ),
  jobCloseCheck: (jobId: string) =>
    request<{ jobId: string; canClose: boolean; reasons: string[]; machines: number; done: number; signatureRequired: boolean }>(
      `/api/jobs/${encodeURIComponent(jobId)}/close-check`
    ),

  // ---- VFB แถว 21: คำขออนุมัติการแก้ไข/ลบของ Admin ----
  listChangeRequests: (params: { status?: string; mine?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.mine) qs.set("mine", "1");
    return request<{ items: ChangeRequest[]; count: number; canApprove: boolean; needsApproval: boolean }>(
      `/api/change-requests${qs.toString() ? `?${qs}` : ""}`
    );
  },
  getChangeRequest: (id: string) => request<ChangeRequest>(`/api/change-requests/${encodeURIComponent(id)}`),
  approveChangeRequest: (id: string, note = "") =>
    request<ChangeRequest>(`/api/change-requests/${encodeURIComponent(id)}/approve`, { method: "POST", body: JSON.stringify({ note }) }),
  rejectChangeRequest: (id: string, reason: string) =>
    request<ChangeRequest>(`/api/change-requests/${encodeURIComponent(id)}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  cancelChangeRequest: (id: string) =>
    request<ChangeRequest>(`/api/change-requests/${encodeURIComponent(id)}/cancel`, { method: "POST", body: "{}" }),
  pendingChangeCount: () => request<{ count: number }>("/api/change-requests/pending-count"),

  setJobLineEvidence: (jobId: string, lineId: string, evidence: { snPhotos: string[]; workPhotos: string[] }) =>
    request<JobEquipmentLine>(
      `/api/jobs/${encodeURIComponent(jobId)}/equipment/${encodeURIComponent(lineId)}/evidence`,
      { method: "PUT", body: JSON.stringify(evidence) }
    ),

  removeJobEquipment: (jobId: string, lineId: string) =>
    request<{ equipmentCount: number; filterUnit: string }>(
      `/api/jobs/${encodeURIComponent(jobId)}/equipment/${encodeURIComponent(lineId)}`,
      { method: "DELETE" }
    ),

  patchJob: (id: string, values: Partial<JobFormValues>, updatedAt: string) =>
    request<Job>(`/api/jobs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...values, updatedAt }),
    }),

  // ---- workflow ของใบงาน (เพิ่มรอบ Requirement.xlsx) ----
  jobStage: (id: string) =>
    request<{ jobId: string; status: JobStatus; stage: JobStage; stageLabel: string }>(
      `/api/jobs/${encodeURIComponent(id)}/stage`
    ),

  setJobStage: (id: string, stage: "ACKNOWLEDGED" | "IN_PROGRESS") =>
    request<Job>(`/api/jobs/${encodeURIComponent(id)}/stage`, {
      method: "POST",
      body: JSON.stringify({ stage }),
    }),

  cancelJob: (id: string, reason: string, updatedAt: string) =>
    request<Job>(`/api/jobs/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason, updatedAt }),
    }),

  // JOB-02 พักงาน / กลับมาดำเนินการ
  holdJob: (id: string, reason: string, updatedAt: string) =>
    request<Job>(`/api/jobs/${encodeURIComponent(id)}/hold`, {
      method: "POST",
      body: JSON.stringify({ reason, updatedAt }),
    }),

  // D-04: jobTime ไม่ส่ง (undefined) = backend คงเวลานัดเดิม · ส่ง "" = ล้างเวลาโดยตั้งใจ
  resumeJob: (id: string, updatedAt: string, jobDate = "", jobTime?: string) =>
    request<Job>(`/api/jobs/${encodeURIComponent(id)}/resume`, {
      method: "POST",
      body: JSON.stringify(jobTime === undefined ? { updatedAt, jobDate } : { updatedAt, jobDate, jobTime }),
    }),

  requestReschedule: (
    id: string,
    values: { reason: RescheduleReason; note?: string; requestedDate?: string; requestedTime?: string }
  ) =>
    request<{ job: Job; request: RescheduleRequest }>(
      `/api/jobs/${encodeURIComponent(id)}/reschedule`,
      { method: "POST", body: JSON.stringify(values) }
    ),

  decideReschedule: (id: string, reqId: string, decision: "APPROVED" | "REJECTED", note = "") =>
    request<Job>(
      `/api/jobs/${encodeURIComponent(id)}/reschedule/${encodeURIComponent(reqId)}/decide`,
      { method: "POST", body: JSON.stringify({ decision, note }) }
    ),

  setJobFinance: (
    id: string,
    values: { revenueAmount: number; costAmount: number; financeNote: string },
    updatedAt: string
  ) =>
    request<Job>(`/api/jobs/${encodeURIComponent(id)}/finance`, {
      method: "POST",
      body: JSON.stringify({ ...values, updatedAt }),
    }),

  // ---- ตาราง PM รายเดือน ----
  pmCandidates: (params: { month?: string; zone?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.month) qs.set("month", params.month);
    if (params.zone) qs.set("zone", params.zone);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ month: string; from: string; to: string; items: PmCandidate[]; count: number }>(
      `/api/pm/candidates${suffix}`
    );
  },

  listPmPlans: (params: { month?: string; technicianId?: string; status?: PmPlanStatus } = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: PmPlan[]; count: number }>(`/api/pm/plans${suffix}`);
  },

  // PM-01 / TECH-01 — ตาราง PM แบบรายการ รวมหลายเดือน (ช่างเห็นเฉพาะของตน — เซิร์ฟเวอร์บังคับ)
  // D-12: days = ดูล่วงหน้า N วันนับจากวันนี้ (ใช้แทน month/months)
  pmItems: (params: { month?: string; months?: number; technicianId?: string; days?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.days !== undefined) qs.set("days", String(params.days));
    if (params.month && params.days === undefined) qs.set("month", params.month);
    if (params.months && params.days === undefined) qs.set("months", String(params.months));
    if (params.technicianId) qs.set("technicianId", params.technicianId);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ month: string; months: string[]; items: PmItemRow[]; count: number }>(`/api/pm/items${suffix}`);
  },

  getPmPlan: (id: string) => request<PmPlan>(`/api/pm/plans/${encodeURIComponent(id)}`),

  createPmPlan: (values: { month: string; technicianId: string; note?: string; equipmentIds?: string[] }) =>
    request<PmPlan>("/api/pm/plans", { method: "POST", body: JSON.stringify(values) }),

  addPmPlanItems: (id: string, equipmentIds: string[]) =>
    request<PmPlan>(`/api/pm/plans/${encodeURIComponent(id)}/items`, {
      method: "POST",
      body: JSON.stringify({ equipmentIds }),
    }),

  skipPmPlanItem: (id: string, itemId: string, reason: string) =>
    request<PmPlan>(
      `/api/pm/plans/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/skip`,
      { method: "POST", body: JSON.stringify({ reason }) }
    ),

  schedulePmPlanItem: (id: string, itemId: string, plannedDate: string, plannedTime = "") =>
    request<PmPlan>(
      `/api/pm/plans/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/schedule`,
      { method: "POST", body: JSON.stringify({ plannedDate, plannedTime }) }
    ),

  createPmJob: (id: string, itemId: string) =>
    request<{ job: Job; plan: PmPlan }>(
      `/api/pm/plans/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/job`,
      { method: "POST", body: JSON.stringify({}) }
    ),

  // PM-02 เลือกหลายเครื่องร้านเดียวกัน เปิด JN เดียว
  createPmJobMulti: (id: string, itemIds: string[]) =>
    request<{ job: Job; plan: PmPlan }>(`/api/pm/plans/${encodeURIComponent(id)}/jobs`, {
      method: "POST",
      body: JSON.stringify({ itemIds }),
    }),

  setPmPlanStatus: (id: string, status: PmPlanStatus, reason = "") =>
    request<PmPlan>(`/api/pm/plans/${encodeURIComponent(id)}/status`, {
      method: "POST",
      body: JSON.stringify({ status, reason }),
    }),

  // ---- การแจ้งเตือนของระบบ ----
  listNotifications: (params: { kind?: NotificationKind; unreadOnly?: boolean; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.kind) qs.set("kind", params.kind);
    if (params.unreadOnly) qs.set("unreadOnly", "1");
    if (params.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: AppNotification[]; count: number }>(`/api/notifications${suffix}`);
  },

  notificationsUnreadCount: () => request<{ count: number }>("/api/notifications/unread-count"),

  markNotificationRead: (id: string) =>
    request<{ ok: true }>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST" }),

  markAllNotificationsRead: () =>
    request<{ ok: true; updated: number }>("/api/notifications/read-all", { method: "POST" }),

  runNotifications: () =>
    request<{ ranAt: string; created: number; skipped: number; errors: string[] }>(
      "/api/notifications/run",
      { method: "POST" }
    ),

  // ---- ระบบสต๊อกอะไหล่ (STK-FN-001..010) ----
  listParts: (params: { q?: string; activeOnly?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.activeOnly) qs.set("activeOnly", "1");
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: Part[]; count: number }>(`/api/stock/parts${suffix}`);
  },

  createPart: (values: Partial<Part>) =>
    request<Part>("/api/stock/parts", { method: "POST", body: JSON.stringify(values) }),

  patchPart: (id: string, values: Partial<Part>, updatedAt: string) =>
    request<Part>(`/api/stock/parts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...values, updatedAt }),
    }),

  listStockLocations: (params: { type?: string; ownerUserId?: string } = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: StockLocation[]; count: number }>(`/api/stock/locations${suffix}`);
  },

  createStockLocation: (values: Partial<StockLocation>) =>
    request<StockLocation>("/api/stock/locations", { method: "POST", body: JSON.stringify(values) }),

  stockBalances: () => request<StockBalancesResponse>("/api/stock/balances"),

  stockTransactions: (
    params: { partId?: string; locationId?: string; jobId?: string; move?: StockMove; limit?: number } = {}
  ) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: StockTransaction[]; count: number }>(`/api/stock/transactions${suffix}`);
  },

  jobParts: (jobId: string) =>
    request<{ items: StockTransaction[]; count: number }>(
      `/api/stock/jobs/${encodeURIComponent(jobId)}/parts`
    ),

  /**
   * บันทึกการเคลื่อนไหวสต๊อก
   * idempotencyKey: ส่งค่าเดิมเมื่อกดซ้ำ — เซิร์ฟเวอร์จะปฏิเสธครั้งที่สองแทนการตัดยอดซ้ำ
   */
  stockMove: (values: {
    partId: string;
    move: StockMove;
    qty: number;
    fromLocationId?: string;
    toLocationId?: string;
    unitCost?: number;
    jobId?: string;
    note?: string;
    idempotencyKey?: string;
  }) => request<StockTransaction>("/api/stock/moves", { method: "POST", body: JSON.stringify(values) }),

  getStockSettings: () =>
    request<{
      settings: { valuationMethod: ValuationMethod; decidedBy: string; decidedAt: string; note: string };
      methodLabel: string;
      options: Array<{ value: ValuationMethod; label: string }>;
      reason: string;
    }>("/api/settings/stock"),

  saveStockSettings: (values: { valuationMethod: ValuationMethod; note?: string }) =>
    request<{ settings: { valuationMethod: ValuationMethod }; methodLabel: string }>("/api/settings/stock", {
      method: "PUT",
      body: JSON.stringify(values),
    }),

  // ---- ระบบวางบิลช่าง (BILL-FN-001..014) ----
  billableJobs: (params: { from?: string; to?: string; technicianId?: string } = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: BillableJob[]; count: number; billable: number }>(`/api/bills/billable${suffix}`);
  },

  listBills: (params: { status?: BillStatus; technicianId?: string; from?: string; to?: string } = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: TechBill[]; count: number }>(`/api/bills${suffix}`);
  },

  getBill: (id: string) => request<TechBill>(`/api/bills/${encodeURIComponent(id)}`),

  billSummary: (params: { technicianId?: string; from?: string; to?: string } = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: BillSummaryRow[]; count: number }>(`/api/bills/summary${suffix}`);
  },

  createBill: (values: {
    periodFrom: string;
    periodTo: string;
    jobIds: string[];
    labor?: Record<string, number>;
    days?: BillDayItem[];
    expenses?: BillExpenseItem[];
    note?: string;
  }) => request<TechBill>("/api/bills", { method: "POST", body: JSON.stringify(values) }),

  patchBill: (
    id: string,
    values: { items?: BillJobItem[]; days?: BillDayItem[]; expenses?: BillExpenseItem[]; note?: string },
    updatedAt: string
  ) =>
    request<TechBill>(`/api/bills/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...values, updatedAt }),
    }),

  setBillStatus: (id: string, status: BillStatus, note = "") =>
    request<TechBill>(`/api/bills/${encodeURIComponent(id)}/status`, {
      method: "POST",
      body: JSON.stringify({ status, note }),
    }),

  // ---- รายรับ/รายจ่ายรายเครื่อง ----
  equipmentFinance: (equipmentId: string) =>
    request<EquipmentFinance>(`/api/equipment/${encodeURIComponent(equipmentId)}/finance`),

  // ---- ต่ออายุสัญญา (CON-FN-011) ----
  renewContract: (id: string, months: number, updatedAt: string, note = "") =>
    request<Contract>(`/api/contracts/${encodeURIComponent(id)}/renew`, {
      method: "POST",
      body: JSON.stringify({ months, note, updatedAt }),
    }),

  // ---- สรุปผลแดชบอร์ด (DASH-FN-001..010) ----
  dashboardSummary: (
    params: { from?: string; to?: string; jobType?: string; team?: string; technicianId?: string } = {}
  ) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<DashboardSummary>(`/api/dashboard/summary${suffix}`);
  },

  closeJob: (
    id: string,
    updatedAt: string,
    evidence?: { signerName?: string; closeNote?: string; signature?: string; photos?: string[] }
  ) =>
    request<Job>(`/api/jobs/${encodeURIComponent(id)}/close`, {
      method: "POST",
      body: JSON.stringify({ updatedAt, ...(evidence ?? {}) }),
    }),

  listMaster: (kind: MasterKind) =>
    request<{ items: MasterItem[]; count: number }>(`/api/master/${kind}`),

  createMaster: (kind: MasterKind, value: string, modelIndex?: { machineType: string; standardPrice: number }) =>
    request<MasterItem>(`/api/master/${kind}`, {
      method: "POST",
      // IDX-01 (D-07): รุ่นใหม่ส่งประเภทเครื่อง/ราคามาตรฐานไปพร้อมกันในคำขอเดียว
      body: JSON.stringify(modelIndex ? { value, ...modelIndex } : { value }),
    }),

  updateMaster: (kind: MasterKind, id: string, value: string) =>
    request<MasterItem>(`/api/master/${kind}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    }),

  // IDX-01 Model Index: ประเภทเครื่อง + ราคาค่าติดตั้ง/บริการมาตรฐาน
  setModelIndex: (id: string, machineType: string, standardPrice: number) =>
    request<MasterItem>(`/api/master/model/${encodeURIComponent(id)}/index`, {
      method: "PATCH",
      body: JSON.stringify({ machineType, standardPrice }),
    }),

  deleteMaster: (kind: MasterKind, id: string) =>
    request<void>(`/api/master/${kind}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  listEquipment: (
    params: {
      status?: EquipmentStatus;
      model?: string;
      zone?: string;
      category?: string;
      warehouse?: string;
      serialState?: "REAL" | "TEMP";
      contractState?: "MISSING";
      warranty?: WarrantyStatus;
      pmStatus?: PmStatus;
      /** Round 8 · MCH-02 */
      dealType?: "SALE" | "RENTAL";
      companyWarranty?: WarrantyStatus;
      q?: string;
    } = {}
  ) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.dealType) qs.set("dealType", params.dealType);
    if (params.companyWarranty) qs.set("companyWarranty", params.companyWarranty);
    if (params.model) qs.set("model", params.model);
    if (params.zone) qs.set("zone", params.zone);
    if (params.category) qs.set("category", params.category);
    if (params.warehouse) qs.set("warehouse", params.warehouse);
    if (params.serialState) qs.set("serialState", params.serialState);
    if (params.contractState) qs.set("contractState", params.contractState);
    if (params.warranty) qs.set("warranty", params.warranty);
    if (params.pmStatus) qs.set("pmStatus", params.pmStatus);
    if (params.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: Equipment[]; count: number }>(`/api/equipment${suffix}`);
  },

  equipmentSummary: () => request<EquipmentSummary>("/api/equipment/summary"),

  // แดชบอร์ด (Phase 8) — สรุปฝั่งเซิร์ฟเวอร์ แยกตามสิทธิ์ของหน้าต้นทาง
  dashboardEquipment: () => request<EquipmentDashboard>("/api/dashboard/equipment"),
  dashboardJobs: () => request<JobDashboard>("/api/dashboard/jobs"),

  getEquipment: (id: string) => request<Equipment>(`/api/equipment/${encodeURIComponent(id)}`),

  createEquipment: (values: EquipmentFormValues) =>
    request<Equipment>("/api/equipment", { method: "POST", body: JSON.stringify(values) }),

  patchEquipment: (id: string, values: Partial<EquipmentFormValues>, updatedAt: string) =>
    request<Equipment>(`/api/equipment/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...values, updatedAt }),
    }),

  deleteEquipment: (id: string) =>
    request<void>(`/api/equipment/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // ประวัติของเครื่อง (รับเข้า/ย้าย/ส่งมอบ/คืน/เปลี่ยนสถานะ)
  // ไทม์ไลน์รวม (ประวัติเครื่อง + ใบงาน) — backend เป็นผู้กรองตามแท็บ
  equipmentTimeline: (id: string, tab: TimelineTab = "all", limit = 200) =>
    request<{ items: TimelineItem[]; count: number; tab: TimelineTab }>(
      `/api/equipment/${encodeURIComponent(id)}/timeline?tab=${tab}&limit=${limit}`
    ),

  equipmentJobs: (id: string) =>
    request<{ items: EquipmentJobRow[]; count: number }>(
      `/api/equipment/${encodeURIComponent(id)}/jobs`
    ),

  equipmentHistory: (id: string, limit = 200) =>
    request<{ items: EquipmentEvent[]; count: number }>(
      `/api/equipment/${encodeURIComponent(id)}/history?limit=${limit}`
    ),

  // MCH-04: เปลี่ยนเครื่องทดแทน — :id = เครื่องเดิม
  replaceEquipment: (id: string, values: { newEquipmentId: string; date?: string; note?: string }) =>
    request<{ old: Equipment; replacement: Equipment }>(`/api/equipment/${encodeURIComponent(id)}/replace`, {
      method: "POST",
      body: JSON.stringify(values),
    }),

  // ลง Serial จริงแทนเลขชั่วคราว TMP-
  setEquipmentSerial: (id: string, serial: string, note = "") =>
    request<Equipment>(`/api/equipment/${encodeURIComponent(id)}/serial`, {
      method: "POST",
      body: JSON.stringify({ serial, note }),
    }),

  // แก้หมายเหตุ/เวลา ของรายการประวัติ (ของเดิมยังถูกเก็บไว้)
  patchEquipmentEvent: (equipmentId: string, eventId: string, values: { note?: string; at?: string }) =>
    request<EquipmentEvent>(
      `/api/equipment/${encodeURIComponent(equipmentId)}/history/${encodeURIComponent(eventId)}`,
      { method: "PATCH", body: JSON.stringify(values) }
    ),

  // ---- โปรไฟล์ประกันสำเร็จรูป ----
  listWarrantyPresets: () =>
    request<{ items: WarrantyPreset[]; count: number }>("/api/warranty-presets"),

  createWarrantyPreset: (values: WarrantyPresetFormValues) =>
    request<WarrantyPreset>("/api/warranty-presets", { method: "POST", body: JSON.stringify(values) }),

  patchWarrantyPreset: (id: string, values: Partial<WarrantyPresetFormValues>) =>
    request<WarrantyPreset>(`/api/warranty-presets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(values),
    }),

  deleteWarrantyPreset: (id: string) =>
    request<void>(`/api/warranty-presets/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // ย้ายเครื่องไปที่อยู่ใหม่ (บันทึกประวัติให้อัตโนมัติ)
  moveEquipment: (id: string, values: MoveEquipmentValues, updatedAt = "") =>
    request<Equipment>(`/api/equipment/${encodeURIComponent(id)}/move`, {
      method: "POST",
      body: JSON.stringify({ ...values, updatedAt }),
    }),

  // ---- คิวจัดส่ง / คิวซ่อม ----
  listSlots: (
    params: { techId?: string; zone?: string; from?: string; to?: string; status?: SlotStatus } = {}
  ) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, String(v));
    });
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: Slot[]; count: number }>(`/api/queue/slots${suffix}`);
  },

  mySlots: (params: { from?: string; to?: string } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, String(v));
    });
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: Slot[]; count: number }>(`/api/queue/slots/mine${suffix}`);
  },

  createSlot: (values: {
    techId?: string;
    techName?: string;
    date: string;
    start: string;
    end: string;
    zone?: string;
    capacity?: number;
    note?: string;
  }) => request<Slot>("/api/queue/slots", { method: "POST", body: JSON.stringify(values) }),

  bulkCreateSlots: (values: {
    techId?: string;
    techName?: string;
    from: string;
    days?: number;
    times?: { start: string; end: string }[];
    zone?: string;
    capacity?: number;
    skipWeekend?: boolean;
  }) =>
    request<{ created: number; skipped: number }>("/api/queue/slots/bulk", {
      method: "POST",
      body: JSON.stringify(values),
    }),

  patchSlot: (id: string, values: Partial<Pick<Slot, "date" | "start" | "end" | "zone" | "capacity" | "status" | "note">>) =>
    request<Slot>(`/api/queue/slots/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(values),
    }),

  deleteSlot: (id: string) =>
    request<void>(`/api/queue/slots/${encodeURIComponent(id)}`, { method: "DELETE" }),

  suggestSlots: (
    params: { zone?: string; lat?: number; lng?: number; from?: string; days?: number; limit?: number } = {}
  ) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "" && v !== 0) qs.set(k, String(v));
    });
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: SuggestedSlot[]; count: number }>(`/api/queue/suggest${suffix}`);
  },

  listBookings: (
    params: { status?: BookingStatus; type?: BookingType; techId?: string; from?: string; to?: string; q?: string } = {}
  ) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, String(v));
    });
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: Booking[]; count: number }>(`/api/queue/bookings${suffix}`);
  },

  myBookings: (params: { from?: string; to?: string } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, String(v));
    });
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: Booking[]; count: number }>(`/api/queue/bookings/mine${suffix}`);
  },

  getBooking: (id: string) => request<Booking>(`/api/queue/bookings/${encodeURIComponent(id)}`),

  createBooking: (values: BookingFormValues) =>
    request<Booking>("/api/queue/bookings", { method: "POST", body: JSON.stringify(values) }),

  setBookingStatus: (
    id: string,
    status: BookingStatus,
    extra: { reason?: string; lat?: number; lng?: number } = {}
  ) =>
    request<Booking>(`/api/queue/bookings/${encodeURIComponent(id)}/status`, {
      method: "POST",
      body: JSON.stringify({ status, ...extra }),
    }),

  listTechnicians: () => request<{ items: AuthUser[]; count: number }>("/api/users/technicians"),

  // ---- ติดตามตำแหน่ง ----
  sendPing: (values: {
    lat: number;
    lng: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    battery?: number;
    bookingId?: string;
    jobId?: string;
  }) => request<{ ok: boolean; at: string }>("/api/tracking/ping", { method: "POST", body: JSON.stringify(values) }),

  technicianPositions: (hours = 12) =>
    request<{ items: TechnicianPosition[]; count: number }>(`/api/tracking/technicians?hours=${hours}`),

  bookingEta: (id: string) =>
    request<BookingEta>(`/api/tracking/bookings/${encodeURIComponent(id)}/eta`),

  // ตรวจว่าเครื่องยังอยู่ที่ที่อยู่ตามสัญญาไหม
  checkEquipmentLocation: (id: string, values: { lat: number; lng: number; note?: string }) =>
    request<GeofenceResult>(`/api/equipment/${encodeURIComponent(id)}/check-location`, {
      method: "POST",
      body: JSON.stringify(values),
    }),

  // ---- เอกสารการขาย ----
  listDocuments: (
    params: { type?: DocumentType; status?: DocumentStatus; contractId?: string; q?: string } = {}
  ) => {
    const qs = new URLSearchParams();
    if (params.type) qs.set("type", params.type);
    if (params.status) qs.set("status", params.status);
    if (params.contractId) qs.set("contractId", params.contractId);
    if (params.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: SalesDocument[]; count: number }>(`/api/documents${suffix}`);
  },

  getDocument: (id: string) => request<SalesDocument>(`/api/documents/${encodeURIComponent(id)}`),

  createDocument: (values: DocumentFormValues) =>
    request<SalesDocument>("/api/documents", { method: "POST", body: JSON.stringify(values) }),

  issueReceipt: (values: IssueReceiptValues) =>
    request<SalesDocument>("/api/documents/receipt", { method: "POST", body: JSON.stringify(values) }),

  voidDocument: (id: string, reason: string) =>
    request<SalesDocument>(`/api/documents/${encodeURIComponent(id)}/void`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  createCreditNote: (id: string, values: { amount?: number; reason: string; issueDate?: string }) =>
    request<SalesDocument>(`/api/documents/${encodeURIComponent(id)}/credit-note`, {
      method: "POST",
      body: JSON.stringify(values),
    }),

  listContracts: (params: { type?: ContractType; status?: ContractStatus; q?: string; partnerId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.partnerId) qs.set("partnerId", params.partnerId);
    if (params.type) qs.set("type", params.type);
    if (params.status) qs.set("status", params.status);
    if (params.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: Contract[]; count: number }>(`/api/contracts${suffix}`);
  },

  getContract: (id: string) => request<Contract>(`/api/contracts/${encodeURIComponent(id)}`),

  /**
   * สร้างสัญญา — สถานะตั้งต้นคือ DRAFT ตาม AC-CON-01
   * ส่ง status: "ACTIVE" ได้เมื่อผู้ใช้ตั้งใจ "สร้างและเปิดใช้งานทันที"
   * (backend รับเฉพาะ "DRAFT" | "ACTIVE" ที่ปลายทางนี้)
   */
  createContract: (values: ContractFormValues, status: "DRAFT" | "ACTIVE" = "DRAFT") =>
    request<Contract>("/api/contracts", {
      method: "POST",
      body: JSON.stringify({ ...values, status }),
    }),

  payInstallment: (id: string, no: number, paid: boolean, updatedAt: string) =>
    request<Contract>(`/api/contracts/${encodeURIComponent(id)}/pay`, {
      method: "POST",
      body: JSON.stringify({ no, paid, updatedAt }),
    }),

  setContractStatus: (id: string, status: ContractStatus, updatedAt: string, note = "") =>
    request<Contract>(`/api/contracts/${encodeURIComponent(id)}/status`, {
      method: "POST",
      body: JSON.stringify({ status, updatedAt, note }),
    }),

  deleteContract: (id: string) =>
    request<void>(`/api/contracts/${encodeURIComponent(id)}`, { method: "DELETE" }),

  listPartners: (params: { type?: PartnerType; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.type) qs.set("type", params.type);
    if (params.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: Partner[]; count: number }>(`/api/partners${suffix}`);
  },

  getPartner: (id: string) => request<Partner>(`/api/partners/${encodeURIComponent(id)}`),

  createPartner: (values: PartnerFormValues) =>
    request<Partner>("/api/partners", { method: "POST", body: JSON.stringify(values) }),

  patchPartner: (id: string, values: Partial<PartnerFormValues>, updatedAt: string) =>
    request<Partner>(`/api/partners/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...values, updatedAt }),
    }),

  deletePartner: (id: string) =>
    request<void>(`/api/partners/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // ---- สาขา / ร้าน / สถานที่ติดตั้งของลูกค้า (ระบบฐานข้อมูลลูกค้า) ----
  listCustomerSites: (partnerId: string, params: { q?: string; activeOnly?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.activeOnly) qs.set("activeOnly", "1");
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: CustomerSite[]; count: number }>(
      `/api/partners/${encodeURIComponent(partnerId)}/sites${suffix}`
    );
  },

  createCustomerSite: (partnerId: string, values: Partial<CustomerSiteFormValues>) =>
    request<CustomerSite>(`/api/partners/${encodeURIComponent(partnerId)}/sites`, {
      method: "POST",
      body: JSON.stringify(values),
    }),

  patchCustomerSite: (
    partnerId: string,
    siteId: string,
    values: Partial<CustomerSiteFormValues>,
    updatedAt: string
  ) =>
    request<CustomerSite>(
      `/api/partners/${encodeURIComponent(partnerId)}/sites/${encodeURIComponent(siteId)}`,
      { method: "PATCH", body: JSON.stringify({ ...values, updatedAt }) }
    ),

  deleteCustomerSite: (partnerId: string, siteId: string) =>
    request<{ deleted: boolean; deactivated?: boolean; equipmentCount?: number; referenceCount?: number } | void>(
      `/api/partners/${encodeURIComponent(partnerId)}/sites/${encodeURIComponent(siteId)}`,
      { method: "DELETE" }
    ),

  partnerEquipment: (partnerId: string, siteId?: string) => {
    const qs = siteId ? `?siteId=${encodeURIComponent(siteId)}` : "";
    return request<{ items: Equipment[]; count: number; unlinkedByName: number }>(
      `/api/partners/${encodeURIComponent(partnerId)}/equipment${qs}`
    );
  },

  partnerSummary: (partnerId: string) =>
    request<{ partnerId: string; name: string; siteCount: number; equipmentCount: number }>(
      `/api/partners/${encodeURIComponent(partnerId)}/summary`
    ),

  // ค้นหารวม: ชื่อลูกค้า / ชื่อร้าน / เบอร์โทร / SN
  customerSummary: (relation = "") =>
    request<CustomerSummaryResponse>(
      `/api/customers/summary${relation ? `?relation=${encodeURIComponent(relation)}` : ""}`
    ),

  // Round 8 — Import/Export ลูกค้า + สาขา (AT-17 · รูปแบบคอลัมน์ Q-13)
  importCustomers: (fileBase64: string, dryRun: boolean) =>
    request<CustomerImportResult>("/api/customers/import", {
      method: "POST",
      body: JSON.stringify({ fileBase64, dryRun }),
    }),

  searchCustomers: (q: string) =>
    request<CustomerSearchResult>(`/api/customers/search?q=${encodeURIComponent(q)}`),

  equipmentHolding: (equipmentId: string) =>
    request<{
      equipmentId: string;
      serial: string;
      current: HoldingPeriod | null;
      periods: HoldingPeriod[];
      count: number;
    }>(`/api/customers/equipment/${encodeURIComponent(equipmentId)}/holding`),

  // ---- Audit log ----
  listAudit: (
    params: {
      entity?: AuditEntity;
      entityId?: string;
      actorId?: string;
      action?: AuditAction;
      /** Round 8 · CORE-04 — ชื่อหรือ id ผู้ดำเนินการ (บางส่วน) */
      actor?: string;
      /** Round 8 · CORE-04 — id ของข้อมูล หรือเลขเอกสาร/SN (บางส่วน) */
      entityRef?: string;
      from?: string;
      to?: string;
      limit?: number;
    } = {}
  ) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: AuditLog[]; count: number }>(`/api/audit${suffix}`);
  },

  // ---- หัวเอกสารบริษัท ----
  getCompany: () => request<{ company: CompanyProfile; missing: string[] }>("/api/settings/company"),

  saveCompany: (values: Partial<CompanyProfile>) =>
    request<{ company: CompanyProfile; missing: string[] }>("/api/settings/company", {
      method: "PUT",
      body: JSON.stringify(values),
    }),

  // ---- นำเข้าเครื่องจาก Excel (ตรวจที่เซิร์ฟเวอร์) ----
  importEquipment: (fileBase64: string, dryRun = false) =>
    request<ImportReport>("/api/equipment/import", {
      method: "POST",
      body: JSON.stringify({ fileBase64, dryRun }),
    }),

  equipmentInventory: () => request<{ rows: InventoryRow[]; count: number }>("/api/equipment/inventory"),

  listQuotations: (params: { status?: QuotationStatus; partnerId?: string; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.partnerId) qs.set("partnerId", params.partnerId);
    if (params.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: Quotation[]; count: number }>(`/api/quotations${suffix}`);
  },

  getQuotation: (id: string) => request<Quotation>(`/api/quotations/${encodeURIComponent(id)}`),

  createQuotation: (values: QuotationFormValues) =>
    request<Quotation>("/api/quotations", { method: "POST", body: JSON.stringify(values) }),

  patchQuotation: (id: string, values: Partial<QuotationFormValues>, updatedAt: string) =>
    request<Quotation>(`/api/quotations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...values, updatedAt }),
    }),

  setQuotationStatus: (id: string, status: QuotationStatus, updatedAt: string) =>
    request<Quotation>(`/api/quotations/${encodeURIComponent(id)}/status`, {
      method: "POST",
      body: JSON.stringify({ status, updatedAt }),
    }),

  deleteQuotation: (id: string) =>
    request<void>(`/api/quotations/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // DEF-01 — ผูกเครื่องกับสัญญาที่ยังไม่มี SN (Admin → 202 รออนุมัติ: request() โยน ApprovalPendingError)
  linkContractEquipment: (id: string, serial: string, updatedAt: string) =>
    request<Contract>(`/api/contracts/${encodeURIComponent(id)}/link-equipment`, {
      method: "POST",
      body: JSON.stringify({ serial, updatedAt }),
    }),

  contractEdit: (
    id: string,
    values: {
      // DEF-08 — ผูก/เปลี่ยนลูกค้าและสาขาจากหน้าสัญญา (backend รองรับอยู่แล้ว)
      partnerId?: string;
      siteId?: string;
      customerName?: string;
      customerPhone?: string;
      customerAddress?: string;
      siteAddress?: string;
      siteLat?: number;
      siteLng?: number;
      zone?: string;
      note?: string;
    },
    updatedAt: string
  ) =>
    request<Contract>(`/api/contracts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...values, updatedAt }),
    }),

  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser; permissions: string[] }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ user: AuthUser; permissions: string[] }>("/api/auth/me"),

  listUsers: () => request<{ items: AuthUser[]; count: number }>("/api/users"),

  createUser: (v: {
    email: string;
    name: string;
    password: string;
    role: Role;
    team?: string;
    zones?: string[];
    phone?: string;
    dailyCapacity?: number;
  }) =>
    request<AuthUser>("/api/users", { method: "POST", body: JSON.stringify(v) }),

  patchUser: (
    id: string,
    v: {
      name?: string;
      role?: Role;
      active?: boolean;
      password?: string;
      team?: string;
      zones?: string[];
      phone?: string;
      dailyCapacity?: number;
    }
  ) =>
    request<AuthUser>(`/api/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(v) }),

  deleteUser: (id: string) =>
    request<void>(`/api/users/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // D-13: technicianId = กรองรายช่าง · groupBy=technician = จัด lane ตามช่าง (ค่าเดิมตามทีม)
  calendar: (
    params: { from?: string; to?: string; team?: string; month?: string; technicianId?: string; groupBy?: "team" | "technician" } = {}
  ) => {
    const qs = new URLSearchParams();
    if (params.month) qs.set("month", params.month);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (params.team) qs.set("team", params.team);
    if (params.technicianId) qs.set("technicianId", params.technicianId);
    if (params.groupBy && params.groupBy !== "team") qs.set("groupBy", params.groupBy);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<CalendarResponse>(`/api/calendar${suffix}`);
  },

  // ---- job chat + work submissions (แชทส่งงาน) ----
  listChat: (jobId: string, since?: string) => {
    const qs = since ? `?since=${encodeURIComponent(since)}` : "";
    return request<{
      messages: ChatMessage[];
      submissions: Submission[];
      typing?: string[];
      reads?: ChatRead[];
      count: number;
    }>(`/api/chat/${encodeURIComponent(jobId)}${qs}`);
  },

  sendTyping: (jobId: string) =>
    request<{ ok: boolean }>(`/api/chat/${encodeURIComponent(jobId)}/typing`, { method: "POST", body: "{}" }),

  markRead: (jobId: string) =>
    request<{ ok: boolean }>(`/api/chat/${encodeURIComponent(jobId)}/read`, { method: "POST", body: "{}" }),

  unreadChats: () =>
    request<{ items: UnreadChat[]; count: number }>("/api/chat/unread/summary"),

  chatRooms: () =>
    request<{ items: ChatRoomSummary[]; count: number; unreadRooms: number }>("/api/chat/rooms/summary"),

  // ---- web push (แจ้งเตือนมือถือ/เดสก์ท็อป) ----
  pushVapid: () => request<{ key: string }>("/api/push/vapid"),

  pushSubscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    request<{ ok: boolean }>("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub) }),

  pushUnsubscribe: (endpoint: string) =>
    request<{ ok: boolean }>("/api/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint }) }),

  sendChat: (jobId: string, text: string) =>
    request<{ message: ChatMessage; submission: Submission | null }>(
      `/api/chat/${encodeURIComponent(jobId)}`,
      { method: "POST", body: JSON.stringify({ text }) }
    ),

  listSubmissions: (params: { status?: SubmissionStatus; jobId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.jobId) qs.set("jobId", params.jobId);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: Submission[]; count: number }>(`/api/submissions${suffix}`);
  },

  confirmSubmission: (subId: string, note?: string) =>
    request<{ submission: Submission; job: Job }>(
      `/api/submissions/${encodeURIComponent(subId)}/confirm`,
      { method: "POST", body: JSON.stringify({ note: note ?? "" }) }
    ),

  rejectSubmission: (subId: string, note?: string) =>
    request<{ submission: Submission }>(
      `/api/submissions/${encodeURIComponent(subId)}/reject`,
      { method: "POST", body: JSON.stringify({ note: note ?? "" }) }
    ),
};
