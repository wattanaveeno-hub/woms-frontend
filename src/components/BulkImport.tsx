"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { downloadTemplate, readRows } from "@/lib/xlsx";

export type RowResult<T> = { ok: true; value: T } | { ok: false; error: string };

interface Props<T> {
  label: string; // entity name e.g. "เครื่อง"
  templateName: string; // file name e.g. "equipment-template.xlsx"
  headers: string[];
  example: (string | number)[];
  toValues: (row: Record<string, string>) => RowResult<T>;
  create: (v: T) => Promise<unknown>;
  perm: string;
  onDone?: () => void;
}

export default function BulkImport<T>({
  label,
  templateName,
  headers,
  example,
  toValues,
  create,
  perm,
  onDone,
}: Props<T>) {
  const { has } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; fail: { row: number; error: string }[] } | null>(null);

  if (!has(perm)) return null;

  const template = async () => {
    try {
      await downloadTemplate(templateName, headers, example);
    } catch {
      toast.error("โหลด template ไม่สำเร็จ (ต้องต่ออินเทอร์เน็ต)");
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const rows = await readRows(file);
      if (rows.length === 0) {
        toast.error("ไม่พบข้อมูลในไฟล์");
        setBusy(false);
        return;
      }
      let ok = 0;
      const fail: { row: number; error: string }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const parsed = toValues(rows[i]);
        if (!parsed.ok) {
          fail.push({ row: i + 2, error: parsed.error }); // +2: header row + 1-index
          continue;
        }
        try {
          await create(parsed.value);
          ok++;
        } catch (err: any) {
          fail.push({ row: i + 2, error: err?.message ?? "บันทึกไม่สำเร็จ" });
        }
      }
      setResult({ ok, fail });
      if (ok > 0) toast.success(`นำเข้าสำเร็จ ${ok} รายการ`);
      if (fail.length > 0) toast.error(`ไม่สำเร็จ ${fail.length} แถว`);
      if (ok > 0) onDone?.();
    } catch {
      toast.error("อ่านไฟล์ Excel ไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="import">
      <button className="btn" onClick={() => setOpen((o) => !o)}>
        ⭱ นำเข้า Excel
      </button>
      {open ? (
        <div className="import-panel">
          <div className="import-row">
            <span>1. ดาวน์โหลดเทมเพลตแล้วกรอกข้อมูล</span>
            <button className="btn btn-sm" onClick={template}>ดาวน์โหลด Template</button>
          </div>
          <div className="import-row">
            <span>2. อัปโหลดไฟล์ที่กรอกแล้ว (.xlsx)</span>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={busy}
              onChange={onFile}
            />
          </div>
          {busy ? <div className="import-status">กำลังนำเข้า…</div> : null}
          {result ? (
            <div className="import-result">
              <div className="import-ok">✓ สำเร็จ {result.ok} รายการ</div>
              {result.fail.length > 0 ? (
                <div className="import-fail">
                  <div>✗ ไม่สำเร็จ {result.fail.length} แถว:</div>
                  <ul>
                    {result.fail.slice(0, 12).map((f, i) => (
                      <li key={i}>แถว {f.row}: {f.error}</li>
                    ))}
                    {result.fail.length > 12 ? <li>… และอีก {result.fail.length - 12} แถว</li> : null}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
