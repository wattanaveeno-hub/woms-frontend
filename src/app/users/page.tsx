"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { AuthUser, Role } from "@/lib/types";
import { useDialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import {
  WomsDataTable,
  WomsEmptyState,
  WomsFormSection,
  WomsPageHeader,
  WomsStatusChip,
  type WomsColumn,
} from "@/components/woms";

const roleLabel = (r: Role) => ROLES.find((x) => x.value === r)?.label ?? r;

// ป้ายตรงกับ BRD §11 (BR-11.1) — ceo = Master/CEO, admin = Administrator (จัดการผู้ใช้ไม่ได้)
const ROLES: { value: Role; label: string }[] = [
  { value: "ceo", label: "ผู้บริหาร (Master/CEO)" },
  { value: "admin", label: "แอดมิน (Administrator)" },
  { value: "manager", label: "ผู้จัดการ" },
  { value: "tech", label: "ช่าง" },
  { value: "sales", label: "ฝ่ายขาย" },
  { value: "viewer", label: "ผู้ดูข้อมูล" },
];

const empty = { email: "", name: "", password: "", role: "viewer" as Role };

export default function UsersPage() {
  const { status, user, has } = useAuth();
  const dialog = useDialog();
  const toast = useToast();
  const [formErr, setFormErr] = useState<Record<string, string>>({});
  const [items, setItems] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  // ข้อความยืนยันความสำเร็จในหน้า (แทน window.alert ที่จัดรูปแบบไม่ได้)
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  const canManage = has("users:manage");

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await api.listUsers();
      setItems(r.items);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authed" && canManage) load();
    else if (status === "authed") setLoading(false);
  }, [status, canManage]);

  if (status !== "authed") return null;
  // เปิด URL ตรงโดยไม่มีสิทธิ์ (เช่น Administrator ตาม BR-11.1) — backend ตอบ 403 ทุก endpoint ของ /api/users อยู่แล้ว
  if (!canManage) return <WomsEmptyState title="คุณไม่มีสิทธิ์เข้าถึงหน้านี้" description="การจัดการผู้ใช้เป็นสิทธิ์ของ Master/CEO และผู้จัดการเท่านั้น" />;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const fe: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) fe.email = "รูปแบบอีเมลไม่ถูกต้อง";
    if (!form.name.trim()) fe.name = "ต้องระบุชื่อ";
    if (form.password.length < 8) fe.password = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
    setFormErr(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    try {
      await api.createUser({
        email: form.email.trim(),
        name: form.name.trim(),
        password: form.password,
        role: form.role,
      });
      toast.success(`เพิ่มผู้ใช้ ${form.name.trim()} แล้ว`);
      setForm(empty);
      await load();
    } catch (e2) {
      if (e2 instanceof ApiError && e2.field) setFormErr({ [e2.field]: e2.message });
      toast.error(e2 instanceof ApiError ? e2.message : "สร้างผู้ใช้ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  // ตั้งทีมและโซนที่ช่างรับผิดชอบ — ใช้จับคู่คิวงานตามโซน
  const editTech = async (u: AuthUser) => {
    const team = await dialog.prompt({
      title: `ทีมช่างของ ${u.name}`,
      label: "ทีมช่าง",
      help: "ใช้จับคู่ขอบเขตการมองเห็นใบงานและการจ่ายคิว",
      defaultValue: u.team ?? "",
      confirmLabel: "ถัดไป",
    });
    if (team === null) return;
    const zones = await dialog.prompt({
      title: `โซนที่ ${u.name} รับผิดชอบ`,
      label: "โซน (คั่นด้วยจุลภาค)",
      help: "เช่น กรุงเทพเหนือ, นนทบุรี — เว้นว่างได้",
      defaultValue: (u.zones ?? []).join(", "),
      confirmLabel: "บันทึก",
    });
    if (zones === null) return;
    try {
      await api.patchUser(u.id, {
        team: team.trim(),
        zones: zones
          .split(",")
          .map((z) => z.trim())
          .filter(Boolean),
      });
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "อัปเดตข้อมูลช่างไม่สำเร็จ");
    }
  };

  // การเปลี่ยนสิทธิ์มีผลด้านความปลอดภัย — ยืนยันก่อน (เดิมเปลี่ยนทันทีที่เลือกใน dropdown)
  const changeRole = async (u: AuthUser, role: Role) => {
    if (role === u.role) return;
    if (
      !(await dialog.confirm({
        title: `เปลี่ยนสิทธิ์ของ ${u.name}?`,
        message: `${roleLabel(u.role)} → ${roleLabel(role)} · มีผลทันทีกับทุกหน้าจอและทุก API`,
        confirmLabel: "เปลี่ยนสิทธิ์",
      }))
    )
      return;
    try {
      await api.patchUser(u.id, { role });
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "แก้ไขสิทธิ์ไม่สำเร็จ");
    }
  };

  const toggleActive = async (u: AuthUser) => {
    if (
      u.active &&
      !(await dialog.confirm({
        title: `ปิดใช้งานบัญชี ${u.name}?`,
        message: "ผู้ใช้จะเข้าสู่ระบบและเรียกใช้ API ไม่ได้ทันที เปิดใช้งานกลับได้ภายหลัง",
        confirmLabel: "ปิดใช้งาน",
        danger: true,
      }))
    )
      return;
    try {
      await api.patchUser(u.id, { active: !u.active });
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "เปลี่ยนสถานะไม่สำเร็จ");
    }
  };

  const resetPassword = async (u: AuthUser) => {
    // QA BUG-017 — เดิมใช้ window.prompt() ซึ่ง **ไม่มีโหมดปิดบัง**
    // รหัสผ่านใหม่จึงถูกพิมพ์เป็นข้อความเปิดเผยบนหน้าจอให้คนข้าง ๆ อ่านได้
    // ตอนนี้เป็น <input type="password"> ในกล่องของระบบเอง
    const pw = await dialog.prompt({
      title: `ตั้งรหัสผ่านใหม่สำหรับ ${u.name}`,
      message: "ผู้ใช้จะต้องใช้รหัสผ่านใหม่นี้ในการเข้าสู่ระบบครั้งถัดไป",
      label: "รหัสผ่านใหม่",
      help: "อย่างน้อย 8 ตัวอักษร",
      type: "password",
      required: true,
      confirmLabel: "เปลี่ยนรหัสผ่าน",
      validate: (v) => (v.length < 8 ? "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" : null),
    });
    if (pw === null) return;
    try {
      await api.patchUser(u.id, { password: pw });
      toast.success(`เปลี่ยนรหัสผ่านของ ${u.name} แล้ว`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    }
  };

  const remove = async (u: AuthUser) => {
    if (
      !(await dialog.confirm({
        title: `ลบผู้ใช้ ${u.name}?`,
        message: "การลบผู้ใช้ย้อนกลับไม่ได้ — ผู้ใช้ที่เคยได้รับมอบหมายงาน มีแผน PM หรือบิลช่างลบไม่ได้ ให้ใช้ปุ่มปิดใช้งานแทน",
        confirmLabel: "ยืนยันลบผู้ใช้",
        danger: true,
      }))
    )
      return;
    try {
      await api.deleteUser(u.id);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ลบผู้ใช้ไม่สำเร็จ");
    }
  };

  const roleCell = (u: AuthUser) => {
    const self = u.id === user?.id;
    return (
      <TextField
        select
        size="small"
        value={u.role}
        disabled={self}
        onChange={(e) => changeRole(u, e.target.value as Role)}
        inputProps={{ "aria-label": `สิทธิ์ของ ${u.name}` }}
        helperText={self ? "เปลี่ยนสิทธิ์ตัวเองไม่ได้" : undefined}
        sx={{ minWidth: 180 }}
        fullWidth={false}
      >
        {ROLES.map((r) => (
          <MenuItem key={r.value} value={r.value}>
            {r.label}
          </MenuItem>
        ))}
      </TextField>
    );
  };
  const teamCell = (u: AuthUser) =>
    u.role === "tech" ? (
      <Box>
        <Typography variant="body2" sx={{ color: "text.primary" }}>
          {u.team || "— ยังไม่ระบุทีม —"}
        </Typography>
        <Typography variant="body2">{(u.zones ?? []).join(", ") || "รับทุกโซน"}</Typography>
        <Button size="small" onClick={() => editTech(u)}>
          แก้ทีม/โซน
        </Button>
      </Box>
    ) : (
      "—"
    );
  const actions = (u: AuthUser) => {
    const self = u.id === user?.id;
    return (
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        <Button size="small" onClick={() => resetPassword(u)}>
          รหัสผ่าน
        </Button>
        <Button size="small" disabled={self} onClick={() => toggleActive(u)}>
          {u.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
        </Button>
        <Button size="small" color="error" disabled={self} onClick={() => remove(u)}>
          ลบ
        </Button>
      </Stack>
    );
  };
  const nameCell = (u: AuthUser) => (
    <>
      {u.name}
      {u.id === user?.id ? <Chip size="small" label="คุณ" sx={{ ml: 0.75 }} /> : null}
    </>
  );
  const activeChip = (u: AuthUser) => <WomsStatusChip label={u.active ? "ใช้งาน" : "ปิด"} tone={u.active ? "success" : "neutral"} />;
  const columns: WomsColumn<AuthUser>[] = [
    { key: "name", label: "ชื่อ", sortValue: (u) => u.name, render: nameCell },
    { key: "email", label: "อีเมล", sortValue: (u) => u.email, render: (u) => u.email },
    { key: "role", label: "สิทธิ์", sortValue: (u) => u.role, render: roleCell },
    { key: "team", label: "ทีม / โซนที่รับผิดชอบ", hideBelowLg: true, render: teamCell },
    { key: "active", label: "สถานะ", sortValue: (u) => (u.active ? 0 : 1), render: activeChip },
    { key: "act", label: "จัดการ", render: actions },
  ];

  return (
    <div>
      <WomsPageHeader title="ผู้ใช้งานระบบ" subtitle={loading ? "กำลังโหลด…" : `${items.length} บัญชี`} />

      <WomsFormSection title="เพิ่มผู้ใช้ใหม่">
        <Box component="form" noValidate onSubmit={create}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                required
                id="user-email"
                label="อีเมล"
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                error={!!formErr.email}
                helperText={formErr.email}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                required
                id="user-name"
                label="ชื่อ"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                error={!!formErr.name}
                helperText={formErr.name}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                required
                id="user-password"
                label="รหัสผ่าน"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                error={!!formErr.password}
                helperText={formErr.password || "อย่างน้อย 8 ตัวอักษร"}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField select id="user-role" label="สิทธิ์" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {ROLES.map((r) => (
                  <MenuItem key={r.value} value={r.value}>
                    {r.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
          <Button type="submit" variant="contained" startIcon={<PersonAddIcon />} disabled={busy} sx={{ mt: 2 }}>
            {busy ? "กำลังเพิ่ม…" : "เพิ่มผู้ใช้"}
          </Button>
        </Box>
      </WomsFormSection>

      <WomsDataTable
        caption="ผู้ใช้งานระบบ"
        rows={items}
        loading={loading}
        error={err}
        onRetry={load}
        columns={columns}
        rowKey={(u) => u.id}
        pageSize={10}
        emptyTitle="ยังไม่มีผู้ใช้"
        renderCard={(u) => (
          <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" spacing={1}>
              <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{nameCell(u)}</Typography>
              {activeChip(u)}
            </Stack>
            <Typography variant="body2" sx={{ mb: 1, overflowWrap: "anywhere" }}>
              {u.email}
            </Typography>
            {roleCell(u)}
            {u.role === "tech" ? <Box sx={{ mt: 1 }}>{teamCell(u)}</Box> : null}
            <Box sx={{ mt: 1 }}>{actions(u)}</Box>
          </Box>
        )}
      />
    </div>
  );
}
