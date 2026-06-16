"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { MasterItem, MasterKind } from "@/lib/types";
import { masterLabel } from "@/lib/options";
import { useToast } from "@/components/Toast";

export default function MasterManager({ kind }: { kind: MasterKind }) {
  const label = masterLabel[kind];
  const toast = useToast();

  const [items, setItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // add form
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);

  // inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const msg = (e: unknown, fallback: string) =>
    e instanceof ApiError ? e.message : fallback;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listMaster(kind);
      setItems(res.items);
    } catch (e) {
      // keep the load failure inline (persistent) since the table has no data to show
      setError(msg(e, "โหลดข้อมูลไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const v = newValue.trim();
    if (!v) return;
    setAdding(true);
    try {
      await api.createMaster(kind, v);
      setNewValue("");
      await load();
      toast.success(`เพิ่ม${label} "${v}" แล้ว`);
    } catch (e) {
      toast.error(msg(e, "เพิ่มไม่สำเร็จ"));
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (item: MasterItem) => {
    setEditId(item.id);
    setEditValue(item.value);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditValue("");
  };

  const saveEdit = async (id: string) => {
    const v = editValue.trim();
    if (!v) return;
    setSavingId(id);
    try {
      await api.updateMaster(kind, id, v);
      cancelEdit();
      await load();
      toast.success("บันทึกแล้ว");
    } catch (e) {
      toast.error(msg(e, "บันทึกไม่สำเร็จ"));
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (item: MasterItem) => {
    if (deletingId) return;
    if (!confirm(`ลบ "${item.value}"?`)) return;
    setDeletingId(item.id);
    try {
      await api.deleteMaster(kind, item.id);
      await load();
      toast.success(`ลบ "${item.value}" แล้ว`);
    } catch (e) {
      toast.error(msg(e, "ลบไม่สำเร็จ"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>เพิ่ม{label}</label>
          <div className="toolbar" style={{ marginTop: 0 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !adding) add();
              }}
              placeholder={`ชื่อ${label}ใหม่`}
            />
            <button className="btn btn-primary" onClick={add} disabled={adding || !newValue.trim()}>
              {adding ? "กำลังเพิ่ม…" : "+ เพิ่ม"}
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card">
        {loading ? (
          <div className="state">กำลังโหลด…</div>
        ) : items.length === 0 ? (
          <div className="state">ยังไม่มี{label} — เพิ่มรายการแรกด้านบน</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{label}</th>
                <th style={{ width: 200, textAlign: "right" }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>
                    {editId === it.id ? (
                      <input
                        className="input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && savingId !== it.id) saveEdit(it.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                      />
                    ) : (
                      it.value
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {editId === it.id ? (
                      <>
                        <button
                          className="btn btn-primary"
                          style={{ padding: "4px 12px" }}
                          onClick={() => saveEdit(it.id)}
                          disabled={savingId === it.id || !editValue.trim()}
                        >
                          {savingId === it.id ? "กำลังบันทึก…" : "บันทึก"}
                        </button>{" "}
                        <button className="btn" style={{ padding: "4px 12px" }} onClick={cancelEdit}>
                          ยกเลิก
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn"
                          style={{ padding: "4px 12px" }}
                          onClick={() => startEdit(it)}
                        >
                          แก้ไข
                        </button>{" "}
                        <button
                          className="btn btn-danger"
                          style={{ padding: "4px 12px" }}
                          onClick={() => remove(it)}
                          disabled={deletingId === it.id}
                        >
                          {deletingId === it.id ? "กำลังลบ…" : "ลบ"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
