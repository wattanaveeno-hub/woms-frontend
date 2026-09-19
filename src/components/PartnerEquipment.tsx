"use client";

// ---------------------------------------------------------------------------
// เครื่องทั้งหมดที่อยู่ภายใต้ลูกค้ารายหนึ่ง
// ---------------------------------------------------------------------------
// ที่มา: "ระบบจะต้องสามารถแสดงรายการเครื่องทั้งหมดที่อยู่ภายใต้ลูกค้าแต่ละรายได้"
//        "ระบบจะต้องสามารถระบุได้ว่าเครื่องแต่ละเครื่องอยู่กับลูกค้าและร้านใด"

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { Equipment } from "@/lib/types";
import { equipmentStatusLabel } from "@/lib/options";

export default function PartnerEquipment({ partnerId }: { partnerId: string }) {
  const [items, setItems] = useState<Equipment[] | null>(null);
  const [unlinked, setUnlinked] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.partnerEquipment(partnerId);
      setItems(r.items);
      setUnlinked(r.unlinkedByName);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดรายการเครื่องไม่สำเร็จ");
      setItems([]);
    }
  }, [partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>
        เครื่องของลูกค้ารายนี้{items ? ` (${items.length})` : ""}
      </h2>

      {error && <div className="alert alert-error">{error}</div>}

      {unlinked > 0 && (
        <div className="alert alert-warn">
          มี {unlinked} เครื่องที่ยังผูกกับลูกค้ารายนี้ด้วย “ชื่อ” เท่านั้น ยังไม่ได้ผูกด้วยรหัสลูกค้า —
          เปลี่ยนชื่อลูกค้าเมื่อไหร่ เครื่องเหล่านี้จะหลุดจากกัน แก้ได้โดยเปิดเครื่องแล้วเลือกลูกค้าจากรายการ
        </div>
      )}

      {items === null ? (
        <div className="state">กำลังโหลด…</div>
      ) : items.length === 0 ? (
        <div className="state">ยังไม่มีเครื่องผูกกับลูกค้ารายนี้</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Serial</th>
                <th>รุ่น</th>
                <th>สถานะ</th>
                <th>สาขา/ร้าน</th>
                <th>ที่อยู่ปัจจุบัน</th>
                <th>PM ครั้งถัดไป</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td className="mono">
                    {e.serial}
                    {e.needsSerial && (
                      <span className="badge badge-off" style={{ marginLeft: 6 }}>
                        ยังไม่มี SN
                      </span>
                    )}
                  </td>
                  <td>{e.model}</td>
                  <td>{equipmentStatusLabel[e.status] ?? e.status}</td>
                  <td>{e.siteLabel || (e.customerId ? "-" : "(ผูกด้วยชื่อ)")}</td>
                  <td>{e.addressFull || e.location || "-"}</td>
                  <td className="mono">{e.nextPmDate || "-"}</td>
                  <td>
                    <Link className="btn btn-sm" href={`/equipment/${e.id}`}>
                      เปิด
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
