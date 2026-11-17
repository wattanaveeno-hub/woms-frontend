"use client";
import Link from "next/link";

// Dynamic RBAC (CF v1.1 · PO 3 พ.ย. 69) — หน้าบทบาทและสิทธิ์
//   ดู Role ของระบบ + Custom Role และ Permission Catalog แยกกลุ่ม
//   สร้างบทบาทย้ายไปหน้า /users/roles/new (17 พ.ย. 69) · OD-R9-01 (รอบ 10): สร้าง Custom Role พร้อมทีม/สาขาเจ้าของ + ขอบเขตข้อมูลค่าเดียว (ไม่มีค่าเริ่มต้น) และมอบ Role ให้ผู้ใช้พร้อมเหตุผล
//   เปิดได้เมื่อ backend เปิด RBAC_CUSTOM_ROLES_ENABLED เท่านั้น
//   17 พ.ย. 69: บทบาทหลักแก้สิทธิ์ที่หน้านี้ได้ (RBAC_SYSTEM_ROLE_EDIT_ENABLED) — มีผลกับทุกคนในบทบาท · ดูประวัติ/คืนค่าตั้งต้นได้
//   backend ตรวจสิทธิ์ทุกคำขอ — หน้านี้เพียงแสดงตัวเลือกตามกติกาเดียวกัน ไม่ใช่ตัวกันสิทธิ์
import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { api, ApiError, type CustomRoleScope, type RoleItem, type RolesCatalogResponse } from "@/lib/api";
import type { AuthUser } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { WomsEmptyState, WomsErrorState, WomsLoadingState } from "@/components/woms";
import PermissionMatrix from "@/components/PermissionMatrix";
import RolePermissionEditor from "@/components/RolePermissionEditor";
import RoleHistoryDialog from "@/components/RoleHistoryDialog";
import type { CatalogItem } from "@/lib/permissionUi";

const SCOPES: { key: CustomRoleScope; label: string; hint: string }[] = [
  { key: "OWN", label: "OWN — ข้อมูลที่ตนสร้าง", hint: "ยังไม่รองรับ resource ใด (ใบงานไม่มีผู้สร้างที่บันทึกไว้) จึงเลือกสิทธิ์ไม่ได้" },
  { key: "ASSIGNED", label: "ASSIGNED — งานที่ได้รับมอบหมาย", hint: "" },
  { key: "TEAM", label: "TEAM — ทีมของผู้ใช้", hint: "" },
  { key: "BRANCH", label: "BRANCH — สาขาของผู้ใช้", hint: "" },
  { key: "ALL", label: "ALL — ทั้งหมด", hint: "" },
];
const scopeLabel = (s?: string) => SCOPES.find((x) => x.key === s)?.label ?? (s ? s : "ยังไม่กำหนด");
/** บทบาทหลัก: สิทธิ์ที่ต่างจากค่าตั้งต้น (ตารางสิทธิ์) */
function baseDiff(r: RoleItem): { grant: Set<string>; deny: Set<string>; total: number } {
  if (!r.system || !r.basePermissions) return { grant: new Set(), deny: new Set(), total: 0 };
  const base = new Set(r.basePermissions);
  const now = new Set(r.permissions);
  const grant = new Set(r.permissions.filter((p) => !base.has(p)));
  const deny = new Set(r.basePermissions.filter((p) => !now.has(p)));
  return { grant, deny, total: grant.size + deny.size };
}
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export default function RolesPage() {
  const { has, user: me } = useAuth();
  const canManage = has("users:manage");
  const [roles, setRoles] = useState<RoleItem[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [meta, setMeta] = useState<Omit<RolesCatalogResponse, "items" | "count">>({});
  const [showKeys, setShowKeys] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [assign, setAssign] = useState({ userId: "", reason: "" });
  const [assignMsg, setAssignMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sysEditOn, setSysEditOn] = useState(false);
  const [editing, setEditing] = useState<{ initial?: string[]; reason?: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [r, c] = await Promise.all([api.listRoles(), api.rolesCatalog()]);
      setRoles(r.items);
      setEnabled(r.customRolesEnabled);
      setSysEditOn(!!r.systemRoleEditEnabled);
      setCatalog(c.items);
      setMeta({ scopeSupport: c.scopeSupport, delegable: c.delegable, canSetScope: c.canSetScope, uiGroups: c.uiGroups });
      setSelected((s) => s || (r.items.find((x) => x.active) ?? r.items[0])?.key || "");
      if ((r.customRolesEnabled || r.systemRoleEditEnabled) && canManage) {
        const u = await api.listUsers().catch(() => ({ items: [] as AuthUser[] }));
        setUsers(u.items.filter((x) => x.active !== false));
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "โหลดข้อมูลบทบาทไม่สำเร็จ");
      setRoles([]);
    }
  }, [canManage]);
  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const m = new Map<string, CatalogItem[]>();
    for (const c of catalog) m.set(c.group, [...(m.get(c.group) ?? []), c]);
    return [...m.entries()];
  }, [catalog]);
  const current = roles?.find((r) => r.key === selected) ?? null;
  const delegable = useMemo(() => new Set(meta.delegable ?? []), [meta.delegable]);
  const doAssign = async () => {
    if (!current) return;
    setBusy(true);
    setAssignMsg(null);
    try {
      const target = users.find((u) => u.id === assign.userId);
      await api.assignRole(current.key, { userId: assign.userId, reason: assign.reason.trim(), expectedUpdatedAt: target?.updatedAt });
      setAssignMsg({ ok: true, text: `มอบบทบาท ${current.name} ให้ ${target?.name ?? assign.userId} แล้ว · มีผลกับคำขอถัดไปของผู้ใช้ทันที` });
      setAssign({ userId: "", reason: "" });
      await load();
    } catch (e) {
      setAssignMsg({ ok: false, text: e instanceof ApiError ? e.message : "มอบบทบาทไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  const isCustom = !!current && !current.system;
  const currentDiff = current ? baseDiff(current) : { grant: new Set<string>(), deny: new Set<string>(), total: 0 };
  const canAssign = canManage && enabled && isCustom && current!.active && !!current!.dataScope;

  // Redesign 13 พ.ย. 69 ตาม Roles.dc.html — รายการบทบาทซ้าย · ตารางสิทธิ์ขวา
  const activeRoles = (roles ?? []).filter((r) => r.active);
  const inactiveRoles = (roles ?? []).filter((r) => !r.active);
  const roleRow = (r: RoleItem) => {
    const on = r.key === selected;
    return (
      <Box
        key={r.key}
        component="button"
        type="button"
        role="listitem"
        aria-current={on ? "true" : undefined}
        onClick={() => {
          setSelected(r.key);
          setAssignMsg(null);
          setEditing(null);
          setNotice(null);
        }}
        data-testid={`role-${r.key}`}
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 1,
          width: "100%",
          px: 2,
          py: 1.5,
          border: 0,
          borderTop: "1px solid #e2e7ec",
          bgcolor: on ? "#f3faf4" : "#fff",
          boxShadow: on ? "inset 3px 0 0 #1b5e37" : "none",
          font: "inherit",
          fontSize: 14,
          fontWeight: on ? 600 : 400,
          color: "#16202b",
          textAlign: "left",
          cursor: "pointer",
          "&:hover": { bgcolor: on ? "#f3faf4" : "#f8fafb" },
        }}
      >
        <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
          {r.name}
          {!r.system ? (
            <Box component="span" sx={{ ml: 0.75, fontSize: 12, color: "#0b6aa2", fontWeight: 600 }}>
              สร้างเอง
            </Box>
          ) : baseDiff(r).total ? (
            <Box component="span" sx={{ ml: 0.75, fontSize: 12, fontWeight: 600, color: "#8a5606", bgcolor: "#fdf3e2", borderRadius: 999, px: 1 }}>
              ปรับแล้ว
            </Box>
          ) : null}
        </Box>
        <Box component="span" sx={{ fontSize: 14, color: "#51626f", flex: "none" }}>
          {r.userCount}
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 1.5 }}>
        <Box>
          <Box component={Link} href="/settings" sx={{ fontSize: 14, fontWeight: 600, color: "#14432a" }}>
            ← ตั้งค่า
          </Box>
          <Typography component="h1" sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1.25 }}>
            บทบาทและสิทธิ์
          </Typography>
        </Box>
        {canManage && enabled ? (
          <Button
            component={Link}
            href="/users/roles/new"
            variant="outlined"
            color="inherit"
            sx={{ minHeight: 40, borderRadius: "8px", borderColor: "#cdd6dd", fontWeight: 600, bgcolor: "#fff" }}
            data-testid="role-add"
          >
            + เพิ่มบทบาท
          </Button>
        ) : null}
      </Box>
      {err ? <WomsErrorState message={err} onRetry={load} /> : null}
      {!roles ? <WomsLoadingState /> : roles.length === 0 && !err ? <WomsEmptyState title="ยังไม่มีบทบาท" /> : null}
      {roles && roles.length ? (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "flex-start" }}>
          <Box component="aside" sx={{ flex: "1 1 240px", maxWidth: { md: 280 }, bgcolor: "#fff", border: "1px solid #e2e7ec", borderRadius: "12px", overflow: "hidden" }}>
            <Box sx={{ px: 2, py: 1.5, fontWeight: 600, fontSize: 14, color: "#51626f" }}>บทบาท</Box>
            <Box role="list" aria-label="รายการบทบาท">
              {activeRoles.map(roleRow)}
            </Box>
            {inactiveRoles.length ? (
              <>
                <Box
                  component="button"
                  type="button"
                  onClick={() => setShowInactive((v) => !v)}
                  aria-expanded={showInactive}
                  sx={{ width: "100%", px: 2, py: 1.25, border: 0, borderTop: "1px solid #e2e7ec", bgcolor: "#fafcfd", font: "inherit", fontSize: 13, fontWeight: 600, color: "#51626f", textAlign: "left", cursor: "pointer" }}
                >
                  {showInactive ? "ซ่อน" : "แสดง"}บทบาทที่ปิดใช้งาน ({inactiveRoles.length})
                </Box>
                {showInactive ? <Box role="list" aria-label="บทบาทที่ปิดใช้งาน">{inactiveRoles.map(roleRow)}</Box> : null}
              </>
            ) : null}
          </Box>
          <Box
            component="section"
            data-testid="role-detail"
            sx={{ flex: "3 1 560px", minWidth: 0, bgcolor: "#fff", border: "1px solid #e2e7ec", borderRadius: "12px", overflow: "hidden" }}
          >
              {current ? (
                <>
                  <Box sx={{ px: 2.5, py: 2, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, alignItems: "flex-start" }}>
                    <Box>
                      <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
                        {current.name}
                      </Typography>
                      <Typography sx={{ fontSize: 14, color: "#51626f" }}>
                        {current.description ? `${current.description} · ` : ""}
                        {current.userCount} คน · {current.permissions.length} สิทธิ์
                        {!current.active ? " · ปิดใช้งาน" : ""}
                        {!isCustom && current.updatedBy && current.updatedAt ? ` · แก้ล่าสุด ${fmtDate(current.updatedAt)} โดย ${current.updatedBy}` : ""}
                      </Typography>
                      {!isCustom ? (
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                          <Box
                            data-testid="role-system-readonly"
                            sx={{ fontSize: 12, fontWeight: 600, color: "#51626f", bgcolor: "#eef2f5", borderRadius: 999, px: 1.25, py: 0.25 }}
                            title="ค่าตั้งต้นตามตารางสิทธิ์ที่ลูกค้าอนุมัติ"
                          >
                            {sysEditOn ? "บทบาทหลักของระบบ" : "บทบาทหลักของระบบ · แก้ไม่ได้"}
                          </Box>
                          {currentDiff.total ? (
                            <Box data-testid="role-base-diff" sx={{ fontSize: 12, fontWeight: 600, color: "#8a5606", bgcolor: "#fdf3e2", borderRadius: 999, px: 1.25, py: 0.25 }}>
                              ต่างจากตารางสิทธิ์ตั้งต้น {currentDiff.total} จุด
                            </Box>
                          ) : null}
                        </Stack>
                      ) : null}
                    </Box>
                    {!isCustom && sysEditOn && !editing ? (
                      <Stack direction="row" spacing={1}>
                        <Button variant="outlined" color="inherit" onClick={() => setShowHistory(true)} data-testid="role-history" sx={{ borderColor: "#cdd6dd" }}>
                          ประวัติการแก้
                        </Button>
                        {current.permissionsEditable ? (
                          <Button variant="contained" onClick={() => { setNotice(null); setEditing({}); }} data-testid="role-edit-perms">
                            แก้ไขสิทธิ์
                          </Button>
                        ) : null}
                      </Stack>
                    ) : null}
                  </Box>
                  {notice ? (
                    <Alert severity="success" sx={{ mx: 2.5, mb: 1.5 }} onClose={() => setNotice(null)} data-testid="role-perm-saved">
                      {notice}
                    </Alert>
                  ) : null}
                  {isCustom ? (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ px: 2.5, pb: 1.5 }} data-testid="role-scope-info">
                      <Chip size="small" color={current.dataScope ? "primary" : "warning"} label={`ขอบเขต: ${scopeLabel(current.dataScope)}`} data-testid="role-scope" />
                      <Chip size="small" variant="outlined" label={`ทีมเจ้าของ: ${current.ownerTeam || "—"}`} />
                      <Chip size="small" variant="outlined" label={`สาขาเจ้าของ: ${current.ownerBranch || "—"}`} />
                    </Stack>
                  ) : null}
                  {isCustom && !current.dataScope ? (
                    <Alert severity="warning" sx={{ mx: 2.5, mb: 1.5 }}>
                      บทบาทนี้ยังไม่กำหนดขอบเขตข้อมูล — ระบบไม่ให้สิทธิ์ใด ๆ และมอบให้ผู้ใช้ไม่ได้
                    </Alert>
                  ) : null}
                  {editing && !isCustom ? (
                    <RolePermissionEditor
                      key={`${current.key}-${current.updatedAt}`}
                      role={current}
                      catalog={catalog}
                      groups={meta.uiGroups}
                      delegable={delegable}
                      users={users}
                      initial={editing.initial}
                      initialReason={editing.reason}
                      onCancel={() => setEditing(null)}
                      onSaved={(msg) => {
                        setEditing(null);
                        setNotice(msg);
                        void load();
                      }}
                    />
                  ) : (
                    <PermissionMatrix
                      items={catalog}
                      groups={meta.uiGroups}
                      held={new Set(current.permissions)}
                      granted={currentDiff.grant}
                      denied={currentDiff.deny}
                      grantLabel="เพิ่มจากตั้งต้น"
                      denyLabel="ตัดจากตั้งต้น"
                      caption={`สิทธิ์ของบทบาท ${current.name}`}
                    />
                  )}
                  {showHistory && !isCustom ? (
                    <RoleHistoryDialog
                      role={current}
                      onClose={() => setShowHistory(false)}
                      onRevert={(e) => {
                        const d = new Set(current.permissions);
                        for (const p of e.added) d.delete(p);
                        for (const p of e.removed) d.add(p);
                        setShowHistory(false);
                        setEditing({ initial: [...d], reason: `ย้อนการแก้วันที่ ${fmtDate(e.at)}` });
                      }}
                      onResetToBase={(base) => {
                        setShowHistory(false);
                        setEditing({ initial: base, reason: "คืนค่าตั้งต้นตามตารางสิทธิ์" });
                      }}
                    />
                  ) : null}
                  <Box sx={{ px: 2.5, py: 1.5, mt: 1.25, borderTop: "1px solid #e2e7ec", fontSize: 14, color: "#51626f", display: editing ? "none" : undefined }} data-testid="rbac-policy-note">
                    {!isCustom && currentDiff.total ? (
                      <>
                        ช่องเส้นประ = ต่างจากตารางสิทธิ์ตั้งต้น (ชี้ที่ช่องเพื่อดูว่าเพิ่ม/ตัดอะไร) ·{" "}
                      </>
                    ) : null}
                    {!isCustom ? (
                      <>
                        ต้องการเพิ่มหรือตัดสิทธิ์ให้บางคน ใช้ปุ่ม &quot;สิทธิ์เฉพาะ&quot; ที่หน้า <Link href="/users">ผู้ใช้งานระบบ</Link> ·{" "}
                      </>
                    ) : null}
                    ดูรหัสสิทธิ์แบบละเอียด (สำหรับผู้ดูแลระบบ){" "}
                    <Box
                      component="button"
                      type="button"
                      onClick={() => setShowKeys((v) => !v)}
                      sx={{ border: 0, p: 0, bgcolor: "transparent", font: "inherit", fontWeight: 600, color: "#14432a", cursor: "pointer", textDecoration: "underline" }}
                    >
                      {showKeys ? "ซ่อน" : "เปิด"}
                    </Box>
                  </Box>
                  <Box sx={{ px: 2.5, pb: showKeys || canAssign ? 2 : 0 }}>
                  {showKeys && groups.map(([g, items]) => {
                    const on = items.filter((i) => current.permissions.includes(i.key));
                    if (!on.length) return null;
                    return (
                      <Box key={g} sx={{ mt: 1.5 }}>
                        <Typography variant="subtitle2">{g}</Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {on.map((i) => (
                            <Chip key={i.key} size="small" label={i.action} title={i.key} />
                          ))}
                        </Stack>
                      </Box>
                    );
                  })}
                  {canAssign ? (
                    <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }} data-testid="role-assign">
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        มอบบทบาทนี้ให้ผู้ใช้
                      </Typography>
                      {assignMsg ? (
                        <Alert severity={assignMsg.ok ? "success" : "error"} sx={{ mb: 1 }} data-testid="role-assign-result">
                          {assignMsg.text}
                        </Alert>
                      ) : null}
                      <Grid container spacing={1.5}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label="ผู้ใช้"
                            value={assign.userId}
                            onChange={(e) => setAssign({ ...assign, userId: e.target.value })}
                            inputProps={{ "data-testid": "role-assign-user" }}
                            helperText="ผู้ใช้หนึ่งคนมีบทบาทเดียว — การมอบจะแทนที่บทบาทเดิม"
                          >
                            {users
                              .filter((u) => u.id !== me?.id)
                              .map((u) => (
                                <MenuItem key={u.id} value={u.id}>
                                  {u.name} · {u.email} ({u.role}
                                  {u.team ? ` · ทีม ${u.team}` : ""})
                                </MenuItem>
                              ))}
                          </TextField>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="เหตุผล (บังคับ)"
                            value={assign.reason}
                            onChange={(e) => setAssign({ ...assign, reason: e.target.value })}
                            inputProps={{ maxLength: 300, "data-testid": "role-assign-reason" }}
                          />
                        </Grid>
                      </Grid>
                      <Button
                        sx={{ mt: 1.5 }}
                        variant="contained"
                        disabled={busy || !assign.userId || !assign.reason.trim()}
                        onClick={doAssign}
                        data-testid="role-assign-submit"
                      >
                        มอบบทบาท
                      </Button>
                    </Box>
                  ) : null}
                  </Box>
                </>
              ) : null}
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
