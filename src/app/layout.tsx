import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Header from "@/components/Header";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/lib/AuthContext";
import { UiProvider } from "@/lib/UiContext";

export const metadata: Metadata = {
  title: "WOMS — ระบบเปิด/ปิดงาน",
  description: "Field Work Order Management",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "WOMS" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2E6B70",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap"
        />
      </head>
      <body>
        <ToastProvider>
          <AuthProvider>
            <UiProvider>
              <div className="app-shell">
                <Nav />
                <main className="app-main">
                  <Header />
                  <div className="shell">{children}</div>
                </main>
              </div>
            </UiProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
