"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Partner, PartnerType } from "@/lib/types";
import { partnerTypeLabel } from "@/lib/options";

const TYPES: PartnerType[] = ["CUSTOMER", "SUPPLIER", "BOTH"];

export default function PartnersPage() {
  const router = useRouter();
  const [items, setItems] = useState<Partner[]>([]);
  const [type, setType] = useState<PartnerType | "">("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listPartners({ type: type || undefined, q: q || undefined });
      setItems(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [type, q]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>คู่ค้า</h1>
          <div className="sub">{items.length} ราย</div>
        </div>
        <Link href="/partners/new" className="btn btn-primary">
          + เพิ่มคู่ค้า
        </Link>
      </div>

      <div className="filters">
        <div className="field">
          <label>ประเภท</label>
          <select className="select" value={type} onChange={(e) => setType(e.target.value as PartnerType | "")}>
            <option value="">ทั้งหมด</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {partnerTypeLabel[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>ค้นหา</label>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ชื่อ / เบอร์ / อีเมล / ผู้ติดต่อ / เลขภาษี"
          />
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card">
        {loading ? (
          <div className="state">กำลังโหลด…</div>
        ) : items.length === 0 ? (
          <div className="state">
            ยังไม่มีคู่ค้า — <Link href="/partners/new">เพิ่มรายแรก</Link>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>ประเภท</th>
                <th>ผู้ติดต่อ</th>
                <th>เบอร์โทร</th>
                <th>อีเมล</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="row-link" onClick={() => router.push(`/partners/${p.id}`)}>
                  <td>{p.name}</td>
                  <td><span className="pill">{partnerTypeLabel[p.type]}</span></td>
                  <td>{p.contactPerson || "—"}</td>
                  <td className="mono" style={{ fontSize: 13 }}>{p.phone || "—"}</td>
                  <td>{p.email || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
