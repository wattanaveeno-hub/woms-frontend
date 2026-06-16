"use client";

// Dependency-free Excel support: SheetJS loaded from CDN at runtime.
const CDN = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";

export function loadXLSX(): Promise<any> {
  const w = window as any;
  if (w.XLSX) return Promise.resolve(w.XLSX);
  return new Promise((resolve, reject) => {
    const existing = document.getElementById("sheetjs") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve((window as any).XLSX));
      existing.addEventListener("error", () => reject(new Error("LOAD_FAIL")));
      if ((window as any).XLSX) resolve((window as any).XLSX);
      return;
    }
    const s = document.createElement("script");
    s.id = "sheetjs";
    s.src = CDN;
    s.async = true;
    s.onload = () => resolve((window as any).XLSX);
    s.onerror = () => reject(new Error("LOAD_FAIL"));
    document.head.appendChild(s);
  });
}

export async function downloadTemplate(
  filename: string,
  headers: string[],
  example: (string | number)[]
): Promise<void> {
  const XLSX = await loadXLSX();
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, filename);
}

export async function readRows(file: File): Promise<Record<string, string>[]> {
  const XLSX = await loadXLSX();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, {
    raw: false,
    defval: "",
    dateNF: "yyyy-mm-dd",
  });
  // normalise: trim keys + string values
  return rows.map((r) => {
    const out: Record<string, string> = {};
    for (const k of Object.keys(r)) out[String(k).trim()] = String(r[k] ?? "").trim();
    return out;
  });
}

// helpers for cell parsing
export const num = (s: string): number => {
  if (!s) return 0;
  const n = Number(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};
