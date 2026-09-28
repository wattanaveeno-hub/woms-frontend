"use client";

// โครงหน้าหลัก: แถบนำทาง (Drawer) + แถบบน (AppBar) + พื้นที่เนื้อหา
import Box from "@mui/material/Box";
import Nav from "@/components/Nav";
import Header from "@/components/Header";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Box className="app-shell" sx={{ display: "flex", minHeight: "100vh" }}>
      <Nav />
      <Box component="main" sx={{ flex: 1, minWidth: 0 }}>
        <Header />
        {/* .shell = ระยะขอบเดิมของหน้าที่ยังไม่ย้ายไป MUI */}
        <div className="shell">{children}</div>
      </Box>
    </Box>
  );
}
