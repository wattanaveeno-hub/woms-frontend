"use client";

// ---------------------------------------------------------------------------
// นำเข้า Excel โดยให้ "เซิร์ฟเวอร์" เป็นผู้ตรวจ
// ---------------------------------------------------------------------------
// ที่มา: MDM-FN-007 "นำเข้าข้อมูลเครื่องจักรจากไฟล์ Excel ได้"
//        NFR Import/Export "…แจ้งรายการข้อมูลที่นำเข้าไม่สำเร็จพร้อมเหตุผลได้"
//
// ทำไมไม่ใช้ตัวเดิม (BulkImport): ตัวเดิมแปลงไฟล์ในเบราว์เซอร์แล้วยิง POST ทีละแถว
// ไฟล์ 500 แถว = 500 คำขอ และถ้าพังกลางทางจะเหลือข้อมูลครึ่ง ๆ กลาง ๆ
// อีกทั้งการตรวจความถูกต้องอยู่ฝั่งเบราว์เซอร์ซึ่งข้ามได้
// ตัวนี้ส่งไฟล์ทั้งก้อนให้เซิร์ฟเวอร์ตรวจและบันทึกในคำขอเดียว

import { useRef, useState } from "react";
import { api, ApiError, downloadFile, fileToBase64 } from "@/lib/api";
import type { ImportReport } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";

/** ~8MB base64 ≈ ไฟล์ 6MB — ตรงกับเพดาน body ของ backend (12MB) */
const MAX_FILE_BYTES = 6 * 1024 * 1024;

export default function ServerImport({
  label,
  perm,
  templatePath,
  templateName,
  onImport,
  onDone,
}: {
  label: string;
  perm: string;
  templatePath: string;
  templateName: string;
  onImport: (fileBase64: string, dryRun: boolean) => Promise<ImportReport>;
  onDone?: () => void;
}) {
  const { has } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  if (!has(perm)) return null;

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      toast.error(`ไฟล์ใหญ่เกินไป (${Math.round(f.size / 1024 / 1024)}MB) — สูงสุด 6MB ต่อครั้ง`);
      return;
    }
    setBusy(true);
    setReport(null);
    setFileName(f.name);
    try {
      const b64 = await fileToBase64(f);
      setPending(b64);
      // ตรวจก่อนเสมอ (dry-run) ผู้ใช้เห็นผลแล้วค่อยยืนยันบันทึก
      const r = await onImport(b64, true);
      setReport(r);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "อ่านไฟล์ไม่สำเร็จ");
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!pending || busy) return;
    setBusy(true);
    try {
      const r = await onImport(pending, false);
      setReport(r);
      setPending(null);
      toast.success(`นำเข้าสำเร็จ ${r.created} จาก ${r.total} แถว`);
      onDone?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "นำเข้าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn" onClick={() => setOpen((o) => !o)}>
        นำเข้า{label}จาก Excel
      </button>

      {open && (
        <div className="card card-pad" style={{ position: "absolute", zIndex: 30, marginTop: 40, minWidth: 420, maxWidth: 640 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <button
              className="btn btn-sm"
              onClick={() => downloadFile(templatePath, templateName).catch((e) => toast.error(e.message))}
            >
              ดาวน์โหลดแม่แบบ
            </button>
            <button className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? "กำลังตรวจ…" : "เลือกไฟล์ .xlsx"}
            </button>
            <button className="btn btn-sm" onClick={() => { setOpen(false); setReport(null); setPending(null); }}>
              ปิด
            </button>
            <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={pick} />
          </div>

          {fileName && <div className="detail-meta">ไฟล์: {fileName}</div>}

          {report && (
            <div style={{ marginTop: 8 }}>
              <div className={report.errors.length ? "alert alert-warn" : "alert alert-ok"}>
                {report.dryRun ? "ผลการตรวจ (ยังไม่บันทึก)" : "ผลการนำเข้า"} — ทั้งหมด {report.total} แถว ·{" "}
                {report.dryRun ? "ผ่าน" : "บันทึกแล้ว"} {report.created} · ไม่ผ่าน {report.skipped}
              </div>

              {report.errors.length > 0 && (
                <div style={{ maxHeight: 260, overflow: "auto" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>แถว</th>
                        <th>ค่า</th>
                        <th>เหตุผลที่ไม่ผ่าน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.errors.map((e, i) => (
                        <tr key={i}>
                          <td className="mono">{e.row}</td>
                          <td className="mono">{e.key || "-"}</td>
                          <td>
                            {/* QA BUG-007 — เดิมชื่อคอลัมน์ถูกต่อท้ายข้อความโดยไม่มีตัวคั่น
                                อ่านออกมาเป็น "ต้องระบุรุ่นเครื่องmodel" (ทั้งบนหน้าจอเวลา
                                คัดลอกข้อความ และเวลาอ่านด้วย screen reader) */}
                            {e.message}
                            {e.field ? (
                              <>
                                {" "}
                                <span className="pill">คอลัมน์ {e.field}</span>
                              </>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {report.dryRun && pending && (
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" onClick={commit} disabled={busy || report.created === 0}>
                    {busy ? "กำลังบันทึก…" : `บันทึก ${report.created} แถวที่ผ่าน`}
                  </button>
                  <button className="btn" onClick={() => { setPending(null); setReport(null); }}>
                    ยกเลิก
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
