import type {
  Job,
  Options,
  JobFormValues,
  JobStatus,
  CalendarResponse,
  MasterItem,
  MasterKind,
  Equipment,
  EquipmentStatus,
  EquipmentFormValues,
  EquipmentEvent,
  MoveEquipmentValues,
  EquipmentSummary,
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
  constructor(status: number, code: string, message: string, field?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
    throw new ApiError(res.status, err.code ?? "ERROR", err.message ?? "เกิดข้อผิดพลาด", err.field);
  }
  return body as T;
}

export const api = {
  getOptions: () => request<Options>("/api/meta/options"),

  listJobs: (params: { status?: JobStatus; team?: string; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.team) qs.set("team", params.team);
    if (params.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ jobs: Job[]; count: number }>(`/api/jobs${suffix}`);
  },

  getJob: (id: string) => request<Job>(`/api/jobs/${encodeURIComponent(id)}`),

  createJob: (values: JobFormValues) =>
    request<Job>("/api/jobs", { method: "POST", body: JSON.stringify(values) }),

  patchJob: (id: string, values: Partial<JobFormValues>, updatedAt: string) =>
    request<Job>(`/api/jobs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...values, updatedAt }),
    }),

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

  createMaster: (kind: MasterKind, value: string) =>
    request<MasterItem>(`/api/master/${kind}`, {
      method: "POST",
      body: JSON.stringify({ value }),
    }),

  updateMaster: (kind: MasterKind, id: string, value: string) =>
    request<MasterItem>(`/api/master/${kind}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
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
      warranty?: WarrantyStatus;
      q?: string;
    } = {}
  ) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.model) qs.set("model", params.model);
    if (params.zone) qs.set("zone", params.zone);
    if (params.warranty) qs.set("warranty", params.warranty);
    if (params.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: Equipment[]; count: number }>(`/api/equipment${suffix}`);
  },

  equipmentSummary: () => request<EquipmentSummary>("/api/equipment/summary"),

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
  equipmentHistory: (id: string, limit = 200) =>
    request<{ items: EquipmentEvent[]; count: number }>(
      `/api/equipment/${encodeURIComponent(id)}/history?limit=${limit}`
    ),

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

  listContracts: (params: { type?: ContractType; status?: ContractStatus; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.type) qs.set("type", params.type);
    if (params.status) qs.set("status", params.status);
    if (params.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ items: Contract[]; count: number }>(`/api/contracts${suffix}`);
  },

  getContract: (id: string) => request<Contract>(`/api/contracts/${encodeURIComponent(id)}`),

  createContract: (values: ContractFormValues) =>
    request<Contract>("/api/contracts", { method: "POST", body: JSON.stringify(values) }),

  payInstallment: (id: string, no: number, paid: boolean, updatedAt: string) =>
    request<Contract>(`/api/contracts/${encodeURIComponent(id)}/pay`, {
      method: "POST",
      body: JSON.stringify({ no, paid, updatedAt }),
    }),

  setContractStatus: (id: string, status: ContractStatus, updatedAt: string) =>
    request<Contract>(`/api/contracts/${encodeURIComponent(id)}/status`, {
      method: "POST",
      body: JSON.stringify({ status, updatedAt }),
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

  contractEdit: (
    id: string,
    values: {
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

  calendar: (params: { from?: string; to?: string; team?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (params.team) qs.set("team", params.team);
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
