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
import { ContractStatusBadge, ContractTypeBadge } from "@/components/ContractBadges";
import { useUrlFilters } from "@/lib/urlFilters";
import { useRef } from "react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
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

const TYPES: ContractType[] = ["RENTAL", "HIRE_PURCHASE", "SALE"];
// QA BUG-025 — สัญญาสร้างใหม่เป็น DRAFT แล้ว (backend เปลี่ยนตาม AC-CON-01)
// ตัวกรองจึงต้องมีครบทุกสถานะที่ระบบผลิตได้ ไม่งั้นสัญญาร่างจะกรองหาไม่เจอเลย
const STATUSES: ContractStatus[] = ["DRAFT", "ACTIVE", "COMPLETED", "EXPIRED", "CANCELLED"];

export default function ContractsPage() {
  const router = useRouter();
  const { has } = useAuth();
  const [items, setItems] = useState<Contract[]>([]);
  // QA BUG-009 — ตัวกรองสะท้อนลง URL (ส่งลิงก์/bookmark/F5/Back ใช้งานได้จริง)
  const [f, setF] = useUrlFilters({ type: "", status: "", q: "" });
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
      const res = await api.listContracts({
        type: type || undefined,
        status: status || undefined,
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
  }, [type, status, q]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: WomsColumn<Contract>[] = [
    { key: "no", label: "เลขสัญญา", sortValue: (c) => c.contractNo, render: (c) => <Link href={`/contracts/${c.id}`} className="code" onClick={(e) => e.stopPropagation()}>{c.contractNo}</Link> },
    { key: "type", label: "ประเภท", sortValue: (c) => c.type, render: (c) => <ContractTypeBadge type={c.type} /> },
    { key: "cust", label: "ลูกค้า", sortValue: (c) => c.customerName, render: (c) => c.customerName },
    { key: "eq", label: "เครื่อง", hideBelowLg: true, sortValue: (c) => c.serial || "", render: (c) => `${c.serial || "—"}${c.model ? ` · ${c.model}` : ""}` },
    { key: "total", label: "ยอดรวม", align: "right", sortValue: (c) => c.totalAmount, render: (c) => <span className="mono">{fmtMoney(c.totalAmount)}</span> },
    { key: "bal", label: "คงเหลือ", align: "right", sortValue: (c) => c.balance, render: (c) => <span className="mono">{fmtMoney(c.balance)}</span> },
    { key: "status", label: "สถานะ", sortValue: (c) => c.status, render: (c) => <ContractStatusBadge status={c.status} /> },
  ];

  return (
    <>
      <WomsPageHeader
        title="สัญญา"
        subtitle={loading ? "กำลังโหลด…" : `${items.length} สัญญา`}
        actions={
          <>
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
                if (!(r["ชื่อลูกค้า"] || "").trim()) return { ok: false, error: "ไม่มีชื่อลูกค้า" };
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

      <WomsFilterPanel
        search={<WomsSearchBar value={q} onChange={setQ} placeholder="เลขสัญญา / ลูกค้า / serial / รุ่น" />}
        activeCount={[type, status].filter(Boolean).length}
        onClear={() => setF({ type: "", status: "" })}
      >
        <WomsSelectFilter label="ประเภท" value={type} onChange={(v) => setType(v as ContractType | "")} options={TYPES.map((t) => ({ value: t, label: contractTypeLabel[t] }))} />
        <WomsSelectFilter label="สถานะ" value={status} onChange={(v) => setStatus(v as ContractStatus | "")} options={STATUSES.map((s) => ({ value: s, label: contractStatusLabel[s] }))} />
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
                  <ContractStatusBadge status={c.status} />
                </Stack>
                <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{c.customerName}</Typography>
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
