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
}

export interface CloseEvidence {
  signerName: string;
  closeNote: string;
  signature: string;
  photos: string[];
}

// Master data: editable lookup lists that feed the job-form dropdowns.
export type MasterKind = "team" | "model";

export interface MasterItem {
  id: string;
  kind: MasterKind;
  value: string;
}

// Equipment (stock unit) — serial-tracked machine with warranty.
export type EquipmentStatus = "IN_STOCK" | "RENTED" | "SOLD" | "REPAIR" | "RETIRED";
export type WarrantyStatus = "NONE" | "ACTIVE" | "EXPIRING" | "EXPIRED";

export interface Equipment {
  id: string;
  serial: string;
  model: string;
  category: string;
  status: EquipmentStatus;
  customerName: string;
  location: string;
  inboundDate: string;
  lat: number;
  lng: number;
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
  | "inboundDate"
  | "lat"
  | "lng"
  | "supplierWarrantyStart"
  | "supplierWarrantyMonths"
  | "customerWarrantyStart"
  | "customerWarrantyMonths"
  | "note"
>;

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
}

export interface Contract {
  id: string;
  contractNo: string;
  type: ContractType;
  status: ContractStatus;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
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
}
