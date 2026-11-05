"use client";

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
import { WomsEmptyState, WomsErrorState, WomsLoadingState, WomsPageHeader } from "@/components/woms";

type CatalogItem = { key: string; group: string; action: string };

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
      setMeta({ scopeSupport: c.scopeSupport, delegable: c.delegable, canSetScope: c.canSetScope });
      setSelected((s) => s || r.items[0]?.key || "");
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

  return (
    <Box>
      <WomsPageHeader title="บทบาทและสิทธิ์" subtitle={roles ? `${roles.length} บทบาท · ${catalog.length} สิทธิ์ในระบบ` : "กำลังโหลด…"} />
      <Alert severity="info" sx={{ mb: 2 }} data-testid="rbac-policy-note">
        บทบาทของระบบแก้ไขผ่านหน้านี้ไม่ได้ ·{" "}
        {enabled
          ? "Custom Role ต้องกำหนดทีม/สาขาเจ้าของและขอบเขตข้อมูลหนึ่งค่า · ขอบเขตที่ยังไม่รองรับสิทธิ์ใด ระบบจะไม่ให้สิทธิ์นั้น (ไม่ขยายเป็น ALL)"
          : "การสร้างบทบาทเองและการมอบให้ผู้ใช้ปิดอยู่ในระบบนี้"}
      </Alert>
      {err ? <WomsErrorState message={err} onRetry={load} /> : null}
      {!roles ? <WomsLoadingState /> : roles.length === 0 && !err ? <WomsEmptyState title="ยังไม่มีบทบาท" /> : null}
      {roles && roles.length ? (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper variant="outlined" sx={{ p: 1 }}>
              <Stack spacing={0.5} role="list" aria-label="รายการบทบาท">
                {roles.map((r) => (
                  <Button
                    key={r.key}
                    role="listitem"
                    onClick={() => {
                      setSelected(r.key);
                      setAssignMsg(null);
                    }}
                    variant={r.key === selected ? "contained" : "text"}
                    sx={{ justifyContent: "space-between", textAlign: "left", minHeight: 44 }}
                    data-testid={`role-${r.key}`}
                  >
                    <span>{r.name}</span>
                    <Stack direction="row" spacing={0.5}>
                      {r.system ? <Chip size="small" label="ระบบ" /> : null}
                      {!r.active ? <Chip size="small" color="default" label="ปิดใช้งาน" /> : null}
                      <Chip size="small" variant="outlined" label={`${r.userCount} คน`} />
                    </Stack>
                  </Button>
                ))}
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper variant="outlined" sx={{ p: 2 }} data-testid="role-detail">
              {current ? (
                <>
                  <Typography variant="h6">{current.name}</Typography>
                  <Typography variant="caption" color="text.secondary" className="code">
                    {current.key} · {current.permissions.length} สิทธิ์
                  </Typography>
                  {isCustom ? (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }} data-testid="role-scope-info">
                      <Chip size="small" color={current.dataScope ? "primary" : "warning"} label={`ขอบเขต: ${scopeLabel(current.dataScope)}`} data-testid="role-scope" />
                      <Chip size="small" variant="outlined" label={`ทีมเจ้าของ: ${current.ownerTeam || "—"}`} />
                      <Chip size="small" variant="outlined" label={`สาขาเจ้าของ: ${current.ownerBranch || "—"}`} />
                    </Stack>
                  ) : null}
                  {isCustom && !current.dataScope ? (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      บทบาทนี้ยังไม่กำหนดขอบเขตข้อมูล — ระบบไม่ให้สิทธิ์ใด ๆ และมอบให้ผู้ใช้ไม่ได้
                    </Alert>
                  ) : null}
                  {groups.map(([g, items]) => {
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
                </>
              ) : null}
            </Paper>
          </Grid>
        </Grid>
      ) : null}

      {canManage && enabled ? (
        <Paper variant="outlined" sx={{ p: 2, mt: 2 }} data-testid="role-create">
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
