"use client";
/**
 * ตารางสิทธิ์ "เรื่อง × ดู/สร้าง/แก้ไข/อนุมัติ/ส่งออก" (อ่านอย่างเดียว)
 * แต่ละช่องรวมสิทธิ์ย่อยหลายตัว — แสดง ✓ เมื่อมีครบ, จำนวนเมื่อมีบางส่วน, "—" เมื่อไม่มี · ชี้ที่ช่องเพื่อดูรายการ
 */
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { PermUiGroup } from "@/lib/api";
import { DEFAULT_UI_GROUPS, UI_ACTION_COLUMNS, buildMatrix, permLabel, type CatalogItem } from "@/lib/permissionUi";

export default function PermissionMatrix({
  items,
  groups,
  held,
  granted,
  denied,
  caption = "ตารางสิทธิ์",
}: {
  items: CatalogItem[];
  groups?: { key: PermUiGroup; label: string }[];
  /** สิทธิ์ที่มีผลจริง */
  held: ReadonlySet<string>;
  /** สิทธิ์ที่เพิ่มรายคน (ไฮไลต์) */
  granted?: ReadonlySet<string>;
  /** สิทธิ์ที่ตัดรายคน (ไฮไลต์) */
  denied?: ReadonlySet<string>;
  caption?: string;
}) {
  const m = buildMatrix(items, held);
  const rows = groups?.length ? groups : DEFAULT_UI_GROUPS;
  const inCell = (g: string, a: string) => items.filter((i) => (i.uiGroup ?? "settings") === g && (i.uiAction ?? "other") === a);
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" aria-label={caption} data-testid="permission-matrix">
        <TableHead>
          <TableRow>
            <TableCell>เรื่อง</TableCell>
            {UI_ACTION_COLUMNS.map((c) => (
              <TableCell key={c.key} align="center">
                {c.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((g) => (
            <TableRow key={g.key}>
              <TableCell component="th" scope="row" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                {g.label}
              </TableCell>
              {UI_ACTION_COLUMNS.map((c) => {
                const cell = m.get(`${g.key}|${c.key}`);
                if (!cell) {
                  return (
                    <TableCell key={c.key} align="center" sx={{ color: "text.disabled" }}>
                      ·
                    </TableCell>
                  );
                }
                const keys = inCell(g.key, c.key);
                const changed = keys.some((k) => granted?.has(k.key) || denied?.has(k.key));
                const title = (
                  <Box component="span" sx={{ display: "block" }}>
                    {keys.map((k) => (
                      <Box component="span" key={k.key} sx={{ display: "block" }}>
                        {held.has(k.key) ? "✓" : "✕"} {permLabel(k.key)}
                        {granted?.has(k.key) ? " (เพิ่มรายคน)" : denied?.has(k.key) ? " (ตัดรายคน)" : ""}
                      </Box>
                    ))}
                  </Box>
                );
                const text = cell.on === 0 ? "—" : cell.on === cell.total ? "✓" : `${cell.on}/${cell.total}`;
                return (
                  <Tooltip key={c.key} title={title} arrow>
                    <TableCell
                      align="center"
                      tabIndex={0}
                      sx={{
                        fontWeight: cell.on ? 700 : 400,
                        color: cell.on ? "success.dark" : "text.secondary",
                        bgcolor: changed ? "rgba(181, 115, 10, 0.10)" : undefined,
                        outline: changed ? "1px dashed" : undefined,
                        outlineColor: changed ? "warning.main" : undefined,
                        cursor: "help",
                      }}
                    >
                      {text}
                    </TableCell>
                  </Tooltip>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Typography variant="caption" color="text.secondary">
        ✓ มีครบ · ตัวเลข = มีบางส่วน · — ไม่มี · ชี้ที่ช่องเพื่อดูสิทธิ์ย่อย
      </Typography>
    </Box>
  );
}
