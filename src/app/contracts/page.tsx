"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import BulkImport from "@/components/BulkImport";
import { num } from "@/lib/xlsx";
import { useAuth } from "@/lib/AuthContext";
import type { Contract, ContractStatus, ContractType, ContractFormValues } from "@/lib/types";
import { contractTypeLabel, contractStatusLabel, fmtMoney } from "@/lib/options";
import { ContractLifecycleBadge, ContractTypeBadge } from "@/components/ContractBadges";
import { useUrlFilters } from "@/lib/urlFilters";
import { useRef } from "react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import { downloadFile } from "@/lib/api";
import { contractListQuery, contractQuoApi, type ContractPaymentState } from "@/lib/contractQuoApi";
import { WomsStatCard, WomsStatGrid, WomsStatusChip } from "@/components/woms";
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

export default function ContractsPage() {
  const router = useRouter();
  const { has } = useAuth();
  const [items, setItems] = useState<Contract[]>([]);
  // QA BUG-009 — ตัวกรองสะท้อนลง URL (ส่งลิงก์/bookmark/F5/Back ใช้งานได้จริง)
  const [f, setF] = useUrlFilters({ type: "", status: "", payment: "", q: "", lifecycle: "" });
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
  }, [type, status, payment, lifecycle, q]);

  // ---- ภาพรวม (CON-01 Dashboard) — คิดจากสัญญาทั้งหมด ไม่ขึ้นกับตัวกรองของตาราง ----
  const [all, setAll] = useState<Contract[] | null>(null);
  // โหลดใหม่ทุกครั้งที่ตารางโหลด (หลังนำเข้า/เปลี่ยนตัวกรอง) เพื่อให้ตัวเลขการ์ดเป็นปัจจุบัน
  useEffect(() => {
    contractQuoApi
      .listContracts({})
      .then((r) => setAll(r.items))
      .catch(() => setAll(null));
  }, [items]);
  const month = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7); // เดือนปัจจุบันตามเวลาไทย
  const stats = all
    ? {
        active: all.filter((c) => c.status === "ACTIVE").length,
        expiring: all.filter((c) => c.lifecycle === "EXPIRING").length,
        overdueCount: all.reduce((n, c) => n + (c.overdueCount ?? 0), 0),
        overdueAmount: all.reduce((n, c) => n + (c.overdueAmount ?? 0), 0),
        dueThisMonth: all
          .filter((c) => c.status === "ACTIVE" || c.status === "EXPIRED")
          .flatMap((c) => c.installments ?? [])
          .filter((it) => it.status === "PENDING" && it.dueDate.startsWith(month)),
      }
    : null;

  useEffect(() => {
    load();
  }, [load]);

  const columns: WomsColumn<Contract>[] = [
    { key: "no", label: "เลขสัญญา", sortValue: (c) => c.contractNo, render: (c) => <Link href={`/contracts/${c.id}`} className="code" onClick={(e) => e.stopPropagation()}>{c.contractNo}</Link> },
    { key: "type", label: "ประเภท", sortValue: (c) => c.type, render: (c) => <ContractTypeBadge type={c.type} /> },
    { key: "cust", label: "ลูกค้า", sortValue: (c) => c.customerName, render: (c) => c.customerName || "-" },
    { key: "eq", label: "เครื่อง", hideBelowLg: true, sortValue: (c) => c.serial || "", render: (c) => `${c.serial || "—"}${c.model ? ` · ${c.model}` : ""}` },
    { key: "total", label: "ยอดรวม", align: "right", sortValue: (c) => c.totalAmount, render: (c) => <span className="mono">{fmtMoney(c.totalAmount)}</span> },
    { key: "bal", label: "คงเหลือ", align: "right", sortValue: (c) => c.balance, render: (c) => <span className="mono">{fmtMoney(c.balance)}</span> },
    // CON-01 / CON-02 — สถานะการชำระของลูกค้า แยกจากสถานะสัญญา
    { key: "pay", label: "การชำระ", sortValue: (c) => c.paymentState ?? "", render: (c) => <PaymentChip c={c} /> },
    // CON-02 — แสดงสถานะที่ผู้ใช้เห็น (รวม "ใกล้หมดอายุ") ไม่ใช่สถานะที่เก็บ
    { key: "status", label: "สถานะสัญญา", sortValue: (c) => c.lifecycle ?? c.status, render: (c) => <ContractLifecycleBadge lifecycle={c.lifecycle ?? c.status} label={c.lifecycleLabel} /> },
    { key: "end", label: "สิ้นสุด", hideBelowLg: true, sortValue: (c) => c.endDate || "9999", render: (c) => c.endDate || "—" },
  ];

  const exportXlsx = () =>
    downloadFile(
      `/api/contracts/export.xlsx${contractListQuery({ type: type || undefined, status: status || undefined, payment: payment || undefined, lifecycle: lifecycle || undefined, q: q || undefined })}`,
      "contracts.xlsx"
    ).catch((e) => toast.error(e?.message ?? "Export ไม่สำเร็จ"));

  return (
    <>
      <WomsPageHeader
        title="สัญญา"
        subtitle={loading ? "กำลังโหลด…" : `${items.length} สัญญา`}
        actions={
          <>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportXlsx}>
            Export Excel
          </Button>
          <BulkImport<ContractFormValues>
              label="สัญญา"
              templateName="contract-template.xlsx"
              perm="contracts:create"
              headers={["ประเภท", "ชื่อลูกค้า", "โทร", "ที่อยู่", "Serial เครื่อง", "รุ่น", "วันเริ่ม", "ค่าเช่า/เดือน", "จำนวนเดือน", "มัดจำ", "ราคารวม", "เงินดาวน์", "จำนวนงวด", "หมายเหตุ"]}
              example={["RENTAL", "บริษัท ตัวอย่าง", "0812345678", "กรุงเทพ", "SN-0001", "RO-300", "2026-01-01", "7000", "12", "7000", "0", "0", "0", ""]}
              toValues={(r) => {
                const traw = (r["ประเภท"] || "").trim();
                const tmap: Record<string, ContractType> = { "เช่า": "RENTAL", "เช่าซื้อ": "HIRE_PURCHASE", "ขาย": "SALE" };
                const codes = ["RENTAL", "HIRE_PURCHASE", "SALE"];
                let type: ContractType;
                if (codes.includes(traw)) type = traw as ContractType;
                else if (tmap[traw]) type = tmap[traw];
                else return { ok: false, error: "ประเภทไม่ถูกต้อง: " + traw };
                // CON-01 / BR-06.1: สัญญาที่ยังไม่ผูกลูกค้าได้ (แสดง "-") — ไม่บังคับชื่อลูกค้าในไฟล์นำเข้า
                return { ok: true, value: {
                  type, customerName: r["ชื่อลูกค้า"] || "", customerPhone: r["โทร"] || "",
                  customerAddress: r["ที่อยู่"] || "", siteAddress: "", siteLat: 0, siteLng: 0, zone: "",
                  serial: r["Serial เครื่อง"] || "", model: r["รุ่น"] || "",
                  startDate: r["วันเริ่ม"] || "", rentPerMonth: num(r["ค่าเช่า/เดือน"]), periodMonths: num(r["จำนวนเดือน"]),
                  deposit: num(r["มัดจำ"]), totalPrice: num(r["ราคารวม"]), downPayment: num(r["เงินดาวน์"]),
                  installmentCount: num(r["จำนวนงวด"]), note: r["หมายเหตุ"] || "",
                } };
              }}
              create={(v) => api.createContract(v)}
              onDone={load}
            />
            {has("contracts:create") ? (
              <Button component={Link} href="/contracts/new" variant="contained" startIcon={<AddIcon />}>
                สร้างสัญญา
              </Button>
            ) : null}
          </>
        }
      />

      {stats ? (
        <WomsStatGrid>
          <WomsStatCard value={stats.active} label="สัญญาใช้งานอยู่" active={status === "ACTIVE"} onClick={() => setF({ status: "ACTIVE", lifecycle: "", payment: "" })} />
          <WomsStatCard
            value={stats.expiring}
            label="ใกล้หมดอายุ (3 เดือน)"
            tone={stats.expiring ? "warning" : "neutral"}
            active={lifecycle === "EXPIRING"}
            onClick={() => setF({ lifecycle: "EXPIRING", status: "", payment: "" })}
          />
          <WomsStatCard
            value={stats.overdueCount}
            label="งวดค้างชำระ"
            hint={`${fmtMoney(stats.overdueAmount)} บาท`}
            tone={stats.overdueCount ? "error" : "neutral"}
            active={payment === "OVERDUE"}
            onClick={() => setF({ payment: "OVERDUE", status: "", lifecycle: "" })}
          />
          <WomsStatCard
            value={stats.dueThisMonth.length}
            label="ครบกำหนดเดือนนี้"
            hint={`${fmtMoney(stats.dueThisMonth.reduce((n, it) => n + it.amount, 0))} บาท`}
          />
        </WomsStatGrid>
      ) : null}

      <WomsFilterPanel
        search={<WomsSearchBar value={q} onChange={setQ} placeholder="เลขสัญญา / ลูกค้า / serial / รุ่น" />}
        activeCount={[type, status, payment, lifecycle].filter(Boolean).length}
        onClear={() => setF({ type: "", status: "", payment: "", lifecycle: "" })}
      >
        <WomsSelectFilter label="ประเภท" value={type} onChange={(v) => setType(v as ContractType | "")} options={TYPES.map((t) => ({ value: t, label: contractTypeLabel[t] }))} />
        <WomsSelectFilter
          label="การชำระ"
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
          options={[
            { value: "ACTIVE", label: "ใช้งานอยู่" },
            { value: "EXPIRING", label: "ใกล้หมดอายุ" },
            { value: "EXPIRED", label: "หมดอายุ" },
            { value: "COMPLETED", label: "ชำระครบแล้ว" },
            { value: "DRAFT", label: "ร่างสัญญา" },
            { value: "CANCELLED", label: "ยกเลิก" },
          ]}
        />
        <WomsSelectFilter label="สถานะ (ที่บันทึก)" value={status} onChange={(v) => setStatus(v as ContractStatus | "")} options={STATUSES.map((s) => ({ value: s, label: contractStatusLabel[s] }))} />
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

function PaymentChip({ c }: { c: Contract }) {
  if (!c.paymentState || c.paymentState === "NONE") return <>-</>;
  return (
    <WomsStatusChip
      label={c.paymentStateLabel ?? (c.paymentState === "OVERDUE" ? "ค้างชำระ" : "ตรงกำหนด")}
      tone={c.paymentState === "OVERDUE" ? "error" : "success"}
    />
  );
}
