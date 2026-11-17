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
  grantLabel = "เพิ่มรายคน",
  denyLabel = "ตัดรายคน",
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
  /** ข้อความกำกับสิทธิ์ที่ไฮไลต์ (หน้าบทบาท: เทียบกับค่าตั้งต้น) */
  grantLabel?: string;
  denyLabel?: string;
}) {
  const m = buildMatrix(items, held);
  const rows = groups?.length ? groups : DEFAULT_UI_GROUPS;
  const inCell = (g: string, a: string) => items.filter((i) => (i.uiGroup ?? "settings") === g && (i.uiAction ?? "other") === a);
  // Redesign 13 พ.ย. 69 ตาม Roles.dc.html: ช่องติ๊กเขียว · บางส่วน = ขีดกลาง · ไม่มีสิทธิ์ในเรื่องนั้นเลย = "—"
  const headSx = { fontSize: 13, fontWeight: 600, color: "#51626f", bgcolor: "#fafcfd", borderBottom: "1px solid #e2e7ec", py: 1.25, whiteSpace: "nowrap" } as const;
  const cellSx = { borderBottom: "1px solid #e2e7ec", py: 1.5, fontSize: 14 } as const;
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" aria-label={caption} data-testid="permission-matrix">
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...headSx, pl: 2.5 }}>เรื่อง</TableCell>
            {UI_ACTION_COLUMNS.map((c) => (
              <TableCell key={c.key} align="center" sx={headSx}>
                {c.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((g) => (
            <TableRow key={g.key} hover>
              <TableCell component="th" scope="row" sx={{ ...cellSx, pl: 2.5, fontWeight: 400, whiteSpace: "nowrap" }}>
                {g.label}
              </TableCell>
              {UI_ACTION_COLUMNS.map((c) => {
                const cell = m.get(`${g.key}|${c.key}`);
                if (!cell) {
                  return (
                    <TableCell key={c.key} align="center" sx={{ ...cellSx, color: "#51626f" }}>
                      —
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
                        {granted?.has(k.key) ? ` (${grantLabel})` : denied?.has(k.key) ? ` (${denyLabel})` : ""}
                      </Box>
                    ))}
                  </Box>
                );
                const state = cell.on === 0 ? "off" : cell.on === cell.total ? "on" : "part";
                const label = `${g.label} ${c.label}: ${state === "on" ? "มีครบ" : state === "part" ? `มี ${cell.on} จาก ${cell.total}` : "ไม่มี"}`;
                return (
                  <Tooltip key={c.key} title={title} arrow>
                    <TableCell
                      align="center"
                      tabIndex={0}
                      aria-label={label}
                      data-state={state}
                      sx={{
                        ...cellSx,
                        bgcolor: changed ? "rgba(181, 115, 10, 0.10)" : undefined,
                        outline: changed ? "1px dashed" : undefined,
                        outlineColor: changed ? "warning.main" : undefined,
                        cursor: "help",
                      }}
                    >
                      <Box
                        component="span"
                        aria-hidden
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 18,
                          height: 18,
                          borderRadius: "3px",
                          border: state === "off" ? "2px solid #8a98a3" : "2px solid #1b5e37",
                          bgcolor: state === "off" ? "#fff" : "#1b5e37",
                          color: "#fff",
                          verticalAlign: "middle",
                        }}
                      >
                        {state === "on" ? (
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5}>
                            <path d="M5 12l5 5 9-10" />
                          </svg>
                        ) : state === "part" ? (
                          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4}>
                            <path d="M5 12h14" />
                          </svg>
                        ) : null}
                      </Box>
                      {state === "part" ? (
                        <Box component="span" sx={{ ml: 0.5, fontSize: 12, color: "#51626f", verticalAlign: "middle" }}>
                          {cell.on}/{cell.total}
                        </Box>
                      ) : null}
                    </TableCell>
                  </Tooltip>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Typography component="p" sx={{ fontSize: 13, color: "#51626f", px: 2.5, pt: 1.25 }}>
        ช่องเขียว = มีครบ · ขีด = มีบางส่วน (ชี้ที่ช่องเพื่อดูสิทธิ์ย่อย) · ช่องว่าง = ไม่มี · — = เรื่องนี้ไม่มีการกระทำนี้
      </Typography>
    </Box>
  );
}
