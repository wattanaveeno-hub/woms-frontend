"use client";

// แถบบนของทุกหน้า (MUI AppBar) — ปุ่มเมนูบนจอเล็ก · แจ้งเตือน · ผู้ใช้ · ออกจากระบบ
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "@/lib/AuthContext";
import { useUi } from "@/lib/UiContext";
import Notifications from "@/components/Notifications";
import NotificationBell from "@/components/NotificationBell";
import type { Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = {
  ceo: "ผู้บริหาร",
  admin: "แอดมิน",
  manager: "ผู้จัดการ",
  tech: "ช่าง",
  sales: "ฝ่ายขาย",
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
  const { status, user, logout } = useAuth();
  const { setOpen } = useUi();
  const path = usePathname();

  if (status !== "authed" || !user) return null;
  // หน้ามือถือช่าง (/m) ไม่มีเมนูข้าง — ใช้แถบสั้นที่มีแค่แจ้งเตือนกับออกจากระบบ
  const tech = path.startsWith("/m");

  return (
    <AppBar className="no-print" position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Toolbar sx={{ gap: 1, minHeight: { xs: 56 } }}>
        {!tech ? (
          <IconButton
            edge="start"
            aria-label="เปิดเมนู"
            onClick={() => setOpen(true)}
            sx={{ display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
        ) : null}
        <Box sx={{ display: tech ? "block" : { xs: "block", md: "none" } }}>
          <Brand href={tech ? "/m" : "/dashboard"} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <NotificationBell />
        {!tech ? <Notifications /> : null}
        <Box sx={{ display: { xs: "none", sm: "flex" }, flexDirection: "column", alignItems: "flex-end", lineHeight: 1.2, mx: 1 }}>
          <Typography variant="body1" sx={{ fontSize: 14, fontWeight: 600 }}>
            {user.name}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: 12 }}>
            {ROLE_LABEL[user.role]}
          </Typography>
        </Box>
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
