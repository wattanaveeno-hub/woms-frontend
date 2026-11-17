"use client";
/**
 * ตารางเลือกสิทธิ์ "เรื่อง × ดู/สร้าง/แก้ไข/อนุมัติ/ส่งออก" (17 พ.ย. 69) — ใช้ทั้งหน้าแก้สิทธิ์บทบาทหลักและหน้าเพิ่มบทบาท
 *   · ติ๊กที่ช่อง = ให้/เอาออกทั้งช่อง (เฉพาะสิทธิ์ที่เลือกได้) · กดชื่อเรื่องเพื่อเลือกสิทธิ์ย่อย
 *   · เรื่องที่เลือกไม่ได้ทั้งเรื่อง แสดงเหตุผลตรงแถว
 *   · before = ชุดก่อนแก้ (แสดง + เพิ่ม / − ตัด) · base = ค่าตั้งต้น (แสดง "ต่างจากตั้งต้น")
 */
import { Fragment, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { PermUiGroup } from "@/lib/api";
import { DEFAULT_UI_GROUPS, UI_ACTION_COLUMNS, permLabel, type CatalogItem } from "@/lib/permissionUi";

const COLS = [...UI_ACTION_COLUMNS, { key: "other" as const, label: "อื่น ๆ" }];

export const changeTagSx = {
  add: { bgcolor: "#e1f1e4", color: "#14432a" },
  del: { bgcolor: "#fbeceb", color: "#b3261e" },
} as const;

export function ChangeTag({ kind, children }: { kind: "add" | "del"; children: React.ReactNode }) {
  return (
    <Box component="span" sx={{ fontSize: 12, fontWeight: 600, borderRadius: 999, px: 1, py: 0.25, whiteSpace: "nowrap", ...changeTagSx[kind] }}>
      {children}
    </Box>
  );
}

export default function PermissionPicker({
  catalog,
  groups,
  value,
  onChange,
  disabledReason,
  before,
  base,
  onlyDiff = false,
  caption = "เลือกสิทธิ์",
  rowAction,
  autoOn,
  shortReason = (r: string) => (r.startsWith("ขอบเขต") ? "ขอบเขตไม่รองรับ" : r.startsWith("ได้อัตโนมัติ") ? "อัตโนมัติ" : "มอบต่อไม่ได้"),
  reasonHint,
  showBlockedSummary = true,
}: {
  catalog: CatalogItem[];
  groups?: { key: PermUiGroup; label: string }[];
  value: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  /** เหตุผลที่เลือก/เอาออกสิทธิ์นี้ไม่ได้ (null = เลือกได้) */
  disabledReason: (key: string) => string | null;
  before?: ReadonlySet<string>;
  base?: ReadonlySet<string>;
  /** แสดงเฉพาะเรื่องที่ต่างจากค่าตั้งต้นหรือกำลังเปลี่ยน */
  onlyDiff?: boolean;
  caption?: string;
  /** ลิงก์/ปุ่มเพิ่มเติมท้ายเหตุผลของเรื่องที่เลือกไม่ได้ (เช่น "เปลี่ยนขอบเขต") — null = ไม่แสดง */
  rowAction?: (reason: string) => React.ReactNode;
  /** สิทธิ์ที่ได้อัตโนมัติจากสิทธิ์อื่น (แสดงติ๊กแบบกดไม่ได้) */
  autoOn?: (key: string) => boolean;
  /** ป้ายสั้นข้างสิทธิ์ที่เลือกไม่ได้ */
  shortReason?: (reason: string) => string;
  /** คำแนะนำต่อท้ายเหตุผลในป้ายด้านบน */
  reasonHint?: (reason: string) => string | null;
  /** แสดงป้ายสรุปสิทธิ์ที่เลือกไม่ได้ด้านบนตาราง */
  showBlockedSummary?: boolean;
}) {
  const rows = groups?.length ? groups : DEFAULT_UI_GROUPS;
  const [open, setOpen] = useState<string | null>(null);
  const inGroup = (g: string) => catalog.filter((i) => (i.uiGroup ?? "settings") === g);
  const inCell = (g: string, a: string) => catalog.filter((i) => (i.uiGroup ?? "settings") === g && (i.uiAction ?? "other") === a);
  const can = (k: string) => disabledReason(k) === null;
  const [showAll, setShowAll] = useState<string | null>(null);
  // ป้ายด้านบน: สิทธิ์ที่เลือกไม่ได้ แยกตามเหตุผล (ไม่นับที่ถืออยู่แล้วหรือได้อัตโนมัติ)
  const blocked = new Map<string, string[]>();
  for (const i of catalog) {
    const r = disabledReason(i.key);
    if (!r || value.has(i.key) || autoOn?.(i.key)) continue;
    blocked.set(r, [...(blocked.get(r) ?? []), i.key]);
  }
  const blockedTotal = [...blocked.values()].reduce((n, l) => n + l.length, 0);
  const rowDiff = (g: string) =>
    inGroup(g).some((i) => (base && value.has(i.key) !== base.has(i.key)) || (before && value.has(i.key) !== before.has(i.key)));

  const setMany = (keys: string[], on: boolean) => {
    const n = new Set(value);
    for (const k of keys) {
      if (on) n.add(k);
      else n.delete(k);
    }
    onChange(n);
  };

  const headSx = { fontSize: 13, fontWeight: 600, color: "#51626f", bgcolor: "#fafcfd", borderBottom: "1px solid #e2e7ec", py: 1.25, whiteSpace: "nowrap" } as const;
  const cellSx = { borderBottom: "1px solid #e2e7ec", py: 1, fontSize: 14 } as const;
  const changedSx = { bgcolor: "rgba(181, 115, 10, 0.10)", outline: "1px dashed", outlineColor: "warning.main", outlineOffset: "-3px" } as const;

  return (
    <Box>
      {showBlockedSummary && blockedTotal ? (
        <Alert severity="info" sx={{ m: 2, mb: 1 }} data-testid="permission-picker-blocked">
          <Box sx={{ fontWeight: 600, mb: 0.5 }}>มี {blockedTotal} สิทธิ์ที่เลือกไม่ได้ (ช่องสีจาง)</Box>
          {[...blocked.entries()].map(([reason, keys]) => {
            const open = showAll === reason;
            const list = open ? keys : keys.slice(0, 6);
            const hint = reasonHint?.(reason);
            return (
              <Box key={reason} sx={{ mt: 0.75, fontSize: 14 }}>
                <b>{reason}</b> ({keys.length})
                {hint ? <Box component="span" sx={{ color: "#51626f" }}> — {hint}</Box> : null}
                <Box sx={{ color: "#2e3f4f" }}>
                  {list.map(permLabel).join(" · ")}
                  {keys.length > 6 ? (
                    <>
                      {" "}
                      <Box
                        component="button"
                        type="button"
                        onClick={() => setShowAll(open ? null : reason)}
                        sx={{ border: 0, p: 0, bgcolor: "transparent", font: "inherit", fontWeight: 600, color: "#14432a", cursor: "pointer", textDecoration: "underline" }}
                      >
                        {open ? "ย่อ" : `ดูทั้งหมด ${keys.length}`}
                      </Box>
                    </>
                  ) : null}
                </Box>
              </Box>
            );
          })}
        </Alert>
      ) : null}
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" aria-label={caption} data-testid="permission-picker">
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
          {rows
            .filter((g) => !onlyDiff || rowDiff(g.key) || open === g.key)
            .map((g) => {
              const all = inGroup(g.key);
              const held = all.filter((i) => value.has(i.key));
              const lockedRow = all.length > 0 && all.every((i) => !can(i.key)) && held.length === 0;
              if (lockedRow) {
                return (
                  <TableRow key={g.key} data-testid={`perm-row-${g.key}`}>
                    <TableCell component="th" scope="row" sx={{ ...cellSx, pl: 2.5, whiteSpace: "nowrap", color: "#51626f", bgcolor: "#fafcfd" }}>
                      {g.label}
                    </TableCell>
                    <TableCell colSpan={UI_ACTION_COLUMNS.length} sx={{ ...cellSx, fontSize: 13, color: "#51626f", bgcolor: "#fafcfd" }}>
                      {(() => {
                        const reason = disabledReason(all[0].key) ?? "";
                        const extra = rowAction?.(reason);
                        return (
                          <>
                            {reason}
                            {extra ? <> · {extra}</> : null}
                          </>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                );
              }
              const expanded = open === g.key;
              return (
                <Fragment key={g.key}>
                  <TableRow>
                    <TableCell component="th" scope="row" sx={{ ...cellSx, pl: 2.5, whiteSpace: "nowrap" }}>
                      <Box
                        component="button"
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setOpen(expanded ? null : g.key)}
                        data-testid={`perm-row-${g.key}`}
                        sx={{ border: 0, p: 0, bgcolor: "transparent", font: "inherit", fontSize: 14, fontWeight: expanded ? 600 : 400, color: "#16202b", cursor: "pointer", textAlign: "left" }}
                      >
                        {expanded ? "▾" : "▸"} {g.label}
                      </Box>
                    </TableCell>
                    {UI_ACTION_COLUMNS.map((c) => {
                      const keys = inCell(g.key, c.key);
                      if (!keys.length) {
                        return (
                          <TableCell key={c.key} align="center" sx={{ ...cellSx, color: "#51626f" }}>
                            —
                          </TableCell>
                        );
                      }
                      const on = keys.filter((i) => value.has(i.key)).length;
                      const editable = keys.filter((i) => can(i.key)).map((i) => i.key);
                      const changed = keys.some((i) => (before && value.has(i.key) !== before.has(i.key)) || (base && value.has(i.key) !== base.has(i.key)));
                      return (
                        <TableCell key={c.key} align="center" sx={{ ...cellSx, ...(changed ? changedSx : {}) }}>
                          <Checkbox
                            size="small"
                            checked={on === keys.length}
                            indeterminate={on > 0 && on < keys.length}
                            disabled={!editable.length}
                            onChange={() => setMany(editable, !editable.every((k) => value.has(k)))}
                            inputProps={{ "aria-label": `${g.label} ${c.label}` }}
                            title={editable.length ? undefined : disabledReason(keys[0].key) ?? undefined}
                          />
                          {on > 0 && on < keys.length ? (
                            <Box component="span" sx={{ display: "block", fontSize: 12, color: "#51626f", lineHeight: 1 }}>
                              {on}/{keys.length}
                            </Box>
                          ) : null}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  {expanded ? (
                    <TableRow>
                      <TableCell colSpan={UI_ACTION_COLUMNS.length + 1} sx={{ bgcolor: "#fafcfd", borderBottom: "1px solid #e2e7ec", px: 2.5, py: 1.5 }}>
                        {COLS.map((c) => {
                          const keys = inCell(g.key, c.key);
                          if (!keys.length) return null;
                          return (
                            <Box key={c.key} sx={{ mb: 1 }} role="group" aria-label={`${g.label} — ${c.label}`}>
                              <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#2e3f4f" }}>{c.label}</Typography>
                              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", columnGap: 2 }}>
                                {keys.map((i) => {
                                  const auto = !value.has(i.key) && !!autoOn?.(i.key);
                                  const isOn = value.has(i.key) || auto;
                                  const was = before?.has(i.key);
                                  const reason = disabledReason(i.key);
                                  return (
                                    <FormControlLabel
                                      key={i.key}
                                      title={reason ? `${i.key} — ${reason}` : i.key}
                                      control={
                                        <Checkbox
                                          size="small"
                                          checked={isOn}
                                          disabled={!!reason}
                                          onChange={(e) => setMany([i.key], e.target.checked)}
                                          inputProps={{ "data-testid": `perm-${i.key}` } as any}
                                        />
                                      }
                                      label={
                                        <Box component="span" sx={{ display: "inline-flex", gap: 0.75, alignItems: "center", flexWrap: "wrap", fontSize: 14, color: reason ? "#51626f" : "#16202b" }}>
                                          {permLabel(i.key)}
                                          {reason ? (
                                            <Box component="span" sx={{ fontSize: 12, fontWeight: 600, bgcolor: auto ? "#e1f1e4" : "#eef2f5", color: auto ? "#14432a" : "#51626f", borderRadius: 999, px: 1 }}>
                                              {shortReason(reason)}
                                            </Box>
                                          ) : null}
                                          {before && !auto && isOn && !was ? <ChangeTag kind="add">+ เพิ่ม</ChangeTag> : null}
                                          {before && !isOn && was ? <ChangeTag kind="del">− ตัด</ChangeTag> : null}
                                          {base && (!before || isOn === was) && isOn !== base.has(i.key) ? (
                                            <Box component="span" sx={{ fontSize: 12, color: "#8a5606" }}>
                                              ต่างจากตั้งต้น
                                            </Box>
                                          ) : null}
                                        </Box>
                                      }
                                    />
                                  );
                                })}
                              </Box>
                            </Box>
                          );
                        })}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
        </TableBody>
      </Table>
    </Box>
    </Box>
  );
}
