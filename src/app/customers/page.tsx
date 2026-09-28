"use client";

// ---------------------------------------------------------------------------
// ค้นหาลูกค้าแบบรวม — ชื่อลูกค้า / ชื่อร้าน / เบอร์โทร / Serial Number
// ---------------------------------------------------------------------------
// ที่มา: ชีต "FUN-NOFUN REQ" โมดูล "ระบบฐานข้อมูลลูกค้า" (MUST-HAVE)
//   "ระบบจะต้องสามารถค้นหาข้อมูลลูกค้าจากชื่อลูกค้า ชื่อร้าน เบอร์โทรศัพท์
//    หรือ Serial Number (SN) ได้"

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import { api, ApiError } from "@/lib/api";
import type { CustomerRelation, CustomerSearchResult, CustomerSummaryResponse } from "@/lib/types";
import { equipmentStatusLabel } from "@/lib/options";
import {
  NeedsSerialChip,
  WomsDataTable,
  WomsEmptyState,
  WomsErrorState,
  WomsPageHeader,
  WomsStatCard,
  WomsStatGrid,
  WomsStatusChip,
  type WomsColumn,
} from "@/components/woms";

type SummaryRow = CustomerSummaryResponse["items"][number];
type CustomerHit = CustomerSearchResult["customers"][number];
type SiteHit = CustomerSearchResult["sites"][number];
type EquipmentHit = CustomerSearchResult["equipment"][number];

const RELATION_LABEL: Record<CustomerRelation, string> = {
  RENTAL: "เช่า",
  SALE: "ซื้อ",
  BOTH: "เช่าและซื้อ",
  NONE: "ยังไม่มีเครื่อง",
};
const RELATION_TONE = { RENTAL: "info", SALE: "success", BOTH: "primary", NONE: "neutral" } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h2" sx={{ fontSize: 18, mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function LinkCard({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardActionArea component={Link} href={href}>
        <CardContent>{children}</CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<CustomerSearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // CUS-01 / BR-13.2 — ยอดลูกค้าทั้งหมด / เช่า / ซื้อ / ทั้งสอง (กดการ์ดเพื่อกรองตาราง)
  const [summary, setSummary] = useState<CustomerSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [relation, setRelation] = useState<CustomerRelation | "">("");

  const loadSummary = useCallback(() => {
    setSummaryLoading(true);
    setSummaryError(null);
    api
      .customerSummary()
      .then(setSummary)
      .catch((e) => setSummaryError(e instanceof ApiError ? e.message : "โหลดสรุปลูกค้าไม่สำเร็จ"))
      .finally(() => setSummaryLoading(false));
  }, []);
  useEffect(loadSummary, [loadSummary]);

  const rows = summary ? summary.items.filter((r) => !relation || r.relation === relation) : [];

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api.searchCustomers(term));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ค้นหาไม่สำเร็จ");
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const empty =
    result && result.counts.customers === 0 && result.counts.sites === 0 && result.counts.equipment === 0;

  const summaryCols: WomsColumn<SummaryRow>[] = [
    {
      key: "name",
      label: "ลูกค้า",
      sortValue: (r) => r.name,
      render: (r) => (
        <>
          <Link href={`/partners/${r.id}`}>{r.name}</Link>
          {r.phone ? <Typography variant="body2">{r.phone}</Typography> : null}
        </>
      ),
    },
    { key: "sites", label: "สาขา", align: "right", sortValue: (r) => r.siteCount, render: (r) => r.siteCount },
    { key: "eq", label: "เครื่อง", align: "right", sortValue: (r) => r.equipmentCount, render: (r) => r.equipmentCount },
    {
      key: "rel",
      label: "สถานะ",
      sortValue: (r) => RELATION_LABEL[r.relation],
      render: (r) => <WomsStatusChip label={RELATION_LABEL[r.relation]} tone={RELATION_TONE[r.relation]} />,
    },
  ];

  const customerCols: WomsColumn<CustomerHit>[] = [
    { key: "name", label: "ชื่อ", sortValue: (c) => c.name, render: (c) => <Link href={`/partners/${c.id}`}>{c.name}</Link> },
    { key: "type", label: "ประเภท", render: (c) => c.type },
    { key: "phone", label: "เบอร์โทร", render: (c) => c.phone || "-" },
    {
      key: "by",
      label: "พบจาก",
      render: (c) => c.matchedLabel ?? (c.matchedBy === "customer" ? "ชื่อลูกค้า" : "สาขา/เครื่องที่เกี่ยวข้อง"),
    },
  ];

  const siteCols: WomsColumn<SiteHit>[] = [
    { key: "label", label: "สาขา", sortValue: (s) => s.label || "", render: (s) => <Link href={`/partners/${s.partnerId}`}>{s.label || "-"}</Link> },
    { key: "phone", label: "เบอร์โทร", render: (s) => s.phone || "-" },
    { key: "addr", label: "ที่อยู่", hideBelowLg: true, render: (s) => s.addressFull || "-" },
    {
      key: "active",
      label: "สถานะ",
      render: (s) => <WomsStatusChip label={s.active ? "ใช้งาน" : "ปิดใช้งาน"} tone={s.active ? "success" : "neutral"} />,
    },
  ];

  const eqCols: WomsColumn<EquipmentHit>[] = [
    {
      key: "serial",
      label: "Serial",
      sortValue: (e) => e.serial,
      render: (e) => (
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Link href={`/equipment/${e.id}`} className="code">
            {e.serial}
          </Link>
          {e.needsSerial ? <NeedsSerialChip /> : null}
        </Stack>
      ),
    },
    { key: "model", label: "รุ่น", sortValue: (e) => e.model, render: (e) => e.model },
    { key: "status", label: "สถานะ", render: (e) => equipmentStatusLabel[e.status] ?? e.status },
    {
      key: "cust",
      label: "ลูกค้า",
      render: (e) =>
        e.customerId ? <Link href={`/partners/${e.customerId}`}>{e.customerName || "(ไม่ระบุชื่อ)"}</Link> : e.customerName || "-",
    },
    { key: "site", label: "สาขา", hideBelowLg: true, render: (e) => e.siteLabel || "-" },
  ];

  const stats: Array<[CustomerRelation | "", string, number]> = summary
    ? [
        ["", "ลูกค้าทั้งหมด", summary.totals.customers],
        ["RENTAL", "ลูกค้าเช่า", summary.totals.rental],
        ["SALE", "ลูกค้าซื้อ", summary.totals.sale],
        ["BOTH", "ทั้งเช่าและซื้อ", summary.totals.both],
      ]
    : [];

  return (
    <>
      <WomsPageHeader title="ฐานข้อมูลลูกค้า" subtitle="ค้นด้วยชื่อลูกค้า ชื่อร้าน เบอร์โทร หรือ Serial ของเครื่อง" />

      <Card component="form" onSubmit={search} sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="ค้นหาลูกค้า"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="เช่น บจก.สุขสัน · Happy cafe · 0812345678 · SN-0001"
              autoFocus
            />
            <Button
              type="submit"
              variant="contained"
              disabled={busy || !q.trim()}
              startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
              sx={{ flexShrink: 0 }}
            >
              {busy ? "กำลังค้นหา…" : "ค้นหา"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {error ? <WomsErrorState message={error} /> : null}
      {empty ? <WomsEmptyState title={`ไม่พบข้อมูลที่ตรงกับ “${result?.query}”`} /> : null}

      {result && !empty ? (
        <>
          {result.customers.length > 0 ? (
            <Section title={`ลูกค้า (${result.counts.customers})`}>
              <WomsDataTable
                caption="ลูกค้าที่ค้นพบ"
                rows={result.customers}
                columns={customerCols}
                rowKey={(c) => c.id}
                pageSize={10}
                renderCard={(c) => (
                  <LinkCard href={`/partners/${c.id}`}>
                    <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{c.name}</Typography>
                    <Typography variant="body2">
                      {c.type} · {c.phone || "ไม่มีเบอร์"}
                    </Typography>
                  </LinkCard>
                )}
              />
            </Section>
          ) : null}
          {result.sites.length > 0 ? (
            <Section title={`สาขา / ร้าน (${result.counts.sites})`}>
              <WomsDataTable
                caption="สาขาที่ค้นพบ"
                rows={result.sites}
                columns={siteCols}
                rowKey={(s) => s.id}
                pageSize={10}
                renderCard={(s) => (
                  <LinkCard href={`/partners/${s.partnerId}`}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{s.label || "-"}</Typography>
                      <WomsStatusChip label={s.active ? "ใช้งาน" : "ปิดใช้งาน"} tone={s.active ? "success" : "neutral"} />
                    </Stack>
                    <Typography variant="body2">{s.phone || "-"}</Typography>
                    <Typography variant="body2">{s.addressFull || "-"}</Typography>
                  </LinkCard>
                )}
              />
            </Section>
          ) : null}
          {result.equipment.length > 0 ? (
            <Section title={`เครื่องที่ตรง Serial (${result.counts.equipment})`}>
              <WomsDataTable
                caption="เครื่องที่ค้นพบ"
                rows={result.equipment}
                columns={eqCols}
                rowKey={(e) => e.id}
                pageSize={10}
                renderCard={(e) => (
                  <LinkCard href={`/equipment/${e.id}`}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Typography className="code">{e.serial}</Typography>
                      {e.needsSerial ? <NeedsSerialChip /> : null}
                    </Stack>
                    <Typography variant="body2">
                      {e.model} · {equipmentStatusLabel[e.status] ?? e.status}
                    </Typography>
                    <Typography variant="body2">
                      {e.customerName || "-"}
                      {e.siteLabel ? ` · ${e.siteLabel}` : ""}
                    </Typography>
                  </LinkCard>
                )}
              />
            </Section>
          ) : null}
        </>
      ) : null}

      <Section title="ลูกค้าตามประเภทการใช้เครื่อง">
        {summaryError ? (
          <WomsErrorState message={summaryError} onRetry={loadSummary} />
        ) : (
          <>
            {summary ? (
              <WomsStatGrid>
                {stats.map(([key, label, n]) => (
                  <WomsStatCard key={label} value={n} label={label} active={relation === key} onClick={() => setRelation(key)} />
                ))}
              </WomsStatGrid>
            ) : null}
            <WomsDataTable
              caption="สรุปลูกค้า"
              rows={rows}
              columns={summaryCols}
              rowKey={(r) => r.id}
              loading={summaryLoading}
              pageSize={25}
              emptyTitle="ไม่มีลูกค้าในกลุ่มนี้"
              renderCard={(r) => (
                <LinkCard href={`/partners/${r.id}`}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{r.name}</Typography>
                    <WomsStatusChip label={RELATION_LABEL[r.relation]} tone={RELATION_TONE[r.relation]} />
                  </Stack>
                  <Typography variant="body2">
                    {r.siteCount} สาขา · {r.equipmentCount} เครื่อง{r.phone ? ` · ${r.phone}` : ""}
                  </Typography>
                </LinkCard>
              )}
            />
          </>
        )}
      </Section>
    </>
  );
}
