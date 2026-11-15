"use client";

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { api, ApiError } from "@/lib/api";
import type { InventoryRow, WarehouseStockRow } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { equipmentTabs } from "@/lib/equipmentTabs";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { WomsDataTable, WomsLinkTabs, WomsPermissionGate, WomsPageHeader, WomsStatCard, WomsStatGrid, type WomsColumn } from "@/components/woms";

const COUNTS: Array<[keyof InventoryRow, string]> = [
  ["total", "ทั้งหมด"],
  ["inStock", "ว่าง"],
  ["reserved", "จอง"],
  ["rented", "เช่า"],
  ["sold", "ขายแล้ว"],
  ["repair", "ซ่อม"],
  ["retired", "ปลดระวาง"],
];

function InventoryInner() {
  const { has } = useAuth();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [byWh, setByWh] = useState<WarehouseStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .equipmentInventory()
      .then((res) => {
        setRows(res.rows);
        setByWh(res.warehouses ?? []);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const sum = (k: keyof InventoryRow) => rows.reduce((s, r) => s + ((r[k] as number) || 0), 0);
  // Phase 7: ตารางเครื่องในคลังแยกตามคลัง (แถว = รุ่น · คอลัมน์ = คลัง · ค่า = ว่าง (+จอง))
  const whs = [...new Set(byWh.map((r) => r.warehouse))];
  const whModels = [...new Set(byWh.map((r) => r.model))];
  const cell = (w: string, m: string) => byWh.find((r) => r.warehouse === w && r.model === m);

  const columns: WomsColumn<InventoryRow>[] = [
    { key: "category", label: "หมวดหมู่", sortValue: (r) => r.category, render: (r) => r.category },
    { key: "model", label: "รุ่น", sortValue: (r) => r.model, render: (r) => r.model },
    ...COUNTS.map(([k, label]) => ({
      key: k as string,
      label,
      align: "right" as const,
      sortValue: (r: InventoryRow) => r[k] as number,
      render: (r: InventoryRow) => <span className="mono" style={k === "total" ? { fontWeight: 700 } : undefined}>{(r[k] as number) ?? 0}</span>,
    })),
  ];

  return (
    <>
      <WomsPageHeader title="สต็อกรวม (ตามหมวด/รุ่น)" subtitle="สรุปจำนวนเครื่องจริงของบริษัท แยกตามหมวดหมู่และรุ่น (ไม่รวมเครื่องลูกค้าภายนอก)" />
      <WomsLinkTabs ariaLabel="คลังเครื่อง" current="/inventory" tabs={equipmentTabs(has)} />

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
              ว่าง {r.inStock} · จอง {r.reserved ?? 0} · เช่า {r.rented} · ขาย {r.sold} · ซ่อม {r.repair} · ปลดระวาง {r.retired}
            </Typography>
          </Box>
        )}
      />

      {!loading && !error ? (
        <Paper variant="outlined" sx={{ p: 2, mt: 2 }} data-testid="stock-by-warehouse">
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            เครื่องในคลังแยกตามคลัง
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            ตัวเลข = ว่างพร้อมใช้ · วงเล็บ = จองแล้ว
          </Typography>
          {byWh.length === 0 ? (
            <Typography variant="body2">ยังไม่มีเครื่องในคลัง</Typography>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>รุ่น</TableCell>
                    {whs.map((w) => (
                      <TableCell key={w} align="right">
                        {w}
                      </TableCell>
                    ))}
                    <TableCell align="right">รวมว่าง</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {whModels.map((m) => (
                    <TableRow key={m}>
                      <TableCell>{m}</TableCell>
                      {whs.map((w) => {
                        const c = cell(w, m);
                        return (
                          <TableCell key={w} align="right" className="mono">
                            {c ? c.inStock : "–"}
                            {c?.reserved ? ` (${c.reserved})` : ""}
                          </TableCell>
                        );
                      })}
                      <TableCell align="right" className="mono" sx={{ fontWeight: 700 }}>
                        {byWh.filter((r) => r.model === m).reduce((n, r) => n + r.inStock, 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Paper>
      ) : null}
    </>
  );
}

export default function InventoryPage() {
  return (
    <WomsPermissionGate perm="inventory:view">
      <InventoryInner />
    </WomsPermissionGate>
  );
}
