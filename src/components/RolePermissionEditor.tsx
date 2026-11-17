"use client";
/**
 * แก้สิทธิ์ของบทบาทหลักที่หน้าบทบาท (17 พ.ย. 69) — บันทึกแล้วมีผลกับทุกคนในบทบาทตั้งแต่คำขอถัดไป
 *   · ตาราง "เรื่อง × ดู/สร้าง/แก้ไข/อนุมัติ/ส่งออก" ติ๊กได้ · กดชื่อเรื่องเพื่อเลือกสิทธิ์ย่อย
 *   · แก้ได้เฉพาะสิทธิ์ในรายการที่ผู้แก้มอบต่อได้ (delegable) — backend ตรวจซ้ำทุกข้อ (PUT /api/roles/:key/permissions)
 *   · ยืนยันก่อนบันทึก: รายการที่เปลี่ยน · จำนวนคน · ผู้ใช้ที่มีสิทธิ์เฉพาะรายคนชนกับการแก้ · บังคับเหตุผล
 */
import { Fragment, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { api, ApiError, type PermUiGroup, type RoleItem } from "@/lib/api";
import type { AuthUser } from "@/lib/types";
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

/** ผู้ใช้ในบทบาทนี้ที่มีสิทธิ์เฉพาะรายคนทับสิทธิ์ที่กำลังเปลี่ยน — สิทธิ์เฉพาะรายคนยังชนะ */
export function overrideConflicts(users: AuthUser[], roleKey: string, added: string[], removed: string[]) {
  const out: { user: AuthUser; text: string }[] = [];
  for (const u of users) {
    if (u.role !== roleKey || u.active === false) continue;
    const o = u.permissionOverrides;
    if (!o) continue;
    for (const p of added) if (o.deny?.includes(p)) out.push({ user: u, text: `ตัด "${permLabel(p)}" รายคนไว้ → ยังไม่ได้สิทธิ์นี้` });
    for (const p of removed) if (o.grant?.includes(p)) out.push({ user: u, text: `เพิ่ม "${permLabel(p)}" รายคนไว้ → ยังมีสิทธิ์นี้ต่อ` });
  }
  return out;
}

export default function RolePermissionEditor({
  role,
  catalog,
  groups,
  delegable,
  users,
  initial,
  initialReason = "",
  onCancel,
  onSaved,
}: {
  role: RoleItem;
  catalog: CatalogItem[];
  groups?: { key: PermUiGroup; label: string }[];
  /** สิทธิ์ที่ผู้แก้มอบต่อได้ */
  delegable: ReadonlySet<string>;
  /** ผู้ใช้ทั้งหมด (ใช้หาคนในบทบาทและสิทธิ์เฉพาะรายคน) */
  users: AuthUser[];
  /** ค่าเริ่มของร่าง (เช่น ย้อนการแก้ครั้งก่อน) — ไม่ระบุ = สิทธิ์ปัจจุบัน */
  initial?: string[];
  initialReason?: string;
  onCancel: () => void;
  onSaved: (msg: string) => void;
}) {
  const rows = groups?.length ? groups : DEFAULT_UI_GROUPS;
  const current = useMemo(() => new Set(role.permissions), [role.permissions]);
  const base = useMemo(() => new Set(role.basePermissions ?? role.permissions), [role.basePermissions, role.permissions]);
  const [draft, setDraft] = useState<Set<string>>(() => new Set(initial ?? role.permissions));
  const [open, setOpen] = useState<string | null>(null);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState(initialReason);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showUsers, setShowUsers] = useState(false);

  const editable = (k: string) => delegable.has(k);
  const inCell = (g: string, a: string) => catalog.filter((i) => (i.uiGroup ?? "settings") === g && (i.uiAction ?? "other") === a);
  const added = useMemo(() => [...draft].filter((p) => !current.has(p)), [draft, current]);
  const removed = useMemo(() => [...current].filter((p) => !draft.has(p)), [draft, current]);
  const roleUsers = users.filter((u) => u.role === role.key && u.active !== false);
  const userCount = users.length ? roleUsers.length : role.userCount;
  const conflicts = overrideConflicts(users, role.key, added, removed);
  const rowDiff = (g: string) =>
    catalog.some((i) => (i.uiGroup ?? "settings") === g && (draft.has(i.key) !== base.has(i.key) || draft.has(i.key) !== current.has(i.key)));

  const toggle = (k: string, on: boolean) =>
    setDraft((d) => {
      const n = new Set(d);
      if (on) n.add(k);
      else n.delete(k);
      return n;
    });
  const toggleCell = (keys: CatalogItem[]) => {
    const ed = keys.filter((i) => editable(i.key));
    const allOn = ed.every((i) => draft.has(i.key));
    setDraft((d) => {
      const n = new Set(d);
      for (const i of ed) {
        if (allOn) n.delete(i.key);
        else n.add(i.key);
      }
      return n;
    });
  };
  const resetToBase = () =>
    setDraft(() => {
      // คืนเฉพาะสิทธิ์ที่แก้ได้ — สิทธิ์นอกรายการมอบต่อคงค่าปัจจุบัน
      const n = new Set<string>();
      for (const i of catalog) {
        const want = editable(i.key) ? base.has(i.key) : current.has(i.key);
        if (want) n.add(i.key);
      }
      for (const p of current) if (!catalog.some((i) => i.key === p)) n.add(p);
      return n;
    });

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.updateSystemRolePermissions(role.key, { permissions: [...draft], reason: reason.trim(), updatedAt: role.updatedAt ?? "" });
      onSaved(`บันทึกสิทธิ์ของบทบาท ${role.name} แล้ว · เพิ่ม ${r.added.length} · ตัด ${r.removed.length} · มีผลกับผู้ใช้ ${r.userCount} คน`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const headSx = { fontSize: 13, fontWeight: 600, color: "#51626f", bgcolor: "#fafcfd", borderBottom: "1px solid #e2e7ec", py: 1.25, whiteSpace: "nowrap" } as const;
  const cellSx = { borderBottom: "1px solid #e2e7ec", py: 1, fontSize: 14 } as const;
  const changedSx = { bgcolor: "rgba(181, 115, 10, 0.10)", outline: "1px dashed", outlineColor: "warning.main", outlineOffset: "-3px" } as const;

  return (
    <Box data-testid="role-perm-editor">
      <Alert severity="info" sx={{ mx: 2.5, mb: 1.5 }}>
        บันทึกแล้วมีผลกับ <b>ผู้ใช้ทุกคนในบทบาทนี้ ({userCount} คน)</b> ตั้งแต่คำขอถัดไป ไม่ต้องออกจากระบบ · สิทธิ์เฉพาะรายคนที่ตั้งไว้ที่หน้าผู้ใช้ยังมีผลทับเหมือนเดิม
      </Alert>
      <Box sx={{ px: 2.5, pb: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Typography sx={{ fontSize: 14, color: "#51626f" }}>ติ๊กที่ช่อง = ให้ทั้งช่อง · กดชื่อเรื่องเพื่อเลือกสิทธิ์ย่อย</Typography>
        <FormControlLabel
          control={<Checkbox size="small" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />}
          label={<Typography sx={{ fontSize: 14 }}>แสดงเฉพาะที่ต่างจากตั้งต้น</Typography>}
        />
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" aria-label={`แก้สิทธิ์ของบทบาท ${role.name}`}>
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
                        const on = keys.filter((i) => draft.has(i.key)).length;
                        const anyEditable = keys.some((i) => editable(i.key));
                        const changed = keys.some((i) => draft.has(i.key) !== current.has(i.key));
                        const diffBase = keys.some((i) => draft.has(i.key) !== base.has(i.key));
                        return (
                          <TableCell key={c.key} align="center" sx={{ ...cellSx, ...(changed || diffBase ? changedSx : {}) }}>
                            <Checkbox
                              size="small"
                              checked={on === keys.length}
                              indeterminate={on > 0 && on < keys.length}
                              disabled={!anyEditable}
                              onChange={() => toggleCell(keys)}
                              inputProps={{ "aria-label": `${g.label} ${c.label}` }}
                              title={anyEditable ? undefined : "สิทธิ์ในช่องนี้อยู่นอกรายการที่คุณมอบต่อได้"}
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
                                    const isOn = draft.has(i.key);
                                    const was = current.has(i.key);
                                    const ed = editable(i.key);
                                    return (
                                      <FormControlLabel
                                        key={i.key}
                                        title={ed ? i.key : `${i.key} — อยู่นอกรายการที่คุณมอบต่อได้`}
                                        control={<Checkbox size="small" checked={isOn} disabled={!ed} onChange={(e) => toggle(i.key, e.target.checked)} />}
                                        label={
                                          <Box component="span" sx={{ display: "inline-flex", gap: 0.75, alignItems: "center", flexWrap: "wrap", fontSize: 14, color: ed ? "#16202b" : "#51626f" }}>
                                            {permLabel(i.key)}
                                            {isOn && !was ? <ChangeTag kind="add">+ เพิ่ม</ChangeTag> : null}
                                            {!isOn && was ? <ChangeTag kind="del">− ตัด</ChangeTag> : null}
                                            {isOn === was && isOn !== base.has(i.key) ? (
                                              <Box component="span" sx={{ fontSize: 12, color: "#8a5606" }}>
                                                ต่างจากตั้งต้น
                                              </Box>
                                            ) : null}
                                            {!ed ? (
                                              <Box component="span" sx={{ fontSize: 12, fontWeight: 600, bgcolor: "#eef2f5", color: "#51626f", borderRadius: 999, px: 1 }}>
                                                มอบต่อไม่ได้
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
      <Box sx={{ px: 2.5, py: 1.5, fontSize: 14, color: "#51626f" }}>
        ช่องที่กดไม่ได้ = อยู่นอกรายการที่คุณมอบต่อได้ ·{" "}
        <Box
          component="button"
          type="button"
          onClick={resetToBase}
          data-testid="role-perm-reset"
          sx={{ border: 0, p: 0, bgcolor: "transparent", font: "inherit", fontWeight: 600, color: "#14432a", cursor: "pointer", textDecoration: "underline" }}
        >
          คืนค่าตั้งต้นทั้งบทบาท
        </Box>
      </Box>

      <Box
        sx={{
          position: "sticky",
          bottom: 0,
          zIndex: 2,
          px: 2.5,
          py: 1.5,
          bgcolor: "#fff",
          borderTop: "1px solid #cdd6dd",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", fontSize: 14 }} data-testid="role-perm-summary">
          <ChangeTag kind="add">+ เพิ่ม {added.length}</ChangeTag>
          <ChangeTag kind="del">− ตัด {removed.length}</ChangeTag>
          <Box component="span" sx={{ color: "#51626f" }}>
            มีผลกับผู้ใช้ {userCount} คน
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button variant="outlined" color="inherit" onClick={onCancel} disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant="contained" disabled={busy || (!added.length && !removed.length)} onClick={() => setConfirm(true)} data-testid="role-perm-review">
            ตรวจสอบก่อนบันทึก
          </Button>
        </Box>
      </Box>

      <Dialog open={confirm} onClose={() => !busy && setConfirm(false)} fullWidth maxWidth="sm" aria-labelledby="role-perm-confirm-title">
        <DialogTitle id="role-perm-confirm-title">บันทึกสิทธิ์ของบทบาท {role.name}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography sx={{ fontSize: 14, color: "#51626f", mt: -1 }}>ตรวจรายการก่อนบันทึก — มีผลกับทุกคนในบทบาทนี้ทันที</Typography>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#2e3f4f" }}>รายการที่เปลี่ยน ({added.length + removed.length})</Typography>
            {[...added.map((p) => ["add", p] as const), ...removed.map((p) => ["del", p] as const)].map(([k, p]) => (
              <Box key={p} sx={{ display: "flex", gap: 1.5, alignItems: "center", py: 1, borderBottom: "1px solid #e2e7ec", fontSize: 14 }}>
                <ChangeTag kind={k}>{k === "add" ? "+ เพิ่ม" : "− ตัด"}</ChangeTag>
                <span>{permLabel(p)}</span>
                <Box component="span" sx={{ ml: "auto", fontSize: 12, color: "#51626f", fontFamily: "ui-monospace, Consolas, monospace" }}>
                  {p}
                </Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ bgcolor: "#f6f8fa", border: "1px solid #e2e7ec", borderRadius: "8px", px: 2, py: 1.5, fontSize: 14 }}>
            <b>มีผลกับผู้ใช้ {userCount} คน</b>
            {roleUsers.length ? (
              <>
                {" · "}
                <Box
                  component="button"
                  type="button"
                  onClick={() => setShowUsers((v) => !v)}
                  sx={{ border: 0, p: 0, bgcolor: "transparent", font: "inherit", fontWeight: 600, color: "#14432a", cursor: "pointer", textDecoration: "underline" }}
                >
                  {showUsers ? "ซ่อนรายชื่อ" : "ดูรายชื่อ"}
                </Box>
              </>
            ) : null}
            {showUsers ? <Box sx={{ mt: 0.5 }}>{roleUsers.map((u) => u.name).join(", ")}</Box> : null}
            <Box sx={{ color: "#51626f", mt: 0.5 }}>ผู้ใช้ที่เปิดหน้าค้างไว้จะเห็นเมนูใหม่เมื่อรีเฟรชหรือเปลี่ยนหน้า · ระบบใช้สิทธิ์ใหม่ตั้งแต่คำขอถัดไป</Box>
          </Box>
          {conflicts.length ? (
            <Alert severity="warning" data-testid="role-perm-conflicts">
              <Box sx={{ fontWeight: 600 }}>ผู้ใช้ {new Set(conflicts.map((c) => c.user.id)).size} คนมีสิทธิ์เฉพาะรายคนที่ชนกับการแก้นี้</Box>
              {conflicts.map((c, i) => (
                <Box key={i}>
                  {c.user.name} — {c.text}
                </Box>
              ))}
              <Box sx={{ mt: 0.5 }}>ถ้าต้องการให้ทุกคนเหมือนกัน แก้ที่หน้าผู้ใช้ของคนเหล่านี้</Box>
            </Alert>
          ) : null}
          <TextField
            label="เหตุผล (บังคับ)"
            multiline
            minRows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            inputProps={{ maxLength: 300, "data-testid": "role-perm-reason" }}
            helperText="บันทึกใน Audit Log พร้อมรายการก่อน/หลัง · ไม่เกิน 300 ตัวอักษร"
          />
          {err ? <Alert severity="error">{err}</Alert> : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" color="inherit" onClick={() => setConfirm(false)} disabled={busy}>
            กลับไปแก้
          </Button>
          <Button variant="contained" onClick={save} disabled={busy || !reason.trim()} data-testid="role-perm-save">
            บันทึกและใช้กับทุกคน
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
