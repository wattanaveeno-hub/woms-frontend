"use client";

// ---------------------------------------------------------------------------
// รายละเอียดอะไหล่ (PART-02 / BR-04.1)
//   การ์ด 1: รหัสพาร์ท ชื่อ รุ่นเครื่องที่ใช้ได้ (หลายรุ่น) รูป
//   การ์ด 2: ประวัติราคาซื้อ (ต้นทุนที่ Admin ใส่ในใบงาน) / ราคาขาย (จาก QUO — นับเฉพาะที่ตอบรับ)
//   การ์ด 3: ประวัติการใช้รายเครื่อง
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import ImageNotSupportedIcon from "@mui/icons-material/ImageNotSupported";
import { api, ApiError } from "@/lib/api";
import type { StockTransaction } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { bangkokDateTime } from "@/lib/date";
import {
  baht,
  partsApi,
  type PartDetail,
  type PartMachineUsage,
  type PartPurchaseEntry,
  type PartSaleEntry,
} from "@/lib/partsApi";
import PartForm, { partToForm } from "@/components/PartForm";
import {
  WomsDataTable,
  WomsErrorState,
  WomsFormSection,
  WomsKeyValue,
  WomsLoadingState,
  WomsPageHeader,
  WomsStatCard,
  WomsStatGrid,
  WomsStatusChip,
  type WomsColumn,
} from "@/components/woms";

type SaleRow = PartSaleEntry & { _k: number };

const cardBox = { border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 } as const;

export default function PartDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { has } = useAuth();
  const toast = useToast();
  const canManage = has("stock:manage");

  const [data, setData] = useState<PartDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Phase 7 (ENTECH design "PartDetail"): ยอดคงเหลือจริงในคลัง + ความเคลื่อนไหวของอะไหล่นี้ (ผู้มีสิทธิ์ดูสต๊อก)
  const [stock, setStock] = useState<{ qty: number; reorderPoint: number; below: boolean; unitCost: number | null } | null>(null);
  const [moves, setMoves] = useState<StockTransaction[]>([]);
  useEffect(() => {
    if (!has("stock:view")) return;
    let alive = true;
    Promise.all([api.stockBalances(), api.stockTransactions({ partId: id, limit: 50 })])
      .then(([b, t]) => {
        if (!alive) return;
        const row = b.items.find((r) => r.partId === id);
        setStock(row ? { qty: row.totalQty, reorderPoint: row.reorderPoint, below: row.belowReorder, unitCost: row.unitCost } : { qty: 0, reorderPoint: 0, below: false, unitCost: null });
        setMoves(t.items);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id, has]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await partsApi.detail(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลอะไหล่ไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <WomsErrorState message={error} onRetry={load} />;
  if (!data) return <WomsLoadingState />;
  const { part, summary } = data;

  const purchaseCols: WomsColumn<PartPurchaseEntry>[] = [
    { key: "at", label: "บันทึกเมื่อ", sortValue: (r) => r.recordedAt, render: (r) => <span className="mono">{bangkokDateTime(r.recordedAt)}</span> },
    { key: "job", label: "ใบงาน", sortValue: (r) => r.jobId, render: (r) => <Link href={`/jobs/${encodeURIComponent(r.jobId)}`} className="mono">{r.jobId}</Link> },
    {
      key: "serial",
      label: "เครื่อง (SN)",
      render: (r) =>
        r.equipmentId ? <Link href={`/equipment/${r.equipmentId}`} className="mono">{r.serial}</Link> : <span className="mono">{r.serial || "—"}</span>,
    },
    { key: "qty", label: "จำนวน", align: "right", render: (r) => <span className="mono">{r.qty} {r.unit}</span> },
    { key: "unitCost", label: "ราคาซื้อ/หน่วย", align: "right", sortValue: (r) => r.unitCost, render: (r) => <span className="mono">{baht(r.unitCost)}</span> },
    { key: "total", label: "รวม", align: "right", render: (r) => <span className="mono">{baht(r.totalCost)}</span> },
    { key: "by", label: "ผู้บันทึก", hideBelowLg: true, render: (r) => r.recordedBy },
  ];

  const saleCols: WomsColumn<SaleRow>[] = [
    { key: "date", label: "วันที่", sortValue: (r) => r.issueDate, render: (r) => <span className="mono">{r.issueDate}</span> },
    { key: "qt", label: "ใบเสนอราคา", render: (r) => <Link href={`/quotations/${r.quotationId}`} className="mono">{r.quotationNo}</Link> },
    { key: "customer", label: "ลูกค้า", hideBelowLg: true, render: (r) => r.customerName || "—" },
    { key: "serial", label: "เครื่อง", hideBelowLg: true, render: (r) => <span className="mono">{r.serial || "—"}</span> },
    { key: "qty", label: "จำนวน", align: "right", render: (r) => <span className="mono">{r.qty}</span> },
    { key: "price", label: "ราคาขาย/หน่วย", align: "right", sortValue: (r) => r.unitPrice, render: (r) => <span className="mono">{baht(r.unitPrice)}</span> },
    { key: "total", label: "ยอดบรรทัด", align: "right", render: (r) => <span className="mono">{baht(r.lineTotal)}</span> },
    {
      key: "status",
      label: "สถานะ",
      render: (r) => <Chip size="small" color={r.counted ? "success" : "default"} label={r.counted ? `${r.statusLabel} · นับเป็นยอดขาย` : r.statusLabel} />,
    },
  ];

  const machineCols: WomsColumn<PartMachineUsage>[] = [
    {
      key: "serial",
      label: "เครื่อง (SN)",
      sortValue: (m) => m.serial,
      render: (m) => (m.equipmentId ? <Link href={`/equipment/${m.equipmentId}`} className="mono">{m.serial}</Link> : <span className="mono">{m.serial || "—"}</span>),
    },
    { key: "model", label: "รุ่น", render: (m) => m.model || "—" },
    { key: "qty", label: "ใช้รวม", align: "right", sortValue: (m) => m.totalQty, render: (m) => <span className="mono">{m.totalQty} {part.unit}</span> },
    {
      key: "jobs",
      label: "จากใบงาน",
      render: (m) => (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {m.jobIds.map((j) => (
            <Link key={j} href={`/jobs/${encodeURIComponent(j)}`} className="mono">
              {j}
            </Link>
          ))}
        </Stack>
      ),
    },
    { key: "last", label: "ใช้ล่าสุด", hideBelowLg: true, sortValue: (m) => m.lastUsedAt, render: (m) => <span className="mono">{bangkokDateTime(m.lastUsedAt)}</span> },
  ];

  return (
    <>
      <WomsPageHeader
        back={{ href: "/stock", label: "อะไหล่ & สต๊อก" }}
        title={
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap component="span">
            <span>{part.name}</span>
            {stock?.below ? <WomsStatusChip label="ใกล้หมด" tone="warning" /> : null}
          </Stack>
        }
        subtitle={
          <>
            <span className="mono">{part.code}</span> · หน่วย: {part.unit || "—"}
            {part.category ? ` · ${part.category}` : ""}
          </>
        }
        actions={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button component={Link} href="/parts" startIcon={<ArrowBackIcon />}>
              รายการอะไหล่
            </Button>
            {canManage && !editing ? (
              <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditing(true)}>
                แก้ไข
              </Button>
            ) : null}
            {has("stock:receive") ? (
              <Button variant="contained" component={Link} href={`/stock?receive=${encodeURIComponent(part.id)}`} data-testid="part-receive">
                รับเข้าสต๊อก
              </Button>
            ) : null}
          </Stack>
        }
      />

      {stock ? (
        <WomsStatGrid>
          <WomsStatCard label="คงเหลือรวม" value={`${stock.qty.toLocaleString("th-TH")} ${part.unit}`} hint={stock.reorderPoint ? `จุดสั่งซื้อ ${stock.reorderPoint}` : undefined} />
          {has("parts:cost_view") && stock.unitCost != null ? <WomsStatCard label="ต้นทุนต่อหน่วย (สต๊อก)" value={baht(stock.unitCost)} /> : null}
          <WomsStatCard label="ราคาขาย" value={baht(part.sellPrice)} />
        </WomsStatGrid>
      ) : null}

      <WomsStatGrid>
        <WomsStatCard label="ใช้ไปแล้วรวม" value={`${summary.totalQty.toLocaleString("th-TH")} ${part.unit}`} />
        <WomsStatCard label="จำนวนเครื่องที่ใช้" value={summary.machineCount} />
        <WomsStatCard label="ต้นทุนรวม (บาท)" value={baht(summary.totalCost)} />
        {data.salesVisible ? <WomsStatCard label="ยอดขายที่ตอบรับ (บาท)" value={baht(summary.soldRevenue)} hint={`${summary.soldQty} หน่วย`} /> : null}
      </WomsStatGrid>

      <WomsFormSection title="ข้อมูลอะไหล่">
        {editing ? (
          <PartForm
            existing={part}
            initial={partToForm(part)}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              toast.success("บันทึกข้อมูลอะไหล่แล้ว");
              load();
            }}
          />
        ) : (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            {part.image ? (
              <Box component="img" src={part.image} alt={part.name} sx={{ width: 160, height: 160, objectFit: "cover", borderRadius: 1, border: 1, borderColor: "divider" }} />
            ) : (
              <Box sx={{ width: 160, height: 160, display: "grid", placeItems: "center", color: "text.disabled", border: 1, borderColor: "divider", borderRadius: 1 }}>
                <Stack alignItems="center" spacing={0.5}>
                  <ImageNotSupportedIcon />
                  <Typography variant="body2">ไม่มีรูป</Typography>
                </Stack>
              </Box>
            )}
            <Box sx={{ flex: 1 }}>
              <WomsKeyValue
                items={[
                  ["รหัสพาร์ท", <span key="c" className="mono">{part.code}</span>],
                  ["ชื่อ", part.name],
                  ["หน่วย", part.unit || "—"],
                  [
                    "รุ่นเครื่องที่ใช้ได้",
                    part.compatibleModels.length ? (
                      <Stack key="m" direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                        {part.compatibleModels.map((m) => (
                          <Chip key={m} size="small" label={m} />
                        ))}
                      </Stack>
                    ) : (
                      "—"
                    ),
                  ],
                  part.note ? ["หมายเหตุ", part.note] : null,
                ]}
              />
            </Box>
          </Stack>
        )}
      </WomsFormSection>

      <WomsFormSection title="ประวัติราคาซื้อ (ต้นทุนจากใบงาน)">
        {/* CURRENT_IMPLEMENTATION_ASSUMPTION (Q-12): ราคาซื้อเป็นต้นทุนต่อหน่วย รวม = จำนวน × ราคา */}
        <WomsDataTable
          caption="ประวัติราคาซื้อ"
          rows={data.purchases}
          columns={purchaseCols}
          rowKey={(r) => r.useId}
          pageSize={10}
          emptyTitle="ยังไม่มีการบันทึกใช้อะไหล่นี้ในใบงาน"
          renderCard={(r) => (
            <Box sx={cardBox}>
              <Typography sx={{ color: "text.primary" }}>
                <Link href={`/jobs/${encodeURIComponent(r.jobId)}`} className="mono">{r.jobId}</Link> · <span className="mono">{r.serial || "—"}</span>
              </Typography>
              <Typography variant="body2">
                {r.qty} {r.unit} × {baht(r.unitCost)} = {baht(r.totalCost)} บาท · {bangkokDateTime(r.recordedAt)}
              </Typography>
            </Box>
          )}
        />
      </WomsFormSection>

      {data.salesVisible ? (
        <WomsFormSection title="ประวัติราคาขาย (จากใบเสนอราคา)">
          <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
            นับเป็นยอดขายเฉพาะใบเสนอราคาที่ลูกค้าตอบรับแล้ว ใบสถานะอื่นแสดงไว้เพื่ออ้างอิงราคา
          </Typography>
          <WomsDataTable
            caption="ประวัติราคาขาย"
            rows={data.sales.map((r, i) => ({ ...r, _k: i }))}
            columns={saleCols}
            rowKey={(r) => `${r.quotationId}-${r._k}`}
            pageSize={10}
            emptyTitle="ยังไม่มีใบเสนอราคาที่เลือกอะไหล่นี้"
            renderCard={(r) => (
              <Box sx={cardBox}>
                <Typography sx={{ color: "text.primary" }}>
                  <Link href={`/quotations/${r.quotationId}`} className="mono">{r.quotationNo}</Link> · {r.statusLabel}
                  {r.counted ? " · นับเป็นยอดขาย" : ""}
                </Typography>
                <Typography variant="body2">
                  {r.qty} × {baht(r.unitPrice)} = {baht(r.lineTotal)} บาท · {r.issueDate}
                </Typography>
              </Box>
            )}
          />
        </WomsFormSection>
      ) : null}

      {has("stock:view") ? (
        <WomsFormSection title="ความเคลื่อนไหวในคลัง">
          <WomsDataTable
            caption="ความเคลื่อนไหวของอะไหล่ในคลัง"
            rows={moves}
            columns={[
              { key: "at", label: "วันที่", sortValue: (t) => t.at, render: (t) => <span className="mono">{bangkokDateTime(t.at)}</span> },
              { key: "move", label: "รายการ", render: (t) => t.moveLabel },
              { key: "loc", label: "คลัง (จาก → เข้า)", render: (t) => `${t.fromLocationName || "—"} → ${t.toLocationName || "—"}` },
              { key: "qty", label: "จำนวน", align: "right", render: (t) => <span className="mono">{t.qty}</span> },
              { key: "ref", label: "อ้างอิง", render: (t) => (t.jobId ? <Link href={`/jobs/${encodeURIComponent(t.jobId)}`} className="mono">{t.jobId}</Link> : "—") },
              { key: "by", label: "ผู้ทำรายการ", hideBelowLg: true, render: (t) => t.byName },
            ]}
            rowKey={(t) => t.id}
            pageSize={10}
            emptyTitle="ยังไม่มีความเคลื่อนไหวในคลัง"
            renderCard={(t) => (
              <Box sx={cardBox}>
                <Typography sx={{ color: "text.primary" }}>
                  {t.moveLabel} × {t.qty}
                </Typography>
                <Typography variant="body2">
                  {t.fromLocationName || "—"} → {t.toLocationName || "—"} · {bangkokDateTime(t.at)}
                </Typography>
              </Box>
            )}
          />
        </WomsFormSection>
      ) : null}

      <WomsFormSection title="ประวัติการใช้รายเครื่อง">
        <WomsDataTable
          caption="การใช้รายเครื่อง"
          rows={data.byMachine}
          columns={machineCols}
          rowKey={(m) => m.equipmentId || `s:${m.serial}`}
          pageSize={10}
          emptyTitle="ยังไม่มีเครื่องที่ใช้อะไหล่นี้"
          renderCard={(m) => (
            <Box sx={cardBox}>
              <Typography sx={{ color: "text.primary" }}>
                <span className="mono">{m.serial || "—"}</span> · {m.model || "—"} · ใช้ {m.totalQty} {part.unit}
              </Typography>
              <Typography variant="body2">ใบงาน: {m.jobIds.join(", ")}</Typography>
            </Box>
          )}
        />
      </WomsFormSection>
    </>
  );
}
