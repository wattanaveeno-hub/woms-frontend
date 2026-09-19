"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import Pagination, { usePagination } from "@/components/Pagination";
import { useAuth } from "@/lib/AuthContext";
import type { AuthUser, Role } from "@/lib/types";
import { useDialog } from "@/components/Dialog";

const ROLES: { value: Role; label: string }[] = [
  { value: "admin", label: "ผู้ดูแลระบบ" },
  { value: "manager", label: "ผู้จัดการ" },
  { value: "tech", label: "ช่าง" },
  { value: "sales", label: "ฝ่ายขาย" },
  { value: "viewer", label: "ผู้ดูข้อมูล" },
];

const empty = { email: "", name: "", password: "", role: "viewer" as Role };

export default function UsersPage() {
  const { status, user, has } = useAuth();
  const dialog = useDialog();
  const [items, setItems] = useState<AuthUser[]>([]);
  const { page, setPage, pageCount, pageItems, total } = usePagination(items, 10);
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
  if (!canManage) return <div className="state">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api.createUser({
        email: form.email.trim(),
        name: form.name.trim(),
        password: form.password,
        role: form.role,
      });
      setForm(empty);
      await load();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "สร้างผู้ใช้ไม่สำเร็จ");
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
      setErr(null);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "อัปเดตข้อมูลช่างไม่สำเร็จ");
    }
  };

  const changeRole = async (u: AuthUser, role: Role) => {
    try {
      await api.patchUser(u.id, { role });
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "แก้ไขสิทธิ์ไม่สำเร็จ");
    }
  };

  const toggleActive = async (u: AuthUser) => {
    try {
      await api.patchUser(u.id, { active: !u.active });
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "เปลี่ยนสถานะไม่สำเร็จ");
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
      setErr(null);
      setOkMsg(`เปลี่ยนรหัสผ่านของ ${u.name} แล้ว`);
    } catch (e) {
      setOkMsg(null);
      setErr(e instanceof ApiError ? e.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    }
  };

  const remove = async (u: AuthUser) => {
    if (
      !(await dialog.confirm({
        title: `ลบผู้ใช้ ${u.name}?`,
        message: "การลบผู้ใช้ย้อนกลับไม่ได้ — ถ้าต้องการแค่ห้ามล็อกอิน ให้ใช้ปุ่มปิดใช้งานแทน",
        confirmLabel: "ยืนยันลบผู้ใช้",
        danger: true,
      }))
    )
      return;
    try {
      await api.deleteUser(u.id);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "ลบผู้ใช้ไม่สำเร็จ");
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>ผู้ใช้งานระบบ</h1>
        <span className="sub">{items.length} บัญชี</span>
      </div>

      {err ? <div className="alert alert-error">{err}</div> : null}
      {okMsg ? <div className="alert alert-ok" role="status">{okMsg}</div> : null}

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>เพิ่มผู้ใช้ใหม่</h2>
        <form onSubmit={create} className="user-form">
          <div className="field">
            <label>อีเมล</label>
            <input className="input" type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />
          </div>
          <div className="field">
            <label>ชื่อ</label>
            <input className="input" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label>รหัสผ่าน</label>
            <input className="input" type="password" required minLength={8} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
          </div>
          <div className="field">
            <label>สิทธิ์</label>
            <select className="input" value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "กำลังเพิ่ม…" : "เพิ่มผู้ใช้"}
          </button>
        </form>
      </div>

      <div className="card">
        {loading ? (
          <div className="state">กำลังโหลด…</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ชื่อ</th><th>อีเมล</th><th>สิทธิ์</th><th>ทีม / โซนที่รับผิดชอบ</th><th>สถานะ</th><th></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((u) => {
                const self = u.id === user?.id;
                return (
                  <tr key={u.id}>
                    <td>{u.name}{self ? <span className="tag" style={{ marginLeft: 6 }}>คุณ</span> : null}</td>
                    <td>{u.email}</td>
                    <td>
                      <select className="input input-sm" value={u.role} disabled={self}
                        onChange={(e) => changeRole(u, e.target.value as Role)}>
                        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {u.role === "tech" ? (
                        <>
                          <div>{u.team || "— ยังไม่ระบุทีม —"}</div>
                          <div style={{ color: "#6b7a86" }}>{(u.zones ?? []).join(", ") || "รับทุกโซน"}</div>
                          <button className="btn btn-sm" onClick={() => editTech(u)}>แก้ทีม/โซน</button>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className={u.active ? "badge badge-ok" : "badge badge-off"}>
                        {u.active ? "ใช้งาน" : "ปิด"}
                      </span>
                    </td>
                    <td className="row-actions">
                      <button className="btn btn-sm" onClick={() => resetPassword(u)}>รหัสผ่าน</button>
                      <button className="btn btn-sm" disabled={self} onClick={() => toggleActive(u)}>
                        {u.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                      </button>
                      <button className="btn btn-sm btn-danger" disabled={self} onClick={() => remove(u)}>ลบ</button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 ? (
                <tr><td colSpan={6} className="state">ยังไม่มีผู้ใช้</td></tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
      <Pagination page={page} pageCount={pageCount} total={total} onPage={setPage} />
    </div>
  );
}
