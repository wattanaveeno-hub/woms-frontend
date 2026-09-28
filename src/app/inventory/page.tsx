"use client";

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { api, ApiError } from "@/lib/api";
import type { InventoryRow } from "@/lib/types";
import { WomsDataTable, WomsPageHeader, WomsStatCard, WomsStatGrid, type WomsColumn } from "@/components/woms";

const COUNTS: Array<[keyof InventoryRow, string]> = [
  ["total", "ทั้งหมด"],
  ["inStock", "ว่าง"],
  ["rented", "เช่า"],
  ["sold", "ขายแล้ว"],
  ["repair", "ซ่อม"],
  ["retired", "ปลดระวาง"],
];

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .equipmentInventory()
      .then((res) => setRows(res.rows))
      .catch((e) => setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const sum = (k: keyof InventoryRow) => rows.reduce((s, r) => s + (r[k] as number), 0);

  const columns: WomsColumn<InventoryRow>[] = [
    { key: "category", label: "หมวดหมู่", sortValue: (r) => r.category, render: (r) => r.category },
    { key: "model", label: "รุ่น", sortValue: (r) => r.model, render: (r) => r.model },
    ...COUNTS.map(([k, label]) => ({
      key: k as string,
      label,
      align: "right" as const,
      sortValue: (r: InventoryRow) => r[k] as number,
      render: (r: InventoryRow) => <span className="mono" style={k === "total" ? { fontWeight: 700 } : undefined}>{r[k] as number}</span>,
    })),
  ];

  return (
    <>
      <WomsPageHeader title="สต็อกรวม (ตามหมวด/รุ่น)" subtitle="สรุปจำนวนเครื่องจริงในคลัง แยกตามหมวดหมู่และรุ่น" />

      {/* QA BUG-004 — ยอดรวมนับจากทุกหน้าเสมอ จึงแยกออกมาแสดงเหนือตาราง ไม่วางใต้แถวของหน้าปัจจุบัน */}
      {!loading && !error && rows.length ? (
        <>
          <Typography variant="body2" sx={{ mb: 1 }}>
            รวมทุกหน้า ({rows.length} รายการ)
          </Typography>
          <WomsStatGrid max={6}>
            {COUNTS.map(([k, label]) => (
              <WomsStatCard key={k} value={sum(k)} label={label} />
            ))}
          </WomsStatGrid>
        </>
      ) : null}

      <WomsDataTable
        caption="สต็อกรวมตามหมวดและรุ่น"
        rows={rows}
        columns={columns}
        rowKey={(r) => `${r.category}||${r.model}`}
        loading={loading}
        error={error}
        onRetry={load}
        pageSize={10}
        emptyTitle="ยังไม่มีเครื่องในคลัง"
        renderCard={(r) => (
          <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{r.model}</Typography>
              <strong className="mono">{r.total}</strong>
            </Stack>
            <Typography variant="body2">{r.category}</Typography>
            <Typography variant="body2">
              ว่าง {r.inStock} · เช่า {r.rented} · ขาย {r.sold} · ซ่อม {r.repair} · ปลดระวาง {r.retired}
            </Typography>
          </Box>
        )}
      />
    </>
  );
}
