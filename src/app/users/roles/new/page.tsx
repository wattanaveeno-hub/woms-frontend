"use client";
// เพิ่มบทบาท (17 พ.ย. 69 · ออกแบบใหม่แทนฟอร์มท้ายหน้าบทบาท) — 3 ขั้น + มอบให้ผู้ใช้ต่อ
//   1 ชื่อ + เริ่มจากสิทธิ์ของบทบาทที่มี · 2 ขอบเขตข้อมูล + ทีม/สาขาเจ้าของ · 3 เลือกสิทธิ์ + สรุป · สร้างเสร็จ → มอบให้หลายคนพร้อมเหตุผล
//   กติกาเดียวกับ backend (POST /api/roles · POST /api/roles/:key/assign) — backend ตรวจซ้ำทุกข้อ หน้านี้ไม่ใช่ตัวกันสิทธิ์
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { api, ApiError, type CustomRoleScope, type RoleItem, type RolesCatalogResponse } from "@/lib/api";
import type { AuthUser } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { WomsErrorState, WomsLoadingState } from "@/components/woms";
import PermissionPicker from "@/components/PermissionPicker";
import { CUSTOM_ROLE_IMPLIED_BY, permLabel, type CatalogItem } from "@/lib/permissionUi";

type Scope = Exclude<CustomRoleScope, "OWN">;
const SCOPES: { key: Scope; title: string; hint: string }[] = [
  { key: "ALL", title: "เห็นทุกงาน", hint: "ทุกทีม ทุกสาขา · เลือกสิทธิ์ได้ทุกเรื่องที่คุณมอบต่อได้" },
  { key: "ASSIGNED", title: "เฉพาะงานที่ได้รับมอบหมาย", hint: "เหมาะกับช่าง" },
  { key: "TEAM", title: "เฉพาะทีมของตัวเอง", hint: "" },
  { key: "BRANCH", title: "เฉพาะสาขาของตัวเอง", hint: "" },
];
const scopeTitle = (s: string) => SCOPES.find((x) => x.key === s)?.title ?? s;
const KEY_RE = /^[a-z][a-z0-9_-]{2,39}$/;
const STEPS = ["ชื่อบทบาท", "ใครใช้ เห็นข้อมูลแค่ไหน", "เลือกสิทธิ์"];

/** รหัสจากชื่อ — ชื่อไทยแปลงไม่ได้ จึงใช้ role_<เวลา> */
function keyFromName(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  return KEY_RE.test(s) ? s : `role_${Date.now().toString(36)}`;
}
/** ชื่อเรื่องจากสิทธิ์ (ส่วนหน้า ":") */
const resourceOf = (k: string) => permLabel(k).split(" · ")[0];

const cardSx = (on: boolean) =>
  ({
    display: "flex",
    gap: 1.5,
    alignItems: "flex-start",
    textAlign: "left",
    width: "100%",
    px: 2,
    py: 1.5,
    border: "1px solid",
    borderColor: on ? "#1b5e37" : "#cdd6dd",
    boxShadow: on ? "inset 0 0 0 1px #1b5e37" : "none",
    borderRadius: "12px",
    bgcolor: on ? "#f3faf4" : "#fff",
    font: "inherit",
    color: "#16202b",
    cursor: "pointer",
  }) as const;
const lblSx = { fontSize: 13, fontWeight: 600, color: "#2e3f4f", mb: 0.5 } as const;

export default function NewRolePage() {
  const router = useRouter();
  const { has, user: me } = useAuth();
  const canManage = has("users:manage");
  const [roles, setRoles] = useState<RoleItem[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [meta, setMeta] = useState<Omit<RolesCatalogResponse, "items" | "count">>({});
  const [enabled, setEnabled] = useState(false);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [template, setTemplate] = useState("");
  const [scope, setScope] = useState<"" | Scope>("");
  const [ownerTeam, setOwnerTeam] = useState("");
  const [ownerBranch, setOwnerBranch] = useState("");
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [seeded, setSeeded] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<RoleItem | null>(null);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [assignRes, setAssignRes] = useState<{ id: string; name: string; ok: boolean; text: string }[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [r, c] = await Promise.all([api.listRoles(), api.rolesCatalog()]);
        if (!alive) return;
        setRoles(r.items);
        setEnabled(r.customRolesEnabled);
        setCatalog(c.items);
        setMeta({ scopeSupport: c.scopeSupport, delegable: c.delegable, canSetScope: c.canSetScope, uiGroups: c.uiGroups });
        const u = await api.listUsers().catch(() => ({ items: [] as AuthUser[] }));
        if (alive) setUsers(u.items.filter((x) => x.active !== false));
      } catch (e) {
        if (alive) setLoadErr(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (me?.team) setOwnerTeam((t) => t || me.team || "");
  }, [me?.team]);

  const delegable = useMemo(() => new Set(meta.delegable ?? []), [meta.delegable]);
  const supportOf = (s: "" | Scope) => (!s ? new Set<string>() : s === "ALL" ? new Set<string>(catalog.map((c) => c.key)) : new Set(meta.scopeSupport?.[s] ?? []));
  const allowed = useMemo(() => {
    const sup = supportOf(scope);
    return new Set([...delegable].filter((p) => sup.has(p)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, delegable, meta.scopeSupport, catalog]);
  const templates = (roles ?? []).filter((r) => r.active && r.key !== "developer");
  const templatePerms = templates.find((r) => r.key === template)?.permissions ?? [];
  const dropped = templatePerms.filter((p) => !allowed.has(p));
  const effectiveKey = keyTouched ? key : keyFromName(name);

  const disabledReason = (k: string) => {
    const parent = CUSTOM_ROLE_IMPLIED_BY[k];
    if (parent && !delegable.has(k) && delegable.has(parent)) return `ได้อัตโนมัติเมื่อเลือก "${permLabel(parent)}"`;
    if (!delegable.has(k)) return "อยู่นอกรายการที่คุณมอบต่อได้";
    if (!allowed.has(k)) return `ขอบเขต "${scopeTitle(scope)}" ยังไม่รองรับเรื่องนี้`;
    return null;
  };

  const goStep3 = () => {
    const sig = `${template}|${scope}`;
    if (sig !== seeded) {
      setPerms(new Set(templatePerms.filter((p) => allowed.has(p))));
      setSeeded(sig);
    } else {
      setPerms((p) => new Set([...p].filter((k) => allowed.has(k))));
    }
    setStep(2);
  };

  const step1Ok = name.trim().length > 0 && name.trim().length <= 80 && KEY_RE.test(effectiveKey);
  const step2Ok = !!scope && !!(ownerTeam.trim() || ownerBranch.trim());

  const submit = async () => {
    if (!scope) return;
    setBusy(true);
    setErr(null);
    try {
      const role = await api.createRole({
        key: effectiveKey,
        name: name.trim(),
        description: description.trim(),
        ownerTeam: ownerTeam.trim(),
        ownerBranch: ownerBranch.trim(),
        dataScope: scope,
        permissions: [...perms],
      });
      setCreated(role);
      setStep(3);
    } catch (e) {
      const field = (e as any)?.field as string | undefined;
      setErr(e instanceof ApiError ? e.message : "สร้างบทบาทไม่สำเร็จ");
      if (field === "key" || field === "name") setStep(0);
      else if (field === "dataScope" || field === "ownerTeam" || field === "ownerBranch") setStep(1);
    } finally {
      setBusy(false);
    }
  };

  /** ผู้รับต้องอยู่ในทีม/สาขาเจ้าของ Role (ตรงกับ ownershipProblem ใน backend) */
  const eligible = users.filter((u) => {
    if (!created || u.id === me?.id) return false;
    if (created.ownerTeam && String(u.team ?? "").trim() !== created.ownerTeam) return false;
    const br: string[] = Array.isArray((u as any).branchIds) ? (u as any).branchIds.map(String) : [];
    if (created.ownerBranch && !br.includes(created.ownerBranch)) return false;
    return true;
  });
  const shown = eligible.filter((u) => !q.trim() || `${u.name} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  const roleName = (k?: string) => roles?.find((r) => r.key === k)?.name ?? k ?? "-";

  const assign = async () => {
    if (!created) return;
    setBusy(true);
    const out: { id: string; name: string; ok: boolean; text: string }[] = [];
    for (const id of pick) {
      const u = users.find((x) => x.id === id);
      try {
        await api.assignRole(created.key, { userId: id, reason: reason.trim(), expectedUpdatedAt: u?.updatedAt });
        out.push({ id, name: u?.name ?? id, ok: true, text: "มอบแล้ว" });
      } catch (e) {
        out.push({ id, name: u?.name ?? id, ok: false, text: e instanceof ApiError ? e.message : "มอบไม่สำเร็จ" });
      }
    }
    setAssignRes(out);
    setPick(new Set(out.filter((r) => !r.ok).map((r) => r.id)));
    setBusy(false);
  };

  if (loadErr) return <WomsErrorState message={loadErr} onRetry={() => location.reload()} />;
  if (!roles) return <WomsLoadingState />;

  const header = (
    <Box>
      <Box component={Link} href="/users/roles" sx={{ fontSize: 14, fontWeight: 600, color: "#14432a" }}>
        ← บทบาทและสิทธิ์
      </Box>
      <Typography component="h1" sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1.25 }}>
        {created ? created.name : name.trim() && step > 0 ? `เพิ่มบทบาท: ${name.trim()}` : "เพิ่มบทบาท"}
      </Typography>
    </Box>
  );

  if (!canManage || !enabled) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
        {header}
        <Alert severity="info">{!canManage ? "คุณไม่มีสิทธิ์สร้างบทบาท" : "การสร้างบทบาทเองยังไม่เปิดใช้ในระบบนี้"}</Alert>
      </Box>
    );
  }

  const nav = (
    <Box component="nav" aria-label="ขั้นตอน" sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
      {STEPS.map((s, i) => {
        const done = step > i;
        const on = step === i;
        return (
          <Box key={s} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {i ? <Box sx={{ width: 40, height: "1px", bgcolor: "#cdd6dd" }} /> : null}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: 14, color: on ? "#16202b" : "#51626f", fontWeight: on ? 600 : 400 }} aria-current={on ? "step" : undefined}>
              <Box
                component="span"
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  bgcolor: on ? "#1b5e37" : done ? "#e1f1e4" : "#eef2f5",
                  color: on ? "#fff" : done ? "#14432a" : "#51626f",
                }}
              >
                {done ? "✓" : i + 1}
              </Box>
              {s}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
  const asideSx = { flex: "1 1 280px", bgcolor: "#fff", border: "1px solid #e2e7ec", borderRadius: "12px", px: 2.5, py: 2, display: "flex", flexDirection: "column", gap: 1, position: { md: "sticky" }, top: 24 } as const;
  const rowSx = { display: "flex", gap: 3, alignItems: "flex-start", flexWrap: "wrap" } as const;
  const mainColSx = { flex: "3 1 600px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 } as const;
  const summaryRows: [string, string][] = [
    ["ชื่อ", (created?.name ?? name.trim()) || "—"],
    ["เห็นข้อมูล", scope ? scopeTitle(scope) : "—"],
    ["ดูแลโดย", [ownerTeam && `ทีม ${ownerTeam}`, ownerBranch && `สาขา ${ownerBranch}`].filter(Boolean).join(" · ") || "—"],
    ["สิทธิ์", step >= 2 ? `${created ? created.permissions.length : perms.size} รายการ` : template ? `${templatePerms.length} รายการ (จาก${roleName(template)})` : "—"],
  ];
  const summaryList = summaryRows.map(([k, v]) => (
    <Box key={k} sx={{ display: "flex", justifyContent: "space-between", gap: 1, fontSize: 14, py: 0.75, borderBottom: "1px solid #e2e7ec" }}>
      <Box component="span" sx={{ color: "#51626f" }}>
        {k}
      </Box>
      <Box component="span" sx={{ textAlign: "right" }}>
        {v}
      </Box>
    </Box>
  ));
  const summaryAside = (
    <Box component="aside" sx={asideSx} data-testid="role-new-summary">
      <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700, mb: 0.5 }}>
        สรุป
      </Typography>
      {summaryList}
      {step < 2 ? <Box sx={{ fontSize: 13, color: "#51626f", mt: 0.5 }}>เลือกสิทธิ์ได้ในขั้นที่ 3 · ยังไม่มีอะไรถูกบันทึกจนกว่าจะกด &quot;สร้างบทบาท&quot;</Box> : null}
    </Box>
  );
  const panelSx = { bgcolor: "#fff", border: "1px solid #e2e7ec", borderRadius: "12px", p: 3, display: "flex", flexDirection: "column", gap: 2.5 } as const;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }} data-testid="role-new">
      {header}
      {step < 3 ? nav : null}
      {err ? (
        <Alert severity="error" onClose={() => setErr(null)} data-testid="role-create-error">
          {err}
        </Alert>
      ) : null}

      {step === 0 ? (
        <Box sx={rowSx}>
          <Box sx={mainColSx}>
          <Box sx={panelSx}>
            <TextField
              label="ชื่อบทบาท"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              helperText='ชื่อที่คนในระบบเห็น เช่น "หัวหน้าช่าง" "แอดมินสาขา"'
              inputProps={{ maxLength: 80, "data-testid": "role-name" }}
            />
            <TextField label="คำอธิบาย" value={description} onChange={(e) => setDescription(e.target.value)} inputProps={{ maxLength: 200 }} />
            <Box>
              <Typography sx={lblSx}>เริ่มจากสิทธิ์ของบทบาทไหน</Typography>
              <Typography sx={{ fontSize: 12, color: "#51626f", mb: 1 }}>คัดลอกสิทธิ์มาเป็นจุดเริ่ม แล้วค่อยเพิ่ม/ตัดในขั้นที่ 3</Typography>
              <Box role="radiogroup" aria-label="เริ่มจากบทบาท" sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 1.25 }}>
                {[{ key: "", name: "เริ่มจากว่าง", permissions: [] as string[] }, ...templates].map((r) => {
                  const on = template === r.key;
                  const topics = [...new Set(r.permissions.map(resourceOf))].slice(0, 3).join(" ");
                  return (
                    <Box key={r.key || "_empty"} component="button" type="button" role="radio" aria-checked={on} onClick={() => setTemplate(r.key)} sx={{ ...cardSx(on), flexDirection: "column", gap: 0.5 }} data-testid={`role-tpl-${r.key || "empty"}`}>
                      <Box component="b" sx={{ fontSize: 14 }}>
                        {r.name}
                      </Box>
                      <Box component="span" sx={{ fontSize: 13, color: "#51626f" }}>
                        {r.key ? `${r.permissions.length} สิทธิ์${topics ? ` · ${topics}` : ""}` : "ไม่มีสิทธิ์ เลือกเองทั้งหมด"}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
            <Box component="details">
              <Box component="summary" sx={{ fontSize: 14, fontWeight: 600, color: "#14432a", cursor: "pointer" }}>
                ตั้งค่าขั้นสูง
              </Box>
              <TextField
                sx={{ mt: 1.5, maxWidth: 320 }}
                fullWidth
                size="small"
                label="รหัสบทบาท"
                value={effectiveKey}
                onChange={(e) => {
                  setKeyTouched(true);
                  setKey(e.target.value.trim());
                }}
                error={!KEY_RE.test(effectiveKey)}
                helperText="สร้างให้อัตโนมัติจากชื่อ · a-z 0-9 _ - ยาว 3–40 ตัว ขึ้นต้นด้วยตัวอักษร · เปลี่ยนภายหลังไม่ได้"
                inputProps={{ "data-testid": "role-key", style: { fontFamily: "ui-monospace, Consolas, monospace" } }}
              />
            </Box>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
            <Button variant="outlined" color="inherit" onClick={() => router.push("/users/roles")}>
              ยกเลิก
            </Button>
            <Button variant="contained" disabled={!step1Ok} onClick={() => setStep(1)} data-testid="role-next-1">
              ถัดไป
            </Button>
          </Box>
          </Box>
          {summaryAside}
        </Box>
      ) : null}

      {step === 1 ? (
        <Box sx={rowSx}>
          <Box sx={mainColSx}>
          <Box sx={panelSx}>
            {meta.canSetScope === false ? (
              <Alert severity="warning">บัญชีของคุณกำหนดขอบเขตข้อมูลไม่ได้ (ต้องเห็นทุกใบงานเอง) — ระบบจะไม่ให้สร้างบทบาท</Alert>
            ) : null}
            <Box>
              <Typography sx={lblSx}>
                คนที่ถือบทบาทนี้เห็นข้อมูลแค่ไหน <Box component="span" sx={{ color: "#b3261e" }}>*</Box>
              </Typography>
              <Box role="radiogroup" aria-label="ขอบเขตข้อมูล" sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 0.75 }}>
                {SCOPES.map((s) => {
                  const on = scope === s.key;
                  const sup = s.key === "ALL" ? [] : [...new Set((meta.scopeSupport?.[s.key] ?? []).map(resourceOf))];
                  const desc = s.key === "ALL" ? s.hint : `${s.hint ? `${s.hint} · ` : ""}${sup.length ? `ใช้ได้กับ ${sup.join(" ")}` : "ยังไม่รองรับเรื่องใด"}`;
                  return (
                    <Box key={s.key} component="button" type="button" role="radio" aria-checked={on} onClick={() => setScope(s.key)} sx={cardSx(on)} data-testid={`role-scope-${s.key}`}>
                      <Box component="span" sx={{ flex: "none", width: 18, height: 18, borderRadius: 999, mt: "2px", boxSizing: "border-box", border: on ? "5px solid #1b5e37" : "2px solid #51626f" }} />
                      <Box component="span">
                        <Box component="b" sx={{ display: "block", fontSize: 14 }}>
                          {s.title}
                        </Box>
                        <Box component="span" sx={{ display: "block", fontSize: 13, color: "#51626f" }}>
                          {desc}
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
              <Typography sx={{ fontSize: 12, color: "#51626f", mt: 0.75 }}>
                ขอบเขตแคบ = เลือกสิทธิ์ได้เฉพาะเรื่องที่ระบบกรองข้อมูลตามขอบเขตนั้นได้แล้ว เรื่องอื่นจะกดไม่ได้ในขั้นถัดไป
              </Typography>
            </Box>
            <Box>
              <Typography sx={lblSx}>
                ทีมหรือสาขาที่ดูแลบทบาทนี้ <Box component="span" sx={{ color: "#b3261e" }}>*</Box>
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#51626f", mb: 1 }}>มอบบทบาทนี้ได้เฉพาะคนในทีม/สาขานี้ และแก้บทบาทได้เฉพาะคนในทีม/สาขานี้</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
                <TextField select size="small" label="ทีม" value={ownerTeam} onChange={(e) => setOwnerTeam(e.target.value)} inputProps={{ "data-testid": "role-owner-team" }}>
                  <MenuItem value="">— ไม่ระบุ —</MenuItem>
                  {me?.team ? <MenuItem value={me.team}>{me.team} (ทีมของคุณ)</MenuItem> : null}
                </TextField>
                <TextField size="small" label="สาขา (รหัสสาขา)" value={ownerBranch} onChange={(e) => setOwnerBranch(e.target.value)} inputProps={{ "data-testid": "role-owner-branch" }} />
              </Box>
              <Typography sx={{ fontSize: 12, color: "#51626f", mt: 0.75 }}>
                {me?.team ? "เลือกได้เฉพาะทีม/สาขาที่คุณอยู่ · ระบุอย่างน้อยหนึ่งอย่าง" : "บัญชีของคุณยังไม่มีทีม — ระบุรหัสสาขาที่คุณอยู่ หรือให้ผู้ดูแลกำหนดทีมให้ก่อน"}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
            <Button variant="outlined" color="inherit" onClick={() => setStep(0)}>
              ย้อนกลับ
            </Button>
            <Button variant="contained" disabled={!step2Ok} onClick={goStep3} data-testid="role-next-2">
              ถัดไป
            </Button>
          </Box>
          </Box>
          {summaryAside}
        </Box>
      ) : null}

      {step === 2 && scope ? (
        <Box sx={rowSx}>
          <Box component="section" sx={{ flex: "3 1 600px", minWidth: 0, bgcolor: "#fff", border: "1px solid #e2e7ec", borderRadius: "12px", overflow: "hidden" }}>
            <Box sx={{ px: 2.5, py: 1.5, fontSize: 14, color: "#51626f", borderBottom: "1px solid #e2e7ec" }}>
              ติ๊กที่ช่อง = ให้ทั้งช่อง · กดชื่อเรื่องเพื่อเลือกสิทธิ์ย่อย
              {template ? (
                <>
                  {" "}
                  · คัดลอกจากบทบาท <b style={{ color: "#16202b" }}>{roleName(template)}</b> แล้ว ปรับต่อได้
                </>
              ) : null}
            </Box>
            <PermissionPicker
              catalog={catalog}
              groups={meta.uiGroups}
              value={perms}
              onChange={setPerms}
              disabledReason={disabledReason}
              autoOn={(k) => !!CUSTOM_ROLE_IMPLIED_BY[k] && perms.has(CUSTOM_ROLE_IMPLIED_BY[k]) && !delegable.has(k)}
              reasonHint={(r) =>
                r.startsWith("อยู่นอก")
                  ? "บทบาทของคุณมอบสิทธิ์เหล่านี้ให้คนอื่นไม่ได้ ถ้าจำเป็นต้องให้ผู้ที่บทบาทสูงกว่า (เช่น Dev/MA) สร้างบทบาทนี้"
                  : r.startsWith("ขอบเขต")
                    ? "ระบบยังกรองข้อมูลเรื่องนี้ตามขอบเขตที่เลือกไม่ได้ ถ้าจำเป็นให้กลับไปเลือก \"เห็นทุกงาน\""
                    : r.startsWith("ได้อัตโนมัติ")
                      ? "ไม่ต้องเลือกเอง"
                      : null
              }
              caption="เลือกสิทธิ์ของบทบาทใหม่"
              rowAction={(reason) =>
                !reason.startsWith("ขอบเขต") ? null : (
                <Box component="button" type="button" onClick={() => setStep(1)} sx={{ border: 0, p: 0, bgcolor: "transparent", font: "inherit", fontWeight: 600, color: "#14432a", cursor: "pointer", textDecoration: "underline" }}>
                  เปลี่ยนขอบเขต
                </Box>
                )
              }
            />
          </Box>
          <Box component="aside" sx={asideSx}>
            <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700, mb: 0.5 }}>
              สรุป
            </Typography>
            {summaryList}
            {template && dropped.length ? (
              <Box sx={{ bgcolor: "#fdf3e2", border: "1px solid #ecd6a8", borderRadius: "8px", px: 1.5, py: 1.25, fontSize: 13, mt: 0.5 }} data-testid="role-dropped">
                สิทธิ์จากบทบาท{roleName(template)} <b>{dropped.length} รายการ</b> ไม่ได้คัดลอกมา เพราะขอบเขตที่เลือกยังไม่รองรับ หรืออยู่นอกรายการที่คุณมอบต่อได้
              </Box>
            ) : null}
            {perms.size === 0 ? <Box sx={{ fontSize: 13, color: "#8a5606" }}>ยังไม่ได้เลือกสิทธิ์ — สร้างได้ แต่ผู้ถือบทบาทจะยังทำอะไรไม่ได้</Box> : null}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
              <Button variant="contained" disabled={busy} onClick={submit} data-testid="role-create-submit">
                สร้างบทบาท
              </Button>
              <Button variant="outlined" color="inherit" onClick={() => setStep(1)} disabled={busy}>
                ย้อนกลับ
              </Button>
            </Box>
          </Box>
        </Box>
      ) : null}

      {step === 3 && created ? (
        <Box sx={rowSx}>
          <Box sx={mainColSx}>
          <Alert severity="success" data-testid="role-create-ok">
            <b>สร้างบทบาทแล้ว</b> · {created.permissions.length} สิทธิ์ · {scopeTitle(created.dataScope ?? "")} · ยังไม่มีใครถือบทบาทนี้
          </Alert>
          <Box sx={panelSx} data-testid="role-assign">
            <Box>
              <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
                มอบบทบาทนี้ให้ผู้ใช้
              </Typography>
              <Typography sx={{ fontSize: 13, color: "#51626f" }}>
                เลือกได้หลายคน · แสดงเฉพาะคนใน{[created.ownerTeam && `ทีม ${created.ownerTeam}`, created.ownerBranch && `สาขา ${created.ownerBranch}`].filter(Boolean).join(" และ ")} · คนที่ถูกเลือกจะเปลี่ยนจากบทบาทเดิมมาเป็นบทบาทนี้
              </Typography>
            </Box>
            <TextField size="small" placeholder="ค้นหาชื่อหรืออีเมล" value={q} onChange={(e) => setQ(e.target.value)} inputProps={{ "aria-label": "ค้นหาผู้ใช้" }} />
            <Box sx={{ maxHeight: 360, overflowY: "auto" }}>
              {shown.length === 0 ? <Box sx={{ fontSize: 14, color: "#51626f", py: 1 }}>ไม่มีผู้ใช้ที่มอบได้</Box> : null}
              {shown.map((u) => (
                <Box key={u.id} component="label" sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.75, borderBottom: "1px solid #e2e7ec", fontSize: 14, cursor: "pointer" }}>
                  <Checkbox
                    size="small"
                    checked={pick.has(u.id)}
                    onChange={(e) => {
                      const n = new Set(pick);
                      if (e.target.checked) n.add(u.id);
                      else n.delete(u.id);
                      setPick(n);
                    }}
                    inputProps={{ "data-testid": `role-assign-${u.id}` } as any}
                  />
                  <Box component="span" sx={{ flex: 1 }}>
                    {u.name}
                    <Box component="span" sx={{ display: "block", fontSize: 13, color: "#51626f" }}>
                      {u.email} · ตอนนี้: {roleName(u.role)}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
            <TextField
              label="เหตุผล (บังคับ)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              inputProps={{ maxLength: 300, "data-testid": "role-assign-reason" }}
            />
            {assignRes.length ? (
              <Alert severity={assignRes.every((r) => r.ok) ? "success" : "warning"} data-testid="role-assign-result">
                {assignRes.map((r, i) => (
                  <Box key={i}>
                    {r.name} — {r.text}
                  </Box>
                ))}
              </Alert>
            ) : null}
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
              <Button variant="outlined" color="inherit" onClick={() => router.push("/users/roles")}>
                {assignRes.some((r) => r.ok) ? "เสร็จ" : "ข้ามไปก่อน"}
              </Button>
              <Button variant="contained" disabled={busy || !pick.size || !reason.trim()} onClick={assign} data-testid="role-assign-submit">
                มอบให้ {pick.size} คน
              </Button>
            </Box>
          </Box>
          </Box>
          {summaryAside}
        </Box>
      ) : null}
    </Box>
  );
}
