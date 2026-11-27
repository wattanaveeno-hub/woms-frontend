"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import ContractImport from "@/components/ContractImport";
import { useAuth } from "@/lib/AuthContext";
import type { Contract, ContractStatus, ContractType } from "@/lib/types";
import { contractTypeLabel, contractStatusLabel, contractLifecycleLabel, fmtMoney } from "@/lib/options";
import { CONTRACT_LIFECYCLE_FILTER_ORDER, contractSummaryStats } from "@/lib/contractRules";
import { bangkokToday, fmtDate } from "@/lib/date";
import { ContractLifecycleBadge, ContractTypeBadge } from "@/components/ContractBadges";
import { useUrlFilters } from "@/lib/urlFilters";
import { useRef } from "react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import { downloadFile } from "@/lib/api";
import { contractListQuery, contractQuoApi, type ContractPaymentState } from "@/lib/contractQuoApi";
import { WomsStatusChip } from "@/components/woms";
import Chip from "@mui/material/Chip";
import { useToast } from "@/components/Toast";
import {
  WomsDataTable,
  WomsFilterPanel,
  WomsPageHeader,
  WomsSearchBar,
  WomsSelectFilter,
  type WomsColumn,
} from "@/components/woms";

const TYPES: ContractType[] = ["RENTAL", "HIRE_PURCHASE", "SALE"];
// QA BUG-025 — สัญญาสร้างใหม่เป็น DRAFT แล้ว (backend เปลี่ยนตาม AC-CON-01)
// ตัวกรองจึงต้องมีครบทุกสถานะที่ระบบผลิตได้ ไม่งั้นสัญญาร่างจะกรองหาไม่เจอเลย
const STATUSES: ContractStatus[] = ["DRAFT", "ACTIVE", "COMPLETED", "EXPIRED", "CANCELLED"];

const EMPTY_TAB = { status: "", payment: "", lifecycle: "", due: "" };
const CONTRACT_TABS: { key: string; label: string; set: Partial<typeof EMPTY_TAB> }[] = [
  { key: "overdue", label: "ค้างชำระ", set: { payment: "OVERDUE" } },
  { key: "due", label: "ครบกำหนดชำระเดือนนี้", set: { due: "THIS_MONTH" } },
  { key: "expiring", label: "ใกล้หมดสัญญา 3 เดือน", set: { lifecycle: "EXPIRING" } },
  { key: "active", label: "ใช้งานอยู่", set: { status: "ACTIVE" } },
  { key: "draft", label: "ร่าง", set: { status: "DRAFT" } },
  { key: "all", label: "ทั้งหมด", set: {} },
];
function contractTabOf(f: Record<string, string>): string | false {
  const cur = { status: f.status || "", payment: f.payment || "", lifecycle: f.lifecycle || "", due: f.due || "" };
  const hit = CONTRACT_TABS.find((t) => {
    const want = { ...EMPTY_TAB, ...t.set };
    return (Object.keys(want) as (keyof typeof EMPTY_TAB)[]).every((k) => want[k] === cur[k]);
  });
  return hit ? hit.key : false;
}

export default function ContractsPage() {
  const router = useRouter();
  const { has } = useAuth();
  const [items, setItems] = useState<Contract[]>([]);
  // QA BUG-009 — ตัวกรองสะท้อนลง URL (ส่งลิงก์/bookmark/F5/Back ใช้งานได้จริง)
  const [f, setF] = useUrlFilters({ type: "", status: "", payment: "", q: "", lifecycle: "", due: "" });
  // DEF-07 — การ์ด "ครบกำหนดเดือนนี้" กดแล้วกรอง ?due=THIS_MONTH (backend กรองด้วยกติกาเดียวกับตัวเลขการ์ด)
  const due = f.due === "THIS_MONTH" ? "THIS_MONTH" : "";
  const lifecycle = f.lifecycle;
  const payment = f.payment as ContractPaymentState | "";
  const toast = useToast();
  const type = f.type as ContractType | "";
  const status = f.status as ContractStatus | "";
  const q = f.q;
  const setType = (v: ContractType | "") => setF({ type: v });
  const setStatus = (v: ContractStatus | "") => setF({ status: v });
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
      const res = await contractQuoApi.listContracts({
        type: type || undefined,
        status: status || undefined,
        payment: payment || undefined,
        lifecycle: lifecycle || undefined,
        due: due || undefined,
        q: q || undefined,
      });
      if (seq !== seqRef.current) return;
      setItems(res.items);
    } catch (e) {
      if (seq !== seqRef.current) return;
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [type, status, payment, lifecycle, due, q]);

  // ---- ภาพรวม (CON-01 Dashboard) — คิดจากสัญญาทั้งหมด ไม่ขึ้นกับตัวกรองของตาราง ----
  const [all, setAll] = useState<Contract[] | null>(null);
  // โหลดใหม่ทุกครั้งที่ตารางโหลด (หลังนำเข้า/เปลี่ยนตัวกรอง) เพื่อให้ตัวเลขการ์ดเป็นปัจจุบัน
  useEffect(() => {
    contractQuoApi
      .listContracts({})
      .then((r) => setAll(r.items))
      .catch(() => setAll(null));
  }, [items]);
  const today = bangkokToday();
  const month = today.slice(0, 7); // เดือนปัจจุบันตามเวลาไทย
  // DEF-07 — ค่าหลักของการ์ด = จำนวนสัญญาที่ตรงกับตัวกรองที่การ์ดพาไป (จำนวนงวด/ยอดเงินอยู่ใน hint)
  const stats = all ? contractSummaryStats(all, month) : null;
  const tab = contractTabOf(f);

  useEffect(() => {
    load();
  }, [load]);

  // ENTECH design (Contracts.dc.html): สัญญา · ลูกค้า (ชื่อ + เบอร์) · เครื่อง · ค่าเช่า/เดือน · ค้างชำระ (งวด · วัน) · ยอดค้าง · ปุ่มโทร/บันทึกรับเงิน
  //   ข้อมูลทั้งหมดมาจากรายการสัญญาเดิม (overdueCount/overdueAmount/installments ที่ backend คำนวณ) · คงเหลือ/สถานะสัญญา/สิ้นสุด ยังแสดงอยู่
  const columns: WomsColumn<Contract>[] = [
    {
      key: "no",
      label: "สัญญา",
      sortValue: (c) => c.contractNo,
      render: (c) => (
        <Stack spacing={0.25} alignItems="flex-start">
          <Link href={`/contracts/${c.id}`} className="code" onClick={(e) => e.stopPropagation()} style={{ fontWeight: 700 }}>
            {c.contractNo}
          </Link>
          <ContractTypeBadge type={c.type} />
        </Stack>
      ),
    },
    {
      key: "cust",
      label: "ลูกค้า",
      sortValue: (c) => c.customerName,
      render: (c) => (
        <Stack spacing={0}>
          <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color: "text.primary", minWidth: 120 }}>
            {c.customerName || "-"}
          </Typography>
          <Typography component="span" sx={{ fontSize: 12, color: "text.secondary" }}>
            <span style={{ whiteSpace: "nowrap" }}>{c.customerPhone || "ไม่มีเบอร์"}</span>
          </Typography>
        </Stack>
      ),
    },
    { key: "eq", label: "เครื่อง", hideBelowLg: true, sortValue: (c) => c.serial || "", render: (c) => (
      <Stack spacing={0}>
        <span>{c.model || "—"}</span>
        <span className="mono" style={{ fontSize: 12, color: "#51626f" }}>{c.serial || "—"}</span>
      </Stack>
    ) },
    {
      key: "rent",
      label: "ค่าเช่า",
      align: "right",
      sortValue: (c) => (c.rentUnit === "DAY" ? c.rentPerDay ?? 0 : c.rentPerMonth || 0),
      render: (c) =>
        c.type === "RENTAL" && c.rentUnit === "DAY" ? (
          <span className="mono">{fmtMoney(c.rentPerDay ?? 0)}/วัน</span>
        ) : c.type === "RENTAL" && c.rentPerMonth ? (
          <span className="mono">{fmtMoney(c.rentPerMonth)}/เดือน</span>
        ) : (
          <span className="mono" style={{ color: "#51626f" }}>—</span>
        ),
    },
    {
      key: "pay",
      label: "ค้างชำระ",
      sortValue: (c) => c.overdueCount ?? 0,
      render: (c) => {
        const days = overdueDays(c, today);
        if ((c.overdueCount ?? 0) > 0)
          return <WomsStatusChip label={`${c.overdueCount} งวด${days !== null ? ` · ${days} วัน` : ""}`} tone={(c.overdueCount ?? 0) > 1 ? "error" : "warning"} />;
        return <PaymentChip c={c} />;
      },
    },
    {
      key: "overdue",
      label: "ยอดค้าง",
      align: "right",
      sortValue: (c) => c.overdueAmount ?? 0,
      render: (c) =>
        (c.overdueAmount ?? 0) > 0 ? (
          <span className="mono" style={{ color: "#b3261e", fontWeight: 700 }}>{fmtMoney(c.overdueAmount ?? 0)}</span>
        ) : (
          <span className="mono" style={{ color: "#51626f" }}>—</span>
        ),
    },
    { key: "bal", label: "คงเหลือ", align: "right", hideBelowLg: true, sortValue: (c) => c.balance, render: (c) => <span className="mono">{fmtMoney(c.balance)}</span> },
    // CON-02 — แสดงสถานะที่ผู้ใช้เห็น (รวม "ใกล้หมดอายุ") ไม่ใช่สถานะที่เก็บ
    {
      key: "status",
      label: "สถานะสัญญา",
      sortValue: (c) => c.lifecycle ?? c.status,
      render: (c) => (
        <Stack spacing={0.25} alignItems="flex-start">
          <ContractLifecycleBadge lifecycle={c.lifecycle ?? c.status} label={c.lifecycleLabel} />
          <Typography component="span" sx={{ fontSize: 12, color: "text.secondary", whiteSpace: "nowrap" }}>
            สิ้นสุด <span className="mono">{fmtDate(c.endDate || "—")}</span>
          </Typography>
        </Stack>
      ),
    },
    {
      key: "act",
      label: "",
      render: (c) => (
        <Stack direction="row" spacing={0.75} justifyContent="flex-end" onClick={(e) => e.stopPropagation()}>
          {c.customerPhone ? (
            <Button size="small" variant="outlined" href={`tel:${c.customerPhone.replace(/[^\d+]/g, "")}`} data-testid="contract-call">
              โทร
            </Button>
          ) : null}
          {/* บันทึกรับเงินทำที่หน้าสัญญา (ตารางงวด) — ปุ่มนี้พาไปเฉพาะผู้มีสิทธิ์ contracts:pay และสัญญาที่มีงวดค้าง */}
          {has("contracts:pay") && (c.overdueCount ?? 0) > 0 ? (
            <Button size="small" variant="contained" component={Link} href={`/contracts/${c.id}#installments`} data-testid="contract-pay">
              <span style={{ whiteSpace: "nowrap" }}>บันทึกรับเงิน</span>
            </Button>
          ) : null}
        </Stack>
      ),
    },
  ];

  const exportXlsx = () =>
    downloadFile(
      `/api/contracts/export.xlsx${contractListQuery({ type: type || undefined, status: status || undefined, payment: payment || undefined, lifecycle: lifecycle || undefined, due: due || undefined, q: q || undefined })}`,
      "contracts.xlsx"
    ).catch((e) => toast.error(e?.message ?? "Export ไม่สำเร็จ"));

  return (
    <>
      <WomsPageHeader
        title="สัญญา"
        subtitle={
          loading
            ? "กำลังโหลด…"
            : stats
              ? `แสดง ${items.length} สัญญา · ใช้งานอยู่ ${stats.active} · ค้างชำระรวม ฿${fmtMoney(stats.overdueAmount)}`
              : `${items.length} สัญญา`
        }
        actions={
          <>
          {has("contracts:export") ? (
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportXlsx}>
              Export Excel
            </Button>
          ) : null}
          {/* BR-05 — นำเข้าที่เซิร์ฟเวอร์ (dry-run → ยืนยัน) แทน BulkImport เดิมที่ยิงสร้างทีละแถวจากเบราว์เซอร์ */}
          <ContractImport onDone={load} />
            {has("contracts:create") ? (
              <Button component={Link} href="/contracts/new" variant="contained" startIcon={<AddIcon />}>
                สร้างสัญญา
              </Button>
            ) : null}
          </>
        }
      />

      {/* Redesign: แท็บตามสิ่งที่ต้องทำ (ค้างชำระก่อน) แทนการ์ดตัวเลข — แต่ละแท็บคือชุดตัวกรองเดิม */}
      <Tabs
        value={tab}
        onChange={(_, v: string) => setF({ ...EMPTY_TAB, ...(CONTRACT_TABS.find((t) => t.key === v)?.set ?? {}) })}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label="สัญญาตามสิ่งที่ต้องทำ"
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        {CONTRACT_TABS.map((t) => {
          const hint =
            !stats || !all
              ? null
              : t.key === "overdue"
                ? `${stats.overdueContracts} · ฿${fmtMoney(stats.overdueAmount)}`
                : t.key === "due"
                  ? `${stats.dueContracts}`
                  : t.key === "expiring"
                    ? `${stats.expiring}`
                    : t.key === "active"
                      ? `${stats.active}`
                      : t.key === "draft"
                        ? `${all.filter((c) => c.status === "DRAFT").length}`
                        : `${all.length}`;
          return (
            <Tab
              key={t.key}
              value={t.key}
              sx={{ minHeight: 44, fontWeight: 600 }}
              label={
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <span>{t.label}</span>
                  {hint !== null ? (
                    <Chip
                      size="small"
                      label={hint}
                      sx={{ height: 20, fontSize: 12, ...(t.key === "overdue" && stats?.overdueContracts ? { bgcolor: "#fbeceb", color: "#b3261e" } : {}) }}
                    />
                  ) : null}
                </Stack>
              }
            />
          );
        })}
      </Tabs>

      <WomsFilterPanel
        search={<WomsSearchBar value={q} onChange={setQ} placeholder="ค้นหาเลขที่สัญญา, ลูกค้า, SN, รุ่น" />}
        activeCount={[type, status, payment, lifecycle, due].filter(Boolean).length}
        onClear={() => setF({ type: "", status: "", payment: "", lifecycle: "", due: "" })}
      >
        <WomsSelectFilter label="ประเภท" value={type} onChange={(v) => setType(v as ContractType | "")} options={TYPES.map((t) => ({ value: t, label: contractTypeLabel[t] }))} />
        <WomsSelectFilter
          label="สถานะลูกค้า"
          value={payment}
          onChange={(v) => setF({ payment: v })}
          options={[
            { value: "OVERDUE", label: "ค้างชำระ" },
            { value: "ON_TIME", label: "ตรงกำหนด" },
          ]}
        />
        <WomsSelectFilter
          label="สถานะที่เห็น"
          value={lifecycle}
          onChange={(v) => setF({ lifecycle: v })}
          // DEF-05 — ป้ายชุดเดียวกับ badge และ backend (options.ts contractLifecycleLabel)
          options={CONTRACT_LIFECYCLE_FILTER_ORDER.map((v) => ({ value: v, label: contractLifecycleLabel[v] }))}
        />
        <WomsSelectFilter label="สถานะ (ที่บันทึก)" value={status} onChange={(v) => setStatus(v as ContractStatus | "")} options={STATUSES.map((s) => ({ value: s, label: contractStatusLabel[s] }))} />
        <WomsSelectFilter label="ครบกำหนด" value={due} onChange={(v) => setF({ due: v })} options={[{ value: "THIS_MONTH", label: "ครบกำหนดเดือนนี้" }]} />
      </WomsFilterPanel>

      <WomsDataTable
        caption="รายการสัญญา"
        rows={items}
        columns={columns}
        rowKey={(c) => c.id}
        loading={loading}
        error={error}
        onRetry={load}
        pageSize={10}
        onRowClick={(c) => router.push(`/contracts/${c.id}`)}
        emptyTitle="ยังไม่มีสัญญาที่ตรงเงื่อนไข"
        emptyAction={
          has("contracts:create") ? (
            <Button component={Link} href="/contracts/new" variant="outlined" startIcon={<AddIcon />}>
              สร้างสัญญาแรก
            </Button>
          ) : undefined
        }
        renderCard={(c) => (
          <Card>
            <CardActionArea component={Link} href={`/contracts/${c.id}`}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <span className="code">{c.contractNo}</span>
                  <ContractLifecycleBadge lifecycle={c.lifecycle ?? c.status} label={c.lifecycleLabel} />
                </Stack>
                <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{c.customerName || "-"}</Typography>
                <PaymentChip c={c} />
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                  <ContractTypeBadge type={c.type} />
                  <Typography variant="body2">{c.serial || "—"}{c.model ? ` · ${c.model}` : ""}</Typography>
                </Stack>
                <Typography variant="body2">
                  ยอดรวม {fmtMoney(c.totalAmount)} · คงเหลือ {fmtMoney(c.balance)}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        )}
      />
    </>
  );
}

/** จำนวนวันที่งวดค้างเก่าสุดเลยกำหนด (จากตารางงวดที่ backend ส่งมา) — ไม่มีข้อมูลงวด = null */
function overdueDays(c: Contract, today: string): number | null {
  const unpaid = (c.installments ?? []).filter((i) => i.status !== "PAID" && i.dueDate && i.dueDate < today).map((i) => i.dueDate).sort();
  if (!unpaid.length) return null;
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${unpaid[0]}T00:00:00Z`)) / 86_400_000);
}

function PaymentChip({ c }: { c: Contract }) {
  if (!c.paymentState || c.paymentState === "NONE") return <>-</>;
  return (
    <WomsStatusChip
      label={c.paymentStateLabel ?? (c.paymentState === "OVERDUE" ? "ค้างชำระ" : "ตรงกำหนด")}
      tone={c.paymentState === "OVERDUE" ? "error" : "success"}
    />
  );
}
