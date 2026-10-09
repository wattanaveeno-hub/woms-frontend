// คิวช่าง + แชทกลุ่ม (Chat & Queue v1) — type และ API client
// แยกไฟล์จาก lib/api.ts (ใช้ request() ตัวเดียวกัน) เพื่อไม่ขยายไฟล์ใหญ่เดิม
import { request } from "./api";
import type { JobEquipmentLine } from "./types";
import type { RoundStatus, SqMode, SqStatus, TimePeriod } from "./serviceQueueRules";

export interface SqRound {
  roundNo: number;
  techId: string;
  techName: string;
  status: RoundStatus;
  date: string;
  time: string;
  period: TimePeriod | "";
  proposedById: string;
  proposedByName: string;
  proposedAt: string;
  proposalNote: string;
  confirmedById: string;
  confirmedByName: string;
  confirmedAt: string;
  rejectReason: string;
  openedReason: string;
  openedById: string;
  openedByName: string;
  createdAt: string;
  closedAt: string;
}

export interface SqItem {
  itemId: string;
  machineType: string;
  model: string;
  serial: string;
  equipmentId: string;
  note: string;
  jobEquipmentId: string;
}

export interface ServiceQueue {
  id: string;
  queueNo: string;
  mode: SqMode;
  status: SqStatus;
  statusLabel: string;
  version: number;
  jobType: string;
  jobSubType: string;
  customerType: string;
  jobName: string;
  customerId: string;
  siteId: string;
  branchNo: string;
  address: string;
  contactName: string;
  phone: string;
  mapLink: string;
  note: string;
  preferredDate: string;
  preferredTime: string;
  items: SqItem[];
  ownerSaleId: string;
  ownerSaleName: string;
  createdById: string;
  createdByName: string;
  techId: string;
  techName: string;
  roundNo: number;
  rounds: SqRound[];
  apptDate: string;
  apptTime: string;
  period: TimePeriod | "";
  periodLabel: string;
  current: SqRound | null;
  pendingSerialCount: number;
  jobId: string;
  releasedAt: string;
  rescheduleReason: string;
  cancelReason: string;
  cancelledAt: string;
  cancelledByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SqEvent {
  queueId: string;
  queueNo: string;
  jobId: string;
  action: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  at: string;
  fromStatus: SqStatus | "";
  toStatus: SqStatus | "";
  roundNo: number;
  changes: { field: string; before: unknown; after: unknown }[];
  reason: string;
}

export interface PeriodConflict {
  queueId: string;
  queueNo: string;
  jobId: string;
  jobName: string;
  date: string;
  time: string;
  period: TimePeriod | "";
  status: string;
  source: "QUEUE" | "JOB";
}

export interface QueueSummary {
  waitAssign: number;
  waitTech: number;
  waitCustomer: number;
  readyToOpen: number;
  rescheduling: number;
  myResponse: number;
  myToConfirm: number;
}

export interface QueueItemInput {
  itemId?: string;
  machineType: string;
  model: string;
  serial: string;
  equipmentId?: string;
  note: string;
}

export interface QueueFormValues {
  jobType: string;
  jobSubType: string;
  customerType: string;
  jobName: string;
  customerId: string;
  siteId: string;
  address: string;
  contactName: string;
  phone: string;
  mapLink: string;
  note: string;
  preferredDate: string;
  preferredTime: string;
  ownerSaleId: string;
  items: QueueItemInput[];
}

// ---- แชทกลุ่ม ----
export type GroupMessageKind = "TEXT" | "SYSTEM" | "CARD";

export interface MessageRef {
  queueId: string;
  queueNo: string;
  jobId: string;
}

export interface AttachmentMeta {
  fileId: string;
  name: string;
  mime: string;
  size: number;
}

export interface GroupMessage {
  messageId: string;
  groupKey: string;
  kind: GroupMessageKind;
  text: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  createdAt: string;
  replyTo: { messageId: string; kind: GroupMessageKind; senderName: string; excerpt: string; ref: MessageRef | null } | null;
  ref: MessageRef | null;
  attachments: AttachmentMeta[];
}

export interface QueueCard {
  id: string;
  queueNo: string;
  jobId: string;
  transferred: boolean;
  jobName?: string;
  jobType?: string;
  ownerSaleName?: string;
  techId?: string;
  techName?: string;
  date?: string;
  time?: string;
  periodLabel?: string;
  status?: SqStatus;
  statusLabel?: string;
  mode?: SqMode;
  roundNo?: number;
  itemCount?: number;
  pendingSerialCount?: number;
}

export interface AttachmentPolicy {
  mime: string[];
  maxFileBytes: number;
  maxFiles: number;
  maxTotalBytes: number;
}

export interface ChatGroupSummary {
  groupKey: string;
  name: string;
  type: "CHECK_QUEUE" | "TECH";
  techId: string;
  lastMessage: GroupMessage | null;
  unread: number;
}

const enc = encodeURIComponent;
const post = <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const sqApi = {
  list: (params: Record<string, string | undefined> = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    const s = q.toString();
    return request<{ items: ServiceQueue[]; count: number }>(`/api/service-queue${s ? `?${s}` : ""}`);
  },
  summary: () => request<QueueSummary>("/api/service-queue/summary"),
  get: (id: string) =>
    request<{ queue: ServiceQueue; events: SqEvent[]; messages: GroupMessage[]; jobEquipment: JobEquipmentLine[]; conflicts: PeriodConflict[] }>(
      `/api/service-queue/${enc(id)}`
    ),
  conflicts: (techId: string, date: string, time: string, excludeId = "") =>
    request<{ items: PeriodConflict[] }>(
      `/api/service-queue/conflicts?techId=${enc(techId)}&date=${enc(date)}&time=${enc(time)}&excludeId=${enc(excludeId)}`
    ),
  sales: () => request<{ items: { id: string; name: string }[] }>("/api/service-queue/sales"),
  forJob: (jobId: string) =>
    request<{ items: ServiceQueue[]; canReschedule: boolean; rescheduleBlocker: string | null }>(`/api/service-queue/jobs/${enc(jobId)}`),
  create: (values: QueueFormValues) => post<ServiceQueue>("/api/service-queue", values),
  edit: (id: string, version: number, values: Partial<QueueFormValues> & { reason?: string }) =>
    request<ServiceQueue>(`/api/service-queue/${enc(id)}`, { method: "PATCH", body: JSON.stringify({ ...values, version }) }),
  assign: (id: string, version: number, techId: string, note = "") => post<ServiceQueue>(`/api/service-queue/${enc(id)}/assign`, { version, techId, note }),
  propose: (id: string, roundNo: number, date: string, time: string, note = "") =>
    post<{ queue: ServiceQueue; conflicts: PeriodConflict[] }>(`/api/service-queue/${enc(id)}/propose`, { roundNo, date, time, note }),
  reject: (id: string, roundNo: number, reason: string) => post<ServiceQueue>(`/api/service-queue/${enc(id)}/reject`, { roundNo, reason }),
  confirm: (id: string, roundNo: number) => post<ServiceQueue>(`/api/service-queue/${enc(id)}/confirm`, { roundNo }),
  requestNewDate: (id: string, roundNo: number, note = "") => post<ServiceQueue>(`/api/service-queue/${enc(id)}/request-new-date`, { roundNo, note }),
  release: (id: string, roundNo: number) => post<ServiceQueue>(`/api/service-queue/${enc(id)}/release`, { roundNo }),
  cancel: (id: string, version: number, reason: string) => post<ServiceQueue>(`/api/service-queue/${enc(id)}/cancel`, { version, reason }),
  rescheduleJob: (jobId: string, reason: string, techId = "") => post<ServiceQueue>(`/api/service-queue/jobs/${enc(jobId)}/reschedule`, { reason, techId }),
};

export const chatApi = {
  groups: () => request<{ items: ChatGroupSummary[]; attachmentPolicy: AttachmentPolicy }>("/api/group-chat/groups"),
  group: (key: string) =>
    request<{ groupKey: string; type: string; name: string; members: { id: string; name: string; role: string }[]; attachmentPolicy: AttachmentPolicy }>(
      `/api/group-chat/groups/${enc(key)}`
    ),
  messages: (key: string, since?: string) =>
    request<{ messages: GroupMessage[]; cards: Record<string, QueueCard> }>(
      `/api/group-chat/groups/${enc(key)}/messages${since ? `?since=${enc(since)}` : ""}`
    ),
  send: (key: string, body: { text: string; replyToId?: string; attachments?: { name: string; dataUrl: string }[] }) =>
    post<{ message: GroupMessage }>(`/api/group-chat/groups/${enc(key)}/messages`, body),
  read: (key: string) => post<{ ok: boolean }>(`/api/group-chat/groups/${enc(key)}/read`, {}),
  file: (fileId: string) => request<{ name: string; mime: string; size: number; dataUrl: string }>(`/api/group-chat/files/${enc(fileId)}`),
};
