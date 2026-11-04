import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SCAN_ENABLED, pageMeta } from "@/lib/site";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Scanner from "@/components/scan/Scanner";

export const metadata: Metadata = pageMeta("Scan a manual", "Photograph any assembly manual and Together AI turns it into a step by step guide in 3D.", "/scan");

export default function Page() {
  if (!SCAN_ENABLED) notFound();
  return (
    <div className="site">
      <SiteHeader />
      <main>
        <Scanner />
      </main>
      <SiteFooter />
    </div>
  );
}
