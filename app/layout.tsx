import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Sora } from "next/font/google";
import "./globals.css";
import PWA from "@/components/PWA";
import { getPublicUrl } from "@/lib/publicurl.mjs";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

const TITLE = "Syncwave — listen to music together, in sync";
const DESCRIPTION =
  "A self-hosted Spotify Jam alternative. Start a room, share one link, and everyone " +
  "hears the same second of the same song — shared queue, chat, reactions and an optional AI DJ.";

/**
 * Resolved per request rather than baked in. A share card's image has to be an
 * absolute URL, and the address this instance answers on is not knowable at
 * build time: the launcher opens its tunnel after the server is already up, and
 * that URL is different every run. So the same rule as share links — an operator
 * who has declared a PUBLIC_URL wins, otherwise reflect the host we were asked
 * on, which is what makes a LAN address work without configuration.
 */
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("host");
  // Next fills in x-forwarded-proto from the connection when a proxy hasn't.
  const proto = h.get("x-forwarded-proto") || "http";
  const base = getPublicUrl() || (host ? `${proto}://${host}` : "http://localhost:3000");
  return {
    metadataBase: new URL(base),
    title: TITLE,
    description: DESCRIPTION,
    applicationName: "Syncwave",
    keywords: [
      "Spotify Jam alternative",
      "listen to music together",
      "synced music listening",
      "shared queue",
      "listening party",
      "self-hosted",
      "JQBX alternative",
      "Turntable.fm alternative",
    ],
    icons: { icon: "/icon.svg", apple: "/icon.svg" },
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "Syncwave", statusBarStyle: "black-translucent" },
    openGraph: {
      type: "website",
      siteName: "Syncwave",
      title: TITLE,
      description: DESCRIPTION,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "A Syncwave listening room" }],
    },
    twitter: {
      card: "summary_large_image",
      title: TITLE,
      description: DESCRIPTION,
      images: ["/og.png"],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#08090f",
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
