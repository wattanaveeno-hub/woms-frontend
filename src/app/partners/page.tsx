"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import Pagination, { usePagination } from "@/components/Pagination";
import BulkImport from "@/components/BulkImport";
import { useAuth } from "@/lib/AuthContext";
import type { Partner, PartnerType, PartnerFormValues } from "@/lib/types";
import { partnerTypeLabel } from "@/lib/options";

const TYPES: PartnerType[] = ["CUSTOMER", "SUPPLIER", "BOTH"];

export default function PartnersPage() {
  const router = useRouter();
  const { has } = useAuth();
  const [items, setItems] = useState<Partner[]>([]);
  const { page, setPage, pageCount, pageItems, total } = usePagination(items, 10);
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
<div className="head-actions">
          <BulkImport<PartnerFormValues>
            label="คู่ค้า"
            templateName="partner-template.xlsx"
            perm="partners:create"
            headers={["ชื่อ", "ประเภท", "โทร", "อีเมล", "ที่อยู่", "เลขผู้เสียภาษี", "ผู้ติดต่อ", "หมายเหตุ"]}
            example={["บริษัท ตัวอย่าง จำกัด", "CUSTOMER", "021112222", "info@example.com", "กรุงเทพ", "0105500000000", "คุณเอ", ""]}
            toValues={(r) => {
              if (!(r["ชื่อ"] || "").trim()) return { ok: false, error: "ไม่มีชื่อ" };
              const traw = (r["ประเภท"] || "CUSTOMER").trim();
              const tmap: Record<string, PartnerType> = { "ลูกค้า": "CUSTOMER", "ผู้ขาย": "SUPPLIER", "ผู้จัดจำหน่าย": "SUPPLIER", "ทั้งคู่": "BOTH" };
              const codes = ["CUSTOMER", "SUPPLIER", "BOTH"];
              let type: PartnerType = "CUSTOMER";
              if (codes.includes(traw)) type = traw as PartnerType;
              else if (tmap[traw]) type = tmap[traw];
              else return { ok: false, error: "ประเภทไม่ถูกต้อง: " + traw };
              return { ok: true, value: {
                name: r["ชื่อ"] || "", type, phone: r["โทร"] || "", email: r["อีเมล"] || "",
                address: r["ที่อยู่"] || "", taxId: r["เลขผู้เสียภาษี"] || "",
                contactPerson: r["ผู้ติดต่อ"] || "", note: r["หมายเหตุ"] || "",
              } };
            }}
            create={(v) => api.createPartner(v)}
            onDone={load}
          />
          {has("partners:create") ? (
            <Link href="/partners/new" className="btn btn-primary">
              + เพิ่มคู่ค้า
            </Link>
          ) : null}
        </div>
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
              {pageItems.map((p) => (
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
      <Pagination page={page} pageCount={pageCount} total={total} onPage={setPage} />
    </>
  );
}
