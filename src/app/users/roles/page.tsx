"use client";
import Link from "next/link";

// Dynamic RBAC (CF v1.1 · PO 3 พ.ย. 69) — หน้าบทบาทและสิทธิ์
//   ดู Role ของระบบ + Custom Role และ Permission Catalog แยกกลุ่ม
//   OD-R9-01 (รอบ 10): สร้าง Custom Role พร้อมทีม/สาขาเจ้าของ + ขอบเขตข้อมูลค่าเดียว (ไม่มีค่าเริ่มต้น) และมอบ Role ให้ผู้ใช้พร้อมเหตุผล
//   เปิดได้เมื่อ backend เปิด RBAC_CUSTOM_ROLES_ENABLED เท่านั้น
//   backend ตรวจสิทธิ์ทุกคำขอ — หน้านี้เพียงแสดงตัวเลือกตามกติกาเดียวกัน ไม่ใช่ตัวกันสิทธิ์
import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { api, ApiError, type CustomRoleScope, type RoleItem, type RolesCatalogResponse } from "@/lib/api";
import type { AuthUser } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { WomsEmptyState, WomsErrorState, WomsLoadingState } from "@/components/woms";
import PermissionMatrix from "@/components/PermissionMatrix";
import type { CatalogItem } from "@/lib/permissionUi";

const SCOPES: { key: CustomRoleScope; label: string; hint: string }[] = [
  { key: "OWN", label: "OWN — ข้อมูลที่ตนสร้าง", hint: "ยังไม่รองรับ resource ใด (ใบงานไม่มีผู้สร้างที่บันทึกไว้) จึงเลือกสิทธิ์ไม่ได้" },
  { key: "ASSIGNED", label: "ASSIGNED — งานที่ได้รับมอบหมาย", hint: "" },
  { key: "TEAM", label: "TEAM — ทีมของผู้ใช้", hint: "" },
  { key: "BRANCH", label: "BRANCH — สาขาของผู้ใช้", hint: "" },
  { key: "ALL", label: "ALL — ทั้งหมด", hint: "" },
];
const scopeLabel = (s?: string) => SCOPES.find((x) => x.key === s)?.label ?? (s ? s : "ยังไม่กำหนด");
const EMPTY_FORM = { key: "", name: "", description: "", ownerTeam: "", ownerBranch: "", dataScope: "" as "" | CustomRoleScope };

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
  const [form, setForm] = useState(EMPTY_FORM);
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [saveErr, setSaveErr] = useState<{ field?: string; message: string } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [assign, setAssign] = useState({ userId: "", reason: "" });
  const [assignMsg, setAssignMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [r, c] = await Promise.all([api.listRoles(), api.rolesCatalog()]);
      setRoles(r.items);
      setEnabled(r.customRolesEnabled);
      setCatalog(c.items);
      setMeta({ scopeSupport: c.scopeSupport, delegable: c.delegable, canSetScope: c.canSetScope, uiGroups: c.uiGroups });
      setSelected((s) => s || (r.items.find((x) => x.active) ?? r.items[0])?.key || "");
      if (r.customRolesEnabled && canManage) {
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
  // ค่าเริ่มต้นทีมเจ้าของ = ทีมของผู้สร้าง (backend ตรวจว่าผู้สร้างอยู่ในทีม/สาขานั้นจริง)
  useEffect(() => {
    if (me?.team) setForm((f) => (f.ownerTeam || f.ownerBranch ? f : { ...f, ownerTeam: me.team ?? "" }));
  }, [me?.team]);

  const groups = useMemo(() => {
    const m = new Map<string, CatalogItem[]>();
    for (const c of catalog) m.set(c.group, [...(m.get(c.group) ?? []), c]);
    return [...m.entries()];
  }, [catalog]);
  const current = roles?.find((r) => r.key === selected) ?? null;
  const delegable = useMemo(() => new Set(meta.delegable ?? []), [meta.delegable]);
  /** สิทธิ์ที่เลือกได้ภายใต้ขอบเขตที่เลือก (ต้องอยู่ในรายการมอบต่อได้ของผู้สร้างด้วย) */
  const allowed = useMemo(() => {
    if (!form.dataScope) return new Set<string>();
    const base = form.dataScope === "ALL" ? [...delegable] : (meta.scopeSupport?.[form.dataScope] ?? []).filter((p) => delegable.has(p));
    return new Set(base);
  }, [form.dataScope, meta.scopeSupport, delegable]);
  // แสดงรหัสเต็ม (กลุ่ม:การกระทำ) — ชื่อการกระทำอย่างเดียวซ้ำกันข้ามกลุ่ม เช่น view
  const catalogLabel = (k: string) => (catalog.some((c) => c.key === k) ? k : `${k} (ไม่อยู่ใน catalog)`);

  const changeScope = (scope: "" | CustomRoleScope) => {
    setForm((f) => ({ ...f, dataScope: scope }));
    // เปลี่ยนขอบเขต → ตัดสิทธิ์ที่ขอบเขตใหม่ไม่รองรับออกทันที (ตรงกับ backend ที่ปฏิเสธ SCOPE_UNSUPPORTED)
    const nextAllowed = !scope ? new Set<string>() : scope === "ALL" ? delegable : new Set((meta.scopeSupport?.[scope] ?? []).filter((p) => delegable.has(p)));
    setPerms((p) => new Set([...p].filter((k) => nextAllowed.has(k))));
  };

  const submit = async () => {
    if (!form.dataScope) return;
    setBusy(true);
    setSaveErr(null);
    setSaved(null);
    try {
      const role = await api.createRole({ ...form, dataScope: form.dataScope, permissions: [...perms] });
      setForm({ ...EMPTY_FORM, ownerTeam: me?.team ?? "" });
      setPerms(new Set());
      setSaved(`สร้างบทบาท ${role.name} แล้ว`);
      setSelected(role.key);
      await load();
    } catch (e) {
      const ae = e as any;
      setSaveErr({ field: ae?.field, message: e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

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
        <Button
          variant="outlined"
          color="inherit"
          disabled={!(canManage && enabled)}
          title={canManage && enabled ? undefined : "การสร้างบทบาทเองยังไม่เปิดใช้ในระบบนี้"}
          onClick={() => document.getElementById("role-create")?.scrollIntoView({ behavior: "smooth" })}
          sx={{ minHeight: 40, borderRadius: "8px", borderColor: "#cdd6dd", fontWeight: 600, bgcolor: "#fff" }}
          data-testid="role-add"
        >
          + เพิ่มบทบาท
        </Button>
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
                      </Typography>
                    </Box>
                    {!isCustom ? (
                      <Box
                        data-testid="role-system-readonly"
                        sx={{ fontSize: 13, fontWeight: 600, color: "#51626f", bgcolor: "#eef2f5", borderRadius: 999, px: 1.5, py: 0.5 }}
                        title="บทบาทหลักกำหนดตามตารางสิทธิ์ที่ลูกค้าอนุมัติ"
                      >
                        บทบาทหลักของระบบ · แก้ไม่ได้
                      </Box>
                    ) : null}
                  </Box>
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
                  <PermissionMatrix items={catalog} groups={meta.uiGroups} held={new Set(current.permissions)} caption={`สิทธิ์ของบทบาท ${current.name}`} />
                  <Box sx={{ px: 2.5, py: 1.5, mt: 1.25, borderTop: "1px solid #e2e7ec", fontSize: 14, color: "#51626f" }} data-testid="rbac-policy-note">
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

      {canManage && enabled ? (
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: "12px" }} data-testid="role-create" id="role-create">
          <Typography variant="h6" sx={{ mb: 1 }}>
            สร้างบทบาท
          </Typography>
          {saveErr ? (
            <Alert severity="error" sx={{ mb: 1 }} data-testid="role-create-error">
              {saveErr.message}
            </Alert>
          ) : null}
          {saved ? (
            <Alert severity="success" sx={{ mb: 1 }} data-testid="role-create-ok">
              {saved}
            </Alert>
          ) : null}
          {meta.canSetScope === false ? (
            <Alert severity="warning" sx={{ mb: 1 }}>
              บัญชีของคุณกำหนดขอบเขตข้อมูลไม่ได้ (ต้องเห็นทุกใบงานเอง) — ระบบจะปฏิเสธการสร้างบทบาท
            </Alert>
          ) : null}
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth size="small" label="รหัส (a-z 0-9 _ -)" value={form.key} error={saveErr?.field === "key"} onChange={(e) => setForm({ ...form, key: e.target.value })} inputProps={{ "data-testid": "role-key" }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField fullWidth size="small" label="ชื่อบทบาท" value={form.name} error={saveErr?.field === "name"} onChange={(e) => setForm({ ...form, name: e.target.value })} inputProps={{ "data-testid": "role-name" }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                size="small"
                label="ทีมเจ้าของ"
                value={form.ownerTeam}
                error={saveErr?.field === "ownerTeam"}
                onChange={(e) => setForm({ ...form, ownerTeam: e.target.value })}
                helperText="ต้องเป็นทีมของคุณ · ระบุทีมหรือสาขาอย่างน้อยหนึ่งอย่าง"
                inputProps={{ "data-testid": "role-owner-team" }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                size="small"
                label="สาขาเจ้าของ (รหัสสาขา)"
                value={form.ownerBranch}
                error={saveErr?.field === "ownerBranch"}
                onChange={(e) => setForm({ ...form, ownerBranch: e.target.value })}
                helperText="ต้องเป็นสาขาที่คุณมีสิทธิ์"
                inputProps={{ "data-testid": "role-owner-branch" }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                fullWidth
                size="small"
                required
                label="ขอบเขตข้อมูล"
                value={form.dataScope}
                error={saveErr?.field === "dataScope"}
                onChange={(e) => changeScope(e.target.value as "" | CustomRoleScope)}
                helperText={form.dataScope ? SCOPES.find((s) => s.key === form.dataScope)?.hint || `เลือกสิทธิ์ได้ ${allowed.size} รายการ` : "ต้องเลือก — ไม่มีค่าเริ่มต้น"}
                inputProps={{ "data-testid": "role-scope-select" }}
              >
                <MenuItem value="" disabled>
                  — เลือกขอบเขต —
                </MenuItem>
                {SCOPES.map((s) => (
                  <MenuItem key={s.key} value={s.key}>
                    {s.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
          {form.dataScope && form.dataScope !== "ALL" ? (
            <Alert severity="info" sx={{ mt: 1 }} data-testid="role-scope-support">
              ขอบเขต {form.dataScope} รองรับ:{" "}
              {(meta.scopeSupport?.[form.dataScope] ?? []).length ? (meta.scopeSupport?.[form.dataScope] ?? []).map(catalogLabel).join(" · ") : "ยังไม่มี"} · สิทธิ์อื่นเลือกไม่ได้
              จนกว่าจะมีการตรวจขอบเขตใน resource นั้น
            </Alert>
          ) : null}
          {groups.map(([g, items]) => (
            <Box key={g} sx={{ mt: 1 }}>
              <Typography variant="subtitle2">{g}</Typography>
              <Stack direction="row" flexWrap="wrap" useFlexGap>
                {items.map((i) => {
                  const can = allowed.has(i.key);
                  return (
                    <FormControlLabel
                      key={i.key}
                      disabled={!can}
                      title={can ? i.key : !form.dataScope ? "เลือกขอบเขตข้อมูลก่อน" : !delegable.has(i.key) ? "สิทธิ์นี้อยู่นอกรายการที่คุณมอบต่อได้" : `ขอบเขต ${form.dataScope} ยังไม่รองรับ`}
                      control={
                        <Checkbox
                          size="small"
                          checked={perms.has(i.key)}
                          inputProps={{ "data-testid": `perm-${i.key}` } as any}
                          onChange={(e) => {
                            const n = new Set(perms);
                            if (e.target.checked) n.add(i.key);
                            else n.delete(i.key);
                            setPerms(n);
                          }}
                        />
                      }
                      label={i.action}
                    />
                  );
                })}
              </Stack>
            </Box>
          ))}
          <Button
            sx={{ mt: 1.5 }}
            variant="contained"
            disabled={busy || !form.key || !form.name || !form.dataScope || !(form.ownerTeam.trim() || form.ownerBranch.trim())}
            onClick={submit}
            data-testid="role-create-submit"
          >
            บันทึก
          </Button>
        </Paper>
      ) : null}
    </Box>
  );
}
