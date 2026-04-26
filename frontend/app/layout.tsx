import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#060b18",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "SafeRoutes — AI-Powered Safety Navigation",
  description: "Navigate smarter with real-time AI safety scores, live incident alerts, and ML-based risk prediction.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "rgba(15, 20, 40, 0.95)",
              color: "#e2e8f0",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              backdropFilter: "blur(12px)",
              borderRadius: "12px",
              fontSize: "14px",
            },
            success: { iconTheme: { primary: "#22c55e", secondary: "#fff" } },
            error:   { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
          }}
        />
      </body>
    </html>
  );
}
