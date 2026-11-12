"use client";

// แถบบนของทุกหน้า (MUI AppBar) — ปุ่มเมนูบนจอเล็ก · แจ้งเตือน · ผู้ใช้ · ออกจากระบบ
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import KeyIcon from "@mui/icons-material/Key";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import UserAvatar from "@/components/UserAvatar";
import AvatarEditorDialog from "@/components/AvatarEditorDialog";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { CHANGE_PASSWORD_PATH } from "@/lib/passwordRules";
import { useAuth } from "@/lib/AuthContext";
import { useUi } from "@/lib/UiContext";
import Notifications from "@/components/Notifications";
import NotificationBell from "@/components/NotificationBell";
import type { Role } from "@/lib/types";
import { isTechModePath } from "@/lib/navRules";
import { landingPath } from "@/lib/financeRules";

const ROLE_LABEL: Record<Role, string> = {
  developer: "Developer/MA",
  ceo: "ผู้บริหาร",
  admin: "แอดมิน",
  manager: "ผู้จัดการ",
  acc: "บัญชี",
  tech: "ช่าง",
  sales: "ฝ่ายขาย",
  store: "คลังสินค้า",
  viewer: "ผู้ดู",
};

function Brand({ href }: { href: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }} aria-label="ENTECH หน้าแรก">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/contract/entech-logo.png" alt="ENTECH" style={{ display: "block", height: 26, width: "auto" }} />
    </Link>
  );
}

export default function Header() {
  const { status, user, logout, has } = useAuth();
  const { setOpen } = useUi();
  const path = usePathname();
  const router = useRouter();
  // D-04: เมนูผู้ใช้ — เปลี่ยนรหัสผ่าน
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);
  // CHAT-AV01: รูปโปรไฟล์ของตัวเอง
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  // กด "/" เพื่อไปช่องค้นหา (ยกเว้นกำลังพิมพ์อยู่ในช่องอื่น)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!searchRef.current) return;
      e.preventDefault();
      searchRef.current.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (status !== "authed" || !user) return null;
  // หน้ามือถือช่าง (/m) ไม่มีเมนูข้าง — ใช้แถบสั้นที่มีแค่แจ้งเตือนกับออกจากระบบ
  // เทียบทั้ง segment — startsWith("/m") เดิมทำให้ /map และ /master ไม่มีปุ่มเปิดเมนู
  const tech = isTechModePath(path);
  const canUseAvatars = ["chat:check_queue", "chat:tech_groups", "chat:own_tech_group", "chat:read_all", "users:view", "users:manage"].some((p) => has(p));

  // Redesign 13 พ.ย. 69 ตาม Top.dc.html: ช่องค้นหา · + เปิดงาน · กระดิ่ง · ผู้ใช้ (เมนู: บัญชี/รหัสผ่าน/รูป/ออกจากระบบ)
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    router.push(v ? `/jobs?status=ALL&q=${encodeURIComponent(v)}` : "/jobs");
  };

  return (
    <AppBar
      className="no-print"
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ borderBottom: "1px solid #e2e7ec", bgcolor: "#fff" }}
    >
      <Toolbar disableGutters sx={{ gap: 1.5, minHeight: { xs: 60, md: 68 }, px: { xs: 1.5, md: 4 } }}>
        {/* WS-02: โหมด /m ไม่มีเมนูข้าง — ปุ่มเปิดเมนูแสดงทุกขนาดจอ */}
        <IconButton
          edge="start"
          aria-label="เปิดเมนู"
          onClick={() => setOpen(true)}
          sx={{ display: tech ? "inline-flex" : { md: "none" } }}
          data-testid="open-nav"
        >
          <MenuIcon />
        </IconButton>
        <Box sx={{ display: tech ? "block" : { xs: "block", md: "none" } }}>
          <Brand href={tech ? "/m" : "/dashboard"} />
        </Box>
        {!tech && has("jobs:view") ? (
          <Box
            component="form"
            role="search"
            onSubmit={submitSearch}
            sx={{
              display: { xs: "none", md: "flex" },
              flex: "1 1 320px",
              maxWidth: 560,
              alignItems: "center",
              gap: 1,
              height: 44,
              px: "14px",
              border: "1px solid #cdd6dd",
              borderRadius: "10px",
              bgcolor: "#f6f8fa",
              color: "#51626f",
              "&:focus-within": { borderColor: "#1b5e37", bgcolor: "#fff" },
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
            <Box
              component="input"
              ref={searchRef}
              value={q}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
              aria-label="ค้นหาทั้งระบบ"
              placeholder="ค้นหา เลขงาน ชื่อลูกค้า เบอร์โทร SN เลขสัญญา"
              sx={{ flex: 1, minWidth: 0, border: 0, bgcolor: "transparent", font: "inherit", fontSize: 15, color: "#16202b", outline: "none" }}
            />
            <Box
              component="kbd"
              sx={{ fontFamily: "ui-monospace,monospace", fontSize: 12, border: "1px solid #cdd6dd", borderRadius: "4px", px: "6px", bgcolor: "#fff", color: "#51626f" }}
            >
              /
            </Box>
          </Box>
        ) : null}
        <Box sx={{ flex: 1 }} />
        {tech ? (
          // WS-02: ทางกลับระบบหลักบนจอใหญ่ — ปลายทางตามบทบาท
          <Button
            component={Link}
            href={landingPath(has)}
            variant="text"
            size="small"
            startIcon={<DashboardOutlinedIcon />}
            sx={{ display: { xs: "none", md: "inline-flex" } }}
            data-testid="back-to-main"
          >
            ไปหน้าระบบหลัก
          </Button>
        ) : null}
        {!tech && has("jobs:create") ? (
          <Button
            component={Link}
            href="/jobs/new"
            variant="contained"
            disableElevation
            data-testid="top-new-job"
            startIcon={
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            }
            sx={{ minHeight: 40, px: 2, borderRadius: "8px", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", display: { xs: "none", sm: "inline-flex" } }}
          >
            เปิดงาน
          </Button>
        ) : null}
        <NotificationBell />
        {!tech ? <Notifications /> : null}
        <Box
          component="button"
          type="button"
          aria-label="เมนูผู้ใช้"
          aria-haspopup="menu"
          aria-controls={menuEl ? "user-menu" : undefined}
          onClick={(e: React.MouseEvent<HTMLElement>) => setMenuEl(e.currentTarget)}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            pl: 1,
            pr: 0.5,
            py: 0.5,
            border: 0,
            borderRadius: "10px",
            bgcolor: "transparent",
            font: "inherit",
            color: "inherit",
            cursor: "pointer",
            textAlign: "left",
            "&:hover": { bgcolor: "#eef2f5" },
          }}
        >
          <UserAvatar userId={user.id} name={user.name} size={36} />
          <Box component="span" sx={{ display: { xs: "none", sm: "block" } }}>
            <Box component="b" sx={{ display: "block", fontSize: 14, lineHeight: 1.2, fontWeight: 700 }}>
              {user.name}
            </Box>
            <Box component="small" sx={{ display: "block", fontSize: 12, color: "#51626f" }}>
              {ROLE_LABEL[user.role]}
            </Box>
          </Box>
        </Box>
        <Menu id="user-menu" anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
          <MenuItem
            onClick={() => {
              setMenuEl(null);
              router.push(CHANGE_PASSWORD_PATH);
            }}
          >
            <ListItemIcon>
              <KeyIcon fontSize="small" />
            </ListItemIcon>
            บัญชีของฉัน &amp; เปลี่ยนรหัสผ่าน
          </MenuItem>
          {/* CHAT-AV01: ตั้งรูปได้เมื่อมีสิทธิ์แชท/ดูผู้ใช้ (ตรงกับ guard ของ backend) */}
          {canUseAvatars ? (
            <MenuItem
              onClick={() => {
                setMenuEl(null);
                setAvatarOpen(true);
              }}
              data-testid="menu-avatar"
            >
              <ListItemIcon>
                <AccountCircleIcon fontSize="small" />
              </ListItemIcon>
              รูปโปรไฟล์
            </MenuItem>
          ) : null}
          <MenuItem
            onClick={() => {
              setMenuEl(null);
              logout();
            }}
            data-testid="menu-logout"
          >
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            ออกจากระบบ
          </MenuItem>
        </Menu>
        <AvatarEditorDialog open={avatarOpen} onClose={() => setAvatarOpen(false)} userId={user.id} name={user.name} mode="me" />
      </Toolbar>
    </AppBar>
  );
}
