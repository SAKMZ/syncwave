import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import PWA from "@/components/PWA";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Syncwave — listen together",
  description:
    "Self-hosted, AI-powered collaborative listening rooms. Start a room, share the link, and jam with your friends in sync.",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Syncwave", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#08080e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sora.variable}>
      <body>
        <div className="sw-aurora" aria-hidden />
        <div className="sw-grain" aria-hidden />
        {children}
        <PWA />
      </body>
    </html>
  );
}
