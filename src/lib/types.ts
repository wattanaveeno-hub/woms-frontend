// MOVE (ย้ายเครื่อง) เพิ่มรอบ Requirement.xlsx
export type JobType = "INSTALL" | "PM" | "CM" | "PM_CM" | "REMOVE" | "MOVE";
export type JobSubType = "PICKUP_REPAIR" | "RETURN" | "";
export type JobStatus = "OPEN" | "CLOSED" | "CANCELLED";

export type Role = "admin" | "manager" | "tech" | "sales" | "viewer";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  team?: string;
  zones?: string[];
  phone?: string;
  dailyCapacity?: number;
}

export interface Job {
  jobId: string;
  jobType: JobType;
  jobSubType: JobSubType;
  jobName: string;
  technicianTeam: string;
  /** ผู้รับผิดชอบรายบุคคล (users._id) — [] = ใบงานเก่าที่มอบหมายด้วยทีมอย่างเดียว */
  technicianIds?: string[];
  /** สาขา/สถานที่ปฏิบัติงาน (customer_sites._id) */
  siteId?: string;
  // ---- workflow ที่เพิ่มรอบ Requirement.xlsx ----
  stage?: JobStage | "";
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  startedAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
  rescheduleRequests?: RescheduleRequest[];
  revenueAmount?: number;
  costAmount?: number;
  financeNote?: string;
  financeBy?: string;
  financeAt?: string;
  salesPerson: string;
  model: string;
  filterUnit: string;
  contactName: string;
  phone: string;
  jobDate: string;
  jobTime: string;
  mapLink: string;
  note: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string;
  signerName: string;
  closeNote: string;
  signature: string;
  photos: string[];
}

/**
 * ใบงานที่ได้จาก endpoint แบบรายการ (Phase 9.1)
 *
 * รายการใบงานไม่ส่งรูปหน้างานและลายเซ็นกลับมา เพราะเป็น base64 ที่หนักมาก
 * (ใบละได้ถึง ~8 MB) หน้าไหนที่ต้องใช้หลักฐานต้องเปิดใบงานนั้นด้วย api.getJob()
 * — ห้ามไล่ยิง getJob ทีละแถวในรายการ
 */
export type JobListItem = Omit<Job, "signature" | "photos">;

export interface Options {
  jobTypes: { value: string; label: string }[];
  jobSubTypes: { value: string; label: string }[];
  teams: string[];
  models: string[];
  zones: string[];
  categories: string[];
  warehouses: string[];
}

export interface CloseEvidence {
  signerName: string;
  closeNote: string;
  signature: string;
  photos: string[];
}

// Master data: editable lookup lists that feed the job-form dropdowns.
export type MasterKind = "team" | "model" | "zone" | "category" | "warehouse";

export interface MasterItem {
  id: string;
  kind: MasterKind;
  value: string;
}

// Equipment (stock unit) — serial-tracked machine with warranty.
export type EquipmentStatus = "IN_STOCK" | "RESERVED" | "RENTED" | "SOLD" | "REPAIR" | "RETIRED";
export type WarrantyStatus = "NONE" | "ACTIVE" | "EXPIRING" | "EXPIRED";
export type WarrantyProvider = "BRAND" | "AGENT" | "OTHER";

// ประกันหนึ่งชุด — เครื่องหนึ่งเครื่องมีได้หลายชุด (แบรนด์ / ตัวแทน / อื่น ๆ)
export interface Warranty {
  provider: WarrantyProvider;
  providerName: string;
  start: string;
  months: number;
  coverage: string;
  note: string;
}

export interface WarrantyView extends Warranty {
  end: string;
  status: WarrantyStatus;
  daysLeft: number;
}

// ประวัติของเครื่อง (stock movement / audit trail)
export type EquipmentEventType =
  | "CREATE"
  | "MOVE"
  | "STATUS"
  | "ASSIGN"
  | "RETURN"
  | "WARRANTY"
  | "EDIT"
  | "CHECK"
  | "SERIAL"
  | "DELETE";

export interface EquipmentEvent {
  id: string;
  edited: boolean;
  editedAt: string;
  editedById: string;
  editedByName: string;
  originalNote: string;
  equipmentId: string;
  serial: string;
  type: EquipmentEventType;
  label: string;
  at: string;
  byId: string;
  byName: string;
  fromStatus: string;
  toStatus: string;
  fromLocation: string;
  toLocation: string;
  lat: number;
  lng: number;
  customerName: string;
  // ---- ผูกลูกค้า/สาขาด้วย id (เพิ่มรอบ Requirement.xlsx) — event เก่าไม่มีฟิลด์นี้ ----
  partnerId?: string;
  siteId?: string;
  refType: "" | "CONTRACT" | "JOB" | "DOCUMENT";
  refId: string;
  note: string;
}

export interface Equipment {
  id: string;
  serial: string;
  hasRealSerial: boolean;
  model: string;
  category: string;
  status: EquipmentStatus;
  customerName: string;
  // ---- ผูกฐานข้อมูลลูกค้าด้วย id (เพิ่มรอบ Requirement.xlsx) ----
  // "" = เครื่องเก่าที่ยังผูกด้วยชื่อลูกค้าอย่างเดียว
  customerId: string;
  siteId: string;
  /** ป้ายชื่อสาขา — backend เติมให้เฉพาะ endpoint ที่ join กับ customer_sites */
  siteLabel: string;
  supplier: string;
  warehouse: string;
  location: string;
  address: string;
  district: string;
  province: string;
  postcode: string;
  zone: string;
  addressFull: string;
  inboundDate: string;
  lat: number;
  lng: number;
  warranties: WarrantyView[];
  supplierWarrantyStart: string;
  supplierWarrantyMonths: number;
  customerWarrantyStart: string;
  customerWarrantyMonths: number;
  note: string;
  supplierWarrantyEnd: string;
  supplierWarrantyStatus: WarrantyStatus;
  customerWarrantyEnd: string;
  customerWarrantyStatus: WarrantyStatus;
  warrantyEnd: string;
  warrantyStatus: WarrantyStatus;
  warrantyDaysLeft: number;
  needsSerial: boolean; // true = ยังเป็น serial ชั่วคราว ต้องตามลง SN จริง
  // ---- ประเภทธุรกิจ + PM (คำนวณจาก backend ทั้งหมด ห้ามคำนวณซ้ำฝั่งหน้าเว็บ) ----
  businessType: BusinessType;
  pmIntervalMonths: number;
  lastPmDate: string;
  nextPmDate: string;
  pmStatus: PmStatus;
  pmDaysLeft: number;
  createdAt: string;
  updatedAt: string;
}

export type BusinessType = "" | "SALE" | "RENTAL";

// สถานะ PM — มาจาก backend (domain/pm.ts) เท่านั้น
export type PmStatus = "NOT_CONFIGURED" | "ON_SCHEDULE" | "DUE_SOON" | "OVERDUE";

/** มุมมองช่วงวันนัดของใบงาน — เทียบกับวันที่ของเซิร์ฟเวอร์ (ไม่ใช่สถานะใหม่ของใบงาน) */
export type JobDateScope = "TODAY" | "OVERDUE";

// ---- ไทม์ไลน์ของเครื่อง (Phase 3 backend: /api/equipment/:id/timeline) ----
export const TIMELINE_TABS = ["all", "job", "pm", "cm", "move"] as const;
export type TimelineTab = (typeof TIMELINE_TABS)[number];

export interface TimelineItem {
  kind: "EVENT" | "JOB";
  at: string;
  title: string;
  detail: string;
  jobId: string;
  eventType: string;
  jobType: string;
  status: string;
  by: string;
  id: string;
}

/** ใบงานที่เครื่องนี้เคยเข้า (/api/equipment/:id/jobs) */
export interface EquipmentJobRow {
  jobId: string;
  jobType: string;
  jobName: string;
  jobDate: string;
  jobTime: string;
  status: string;
  technicianTeam: string;
  contactName: string;
  lineId: string;
  note: string;
}

/**
 * สิ่งที่ส่งไป backend เพื่อผูกเครื่องกับใบงาน
 *  - ส่ง equipmentId  = เลือกเครื่องที่มีอยู่ในคลัง
 *  - ส่ง serial       = อ้างด้วย serial จริง (ถ้าไม่มีในคลัง backend จะปฏิเสธ — ไม่สร้างให้)
 *  - ไม่ส่งทั้งสองอย่าง = ยังไม่มี SN จริง ให้ backend ออกเลขชั่วคราวให้ (ห้ามสร้างเลข TMP เองที่หน้าเว็บ)
 */
export interface JobEquipmentInput {
  equipmentId?: string;
  serial?: string;
  model?: string;
  note?: string;
}

/** เครื่องหนึ่งตัวในใบงาน (Phase 3 backend) */
export interface JobEquipmentLine {
  id: string;
  jobId: string;
  equipmentId: string;
  serial: string;
  model: string;
  hasRealSerial: boolean;
  note: string;
  linked: boolean;
  needsSerial: boolean;
  source: "JOB" | "QUEUE" | "MIGRATION";
  createdAt: string;
}

export type EquipmentFormValues = Pick<
  Equipment,
  | "serial"
  | "model"
  | "category"
  | "status"
  | "customerName"
  | "customerId"
  | "siteId"
  | "supplier"
  | "warehouse"
  | "location"
  | "address"
  | "district"
  | "province"
  | "postcode"
  | "zone"
  | "inboundDate"
  | "lat"
  | "lng"
  | "note"
> & { warranties: Warranty[] };

// ย้ายเครื่อง / อัปเดตที่อยู่ปัจจุบัน
export interface MoveEquipmentValues {
  location?: string;
  address?: string;
  district?: string;
  province?: string;
  postcode?: string;
  zone?: string;
  lat?: number;
  lng?: number;
  note?: string;
  refType?: "" | "CONTRACT" | "JOB" | "DOCUMENT";
  refId?: string;
}

export interface InventoryRow {
  category: string;
  model: string;
  total: number;
  inStock: number;
  rented: number;
  sold: number;
  repair: number;
  retired: number;
}

export interface EquipmentSummary {
  total: number;
  byStatus: Record<string, number>;
  warrantyExpiring: number;
  warrantyExpired: number;
}

// ---- แดชบอร์ด (Phase 8) — ค่าทุกตัว derive จาก backend ห้ามคำนวณซ้ำในหน้าเว็บ ----
export interface PmAttentionItem {
  id: string;
  serial: string;
  model: string;
  customerName: string;
  location: string;
  nextPmDate: string;
  pmStatus: PmStatus;
  /** ติดลบ = เกินกำหนดมาแล้วกี่วัน */
  pmDaysLeft: number;
  needsSerial: boolean;
}

export interface EquipmentDashboard {
  total: number;
  byPmStatus: Record<PmStatus, number>;
  byWarranty: Record<WarrantyStatus, number>;
  needsSerial: number;
  pmAttention: PmAttentionItem[];
  pmAttentionTotal: number;
}

export interface JobDashboard {
  total: number;
  open: number;
  closed: number;
  /** จำนวนงานที่นัดวันนี้ (ยังไม่ปิด) */
  today: number;
  /** ยังเปิดอยู่ + เลยวันนัดมาแล้ว */
  overdue: number;
  /** วันที่ที่เซิร์ฟเวอร์ใช้ตัดสิน (YYYY-MM-DD) */
  serverDate: string;
}

// Contracts — rental / hire-purchase / sale agreements.
export type ContractType = "RENTAL" | "HIRE_PURCHASE" | "SALE";
// DRAFT / EXPIRED เพิ่มรอบ Requirement.xlsx (CON-FN-007)
export type ContractStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "EXPIRED" | "CANCELLED";
export type ContractLifecycle = "DRAFT" | "ACTIVE" | "EXPIRING" | "EXPIRED" | "COMPLETED" | "CANCELLED";

export const CONTRACT_LIFECYCLE_LABEL: Record<ContractLifecycle, string> = {
  DRAFT: "ร่างสัญญา",
  ACTIVE: "ใช้งานอยู่",
  EXPIRING: "ใกล้หมดอายุ",
  EXPIRED: "หมดอายุ",
  COMPLETED: "ชำระครบแล้ว",
  CANCELLED: "ยกเลิก",
};
export type InstallmentStatus = "PENDING" | "PAID";

export interface Installment {
  no: number;
  dueDate: string;
  amount: number;
  status: InstallmentStatus;
  paidDate: string;
  receiptNo?: string; // เลขที่ใบเสร็จของงวดนี้ ("" = ยังไม่ได้ออก)
}

export interface Contract {
  id: string;
  contractNo: string;
  type: ContractType;
  status: ContractStatus;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  siteAddress: string;
  siteLat: number;
  siteLng: number;
  zone: string;
  siteAddressFull: string;
  serial: string;
  model: string;
  startDate: string;
  rentPerMonth: number;
  periodMonths: number;
  deposit: number;
  totalPrice: number;
  downPayment: number;
  installmentCount: number;
  installments: Installment[];
  note: string;
  createdAt: string;
  updatedAt: string;
  // derived
  endDate: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  paidCount: number;
  nextDueDate: string;
  // ---- เพิ่มรอบ Requirement.xlsx ----
  statusLabel?: string;
  lifecycle?: ContractLifecycle;
  lifecycleLabel?: string;
  daysToExpiry?: number;
  overdue?: boolean;
  renewCount?: number;
  history?: Array<{
    type: string;
    at: string;
    byName: string;
    fromStatus: string;
    toStatus: string;
    note: string;
    fromEndDate: string;
    toEndDate: string;
  }>;
}

export type ContractFormValues = Pick<
  Contract,
  | "type"
  | "customerName"
  | "customerPhone"
  | "customerAddress"
  | "siteAddress"
  | "siteLat"
  | "siteLng"
  | "zone"
  | "serial"
  | "model"
  | "startDate"
  | "rentPerMonth"
  | "periodMonths"
  | "deposit"
  | "totalPrice"
  | "downPayment"
  | "installmentCount"
  | "note"
>;

// Partner (คู่ค้า) — customers / suppliers.
export type PartnerType = "CUSTOMER" | "SUPPLIER" | "BOTH";

export interface Partner {
  id: string;
  name: string;
  type: PartnerType;
  phone: string;
  email: string;
  address: string;
  taxId: string;
  contactPerson: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export type PartnerFormValues = Pick<
  Partner,
  "name" | "type" | "phone" | "email" | "address" | "taxId" | "contactPerson" | "note"
>;

// Quotation (ใบเสนอราคา)
export type QuotationStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED";

export interface QuotationLine {
  no: number;
  description: string;
  qty: number;
  unitPrice: number;
  /** ส่วนลดของบรรทัดนี้ (บาท) */
  discount?: number;
}

export interface Quotation {
  id: string;
  quotationNo: string;
  status: QuotationStatus;
  partnerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  issueDate: string;
  validUntil: string;
  lines: QuotationLine[];
  vatRate: number;
  // ---- เพิ่มรอบ Requirement.xlsx (QUO-FN-005 / QUO-FN-011) ----
  discount?: number;
  externalCustomer?: boolean;
  grossTotal?: number;
  discountTotal?: number;
  note: string;
  createdAt: string;
  updatedAt: string;
  lineTotals: number[];
  subtotal: number;
  vatAmount: number;
  total: number;
}

export type QuotationFormValues = Pick<
  Quotation,
  | "partnerId"
  | "customerName"
  | "customerPhone"
  | "customerAddress"
  | "issueDate"
  | "validUntil"
  | "lines"
  | "vatRate"
  | "note"
> & { discount?: number; externalCustomer?: boolean };

export interface CalendarEvent {
  jobId: string;
  title: string;
  team: string;
  jobType: JobType;
  date: string;
  time: string;
  status: JobStatus;
}

export interface CalendarResponse {
  from?: string;
  to?: string;
  lanes: { team: string; events: CalendarEvent[] }[];
}

// Form payload — the editable subset of a Job.
export type JobFormValues = Pick<
  Job,
  | "jobType"
  | "jobSubType"
  | "jobName"
  | "technicianTeam"
  | "salesPerson"
  | "model"
  | "filterUnit"
  | "contactName"
  | "phone"
  | "jobDate"
  | "jobTime"
  | "mapLink"
  | "note"
>;

// ---- Job chat + work submissions (แชทส่งงาน) ----
export type SubmissionStatus = "PENDING" | "CONFIRMED" | "REJECTED";

export interface ChatMessage {
  msgId: string;
  jobId: string;
  userId: string;
  userName: string;
  role: string;
  text: string;
  isSubmission: boolean;
  system: boolean;
  createdAt: string;
}

export interface Submission {
  subId: string;
  jobId: string;
  msgId: string;
  submittedById: string;
  submittedBy: string;
  text: string;
  status: SubmissionStatus;
  reviewedBy: string;
  reviewedAt: string;
  reviewNote: string;
  createdAt: string;
  seen?: boolean; // ผู้เรียกดูอ่านห้องแชทงานนี้หลังการส่งงานแล้วหรือยัง
}

export interface ChatRead {
  jobId: string;
  userId: string;
  userName: string;
  lastReadAt: string;
}

export interface UnreadChat {
  jobId: string;
  count: number;
  lastFrom: string;
  lastText: string;
  lastAt: string;
}

// ห้องแชทงาน — สรุปห้องละแถวสำหรับหน้ารวมแชท
export interface ChatRoomSummary {
  jobId: string;
  jobName: string; // "" ถ้าไม่พบข้อมูลงาน
  jobStatus: JobStatus | "";
  technicianTeam: string;
  lastAt: string;
  lastFrom: string;
  lastText: string;
  lastSystem: boolean;
  msgCount: number;
  everRead: boolean; // เราเคยเปิดอ่านห้องนี้แล้วหรือยัง
  unread: boolean;
}

// ---- เอกสารการขาย (ใบเสร็จ / ใบกำกับ / ใบลดหนี้ / ใบส่งของ / สัญญา) ----
export type DocumentType =
  | "INVOICE"
  | "RECEIPT"
  | "TAX_INVOICE"
  | "CREDIT_NOTE"
  | "DELIVERY_NOTE"
  | "CONTRACT"
  | "WARRANTY_CARD";

export type DocumentStatus = "ISSUED" | "VOID";

export type PaymentMethod = "CASH" | "TRANSFER" | "CHEQUE" | "CARD" | "CREDIT" | "OTHER";

export interface DocumentLine {
  no: number;
  description: string;
  qty: number;
  unitPrice: number;
}

export interface SalesDocument {
  id: string;
  docNo: string;
  type: DocumentType;
  status: DocumentStatus;
  issueDate: string;
  contractId: string;
  contractNo: string;
  quotationId: string;
  quotationNo: string;
  jobId: string;
  installmentNo: number;
  refDocId: string;
  refDocNo: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerTaxId: string;
  serial: string;
  model: string;
  lines: DocumentLine[];
  discount: number;
  vatRate: number;
  paymentMethod: PaymentMethod;
  paymentRef: string;
  note: string;
  voidReason: string;
  voidedAt: string;
  voidedById: string;
  voidedByName: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdByName: string;
  // derived
  typeLabel: string;
  statusLabel: string;
  lineTotals: number[];
  subtotal: number;
  vatAmount: number;
  total: number;
  creditedAmount: number;
  netTotal: number;
}

export interface DocumentFormValues {
  type: DocumentType;
  issueDate?: string;
  contractId?: string;
  quotationId?: string;
  jobId?: string;
  installmentNo?: number;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerTaxId?: string;
  serial?: string;
  model?: string;
  lines: { description: string; qty: number; unitPrice: number }[];
  discount?: number;
  vatRate?: number;
  paymentMethod?: PaymentMethod;
  paymentRef?: string;
  note?: string;
}

export interface IssueReceiptValues {
  contractId: string;
  installmentNo: number;
  type?: "RECEIPT" | "TAX_INVOICE";
  issueDate?: string;
  paymentMethod?: PaymentMethod;
  paymentRef?: string;
  vatRate?: number;
  customerTaxId?: string;
  note?: string;
}

// ---- คิวจัดส่ง / คิวซ่อม ----
export type SlotStatus = "OPEN" | "BLOCKED";

export interface Slot {
  id: string;
  techId: string;
  techName: string;
  date: string;
  start: string;
  end: string;
  zone: string;
  capacity: number;
  status: SlotStatus;
  note: string;
  booked: number;
  available: number;
  createdAt: string;
  updatedAt: string;
}

export interface SuggestedSlot extends Slot {
  score: number;
  daysAhead: number;
  detourKm: number;
  zoneMatch: boolean;
  reason: string;
}

export type BookingType = "DELIVERY" | "REPAIR" | "INSTALL" | "PM" | "PICKUP";
export type BookingStatus = "BOOKED" | "ON_THE_WAY" | "ARRIVED" | "DONE" | "CANCELLED";

export interface Booking {
  id: string;
  bookingNo: string;
  type: BookingType;
  status: BookingStatus;
  slotId: string;
  techId: string;
  techName: string;
  date: string;
  start: string;
  end: string;
  zone: string;
  customerName: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  serial: string;
  contractId: string;
  contractNo: string;
  jobId: string;
  note: string;
  startedAt: string;
  arrivedAt: string;
  doneAt: string;
  cancelReason: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdByName: string;
  typeLabel: string;
  statusLabel: string;
}

export interface BookingFormValues {
  slotId: string;
  type: BookingType;
  customerName: string;
  phone?: string;
  address?: string;
  lat?: number;
  lng?: number;
  serial?: string;
  contractId?: string;
  contractNo?: string;
  note?: string;
  createJob?: boolean;
}

// ---- ติดตามตำแหน่ง ----
export interface TechnicianPosition {
  userId: string;
  userName: string;
  lat: number;
  lng: number;
  at: string;
  minutesAgo: number;
  bookingId: string;
  jobId: string;
  destination: {
    bookingNo: string;
    customerName: string;
    address: string;
    lat: number;
    lng: number;
    distanceKm: number;
    etaMinutes: number;
    status: string;
  } | null;
}

export interface BookingEta {
  bookingNo: string;
  available: boolean;
  message: string;
  techName?: string;
  status?: BookingStatus;
  lat?: number;
  lng?: number;
  at?: string;
  minutesAgo?: number;
  distanceKm?: number;
  etaMinutes?: number;
  arrivedAt?: string;
}

export interface GeofenceResult {
  serial: string;
  contractNo: string;
  matched: boolean;
  distanceKm: number;
  distanceM: number;
  radiusM: number;
  checkedAt: string;
  siteLat: number;
  siteLng: number;
  siteAddress: string;
  checkedLat: number;
  checkedLng: number;
  message: string;
}

// ---- โปรไฟล์ประกันสำเร็จรูป (ตั้งค่าในข้อมูลพื้นฐาน) ----
export interface WarrantyPresetItem {
  provider: WarrantyProvider;
  providerName: string;
  months: number;
  coverage: string;
}

export interface WarrantyPreset {
  id: string;
  name: string;
  items: WarrantyPresetItem[];
  isDefault: boolean;
  note: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface WarrantyPresetFormValues {
  name: string;
  items: WarrantyPresetItem[];
  isDefault?: boolean;
  note?: string;
}


// ---------------------------------------------------------------------------
// สาขา / ร้าน / สถานที่ติดตั้งของลูกค้า (ระบบฐานข้อมูลลูกค้า)
// ---------------------------------------------------------------------------
export interface CustomerSite {
  id: string;
  partnerId: string;
  branchNo: string;
  storeName: string;
  contactPerson: string;
  phone: string;
  address: string;
  district: string;
  province: string;
  postcode: string;
  zone: string;
  lat: number;
  lng: number;
  active: boolean;
  note: string;
  addressFull: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export type CustomerSiteFormValues = Pick<
  CustomerSite,
  | "branchNo"
  | "storeName"
  | "contactPerson"
  | "phone"
  | "address"
  | "district"
  | "province"
  | "postcode"
  | "zone"
  | "lat"
  | "lng"
  | "active"
  | "note"
>;

export interface CustomerSearchResult {
  query: string;
  customers: Array<{
    id: string;
    name: string;
    type: PartnerType;
    phone: string;
    matchedBy: "customer" | "related";
    /**
     * QA BUG-014 — เหตุผลจริงที่แถวนี้ถูกดึงมา (backend เพิ่มให้ใหม่)
     * เดิมคอลัมน์ "พบจาก" ตัดสินจาก matchedBy อย่างเดียว ค้นด้วยเบอร์โทร
     * จึงรายงานว่า "ชื่อลูกค้า" ซึ่งไม่จริง · optional ไว้เผื่อ backend รุ่นเก่า
     */
    matchedField?: string;
    matchedLabel?: string;
  }>;
  sites: Array<{
    id: string;
    partnerId: string;
    label: string;
    branchNo: string;
    storeName: string;
    phone: string;
    addressFull: string;
    active: boolean;
  }>;
  equipment: Array<{
    id: string;
    serial: string;
    model: string;
    status: EquipmentStatus;
    customerId: string;
    customerName: string;
    siteId: string;
    siteLabel: string;
    needsSerial: boolean;
  }>;
  counts: { customers: number; sites: number; equipment: number };
}

export interface HoldingPeriod {
  customerName: string;
  partnerId: string;
  siteId: string;
  siteLabel: string;
  from: string;
  to: string;
  sourceEventId: string;
  sourceType: string;
}

// ---------------------------------------------------------------------------
// Audit log (NFR Audit Log / USR-FN-007)
// ---------------------------------------------------------------------------
export type AuditAction =
  | "LOGIN"
  | "LOGIN_FAILED"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "STATUS"
  | "CLOSE"
  | "APPROVE"
  | "REJECT"
  | "IMPORT"
  | "EXPORT";

export type AuditEntity =
  | "auth"
  | "users"
  | "jobs"
  | "equipment"
  | "customer_sites"
  | "partners"
  | "contracts"
  | "quotations"
  | "documents"
  | "pm_schedules"
  | "parts"
  | "stock"
  | "tech_bills"
  | "master";

export interface AuditLog {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: AuditAction;
  actionLabel: string;
  entity: AuditEntity;
  entityId: string;
  entityLabel: string;
  changes: Array<{ field: string; before: string; after: string }>;
  summary: string;
  ip: string;
}

// ---------------------------------------------------------------------------
// หัวเอกสารบริษัท
// ---------------------------------------------------------------------------
export interface CompanyProfile {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  logoDataUrl: string;
  approved: boolean;
  approvedBy: string;
  approvedAt: string;
  note: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// ผลการนำเข้า Excel (ตรวจที่เซิร์ฟเวอร์)
// ---------------------------------------------------------------------------
export interface ImportReport {
  dryRun: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string; field?: string; key?: string }>;
}


// ---------------------------------------------------------------------------
// ขั้นของใบงาน + คำขอเลื่อนนัด (เพิ่มรอบ Requirement.xlsx)
// ---------------------------------------------------------------------------
export type JobStage =
  | "OPEN"
  | "ACKNOWLEDGED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "CONFIRMED"
  | "CANCELLED";

/*
 * ป้ายของ "ขั้นปฏิบัติงาน" (stage) — คนละแกนกับ "สถานะเอกสาร" (status)
 * QA ข้อสังเกตที่ AC-JOBD-01: ทั้งสองแกนเคยใช้คำว่า "เปิดงาน" เหมือนกัน
 * ทำให้หน้าจอเดียวมีคำว่า "เปิดงาน" สองที่ที่หมายความคนละเรื่อง
 */
export const JOB_STAGE_LABEL: Record<JobStage, string> = {
  OPEN: "ยังไม่เริ่มงาน",
  ACKNOWLEDGED: "ช่างรับทราบแล้ว",
  IN_PROGRESS: "กำลังดำเนินการ",
  SUBMITTED: "ช่างส่งตรวจ — รอ Admin ยืนยัน",
  CONFIRMED: "Admin ยืนยันปิดงานแล้ว",
  CANCELLED: "ยกเลิก",
};

export type RescheduleReason = "LATE" | "IN_PROGRESS" | "POSTPONE";
export type RescheduleStatus = "PENDING" | "APPROVED" | "REJECTED";

export const RESCHEDULE_REASON_LABEL: Record<RescheduleReason, string> = {
  LATE: "เข้างานไม่ทันเวลานัด",
  IN_PROGRESS: "กำลังดำเนินการ ขอเวลาเพิ่ม",
  POSTPONE: "ขอเลื่อนวันนัด",
};

export interface RescheduleRequest {
  id: string;
  reason: RescheduleReason;
  note: string;
  requestedDate: string;
  requestedTime: string;
  requestedById: string;
  requestedBy: string;
  requestedAt: string;
  status: RescheduleStatus;
  decidedById: string;
  decidedBy: string;
  decidedAt: string;
  decisionNote: string;
}

// ---------------------------------------------------------------------------
// ตาราง PM รายเดือน
// ---------------------------------------------------------------------------
export type PmPlanStatus = "DRAFT" | "APPROVED" | "SENT" | "CLOSED" | "CANCELLED";
export type PmItemStatus = "PLANNED" | "JOB_CREATED" | "DONE" | "SKIPPED";

export const PM_PLAN_STATUS_LABEL: Record<PmPlanStatus, string> = {
  DRAFT: "ร่าง",
  APPROVED: "อนุมัติแล้ว",
  SENT: "ส่งให้ช่างแล้ว",
  CLOSED: "ปิดรอบเดือน",
  CANCELLED: "ยกเลิก",
};

export const PM_ITEM_STATUS_LABEL: Record<PmItemStatus, string> = {
  PLANNED: "อยู่ในแผน",
  JOB_CREATED: "เปิดใบงานแล้ว",
  DONE: "ทำ PM แล้ว",
  SKIPPED: "ตัดออกจากแผน",
};

export interface PmPlanItem {
  id: string;
  equipmentId: string;
  serial: string;
  model: string;
  customerId: string;
  customerName: string;
  siteId: string;
  siteLabel: string;
  zone: string;
  dueDate: string;
  plannedDate: string;
  plannedTime: string;
  contractNo: string;
  pmPackage: string;
  status: PmItemStatus;
  jobId: string;
  jobCreatedAt: string;
  skipReason: string;
  note: string;
  addedBy: string;
  addedAt: string;
}

export interface PmPlan {
  id: string;
  month: string;
  technicianId: string;
  technicianName: string;
  team: string;
  status: PmPlanStatus;
  statusLabel: string;
  items: PmPlanItem[];
  counts: Record<PmItemStatus, number>;
  total: number;
  visibleToTechnician: boolean;
  approvedBy: string;
  approvedAt: string;
  sentAt: string;
  cancelReason: string;
  note: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PmCandidate {
  equipmentId: string;
  serial: string;
  model: string;
  customerId: string;
  customerName: string;
  siteId: string;
  siteLabel: string;
  zone: string;
  dueDate: string;
  pmStatus: PmStatus;
  pmDaysLeft: number;
  pmPackage: string;
  pmIntervalMonths: number;
  lastPmDate: string;
  contractNo: string;
}

// ---------------------------------------------------------------------------
// การแจ้งเตือนของระบบ
// ---------------------------------------------------------------------------
export type NotificationKind =
  | "JOB_CLOSE_OVERDUE"
  | "JOB_RESCHEDULE_REQUEST"
  | "PM_DUE_SOON"
  | "PM_DUE"
  | "PM_OVERDUE"
  | "CONTRACT_EXPIRING"
  | "CONTRACT_OVERDUE_PAYMENT"
  | "WARRANTY_EXPIRING"
  | "STOCK_BELOW_REORDER";

export type NotificationSeverity = "INFO" | "WARNING" | "URGENT";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  kindLabel: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  url: string;
  entity: string;
  entityId: string;
  createdAt: string;
  read: boolean;
}


// ---------------------------------------------------------------------------
// ระบบสต๊อกอะไหล่
// ---------------------------------------------------------------------------
export type StockLocationType = "MAIN" | "TECH";
export type StockMove = "RECEIVE" | "ISSUE" | "TRANSFER" | "RETURN" | "ADJUST";
export type ValuationMethod = "" | "STANDARD" | "MOVING_AVERAGE" | "LATEST_COST";

export const STOCK_MOVE_LABEL: Record<StockMove, string> = {
  RECEIVE: "รับเข้า",
  ISSUE: "เบิกจ่าย",
  TRANSFER: "โอนย้าย",
  RETURN: "คืนอะไหล่",
  ADJUST: "ปรับยอด",
};

export interface Part {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  sellPrice: number;
  standardCost: number;
  reorderPoint: number;
  active: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockLocation {
  id: string;
  code: string;
  name: string;
  type: StockLocationType;
  typeLabel: string;
  ownerUserId: string;
  ownerName: string;
  active: boolean;
  note: string;
}

export interface StockTransaction {
  id: string;
  partId: string;
  partCode: string;
  partName: string;
  move: StockMove;
  moveLabel: string;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  qty: number;
  unitCost: number;
  jobId: string;
  note: string;
  byName: string;
  at: string;
}

export interface PartBalanceRow {
  partId: string;
  code: string;
  name: string;
  unit: string;
  reorderPoint: number;
  byLocation: Array<{ locationId: string; locationName: string; type: StockLocationType; qty: number }>;
  totalQty: number;
  belowReorder: boolean;
  unitCost: number | null;
  totalValue: number | null;
}

export interface StockBalancesResponse {
  items: PartBalanceRow[];
  count: number;
  belowReorder: number;
  valuation: { method: ValuationMethod; methodLabel: string; reason: string; totalValue: number | null };
  byLocation: Array<{ locationId: string; locationName: string; qty: number; value: number | null }>;
}

// ---------------------------------------------------------------------------
// ระบบวางบิลช่าง
// ---------------------------------------------------------------------------
export type BillStatus = "DRAFT" | "SUBMITTED" | "RETURNED" | "APPROVED" | "PAID" | "CANCELLED";

export const BILL_STATUS_LABEL: Record<BillStatus, string> = {
  DRAFT: "ร่าง",
  SUBMITTED: "ส่งตรวจแล้ว",
  RETURNED: "ส่งกลับให้แก้ไข",
  APPROVED: "อนุมัติแล้ว",
  PAID: "จ่ายแล้ว",
  CANCELLED: "ยกเลิก",
};

export interface BillJobItem {
  jobId: string;
  jobName: string;
  jobType: string;
  jobDate: string;
  customerName: string;
  laborAmount: number;
  note: string;
}

export interface BillDayItem {
  date: string;
  distanceKm: number;
  travelAmount: number;
  note: string;
}

export interface BillExpenseItem {
  id: string;
  label: string;
  amount: number;
  attachment: string;
  note: string;
}

export interface TechBill {
  id: string;
  billNo: string;
  technicianId: string;
  technicianName: string;
  periodFrom: string;
  periodTo: string;
  status: BillStatus;
  statusLabel: string;
  items: BillJobItem[];
  days: BillDayItem[];
  expenses: BillExpenseItem[];
  note: string;
  reviewedBy: string;
  reviewNote: string;
  approvedBy: string;
  approvedAt: string;
  cancelReason: string;
  editable: boolean;
  totals: {
    laborTotal: number;
    travelTotal: number;
    expenseTotal: number;
    grandTotal: number;
    jobCount: number;
    dayCount: number;
    distanceTotalKm: number;
  };
  datesMissingTravel?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BillableJob {
  jobId: string;
  jobName: string;
  jobType: string;
  jobDate: string;
  customerName: string;
  alreadyBilled: boolean;
}

export interface BillSummaryRow {
  technicianId: string;
  technicianName: string;
  billCount: number;
  jobCount: number;
  laborTotal: number;
  travelTotal: number;
  expenseTotal: number;
  grandTotal: number;
  byStatus: Record<string, number>;
}

// ---------------------------------------------------------------------------
// รายรับ/รายจ่ายรายเครื่อง
// ---------------------------------------------------------------------------
export interface EquipmentFinance {
  equipmentId: string;
  serial: string;
  lines: Array<{
    source: string;
    sourceLabel: string;
    ref: string;
    date: string;
    description: string;
    revenue: number;
    cost: number;
  }>;
  revenueTotal: number;
  costTotal: number;
  net: number;
  bySource: Array<{ source: string; label: string; revenue: number; cost: number }>;
  excluded: Array<{ source: string; reason: string }>;
}


// ---------------------------------------------------------------------------
// สรุปผลแดชบอร์ด (DASH-FN-001..010)
// ---------------------------------------------------------------------------
export interface DashboardSummary {
  filter: { from?: string; to?: string; jobType?: string; team?: string; technicianId?: string };
  serverDate: string;
  jobs: {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    byTechnicianTeam: Record<string, number>;
    revenueTotal: number;
    costTotal: number;
    net: number;
  };
  pm: {
    done: number;
    openJobs: number;
    dueSoon: number;
    overdue: number;
    planItems: Record<string, number>;
  };
  stock: {
    parts: number;
    totalQty: number;
    belowReorder: number;
    valuationMethod: string;
    totalValue: number | null;
    valuationNote: string;
  } | null;
  contracts: {
    total: number;
    active: number;
    expiring: number;
    expired: number;
    overdue: number;
  } | null;
  /** ใช้กระทบยอดกับหน้ารายการต้นทาง */
  sources: { jobsScanned: number; jobsMatchedFilter: number; equipmentScanned: number };
}
