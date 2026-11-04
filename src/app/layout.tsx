import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import "./guide.css";
import "./home.css";
import "./scan.css";
import { Analytics } from "@vercel/analytics/next";
import Offline from "@/components/Offline";
import { AI_ENABLED, SITE_URL } from "@/lib/site";

// the one face, site and guide alike
const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  variable: "--font-figtree",
  display: "swap",
});

const description = `Type the JYSK product name or article number from the box. assemble.help shows every assembly step in 3D, with the parts, screws and tools for each one${AI_ENABLED ? ", and reads it out loud" : ""}. Not affiliated with JYSK.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "assemble.help: JYSK assembly, step by step", template: "%s | assemble.help" },
  description,
  applicationName: "assemble.help",
  appleWebApp: { capable: true, title: "assemble.help", statusBarStyle: "default" },
  openGraph: { type: "website", siteName: "assemble.help", title: "assemble.help: JYSK assembly, step by step", description, url: "/" },
  twitter: { card: "summary_large_image", title: "assemble.help: JYSK assembly, step by step", description },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={figtree.variable}>
      <body>
        {children}
        <Analytics />
        {/* it reads the path, which the prerendered shell doesn't know yet */}
        <Suspense fallback={null}>
          <Offline />
        </Suspense>
      </body>
    </html>
  );
}
