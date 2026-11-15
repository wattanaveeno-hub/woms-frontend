"use client";

import { useEffect, useState } from "react";
import type { SalesTeamView } from "@/lib/api";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type { AuthUser, Role } from "@/lib/types";
import { useDialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Link from "next/link";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import UserAvatar from "@/components/UserAvatar";
import AvatarEditorDialog from "@/components/AvatarEditorDialog";
import { usePrefetchAvatars } from "@/lib/avatarStore";
import UserPermissionsDialog from "@/components/UserPermissionsDialog";
import type { RoleItem, RolesCatalogResponse } from "@/lib/api";
import {
  WomsDataTable,
  WomsEmptyState,
  WomsFormSection,
  WomsPageHeader,
  WomsSearchBar,
  WomsStatusChip,
  WomsViewPills,
  type WomsColumn,
} from "@/components/woms";
import { filterUsers, type UserView } from "@/lib/userFilter";

const roleLabel = (r: Role) => ROLES.find((x) => x.value === r)?.label ?? r;

// ป้ายตรงกับ BRD §11 (BR-11.1) — ceo = Master/CEO, admin = Administrator (จัดการผู้ใช้ไม่ได้)
// RBAC Role Matrix: เพิ่ม Developer/MA และ STORE (Backend ตรวจลำดับบทบาทเมื่อมอบ — SET-02)
const ROLES: { value: Role; label: string }[] = [
  { value: "developer", label: "Developer/MA" },
  { value: "ceo", label: "ผู้บริหาร (Master/CEO)" },
  { value: "admin", label: "แอดมิน (Administrator)" },
  { value: "manager", label: "ผู้จัดการ" },
  { value: "acc", label: "บัญชี (ACC)" },
  { value: "tech", label: "ช่าง" },
  { value: "sales", label: "ฝ่ายขาย" },
  { value: "store", label: "คลังสินค้า (STORE)" },
  { value: "viewer", label: "ผู้ดูข้อมูล" },
];

const empty = { email: "", name: "", password: "", role: "viewer" as Role, phone: "" };

export default function UsersPage() {
  const { status, user, has } = useAuth();
  const dialog = useDialog();
  const toast = useToast();
  const [formErr, setFormErr] = useState<Record<string, string>>({});
  const [items, setItems] = useState<AuthUser[]>([]);
  // ENTECH design (Users.dc.html): ค้นหา + กลุ่มบทบาท — กรองที่หน้าเว็บจากรายการเดิม (ไม่เปลี่ยน API/สิทธิ์)
  const [userQ, setUserQ] = useState("");
  const [userView, setUserView] = useState<UserView>("ALL");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  // ข้อความยืนยันความสำเร็จในหน้า (แทน window.alert ที่จัดรูปแบบไม่ได้)
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  const canManage = has("users:manage");
  // CHAT-AV01: ผู้จัดการผู้ใช้ตั้งรูปโปรไฟล์ให้ผู้อื่นได้ (backend ตรวจลำดับบทบาท/Protected Admin)
  const [avatarFor, setAvatarFor] = useState<AuthUser | null>(null);
  // AUTH-01: สิทธิ์รายบุคคล — โหลดสิทธิ์ตามบทบาท + catalog เมื่อจัดการผู้ใช้ได้
  const [permFor, setPermFor] = useState<AuthUser | null>(null);
  const [roleItems, setRoleItems] = useState<RoleItem[]>([]);
  const [catalog, setCatalog] = useState<RolesCatalogResponse | null>(null);
  usePrefetchAvatars(items.map((u) => u.id));
  // VFB แถว 21: CEO "มองเห็นทุกอย่าง แก้ไขไม่ได้" → ดูรายชื่อได้ (users:view) แต่ไม่มีปุ่ม/ฟอร์มแก้ไข
  const canView = canManage || has("users:view");

  // UAT2-06: ทีมของ Sales (ทีมเซลล์ในหน้า "ทีมเซลล์ & กลุ่มแชท") แสดงและกำหนดได้จากหน้าผู้ใช้
  const [salesTeams, setSalesTeams] = useState<SalesTeamView[]>([]);
  const [teamFor, setTeamFor] = useState<AuthUser | null>(null);
  const [teamPick, setTeamPick] = useState("");
  const [teamBusy, setTeamBusy] = useState(false);
  const teamOf = (uid: string) => salesTeams.find((t) => t.active !== false && t.memberIds.includes(uid)) ?? null;

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await api.listUsers();
      setItems(r.items);
      api.salesTeams().then((t) => setSalesTeams(t.items)).catch(() => setSalesTeams([]));
      if (canManage && !catalog) {
        const [ro, c] = await Promise.all([api.listRoles().catch(() => null), api.rolesCatalog().catch(() => null)]);
        if (ro) setRoleItems(ro.items);
        if (c) setCatalog(c);
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authed" && canView) load();
    else if (status === "authed") setLoading(false);
  }, [status, canView]);

  if (status !== "authed") return null;
  // เปิด URL ตรงโดยไม่มีสิทธิ์ (เช่น Administrator ตาม BR-11.1) — backend ตอบ 403 ทุก endpoint ของ /api/users อยู่แล้ว
  if (!canView) return <WomsEmptyState title="คุณไม่มีสิทธิ์เข้าถึงหน้านี้" description="การดูและจัดการผู้ใช้เป็นสิทธิ์ของผู้บริหารและผู้จัดการเท่านั้น" />;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const fe: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) fe.email = "รูปแบบอีเมลไม่ถูกต้อง";
    if (!form.name.trim()) fe.name = "ต้องระบุชื่อ";
    if (form.password.length < 8) fe.password = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
    if (form.phone.trim() && form.phone.replace(/\D/g, "").length < 9) fe.phone = "เบอร์โทรต้องมีอย่างน้อย 9 หลัก";
    setFormErr(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    try {
      await api.createUser({
        email: form.email.trim(),
        name: form.name.trim(),
        password: form.password,
        role: form.role,
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
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

  // UAT2-04: เบอร์โทรใช้เข้าสู่ระบบได้ (ยังต้องใช้รหัสผ่าน) — backend ตรวจห้ามซ้ำ (409 field phone)
  const editPhone = async (u: AuthUser) => {
    const v = await dialog.prompt({
      title: `เบอร์โทรของ ${u.name}`,
      label: "เบอร์โทร",
      help: "ใช้เข้าสู่ระบบแทนอีเมลได้ (ยังต้องใช้รหัสผ่าน) · ห้ามซ้ำกับผู้ใช้อื่น · เว้นว่างเพื่อลบ",
      defaultValue: u.phone ?? "",
      confirmLabel: "บันทึก",
    });
    if (v === null) return;
    const phone = v.trim();
    if (phone && phone.replace(/\D/g, "").length < 9) return toast.error("เบอร์โทรต้องมีอย่างน้อย 9 หลัก");
    try {
      await api.patchUser(u.id, { phone, expectedUpdatedAt: u.updatedAt });
      toast.success(`บันทึกเบอร์โทรของ ${u.name} แล้ว`);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "บันทึกเบอร์โทรไม่สำเร็จ");
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
    // Q-R6-04 (Owner อนุมัติ รอบ 7): ต้องกรอกเหตุผลทุกครั้ง — backend ตรวจซ้ำ (ว่าง/ช่องว่าง = 400)
    const reason = await dialog.prompt({
      title: `เปลี่ยนสิทธิ์ของ ${u.name}?`,
      message: `${roleLabel(u.role)} → ${roleLabel(role)} · มีผลทันทีกับคำขอถัดไปทุกหน้าจอและทุก API`,
      label: "เหตุผลการเปลี่ยนสิทธิ์",
      type: "textarea",
      required: true,
      validate: (v) => (v.trim() ? (v.trim().length > 300 ? "ไม่เกิน 300 ตัวอักษร" : null) : "ต้องระบุเหตุผล"),
      confirmLabel: "เปลี่ยนสิทธิ์",
    });
    if (reason === null) return;
    try {
      await api.patchUser(u.id, { role, roleChangeReason: reason.trim(), expectedUpdatedAt: u.updatedAt || undefined });
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
      // D-04: รีเซ็ตแล้วผู้ใช้ต้องเปลี่ยนรหัสผ่านเองเมื่อเข้าสู่ระบบครั้งถัดไป และทุกเซสชันเดิมถูกออกจากระบบ
      message:
        "ผู้ใช้จะต้องใช้รหัสผ่านชั่วคราวนี้เข้าสู่ระบบ แล้วระบบจะให้เปลี่ยนรหัสผ่านใหม่เองเมื่อเข้าสู่ระบบครั้งถัดไป · อุปกรณ์ทุกเครื่องที่ผู้ใช้เข้าสู่ระบบอยู่จะถูกออกจากระบบทันที",
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
      toast.success(`รีเซ็ตรหัสผ่านของ ${u.name} แล้ว — ผู้ใช้ต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งถัดไป`);
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
    if (!canManage) return ROLES.find((r) => r.value === u.role)?.label ?? u.role;
    return (
      <Box>
      {u.protectedAdmin ? (
        <Typography variant="caption" sx={{ display: "block", color: "warning.dark", fontWeight: 600 }} data-testid="protected-admin-badge">
          ผู้ดูแลระบบสูงสุด
        </Typography>
      ) : null}
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
      </Box>
    );
  };
  const saveSalesTeam = async () => {
    if (!teamFor) return;
    const uid = teamFor.id;
    const cur = teamOf(uid);
    if ((cur?.id ?? "") === teamPick) return setTeamFor(null);
    setTeamBusy(true);
    try {
      const reason = `กำหนดทีมของ ${teamFor.name} จากหน้าผู้ใช้งาน`;
      // เซลล์หนึ่งคนอยู่ได้หนึ่งทีม — ถอดออกจากทีมเดิมก่อน แล้วค่อยเพิ่มเข้าทีมใหม่ (backend ตรวจซ้ำ)
      if (cur) await api.updateSalesTeam(cur.id, { memberIds: cur.memberIds.filter((m) => m !== uid), expectedUpdatedAt: cur.updatedAt, reason });
      if (teamPick) {
        const next = salesTeams.find((t) => t.id === teamPick)!;
        await api.updateSalesTeam(next.id, { memberIds: [...new Set([...next.memberIds, uid])], expectedUpdatedAt: next.updatedAt, reason });
      }
      toast.success(teamPick ? `ย้าย ${teamFor.name} เข้าทีมแล้ว` : `นำ ${teamFor.name} ออกจากทีมแล้ว`);
      setTeamFor(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "กำหนดทีมไม่สำเร็จ");
    } finally {
      setTeamBusy(false);
      api.salesTeams().then((t) => setSalesTeams(t.items)).catch(() => undefined);
    }
  };
  const teamCell = (u: AuthUser) =>
    u.role === "sales" ? (
      <Box data-testid="sales-team-cell">
        <Typography variant="body2" sx={{ color: "text.primary" }}>
          {teamOf(u.id)?.name ? `ทีมเซลล์: ${teamOf(u.id)!.name}` : "— ยังไม่อยู่ในทีมเซลล์ —"}
        </Typography>
        {canManage && salesTeams.length ? (
          <Button
            size="small"
            onClick={() => {
              setTeamPick(teamOf(u.id)?.id ?? "");
              setTeamFor(u);
            }}
          >
            กำหนดทีม
          </Button>
        ) : canManage ? (
          <Button size="small" component={Link} href="/group-chat/manage">
            สร้างทีมเซลล์
          </Button>
        ) : null}
      </Box>
    ) : u.role === "tech" ? (
      <Box>
        <Typography variant="body2" sx={{ color: "text.primary" }}>
          {u.team || "— ยังไม่ระบุทีม —"}
        </Typography>
        <Typography variant="body2">{(u.zones ?? []).join(", ") || "รับทุกโซน"}</Typography>
        {canManage ? (
          <Button size="small" onClick={() => editTech(u)}>
            แก้ทีม/โซน
          </Button>
        ) : null}
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
        <Button size="small" onClick={() => void editPhone(u)} data-testid="user-phone-edit">
          เบอร์โทร
        </Button>
        <Button size="small" onClick={() => setAvatarFor(u)} data-testid="user-avatar-edit">
          รูปโปรไฟล์
        </Button>
        <Button size="small" disabled={self || !catalog} onClick={() => setPermFor(u)} data-testid="user-perm-edit">
          สิทธิ์เฉพาะ
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
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      <UserAvatar userId={u.id} name={u.name} size={28} />
      <span>{u.name}</span>
      {u.id === user?.id ? <Chip size="small" label="คุณ" /> : null}
    </Box>
  );
  const activeChip = (u: AuthUser) => <WomsStatusChip label={u.active ? "ใช้งาน" : "ปิด"} tone={u.active ? "success" : "neutral"} />;
  // หน้าผู้ใช้งาน: สถานะที่ผู้ดูแลต้องรู้ทันที — ถูกระงับชั่วคราว / ล็อกอินผิด / ต้องเปลี่ยนรหัสผ่าน / สิทธิ์เฉพาะ
  const statusCell = (u: AuthUser) => (
    <Stack spacing={0.5} alignItems="flex-start">
      {activeChip(u)}
      {u.loginLocked ? (
        <WomsStatusChip label={`ระงับชั่วคราว ${Math.ceil((u.loginRetryAfterSec ?? 0) / 60)} นาที`} tone="error" />
      ) : u.loginFailures ? (
        <WomsStatusChip label={`ล็อกอินผิด ${u.loginFailures} ครั้ง`} tone="warning" />
      ) : null}
      {u.mustChangePassword ? <WomsStatusChip label="ต้องเปลี่ยนรหัส" tone="warning" /> : null}
      {u.permissionOverrides && (u.permissionOverrides.grant.length || u.permissionOverrides.deny.length) ? (
        <Chip
          size="small"
          variant="outlined"
          label={`สิทธิ์เฉพาะ +${u.permissionOverrides.grant.length} / −${u.permissionOverrides.deny.length}`}
          data-testid="user-perm-chip"
        />
      ) : null}
    </Stack>
  );
  const lastLoginCell = (u: AuthUser) => {
    if (!u.lastLoginAt) return <Typography variant="body2" color="text.secondary">ยังไม่เคย</Typography>;
    const d = new Date(u.lastLoginAt);
    const txt = Number.isNaN(d.getTime())
      ? "—"
      : d.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
    const dev = u.lastLoginDevice === "mobile" ? "มือถือ" : u.lastLoginDevice === "desktop" ? "คอมพิวเตอร์" : "";
    return (
      <Box>
        <Typography variant="body2" sx={{ color: "text.primary" }}>{txt}</Typography>
        {dev ? <Typography variant="caption" color="text.secondary">{dev}</Typography> : null}
      </Box>
    );
  };
  const columns: WomsColumn<AuthUser>[] = [
    { key: "name", label: "ชื่อ", sortValue: (u) => u.name, render: nameCell },
    {
      key: "email",
      label: "อีเมล / เบอร์โทร",
      sortValue: (u) => u.email,
      render: (u) => (
        <Box>
          <Typography variant="body2" sx={{ color: "text.primary" }}>{u.email}</Typography>
          {u.phone ? <Typography variant="caption" color="text.secondary">{u.phone}</Typography> : null}
        </Box>
      ),
    },
    { key: "role", label: "สิทธิ์", sortValue: (u) => u.role, render: roleCell },
    { key: "team", label: "ทีม / โซนที่รับผิดชอบ", hideBelowLg: true, render: teamCell },
    { key: "last", label: "เข้าใช้ล่าสุด", hideBelowLg: true, sortValue: (u) => u.lastLoginAt || "", render: lastLoginCell },
    { key: "active", label: "สถานะ", sortValue: (u) => (u.active ? 0 : 1) * 10 - (u.loginLocked ? 2 : u.loginFailures ? 1 : 0), render: statusCell },
    ...(canManage ? [{ key: "act", label: "จัดการ", render: actions } as WomsColumn<AuthUser>] : []),
  ];

  return (
    <div>
      <WomsPageHeader title="ผู้ใช้งานระบบ" subtitle={loading ? "กำลังโหลด…" : `${items.length} บัญชี`} />

      {canManage ? null : (
        <Alert severity="info" sx={{ mb: 2 }}>
          ดูได้อย่างเดียว — การเพิ่ม แก้ไข หรือลบผู้ใช้เป็นสิทธิ์ของผู้จัดการ
        </Alert>
      )}
      {canManage ? (
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
              <TextField
                id="user-phone"
                label="เบอร์โทร"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                error={!!formErr.phone}
                helperText={formErr.phone || "ใช้เข้าสู่ระบบได้ · ห้ามซ้ำ"}
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
      ) : null}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 2 }} data-testid="users-filters">
        <Box sx={{ flex: "1 1 260px", maxWidth: 420 }}>
          <WomsSearchBar value={userQ} onChange={setUserQ} placeholder="ชื่อ อีเมล เบอร์โทร" label="ค้นหาผู้ใช้" />
        </Box>
        <WomsViewPills
          ariaLabel="กลุ่มผู้ใช้"
          value={userView}
          onChange={setUserView}
          options={[
            { value: "ALL", label: "ทั้งหมด", count: items.length },
            { value: "TECH", label: "ช่าง", count: filterUsers(items, "", "TECH").length },
            { value: "SALES", label: "เซลล์", count: filterUsers(items, "", "SALES").length },
            { value: "ADMIN", label: "แอดมิน/ผู้จัดการ", count: filterUsers(items, "", "ADMIN").length },
            { value: "INACTIVE", label: "ปิดใช้งาน", count: filterUsers(items, "", "INACTIVE").length },
          ]}
        />
      </Box>
      <WomsDataTable
        caption="ผู้ใช้งานระบบ"
        rows={filterUsers(items, userQ, userView)}
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
              {statusCell(u)}
            </Stack>
            <Typography variant="body2" sx={{ mb: 1, overflowWrap: "anywhere" }}>
              {u.email}
              {u.phone ? ` · ${u.phone}` : ""}
            </Typography>
            {roleCell(u)}
            {u.role === "tech" || u.role === "sales" ? <Box sx={{ mt: 1 }}>{teamCell(u)}</Box> : null}
            {/* DEF-06 — มุมมองการ์ด (มือถือ) ต้องซ่อนปุ่มจัดการเหมือนมุมมองตาราง (CEO ดูอย่างเดียว · VFB แถว 21) */}
            {canManage ? <Box sx={{ mt: 1 }}>{actions(u)}</Box> : null}
          </Box>
        )}
      />
      {permFor && catalog ? (
        <UserPermissionsDialog
          user={permFor}
          catalog={catalog.items}
          groups={catalog.uiGroups}
          delegable={catalog.delegable}
          actorIsDeveloper={user?.role === "developer"}
          basePermissions={roleItems.find((r) => r.key === permFor.role)?.permissions ?? []}
          onClose={() => setPermFor(null)}
          onSaved={(u) => {
            setPermFor(null);
            toast.success(`บันทึกสิทธิ์เฉพาะของ ${u.name} แล้ว`);
            void load();
          }}
        />
      ) : null}
      <Dialog open={!!teamFor} onClose={teamBusy ? undefined : () => setTeamFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>ทีมเซลล์ของ {teamFor?.name}</DialogTitle>
        <DialogContent>
          <TextField select fullWidth label="ทีมเซลล์" value={teamPick} onChange={(e) => setTeamPick(e.target.value)} sx={{ mt: 1 }} helperText="เซลล์หนึ่งคนอยู่ได้หนึ่งทีม · จัดการทีมทั้งหมดที่หน้า ทีมเซลล์ & กลุ่มแชท">
            <MenuItem value="">— ไม่อยู่ในทีม —</MenuItem>
            {salesTeams.filter((t) => t.active !== false).map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setTeamFor(null)} disabled={teamBusy}>
            ยกเลิก
          </Button>
          <Button variant="contained" onClick={() => void saveSalesTeam()} disabled={teamBusy}>
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>
      {avatarFor ? (
        <AvatarEditorDialog
          open
          onClose={() => setAvatarFor(null)}
          userId={avatarFor.id}
          name={avatarFor.name}
          mode={avatarFor.id === user?.id ? "me" : "admin"}
        />
      ) : null}
    </div>
  );
}
