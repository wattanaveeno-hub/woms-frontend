"use client";

// แถบบนของทุกหน้า (MUI AppBar) — ปุ่มเมนูบนจอเล็ก · แจ้งเตือน · ผู้ใช้ · ออกจากระบบ
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
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
    <Link href={href} style={{ textDecoration: "none" }} aria-label="WOMS หน้าแรก">
      <Typography component="span" sx={{ fontWeight: 700, fontSize: 20, letterSpacing: "0.04em", color: "text.primary" }}>
        WOMS<Box component="span" sx={{ color: "primary.main" }}>.</Box>
      </Typography>
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

  if (status !== "authed" || !user) return null;
  // หน้ามือถือช่าง (/m) ไม่มีเมนูข้าง — ใช้แถบสั้นที่มีแค่แจ้งเตือนกับออกจากระบบ
  // เทียบทั้ง segment — startsWith("/m") เดิมทำให้ /map และ /master ไม่มีปุ่มเปิดเมนู
  const tech = isTechModePath(path);
  const canUseAvatars = ["chat:check_queue", "chat:tech_groups", "chat:own_tech_group", "chat:read_all", "users:view", "users:manage"].some((p) => has(p));

  return (
    <AppBar className="no-print" position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Toolbar sx={{ gap: 1, minHeight: { xs: 56 } }}>
        {/* WS-02: โหมด /m ไม่มีเมนูข้าง — ปุ่มเปิดเมนูแสดงทุกขนาดจอ (เมนูกรองตามสิทธิ์ใน Nav) */}
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
        <Box sx={{ flex: 1 }} />
        {tech ? (
          // WS-02: ทางกลับระบบหลักบนจอใหญ่ (มือถือใช้ปุ่มเมนู/แถบเมนูล่าง) — ปลายทางตามบทบาท
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
        <NotificationBell />
        {!tech ? <Notifications /> : null}
        <Button
          color="inherit"
          aria-label="เมนูผู้ใช้"
          aria-haspopup="menu"
          aria-controls={menuEl ? "user-menu" : undefined}
          onClick={(e) => setMenuEl(e.currentTarget)}
          sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", gap: 1, lineHeight: 1.2, mx: 1, textTransform: "none" }}
        >
          <Box component="span" sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <Typography variant="body1" component="span" sx={{ fontSize: 14, fontWeight: 600 }}>
              {user.name}
            </Typography>
            <Typography variant="body2" component="span" sx={{ fontSize: 12 }}>
              {ROLE_LABEL[user.role]}
            </Typography>
          </Box>
          <UserAvatar userId={user.id} name={user.name} size={32} />
        </Button>
        <IconButton
          aria-label="เมนูผู้ใช้"
          aria-haspopup="menu"
          onClick={(e) => setMenuEl(e.currentTarget)}
          sx={{ display: { xs: "inline-flex", sm: "none" } }}
        >
          <UserAvatar userId={user.id} name={user.name} size={28} />
        </IconButton>
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
            เปลี่ยนรหัสผ่าน
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
        </Menu>
        <AvatarEditorDialog open={avatarOpen} onClose={() => setAvatarOpen(false)} userId={user.id} name={user.name} mode="me" />
        <Button
          variant="outlined"
          color="secondary"
          onClick={logout}
          startIcon={<LogoutIcon />}
          sx={{ display: { xs: "none", sm: "inline-flex" } }}
        >
          {tech ? "ออก" : "ออกจากระบบ"}
        </Button>
        <IconButton aria-label="ออกจากระบบ" onClick={logout} sx={{ display: { xs: "inline-flex", sm: "none" } }}>
          <LogoutIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
