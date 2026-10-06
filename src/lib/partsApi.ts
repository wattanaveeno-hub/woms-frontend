// ---------------------------------------------------------------------------
// Round 8 — ข้อมูลและประวัติอะไหล่ (PART-01..03 / BR-04)
// ---------------------------------------------------------------------------
// การเพิ่ม/แก้ master อะไหล่ยังใช้ /api/stock/parts (api.createPart / api.patchPart)
// ที่นี่คือฝั่งประวัติ + การบันทึกอะไหล่รายเครื่องในใบงาน
import { downloadFile, request } from "./api";
import type { Part } from "./types";

export interface PartProfile extends Part {
  image: string;
  compatibleModels: string[];
}

export interface PartListRow extends PartProfile {
  totalUsedQty: number;
  machineCount: number;
}

export interface JobPartUse {
  id: string;
  partId: string;
  partCode: string;
  partName: string;
  qty: number;
  unit: string;
  unitCost: number;
  note: string;
  recordedById: string;
  recordedBy: string;
  recordedAt: string;
}

export interface JobLineParts {
  lineId: string;
  jobId: string;
  equipmentId: string;
  serial: string;
  model: string;
  partsUsed: JobPartUse[];
  partsCost: number;
}

export interface PartPurchaseEntry {
  jobId: string;
  lineId: string;
  equipmentId: string;
  serial: string;
  model: string;
  useId: string;
  qty: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  note: string;
  recordedBy: string;
  recordedAt: string;
  jobDate: string;
  jobType: string;
  jobStatus: string;
}

export interface PartSaleEntry {
  quotationId: string;
  quotationNo: string;
  status: string;
  statusLabel: string;
  counted: boolean;
  issueDate: string;
  customerName: string;
  equipmentId: string;
  serial: string;
  description: string;
  qty: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface PartMachineUsage {
  equipmentId: string;
  serial: string;
  model: string;
  totalQty: number;
  totalCost: number;
  jobIds: string[];
  lastUsedAt: string;
}

export interface PartUsageSummary {
  totalQty: number;
  totalCost: number;
  machineCount: number;
  jobCount: number;
  lastUsedAt: string;
  soldQty: number;
  soldRevenue: number;
}

export interface PartDetail {
  part: PartProfile;
  purchases: PartPurchaseEntry[];
  sales: PartSaleEntry[];
  salesVisible: boolean;
  byMachine: PartMachineUsage[];
  summary: PartUsageSummary;
}

export interface PartFormValues {
  code: string;
  name: string;
  unit: string;
  compatibleModels: string[];
  image: string;
  note: string;
  active: boolean;
}

const enc = encodeURIComponent;

export const partsApi = {
  list: (q = "") =>
    request<{ items: PartListRow[]; count: number }>(`/api/parts${q ? `?q=${enc(q)}` : ""}`),
  models: () => request<{ items: string[]; count: number }>("/api/parts/models"),
  detail: (id: string) => request<PartDetail>(`/api/parts/${enc(id)}`),
  exportXlsx: () => downloadFile("/api/parts/export.xlsx", "woms-parts.xlsx"),
  create: (values: Partial<PartFormValues>) =>
    request<PartProfile>("/api/stock/parts", { method: "POST", body: JSON.stringify(values) }),
  patch: (id: string, values: Partial<PartFormValues>, updatedAt: string) =>
    request<PartProfile>(`/api/stock/parts/${enc(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...values, updatedAt }),
    }),

  jobLines: (jobId: string) =>
    request<{ items: JobLineParts[]; count: number; totalCost: number }>(`/api/jobs/${enc(jobId)}/equipment-parts`),
  addUse: (jobId: string, lineId: string, values: { partId: string; qty: number; unit?: string; unitCost: number; note?: string }) =>
    request<{ line: JobLineParts; use: JobPartUse }>(`/api/jobs/${enc(jobId)}/equipment/${enc(lineId)}/parts`, {
      method: "POST",
      body: JSON.stringify(values),
    }),
  updateUse: (
    jobId: string,
    lineId: string,
    useId: string,
    values: Partial<{ qty: number; unit: string; unitCost: number; note: string }>
  ) =>
    request<{ line: JobLineParts; use: JobPartUse }>(
      `/api/jobs/${enc(jobId)}/equipment/${enc(lineId)}/parts/${enc(useId)}`,
      { method: "PUT", body: JSON.stringify(values) }
    ),
  removeUse: (jobId: string, lineId: string, useId: string) =>
    request<{ line: JobLineParts; removed: JobPartUse }>(
      `/api/jobs/${enc(jobId)}/equipment/${enc(lineId)}/parts/${enc(useId)}`,
      { method: "DELETE" }
    ),
};

/** ย่อรูปก่อนเก็บเป็น data URL (ขนาดสูงสุดของ backend ≈ 1 MB) */
export function compressPartImage(file: File, maxDim = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("ประมวลผลรูปไม่สำเร็จ"));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("โหลดรูปไม่สำเร็จ"));
    };
    img.src = url;
  });
}

export const baht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
