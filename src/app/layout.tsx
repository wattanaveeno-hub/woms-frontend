import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/lib/AuthContext";

export const metadata: Metadata = {
  title: "WOMS — ระบบเปิด/ปิดงาน",
  description: "Field Work Order Management",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <ToastProvider>
          <AuthProvider>
            <Nav />
            <main className="shell">{children}</main>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
