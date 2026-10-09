// Round 8 — API เพิ่มเติมของโมดูลสัญญาและใบเสนอราคา (แยกไฟล์เพื่อไม่แก้ api.ts กลาง)
import { request } from "@/lib/api";
import type { Contract, ContractStatus, ContractType, Job, Quotation } from "@/lib/types";

export type ContractPaymentState = "ON_TIME" | "OVERDUE" | "NONE";

export interface ContractFileMeta {
  id: string;
  contractId: string;
  contractNo: string;
  kind: "DOCUMENT" | "PAYMENT_EVIDENCE";
  kindLabel: string;
  installmentNo: number;
  name: string;
  mimeType: string;
  size: number;
  note: string;
  uploadedById: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface ContractChainItem {
  id: string;
  contractNo: string;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  lifecycle: string;
  lifecycleLabel: string;
}

export interface EquipmentContracts {
  equipment: { id: string; serial: string; model: string; status: string };
  active: Contract | null;
  contracts: Contract[];
}

export interface ContractListParams {
  type?: ContractType;
  status?: ContractStatus;
  payment?: ContractPaymentState;
  /** สถานะที่ผู้ใช้เห็น รวม "ใกล้หมดอายุ" (EXPIRING) ที่คำนวณจากวันสิ้นสุด (CON-02) */
  lifecycle?: string;
  /** DEF-07 — มีงวดค้างครบกำหนดในเดือนนี้ (เวลาไทย) */
  due?: "THIS_MONTH";
  q?: string;
  partnerId?: string;
}

export function contractListQuery(params: ContractListParams): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
  return qs.toString() ? `?${qs}` : "";
}

const enc = encodeURIComponent;

/** ขนาดไฟล์สูงสุด (ตรงกับ backend domain/contractFile.ts) */
export const MAX_EVIDENCE_BYTES = 1_500_000;
export const MAX_DOCUMENT_BYTES = 6_000_000;
export const ACCEPT_FILE_TYPES = "image/png,image/jpeg,image/webp,application/pdf";

/** อ่านไฟล์เป็น data URL เต็ม (backend ตรวจชนิด/ขนาดซ้ำเสมอ) */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    r.readAsDataURL(file);
  });
}

export const contractQuoApi = {
  listContracts: (params: ContractListParams = {}) =>
    request<{ items: Contract[]; count: number }>(`/api/contracts${contractListQuery(params)}`),

  payInstallment: (
    id: string,
    body: {
      no: number;
      paid: boolean;
      updatedAt: string;
      paidDate?: string;
      paymentRef?: string;
      evidence?: { name: string; dataUrl: string } | null;
    }
  ) => request<Contract>(`/api/contracts/${enc(id)}/pay`, { method: "POST", body: JSON.stringify(body) }),

  listFiles: (id: string) => request<{ items: ContractFileMeta[]; count: number }>(`/api/contracts/${enc(id)}/files`),

  uploadFile: (id: string, body: { name: string; dataUrl: string; note?: string }) =>
    request<ContractFileMeta>(`/api/contracts/${enc(id)}/files`, { method: "POST", body: JSON.stringify(body) }),

  fileUrl: (id: string, fileId: string) => `/api/contracts/${enc(id)}/files/${enc(fileId)}`,

  renew: (
    id: string,
    body: { months: number; contractNo?: string; startDate?: string; rentPerMonth?: number; note?: string; updatedAt: string }
  ) => request<Contract>(`/api/contracts/${enc(id)}/renew`, { method: "POST", body: JSON.stringify(body) }),

  chain: (id: string) => request<{ items: ContractChainItem[]; currentId: string }>(`/api/contracts/${enc(id)}/chain`),

  byEquipment: (equipmentId: string) => request<EquipmentContracts>(`/api/contracts/by-equipment/${enc(equipmentId)}`),

  openJobFromQuotation: (
    id: string,
    body: {
      jobType: string;
      jobSubType?: string;
      jobName?: string;
      technicianTeam: string;
      technicianIds?: string[];
      jobDate: string;
      jobTime?: string;
      note?: string;
      installAddress?: string;
    }
  ) =>
    request<{ quotation: Quotation; job: Job & { equipment: unknown[] } }>(`/api/quotations/${enc(id)}/open-job`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

/** QUO-02 / AT-10 — ข้อความรายการบนเอกสารถึงลูกค้า: อะไหล่ใช้ชื่อ ไม่ใช้รหัส (ตรงกับ backend) */
export function quotationLineText(
  l: { description: string; partId?: string; partName?: string },
  partCode = ""
): string {
  const scrub = (t: string) => {
    let out = (t ?? "").trim();
    const code = partCode.trim();
    if (code) out = out.split(code).join("").replace(/\s{2,}/g, " ").replace(/^[\s\-–:·,]+|[\s\-–:·,]+$/g, "").trim();
    return out;
  };
  const desc = scrub(l.description ?? "");
  if (l.partId && l.partName) {
    const name = scrub(l.partName);
    return desc && desc !== name ? `${name} — ${desc}` : name;
  }
  return desc;
}

export const QUOTATION_LINE_KIND_LABEL: Record<string, string> = {
  SERVICE: "ค่าบริการ",
  PART: "อะไหล่",
  PM_PACKAGE: "Package PM",
  OTHER: "อื่น ๆ",
};
