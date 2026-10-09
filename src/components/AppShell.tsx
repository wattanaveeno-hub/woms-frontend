"use client";

// โครงหน้าหลัก: แถบนำทาง (Drawer) + แถบบน (AppBar) + พื้นที่เนื้อหา
import Box from "@mui/material/Box";
import Nav from "@/components/Nav";
import Header from "@/components/Header";
import TechBottomNav, { TECH_NAV_HEIGHT, useTechBottomNavVisible } from "@/components/TechBottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  // ช่างบนมือถือมีแถบเมนูล่าง — เว้นที่ด้านล่างไม่ให้บังเนื้อหา/ปุ่มบันทึก
  const techNav = useTechBottomNavVisible();
  return (
    <Box className="app-shell" sx={{ display: "flex", minHeight: "100vh" }}>
      <Nav />
      <Box component="main" sx={{ flex: 1, minWidth: 0, pb: techNav ? `${TECH_NAV_HEIGHT + 16}px` : 0 }}>
        <Header />
        {/* .shell = ระยะขอบเดิมของหน้าที่ยังไม่ย้ายไป MUI */}
        <div className="shell">{children}</div>
      </Box>
      <TechBottomNav />
    </Box>
  );
}
