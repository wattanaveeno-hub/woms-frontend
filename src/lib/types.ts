export type JobType = "INSTALL" | "PM" | "CM" | "PM_CM" | "REMOVE";
export type JobSubType = "PICKUP_REPAIR" | "RETURN" | "";
export type JobStatus = "OPEN" | "CLOSED";

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

export interface Options {
  jobTypes: { value: string; label: string }[];
  jobSubTypes: { value: string; label: string }[];
  teams: string[];
  models: string[];
  zones: string[];
}

export interface CloseEvidence {
  signerName: string;
  closeNote: string;
  signature: string;
  photos: string[];
}

// Master data: editable lookup lists that feed the job-form dropdowns.
export type MasterKind = "team" | "model" | "zone";

export interface MasterItem {
  id: string;
  kind: MasterKind;
  value: string;
}

// Equipment (stock unit) — serial-tracked machine with warranty.
export type EquipmentStatus = "IN_STOCK" | "RENTED" | "SOLD" | "REPAIR" | "RETIRED";
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
  | "DELETE";

export interface EquipmentEvent {
  id: string;
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
  refType: "" | "CONTRACT" | "JOB" | "DOCUMENT";
  refId: string;
  note: string;
}

export interface Equipment {
  id: string;
  serial: string;
  model: string;
  category: string;
  status: EquipmentStatus;
  customerName: string;
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
  createdAt: string;
  updatedAt: string;
}

export type EquipmentFormValues = Pick<
  Equipment,
  | "serial"
  | "model"
  | "category"
  | "status"
  | "customerName"
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

// Contracts — rental / hire-purchase / sale agreements.
export type ContractType = "RENTAL" | "HIRE_PURCHASE" | "SALE";
export type ContractStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";
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
export type QuotationStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";

export interface QuotationLine {
  no: number;
  description: string;
  qty: number;
  unitPrice: number;
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
  "partnerId" | "customerName" | "customerPhone" | "customerAddress" | "issueDate" | "validUntil" | "lines" | "vatRate" | "note"
>;

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
