"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Equipment, JobEquipmentInput, JobEquipmentLine, Options } from "@/lib/types";
import { NeedsSerialBadge } from "@/components/EquipmentBadges";

/**
 * "อุปกรณ์ในใบงาน" — ใช้ได้ทั้งตอนเปิดงานใหม่และตอนแก้ใบงานเดิม
 *
 * โหมด create : เก็บรายการไว้ในหน้าเว็บก่อน แล้วส่งไปพร้อมตอนกดบันทึกเปิดงาน
 * โหมด edit   : เรียก API ทันทีทีละรายการ แล้วให้หน้าแม่โหลดข้อมูลใหม่จาก backend
 *
 * กติกาที่ backend เป็นเจ้าของ (หน้าเว็บไม่ทำซ้ำ):
 *   filterUnit · model · equipmentCount · การออกเลข TMP · การปฏิเสธ serial ที่ไม่มีในคลัง
 */

export interface PendingItem extends JobEquipmentInput {
  /** key ชั่วคราวสำหรับ React เท่านั้น */
  key: string;
  /** ข้อความที่ใช้แสดงในรายการก่อนบันทึก */
  displaySerial: string;
  displayModel: string;
  hasRealSerial: boolean;
}

export interface JobEquipmentSectionProps {
  mode: "create" | "edit";
  options: Options;
  canEdit: boolean;
  /** เหตุผลที่แก้ไม่ได้ (เช่น ใบงานปิดแล้ว) — แสดงให้ผู้ใช้เข้าใจว่าทำไมไม่มีปุ่ม */
  readOnlyReason?: string;
  /** โหมด edit */
  jobId?: string;
  lines?: JobEquipmentLine[];
  /** ข้อมูลเดิมของใบงานเก่าที่ยังไม่มีแถวเชื่อม */
  legacy?: { filterUnit: string; model: string };
  /** โหมด create */
  pending?: PendingItem[];
  onPendingChange?: (items: PendingItem[]) => void;
  /** โหมด edit — ให้หน้าแม่โหลดข้อมูลใหม่ทั้งใบ */
  onChanged?: () => void | Promise<void>;
}

let seq = 0;
const nextKey = () => `p${++seq}`;

export default function JobEquipmentSection({
  mode,
  options,
  canEdit,
  readOnlyReason,
  jobId,
  lines = [],
  legacy,
  pending = [],
  onPendingChange,
  onChanged,
}: JobEquipmentSectionProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"pick" | "noserial">("pick");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Equipment[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [model, setModel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = mode === "create" ? pending.length : lines.length;
  // ใบงานเก่าที่ยังไม่มีแถวเชื่อม แต่มีข้อความเครื่องเดิมอยู่
  const legacyOnly = mode === "edit" && lines.length === 0 && !!legacy?.filterUnit;

  const reset = () => {
    setQ("");
    setResults(null);
    setModel("");
    setNote("");
    setError(null);
  };

  const search = async () => {
    setSearching(true);
    setError(null);
    try {
      const res = await api.listEquipment({ q: q.trim() || undefined });
      setResults(res.items.slice(0, 8));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "ค้นหาเครื่องไม่สำเร็จ");
    } finally {
      setSearching(false);
    }
  };

  // เพิ่มรายการ — โหมด create เก็บไว้ในหน้าเว็บ, โหมด edit ยิง API ทันที
  const add = async (input: JobEquipmentInput, display: { serial: string; model: string; real: boolean }) => {
    setError(null);
    if (mode === "create") {
      const dupe = pending.some(
        (p) =>
          (input.equipmentId && p.equipmentId === input.equipmentId) ||
          (input.serial && p.serial?.toLowerCase() === input.serial.toLowerCase())
      );
      if (dupe) {
        setError("เครื่องนี้อยู่ในรายการแล้ว");
        return;
      }
      onPendingChange?.([
        ...pending,
        {
          key: nextKey(),
          ...input,
          displaySerial: display.serial,
          displayModel: display.model,
          hasRealSerial: display.real,
        },
      ]);
      setOpen(false);
      reset();
      return;
    }

    if (!jobId) return;
    setBusy(true);
    try {
      await api.addJobEquipment(jobId, input);
      await onChanged?.();
      setOpen(false);
      reset();
    } catch (e) {
      // ข้อความจาก backend เช่น "ไม่พบเครื่อง serial ... ในคลัง" ต้องแสดงให้ผู้ใช้เห็นตรง ๆ
      setError(e instanceof ApiError ? e.message : "เพิ่มเครื่องไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const removePending = (key: string) => {
    onPendingChange?.(pending.filter((p) => p.key !== key));
  };

  const removeLine = async (line: JobEquipmentLine) => {
    if (!jobId) return;
    if (!confirm(`เอาเครื่อง ${line.serial} ออกจากใบงานนี้?\n(เครื่องยังอยู่ในคลังเหมือนเดิม ไม่ถูกลบ)`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.removeJobEquipment(jobId, line.id);
      await onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "เอาเครื่องออกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  // แถวหนึ่งรายการ — ใช้ flex + wrap ให้อ่านได้บนจอแคบ ไม่ใช้ตารางกว้าง
  const row = (
    key: string,
    serial: string,
    modelText: string,
    real: boolean,
    noteText: string,
    onRemove?: () => void,
    tag?: string
  ) => (
    <div
      key={key}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        padding: "10px 0",
        borderTop: "1px solid var(--line)",
      }}
    >
      <span className="code" style={{ fontWeight: 600 }}>{serial || "—"}</span>
      {!real ? <NeedsSerialBadge /> : null}
      {tag ? <span className="badge badge-off">{tag}</span> : null}
      <span style={{ color: "var(--slate-2)" }}>{modelText || "—"}</span>
      {noteText ? <span className="sub" style={{ flexBasis: "100%" }}>{noteText}</span> : null}
      {onRemove ? (
        <button
          className="btn"
          style={{ marginLeft: "auto", padding: "4px 10px" }}
          onClick={onRemove}
          disabled={busy}
        >
          เอาออก
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <div className="toolbar" style={{ marginTop: 0, justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>อุปกรณ์ในใบงาน {count ? `(${count})` : ""}</h2>
        {canEdit ? (
          <button className="btn" onClick={() => { setOpen((o) => !o); reset(); }} disabled={busy}>
            {open ? "ปิด" : "+ เพิ่มเครื่อง"}
          </button>
        ) : null}
      </div>

      {error ? <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div> : null}

      {!canEdit && readOnlyReason ? (
        <div className="sub" style={{ marginTop: 8 }}>{readOnlyReason}</div>
      ) : null}

      {/* ---- รายการเครื่อง ---- */}
      {count === 0 && !legacyOnly ? (
        <div className="state" style={{ padding: "14px 0" }}>
          ยังไม่มีเครื่องในใบงานนี้
          {canEdit ? " — กด “เพิ่มเครื่อง” เพื่อเลือกจากคลัง หรือเปิดงานโดยยังไม่ระบุ Serial ก็ได้" : ""}
        </div>
      ) : null}

      {mode === "create"
        ? pending.map((p) =>
            row(p.key, p.displaySerial, p.displayModel, p.hasRealSerial, p.note ?? "", () => removePending(p.key))
          )
        : lines.map((l) =>
            row(
              l.id,
              l.serial,
              l.model,
              l.hasRealSerial,
              l.note,
              canEdit ? () => removeLine(l) : undefined,
              l.linked ? undefined : "ข้อมูลเดิม (ยังไม่ผูกกับคลัง)"
            )
          )}

      {/* ---- ใบงานเก่าที่ยังไม่มีแถวเชื่อมเลย ---- */}
      {legacyOnly ? (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          <div className="sub" style={{ marginBottom: 6 }}>
            ใบงานนี้บันทึกไว้ก่อนระบบผูกเครื่อง — ข้อมูลเดิมที่มีคือ
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <span className="code">{legacy?.filterUnit}</span>
            <span className="badge badge-off">ข้อความเดิม ยังไม่ผูกกับคลัง</span>
            {legacy?.model ? <span style={{ color: "var(--slate-2)" }}>{legacy.model}</span> : null}
          </div>
          {canEdit ? (
            <div className="sub" style={{ marginTop: 6 }}>
              ผูกกับเครื่องจริงได้โดยกด “เพิ่มเครื่อง” — ข้อความเดิมจะไม่ถูกลบ
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ---- ฟอร์มเพิ่มเครื่อง ---- */}
      {open && canEdit ? (
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 6, paddingTop: 12 }}>
          <div className="toolbar" style={{ marginTop: 0, gap: 8 }}>
            <button className={`btn ${tab === "pick" ? "btn-primary" : ""}`} onClick={() => setTab("pick")}>
              เลือกจากคลัง
            </button>
            <button className={`btn ${tab === "noserial" ? "btn-primary" : ""}`} onClick={() => setTab("noserial")}>
              ยังไม่มี Serial จริง
            </button>
          </div>

          {tab === "pick" ? (
            <div style={{ marginTop: 12 }}>
              <div className="field">
                <label>ค้นหาเครื่องในคลัง</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    className="input"
                    style={{ flex: 1, minWidth: 180 }}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") search();
                    }}
                    placeholder="serial / รุ่น / ลูกค้า"
                  />
                  <button className="btn" onClick={search} disabled={searching}>
                    {searching ? "กำลังค้นหา…" : "ค้นหา"}
                  </button>
                </div>
              </div>

              {results ? (
                results.length ? (
                  <div style={{ marginTop: 8 }}>
                    {results.map((e) => (
                      <div
                        key={e.id}
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                          alignItems: "center",
                          padding: "8px 0",
                          borderTop: "1px solid var(--line)",
                        }}
                      >
                        <span className="code">{e.serial}</span>
                        {e.needsSerial ? <NeedsSerialBadge /> : null}
                        <span style={{ color: "var(--slate-2)" }}>{e.model || "—"}</span>
                        <span className="sub">{e.customerName || e.warehouse || ""}</span>
                        <button
                          className="btn btn-primary"
                          style={{ marginLeft: "auto", padding: "4px 10px" }}
                          disabled={busy}
                          onClick={() =>
                            add(
                              { equipmentId: e.id, note: note.trim() },
                              { serial: e.serial, model: e.model, real: e.hasRealSerial }
                            )
                          }
                        >
                          เลือก
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    <div className="alert alert-warn">
                      ไม่พบเครื่องที่ตรงกับ “{q}” ในคลัง
                    </div>
                    <div className="sub" style={{ marginBottom: 8 }}>
                      ถ้านี่คือ Serial จริงที่ยังไม่ได้รับเข้าคลัง ให้รับเข้าคลังก่อน
                      หรือใช้แท็บ “ยังไม่มี Serial จริง” เพื่อให้ระบบออกเลขชั่วคราวให้
                    </div>
                    {q.trim() ? (
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          add({ serial: q.trim(), note: note.trim() }, { serial: q.trim(), model: "", real: true })
                        }
                      >
                        ลองใช้ “{q.trim()}” เป็น Serial
                      </button>
                    ) : null}
                  </div>
                )
              ) : null}
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <div className="sub" style={{ marginBottom: 8 }}>
                ระบบจะสร้างเครื่องใหม่ในคลังพร้อมออกเลขชั่วคราวให้ และขึ้นป้าย “ยังไม่มี SN”
                เพื่อให้ตามลง Serial จริงภายหลัง
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>รุ่น</label>
                  <input
                    className="input"
                    list="jobeq-model-options"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="เช่น RO-300"
                  />
                  <datalist id="jobeq-model-options">
                    {options.models.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
                <div className="field">
                  <label>หมายเหตุ</label>
                  <input
                    className="input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="เช่น เครื่องลูกค้าเอง"
                  />
                </div>
              </div>
              <div className="toolbar">
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() =>
                    add(
                      { model: model.trim(), note: note.trim() },
                      { serial: "(ระบบออกเลขให้ตอนบันทึก)", model: model.trim(), real: false }
                    )
                  }
                >
                  เพิ่มเครื่องที่ยังไม่มี Serial
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
