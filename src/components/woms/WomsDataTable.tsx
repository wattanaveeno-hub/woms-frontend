"use client";

// ---------------------------------------------------------------------------
// ตารางงานปฏิบัติการมาตรฐาน — ตารางเต็มบนจอใหญ่ / การ์ดบนมือถือ
// ---------------------------------------------------------------------------
// ไม่ย่อตารางเดสก์ท็อปลงบนมือถือ: ต่ำกว่า md จะเรนเดอร์ renderCard() แทน
// มีสถานะ loading / error (+ลองใหม่) / empty ครบในตัว · เรียงลำดับด้วยหัวคอลัมน์ได้
// การแบ่งหน้าเป็นฝั่ง client ของรายการที่ได้มาแล้วเท่านั้น (ตัวกรองยังเป็นของ API)
import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { WomsEmptyState, WomsErrorState, WomsLoadingState } from "./WomsStates";
import { flattenGroups, groupRows, withGroupHeaders } from "@/lib/tableGroups";
import Typography from "@mui/material/Typography";

/**
 * แบ่งกลุ่มแถว (เสริม · ใช้ทั้งตารางเดสก์ท็อปและการ์ดมือถือ) — ไม่ส่ง = พฤติกรรมเดิม
 *   key: กลุ่มของแถว · label: ชื่อกลุ่ม · badge: ป้ายสั้นหน้าชื่อ (เช่น เดือนย่อ/อักษรแรกของช่าง)
 *   order: ลำดับกลุ่ม (ไม่ส่ง = ตามลำดับที่พบในแถว) · countLabel: ข้อความจำนวนในกลุ่ม (นับจากทุกแถว)
 */
export interface WomsGroupBy<T> {
  key: (row: T) => string;
  label: (key: string) => React.ReactNode;
  badge?: (key: string) => React.ReactNode;
  order?: string[];
  countLabel?: (n: number) => React.ReactNode;
}

export interface WomsColumn<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  /** ค่าที่ใช้เรียง — ไม่ส่ง = เรียงไม่ได้ */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right" | "center";
  width?: number | string;
  /** ซ่อนคอลัมน์รองบนจอกลาง (md) */
  hideBelowLg?: boolean;
}

export interface WomsDataTableProps<T> {
  rows: T[];
  columns: WomsColumn<T>[];
  rowKey: (row: T) => string;
  renderCard: (row: T) => React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  pageSize?: number;
  initialSort?: { key: string; dir: "asc" | "desc" };
  caption?: string;
  /** คลิกทั้งแถว (เสริม — คอลัมน์หลักควรมีลิงก์ให้ใช้คีย์บอร์ดได้ด้วย) */
  onRowClick?: (row: T) => void;
  /** เลือกหลายแถว (เสริม) — "เลือกทั้งหมด" มีผลเฉพาะแถวในหน้าที่มองเห็นอยู่ */
  selection?: WomsSelection<T>;
  /** ข้อความเหนือตาราง (เช่นลำดับการเรียง) และปุ่มเครื่องมือด้านขวา */
  toolbar?: React.ReactNode;
  /** ซ่อนตัวแบ่งหน้าในตาราง — ใช้เมื่อหน้าจอแบ่งหน้าที่เซิร์ฟเวอร์เอง (เช่น ประวัติการใช้งาน) */
  hidePager?: boolean;
  /** แบ่งกลุ่มแถว (เสริม) */
  groupBy?: WomsGroupBy<T>;
}

export interface WomsSelection<T> {
  isSelected: (row: T) => boolean;
  onToggle: (row: T) => void;
  /** all = true → เลือกทุกแถวใน rows · false → ยกเลิกทุกแถวใน rows */
  onTogglePage: (rows: T[], all: boolean) => void;
  /** ข้อความ aria-label ของ checkbox รายแถว */
  label: (row: T) => string;
  /** แถวที่เลือกไม่ได้ (เช่น อยู่ในแผนแล้ว) — "เลือกทั้งหมด" จะข้ามแถวนี้ */
  isDisabled?: (row: T) => boolean;
}

export function WomsDataTable<T>({
  rows,
  columns,
  rowKey,
  renderCard,
  loading,
  error,
  onRetry,
  emptyTitle = "ไม่มีข้อมูล",
  emptyDescription,
  emptyAction,
  pageSize = 25,
  hidePager = false,
  initialSort,
  caption,
  onRowClick,
  selection,
  toolbar,
  groupBy,
}: WomsDataTableProps<T>) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("md"));
  const wide = useMediaQuery(theme.breakpoints.up("lg"));
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(pageSize);

  // ผลลัพธ์ชุดใหม่ (เปลี่ยนตัวกรอง/ค้นหา) → กลับหน้าแรกเสมอ ไม่ค้างอยู่หน้ากลางของชุดเก่า
  useEffect(() => {
    setPage(0);
  }, [rows]);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    const out = [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      return typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "th");
    });
    return sort.dir === "asc" ? out : out.reverse();
  }, [rows, columns, sort]);

  // groupBy: เรียงแถวตามกลุ่ม (ภายในกลุ่มคงลำดับที่เรียงแล้ว) · จำนวนต่อกลุ่มนับจากทุกแถว
  const grouped = useMemo(() => (groupBy ? flattenGroups(groupRows(sorted, groupBy.key, groupBy.order)) : null), [sorted, groupBy]);
  const ordered = grouped ? grouped.rows : sorted;

  // รายการเปลี่ยน (ตัวกรองใหม่) แล้วหน้าเดิมเกินจำนวน → กลับหน้าแรก
  const maxPage = Math.max(0, Math.ceil(ordered.length / perPage) - 1);
  const current = Math.min(page, maxPage);
  const pageRows = ordered.slice(current * perPage, current * perPage + perPage);
  const groupHead = (k: string) =>
    groupBy ? (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        {groupBy.badge ? (
          <Box
            component="span"
            aria-hidden
            sx={{ display: "inline-grid", placeItems: "center", minWidth: 26, height: 24, px: 0.5, borderRadius: "6px", bgcolor: "primary.light", color: "primary.dark", fontSize: 12, fontWeight: 700 }}
          >
            {groupBy.badge(k)}
          </Box>
        ) : null}
        <Typography component="span" sx={{ fontSize: 14, fontWeight: 700, color: "text.primary" }}>
          {groupBy.label(k)}
        </Typography>
        <Typography component="span" sx={{ fontSize: 13, color: "text.secondary" }}>
          {(groupBy.countLabel ?? ((n: number) => `${n} รายการ`))(grouped?.counts.get(k) ?? 0)}
        </Typography>
      </Stack>
    ) : null;

  const bar = toolbar ? (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
      {toolbar}
    </Stack>
  ) : null;
  if (loading)
    return (
      <>
        {bar}
        <WomsLoadingState />
      </>
    );
  if (error)
    return (
      <>
        {bar}
        <WomsErrorState message={error} onRetry={onRetry} />
      </>
    );
  if (rows.length === 0)
    return (
      <>
        {bar}
        <WomsEmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </>
    );

  const selectable = selection ? pageRows.filter((r) => !selection.isDisabled?.(r)) : [];
  const pageAll = !!selection && selectable.length > 0 && selectable.every((r) => selection.isSelected(r));
  const pageSome = !!selection && !pageAll && selectable.some((r) => selection.isSelected(r));

  const pager = hidePager ? null : (
    <TablePagination
      component="div"
      count={ordered.length}
      page={current}
      onPageChange={(_, p) => setPage(p)}
      rowsPerPage={perPage}
      onRowsPerPageChange={(e) => {
        setPerPage(Number(e.target.value));
        setPage(0);
      }}
      rowsPerPageOptions={[10, 25, 50, 100]}
      labelRowsPerPage={mobile ? "ต่อหน้า" : "แถวต่อหน้า"}
      labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
    />
  );

  if (mobile) {
    return (
      <Box>
        {bar}
        <Stack spacing={1.5}>
          {groupBy
            ? withGroupHeaders(pageRows, groupBy.key).map((it, i) =>
                "header" in it ? (
                  <Box key={`g:${it.header}:${i}`} role="heading" aria-level={3} sx={{ px: 1.5, py: 1, mt: i ? 1 : 0, bgcolor: "neutral.light", borderRadius: 1 }} data-testid="woms-group-header">
                    {groupHead(it.header)}
                  </Box>
                ) : (
                  <Box key={rowKey(it.row)}>{renderCard(it.row)}</Box>
                )
              )
            : pageRows.map((r) =>
            selection ? (
              <Stack key={rowKey(r)} direction="row" spacing={0.5} alignItems="flex-start">
                <Checkbox
                  checked={selection.isSelected(r)}
                  disabled={selection.isDisabled?.(r)}
                  onChange={() => selection.onToggle(r)}
                  inputProps={{ "aria-label": selection.label(r) }}
                  sx={{ mt: 1 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>{renderCard(r)}</Box>
              </Stack>
            ) : (
              <Box key={rowKey(r)}>{renderCard(r)}</Box>
            )
          )}
        </Stack>
        {ordered.length > perPage ? pager : null}
      </Box>
    );
  }

  const visible = columns.filter((c) => wide || !c.hideBelowLg);
  return (
    <>
    {bar}
    <Paper variant="outlined">
      <TableContainer>
        <Table size="small" aria-label={caption}>
          <TableHead>
            <TableRow>
              {selection ? (
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={pageAll}
                    indeterminate={pageSome}
                    onChange={() => selection.onTogglePage(selectable, !pageAll)}
                    disabled={selectable.length === 0}
                    inputProps={{ "aria-label": "เลือกทั้งหมดในหน้านี้" }}
                  />
                </TableCell>
              ) : null}
              {visible.map((c) => (
                <TableCell key={c.key} align={c.align} sx={{ width: c.width, whiteSpace: "nowrap" }}>
                  {c.sortValue ? (
                    <TableSortLabel
                      active={sort?.key === c.key}
                      direction={sort?.key === c.key ? sort.dir : "asc"}
                      onClick={() => {
                        setPage(0);
                        setSort((s) =>
                          s?.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: "asc" }
                        );
                      }}
                    >
                      {c.label}
                    </TableSortLabel>
                  ) : (
                    c.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {(groupBy ? withGroupHeaders(pageRows, groupBy.key) : pageRows.map((row) => ({ row }))).map((it, i) =>
              "header" in it ? (
                <TableRow key={`g:${it.header}:${i}`} data-testid="woms-group-header">
                  <TableCell colSpan={visible.length + (selection ? 1 : 0)} sx={{ bgcolor: "neutral.light", py: 1 }} component="th" scope="colgroup">
                    {groupHead(it.header)}
                  </TableCell>
                </TableRow>
              ) : ((r: T) => (
              <TableRow
                key={rowKey(r)}
                hover
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                sx={onRowClick ? { cursor: "pointer" } : undefined}
                selected={selection?.isSelected(r)}
              >
                {selection ? (
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selection.isSelected(r)}
                      disabled={selection.isDisabled?.(r)}
                      onChange={() => selection.onToggle(r)}
                      inputProps={{ "aria-label": selection.label(r) }}
                    />
                  </TableCell>
                ) : null}
                {visible.map((c) => (
                  <TableCell key={c.key} align={c.align}>
                    {c.render(r)}
                  </TableCell>
                ))}
              </TableRow>
              ))(it.row)
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {pager}
    </Paper>
    </>
  );
}
