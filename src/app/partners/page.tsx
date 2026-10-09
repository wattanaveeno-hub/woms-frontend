"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import BulkImport from "@/components/BulkImport";
import { useAuth } from "@/lib/AuthContext";
import type { Partner, PartnerType, PartnerFormValues } from "@/lib/types";
import { partnerTypeLabel } from "@/lib/options";
import { useUrlFilters } from "@/lib/urlFilters";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import {
  WomsDataTable,
  WomsFilterPanel,
  WomsPageHeader,
  WomsSearchBar,
  WomsSelectFilter,
  type WomsColumn,
} from "@/components/woms";

const TYPES: PartnerType[] = ["CUSTOMER", "SUPPLIER", "BOTH"];

export default function PartnersPage() {
  const router = useRouter();
  const { has } = useAuth();
  const [items, setItems] = useState<Partner[]>([]);
  // QA BUG-009 — ตัวกรองสะท้อนลง URL
  const [f, setF] = useUrlFilters({ type: "", q: "" });
  const type = f.type as PartnerType | "";
  const q = f.q;
  const setType = (v: PartnerType | "") => setF({ type: v });
  const setQ = (v: string) => setF({ q: v });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // กันคำตอบที่มาช้าทับผลลัพธ์ใหม่กว่า (พิมพ์ค้นหาต่อเนื่อง)
  const seqRef = useRef(0);
  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.listPartners({ type: type || undefined, q: q || undefined });
      if (seq !== seqRef.current) return;
      setItems(res.items);
    } catch (e) {
      if (seq !== seqRef.current) return;
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [type, q]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: WomsColumn<Partner>[] = [
    { key: "code", label: "รหัสลูกค้า", sortValue: (p) => p.customerCode || "", render: (p) => <span className="mono">{p.customerCode || "—"}</span> },
    { key: "name", label: "ชื่อ", sortValue: (p) => p.name, render: (p) => <Link href={`/partners/${p.id}?from=partners`} onClick={(e) => e.stopPropagation()}>{p.name}</Link> },
    { key: "type", label: "ประเภท", sortValue: (p) => p.type, render: (p) => <Chip size="small" variant="outlined" label={partnerTypeLabel[p.type]} /> },
    { key: "contact", label: "ผู้ติดต่อ", render: (p) => p.contactPerson || "—" },
    { key: "phone", label: "เบอร์โทร", render: (p) => <span className="mono">{p.phone || "—"}</span> },
    { key: "email", label: "อีเมล", hideBelowLg: true, render: (p) => p.email || "—" },
  ];

  return (
    <>
      <WomsPageHeader
        title="คู่ค้า"
        subtitle={loading ? "กำลังโหลด…" : `${items.length} ราย`}
        actions={
          <>
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
              <Button component={Link} href="/partners/new?from=partners" variant="contained" startIcon={<AddIcon />}>
                เพิ่มคู่ค้า
              </Button>
            ) : null}
          </>
        }
      />

      <WomsFilterPanel
        search={<WomsSearchBar value={q} onChange={setQ} placeholder="ชื่อ / เบอร์ / อีเมล / ผู้ติดต่อ / เลขภาษี" />}
        activeCount={type ? 1 : 0}
        onClear={() => setType("")}
      >
        <WomsSelectFilter label="ประเภท" value={type} onChange={(v) => setType(v as PartnerType | "")} options={TYPES.map((t) => ({ value: t, label: partnerTypeLabel[t] }))} />
      </WomsFilterPanel>

      <WomsDataTable
        caption="รายการคู่ค้า"
        rows={items}
        columns={columns}
        rowKey={(p) => p.id}
        loading={loading}
        error={error}
        onRetry={load}
        pageSize={10}
        onRowClick={(p) => router.push(`/partners/${p.id}?from=partners`)}
        emptyTitle="ยังไม่มีคู่ค้าที่ตรงเงื่อนไข"
        emptyAction={
          has("partners:create") ? (
            <Button component={Link} href="/partners/new?from=partners" variant="outlined" startIcon={<AddIcon />}>
              เพิ่มรายแรก
            </Button>
          ) : undefined
        }
        renderCard={(p) => (
          <Card>
            <CardActionArea component={Link} href={`/partners/${p.id}?from=partners`}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{p.name}</Typography>
                  <Chip size="small" variant="outlined" label={partnerTypeLabel[p.type]} />
                </Stack>
                <Typography variant="body2">{[p.contactPerson, p.phone, p.email].filter(Boolean).join(" · ") || "—"}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        )}
      />
    </>
  );
}
