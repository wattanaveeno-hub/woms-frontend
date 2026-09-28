"use client";

// ThemeProvider + CssBaseline ของทั้งแอป (App Router: ใช้ AppRouterCacheProvider
// เพื่อให้ style ของ emotion ถูกฝังตอน SSR ไม่กระพริบตอนโหลดหน้า)
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { theme } from "./theme";

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: "mui", prepend: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
