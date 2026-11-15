"use client";

// ---------------------------------------------------------------------------
// ค้นหาลูกค้าแบบรวม — ชื่อลูกค้า / ชื่อร้าน / เบอร์โทร / Serial Number
// ---------------------------------------------------------------------------
// ที่มา: ชีต "FUN-NOFUN REQ" โมดูล "ระบบฐานข้อมูลลูกค้า" (MUST-HAVE)
//   "ระบบจะต้องสามารถค้นหาข้อมูลลูกค้าจากชื่อลูกค้า ชื่อร้าน เบอร์โทรศัพท์
//    หรือ Serial Number (SN) ได้"

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import EditIcon from "@mui/icons-material/Edit";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import DownloadIcon from "@mui/icons-material/Download";
import AddIcon from "@mui/icons-material/Add";
import { api, ApiError, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { apptRelative } from "@/lib/apptRelative";
import { bangkokToday } from "@/lib/date";
import { useToast } from "@/components/Toast";
import CustomerImport from "@/components/CustomerImport";
import type { CustomerRelation, CustomerSearchResult, CustomerSummaryResponse } from "@/lib/types";
import { equipmentStatusLabel, partnerTypeLabel } from "@/lib/options";
import {
  NeedsSerialChip,
  WomsDataTable,
  WomsEmptyState,
  WomsErrorState,
  WomsFilterPanel,
  WomsPageHeader,
  WomsSearchBar,
  WomsStatCard,
  WomsStatGrid,
  WomsStatusChip,
  WomsTwoLine,
  WomsViewPills,
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
const KIND_LABEL: Record<string, string> = { COMPANY: "บริษัท", PERSON: "บุคคล", AGENCY: "หน่วยงาน" };
const JOB_STATUS_SHORT: Record<string, string> = { CLOSED: "ปิดแล้ว", HOLD: "พักงาน", CANCELLED: "ยกเลิก" };

// CUS-01 — ตัวกรองสถานะ: "ลูกค้าเช่า" = เช่าอย่างเดียว + ทั้งสอง · "ลูกค้าซื้อ" = ซื้ออย่างเดียว + ทั้งสอง
type RelationFilter = "" | "RENTAL_ANY" | "SALE_ANY" | CustomerRelation;
const RELATION_FILTERS: Array<{ value: Exclude<RelationFilter, "">; label: string }> = [
  { value: "RENTAL_ANY", label: "ลูกค้าเช่า (รวมทั้งสอง)" },
  { value: "SALE_ANY", label: "ลูกค้าซื้อ (รวมทั้งสอง)" },
  { value: "RENTAL", label: "เช่าอย่างเดียว" },
  { value: "SALE", label: "ซื้ออย่างเดียว" },
  { value: "BOTH", label: "เช่าและซื้อ" },
  { value: "NONE", label: "ยังไม่มีเครื่อง/สัญญา" },
];
function matchRelation(f: RelationFilter, r: CustomerRelation): boolean {
  if (!f) return true;
  if (f === "RENTAL_ANY") return r === "RENTAL" || r === "BOTH";
  if (f === "SALE_ANY") return r === "SALE" || r === "BOTH";
  return r === f;
}

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
  const [relation, setRelation] = useState<RelationFilter>("");
  const [tableQ, setTableQ] = useState("");
  const [kind, setKind] = useState("");
  const { has } = useAuth();
  const canEditPartner = has("partners:edit");
  const toast = useToast();

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

  const rows = useMemo(() => {
    if (!summary) return [];
    const needle = tableQ.trim().toLowerCase();
    return summary.items.filter(
      (r) =>
        matchRelation(relation, r.relation) &&
        (!kind || (kind === "UNSET" ? !r.customerKind : r.customerKind === kind)) &&
        (!needle ||
          r.name.toLowerCase().includes(needle) ||
          (r.customerCode ?? "").toLowerCase().includes(needle) ||
          (r.phone ?? "").replace(/\D/g, "").includes(needle.replace(/\D/g, "") || "\u0000"))
    );
  }, [summary, relation, kind, tableQ]);

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

  // P4-02: คอลัมน์สัญญา/งานล่าสุดแสดงเมื่อ backend ส่งข้อมูลให้ผู้ใช้นี้ (ตามสิทธิ์ contracts:view / jobs:view)
  const showContracts = summary?.fields ? summary.fields.contractSummary : false;
  const showJobs = summary?.fields ? summary.fields.latestJob : false;
  const summaryCols: WomsColumn<SummaryRow>[] = [
    {
      key: "name",
      label: "ลูกค้า",
      sortValue: (r) => r.name,
      render: (r) => (
        <WomsTwoLine
          main={<Link href={`/partners/${r.id}?from=customers`}>{r.name}</Link>}
          sub={
            <>
              {r.customerCode ? <span className="mono">{r.customerCode}</span> : <span>ไม่มีรหัส</span>}
              {r.customerKind ? ` · ${KIND_LABEL[r.customerKind]}` : ""}
              {r.siteCount > 1 ? ` · ${r.siteCount} สาขา` : ""}
            </>
          }
        />
      ),
    },
    // ENTECH design (Customers.dc.html) + P4-02: ผู้ติดต่อหลัก · รุ่นเครื่อง × จำนวน · สัญญา/ค้างชำระ · งานล่าสุด · เซลล์
    {
      key: "contact",
      label: "ติดต่อ",
      sortValue: (r) => r.contactName || r.phone || "",
      render: (r) => (
        <WomsTwoLine
          main={r.contactName || <span className="muted">—</span>}
          sub={(r.contactPhone ?? r.phone) ? <span style={{ fontVariantNumeric: "tabular-nums" }}>{r.contactPhone ?? r.phone}</span> : "ไม่มีเบอร์"}
        />
      ),
    },
    { key: "sites", label: "สาขา", align: "right", hideBelowLg: true, sortValue: (r) => r.siteCount, render: (r) => r.siteCount },
    {
      key: "eq",
      label: "เครื่อง",
      sortValue: (r) => r.equipmentCount,
      render: (r) => (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap data-testid="customer-models">
          <span style={{ whiteSpace: "nowrap" }}>
            {r.models && r.models.length
              ? r.models
                  .slice(0, 2)
                  .map((m) => `${m.model || "ไม่ระบุรุ่น"}${m.count > 1 ? ` ×${m.count}` : ""}`)
                  .join(", ") + (r.models.length > 2 ? ` +${r.models.length - 2} รุ่น` : "")
              : `${r.equipmentCount} เครื่อง`}
          </span>
          <WomsStatusChip label={RELATION_LABEL[r.relation]} tone={RELATION_TONE[r.relation]} />
        </Stack>
      ),
    },
    ...(showContracts
      ? [
          {
            key: "contracts",
            label: "สัญญา",
            sortValue: (r: SummaryRow) => r.contractSummary?.overdueInstallments ?? 0,
            render: (r: SummaryRow) => {
              const c = r.contractSummary;
              if (!c || !c.liveContracts) return <span className="muted">—</span>;
              if (c.overdueInstallments > 0)
                return (
                  <Box data-testid="customer-overdue">
                    <Typography component="span" sx={{ fontSize: 14, fontWeight: 700, color: "#b3261e" }}>
                      ค้าง {c.overdueInstallments} งวด
                    </Typography>
                    <Typography component="div" sx={{ fontSize: 12, color: "text.secondary" }}>
                      ฿{c.overdueAmount.toLocaleString("th-TH")} · {c.oldestOverdueDays} วัน
                    </Typography>
                  </Box>
                );
              return <span>ปกติ · {c.liveContracts} สัญญา</span>;
            },
          } as WomsColumn<SummaryRow>,
        ]
      : []),
    ...(showJobs
      ? [
          {
            key: "job",
            label: "งานล่าสุด",
            hideBelowLg: true,
            sortValue: (r: SummaryRow) => r.latestJob?.jobDate ?? "",
            render: (r: SummaryRow) => {
              const j = r.latestJob;
              if (!j) return <span className="muted">—</span>;
              const when = apptRelative(j.jobDate, "", bangkokToday()).main;
              return (
                <WomsTwoLine
                  main={
                    <Link href={`/jobs/${encodeURIComponent(j.jobId)}`} onClick={(e) => e.stopPropagation()}>
                      {when}
                    </Link>
                  }
                  sub={`${j.jobName || j.jobId}${j.status && j.status !== "OPEN" ? ` (${JOB_STATUS_SHORT[j.status] ?? j.status})` : ""}`}
                />
              );
            },
          } as WomsColumn<SummaryRow>,
        ]
      : []),
    {
      key: "sales",
      label: "เซลล์",
      hideBelowLg: true,
      sortValue: (r) => r.ownerSale?.name ?? "",
      render: (r) =>
        r.ownerSale?.name || r.siteOwnerSales?.length ? (
          <WomsTwoLine main={r.ownerSale?.name || "—"} sub={r.siteOwnerSales?.length ? `สาขา: ${r.siteOwnerSales.join(", ")}` : undefined} />
        ) : (
          <span className="muted">—</span>
        ),
    },
    // FB-22: ปุ่มแก้ไขชัดเจนในรายการ (ผู้มีสิทธิ์แก้ไขเท่านั้น)
    ...(canEditPartner
      ? [
          {
            key: "edit",
            label: "",
            align: "right",
            render: (r: SummaryRow) => (
              <Button size="small" variant="outlined" startIcon={<EditIcon />} component={Link} href={`/partners/${r.id}?from=customers&edit=1`} data-testid="customer-edit">
                แก้ไข
              </Button>
            ),
          } as WomsColumn<SummaryRow>,
        ]
      : []),
  ];

  const customerCols: WomsColumn<CustomerHit>[] = [
    { key: "name", label: "ชื่อ", sortValue: (c) => c.name, render: (c) => <Link href={`/partners/${c.id}?from=customers`}>{c.name}</Link> },
    { key: "type", label: "ประเภท", sortValue: (c) => partnerTypeLabel[c.type] ?? c.type, render: (c) => partnerTypeLabel[c.type] ?? c.type },
    { key: "phone", label: "เบอร์โทร", render: (c) => c.phone || "-" },
    {
      key: "by",
      label: "พบจาก",
      render: (c) => c.matchedLabel ?? (c.matchedBy === "customer" ? "ชื่อลูกค้า" : "สาขา/เครื่องที่เกี่ยวข้อง"),
    },
    ...(canEditPartner
      ? [
          {
            key: "edit",
            label: "",
            render: (c: CustomerHit) => (
              <Button size="small" variant="outlined" startIcon={<EditIcon />} component={Link} href={`/partners/${c.id}?from=customers&edit=1`}>
                แก้ไข
              </Button>
            ),
          } as WomsColumn<CustomerHit>,
        ]
      : []),
  ];

  const siteCols: WomsColumn<SiteHit>[] = [
    { key: "label", label: "สาขา", sortValue: (s) => s.label || "", render: (s) => <Link href={`/partners/${s.partnerId}?from=customers`}>{s.label || "-"}</Link> },
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
        e.customerId ? <Link href={`/partners/${e.customerId}?from=customers`}>{e.customerName || "(ไม่ระบุชื่อ)"}</Link> : e.customerName || "-",
    },
    { key: "site", label: "สาขา", hideBelowLg: true, render: (e) => e.siteLabel || "-" },
  ];

  // ยอดคำนวณจากเครื่องและสัญญา ACTIVE ที่ผูกลูกค้าจริงทุกครั้ง (ไม่ใช่ตัวเลขที่พิมพ์เก็บไว้)
  const stats: Array<[RelationFilter, string, number]> = summary
    ? [
        ["", "ลูกค้าทั้งหมด", summary.totals.customers],
        ["RENTAL_ANY", "ลูกค้าเช่า", summary.inclusive?.rental ?? summary.totals.rental + summary.totals.both],
        ["SALE_ANY", "ลูกค้าซื้อ", summary.inclusive?.sale ?? summary.totals.sale + summary.totals.both],
        ["BOTH", "ทั้งเช่าและซื้อ", summary.totals.both],
        ["NONE", "ยังไม่มีเครื่อง/สัญญา", summary.totals.none],
      ]
    : [];

  const totalSites = summary ? summary.items.reduce((n, r) => n + (r.siteCount || 0), 0) : 0;
  const views: Array<{ value: RelationFilter | "ALL"; label: string; count?: number }> = stats.map(([key, label, n]) => ({
    value: (key || "ALL") as RelationFilter | "ALL",
    label: key ? label.replace(/^ลูกค้า/, "") : "ทั้งหมด",
    count: n,
  }));

  return (
    <>
      <WomsPageHeader
        title="ลูกค้า"
        subtitle={summary ? `${summary.totals.customers.toLocaleString("th-TH")} ลูกค้า · ${totalSites.toLocaleString("th-TH")} สาขา/จุดติดตั้ง` : "ฐานข้อมูลลูกค้า"}
        actions={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <CustomerImport onDone={loadSummary} />
            {has("partners:export") ? (
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() =>
                  downloadFile("/api/customers/export.xlsx", "woms-customers.xlsx").catch((e) =>
                    toast.error(e instanceof ApiError ? e.message : "ส่งออกไม่สำเร็จ")
                  )
                }
              >
                ส่งออก Excel
              </Button>
            ) : null}
            {has("partners:create") ? (
              <Button component={Link} href="/partners/new?from=customers" variant="contained" startIcon={<AddIcon />}>
                เพิ่มลูกค้า
              </Button>
            ) : null}
          </Stack>
        }
      />

      {/* ค้นหา: พิมพ์แล้วกรองตารางทันที · กด Enter/ปุ่ม = ค้นทั้งระบบ (ชื่อร้าน สาขา Serial) */}
      <Stack direction={{ xs: "column", md: "row" }} gap={1} flexWrap="wrap" useFlexGap alignItems={{ md: "center" }} sx={{ mb: 2 }} component="form" onSubmit={search}>
        <TextField
          label="ค้นหาลูกค้า"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setTableQ(e.target.value);
          }}
          placeholder="ชื่อ รหัสลูกค้า เบอร์โทร"
          sx={{ maxWidth: { md: 320 } }}
          InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ color: "text.secondary", mr: 1 }} /> }}
        />
        <Button
          type="submit"
          variant="outlined"
          disabled={busy || !q.trim()}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{ flexShrink: 0 }}
        >
          {busy ? "กำลังค้นหา…" : "ค้นสาขา / Serial"}
        </Button>
      </Stack>
      <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mb: 2 }} data-testid="customer-pills">
        {/* ENTECH design: กลุ่มลูกค้า (เช่า/ซื้อ) และประเภท (บริษัท/บุคคล) เป็น pill ใต้ช่องค้นหา */}
        {summary && !summaryError ? (
          <Box sx={{ minWidth: 0 }}>
            <WomsViewPills
              ariaLabel="กลุ่มลูกค้า"
              options={views}
              value={(relation || "ALL") as RelationFilter | "ALL"}
              onChange={(v) => setRelation(v === "ALL" ? "" : (v as RelationFilter))}
            />
          </Box>
        ) : null}
        <Box sx={{ width: "1px", alignSelf: "stretch", bgcolor: "divider", mx: 0.5 }} />
        {/* ENTECH design + P4-03: แยก บริษัท / บุคคล เป็น pill (ตัวกรองเดิม customerKind — กรองที่หน้าเว็บจากข้อมูลชุดเดียวกัน) */}
        <WomsViewPills
          ariaLabel="ประเภทลูกค้า"
          options={[
            { value: "ALL", label: "ทุกประเภท" },
            { value: "COMPANY", label: "บริษัท", count: summary?.items.filter((r) => r.customerKind === "COMPANY").length },
            { value: "PERSON", label: "บุคคล", count: summary?.items.filter((r) => r.customerKind === "PERSON").length },
            { value: "AGENCY", label: "หน่วยงาน", count: summary?.items.filter((r) => r.customerKind === "AGENCY").length },
            { value: "UNSET", label: "ยังไม่ระบุ", count: summary?.items.filter((r) => !r.customerKind).length },
          ]}
          value={kind || "ALL"}
          onChange={(v) => setKind(v === "ALL" ? "" : v)}
        />
      </Stack>

      {error ? <WomsErrorState message={error} /> : null}
      {empty ? <WomsEmptyState title={`ไม่พบข้อมูลที่ตรงกับ “${result?.query}”`} /> : null}

      {result && !empty ? (
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h2">ผลค้นทั้งระบบ “{result.query}”</Typography>
            <Button size="small" variant="outlined" onClick={() => setResult(null)}>
              ปิดผลค้นหา
            </Button>
          </Stack>
          {result.customers.length > 0 ? (
            <Section title={`ลูกค้า (${result.counts.customers})`}>
              <WomsDataTable
                caption="ลูกค้าที่ค้นพบ"
                rows={result.customers}
                columns={customerCols}
                rowKey={(c) => c.id}
                pageSize={10}
                renderCard={(c) => (
                  <LinkCard href={`/partners/${c.id}?from=customers`}>
                    <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{c.name}</Typography>
                    <Typography variant="body2">
                      {partnerTypeLabel[c.type] ?? c.type} · {c.phone || "ไม่มีเบอร์"}
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
                  <LinkCard href={`/partners/${s.partnerId}?from=customers`}>
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
        </Box>
      ) : null}

      {summaryError ? (
        <WomsErrorState message={summaryError} onRetry={loadSummary} />
      ) : (
        <>
          <WomsDataTable
            caption="รายชื่อลูกค้า"
            rows={rows}
            columns={summaryCols}
            rowKey={(r) => r.id}
            loading={summaryLoading}
            pageSize={25}
            emptyTitle="ไม่มีลูกค้าในกลุ่มนี้"
            renderCard={(r) => (
              <LinkCard href={`/partners/${r.id}?from=customers`}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography sx={{ fontWeight: 600, color: "text.primary" }}>
                    {r.customerCode ? <span className="mono">{r.customerCode} · </span> : null}
                    {r.name}
                  </Typography>
                  <WomsStatusChip label={RELATION_LABEL[r.relation]} tone={RELATION_TONE[r.relation]} />
                </Stack>
                <Typography variant="body2">
                  {r.customerKind ? `${KIND_LABEL[r.customerKind]} · ` : ""}
                  {r.siteCount} สาขา · {r.equipmentCount} เครื่อง{r.phone ? ` · ${r.phone}` : ""}
                </Typography>
              </LinkCard>
            )}
          />
        </>
      )}
    </>
  );
}
