import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import SiteHeader from "@/components/SiteHeader";
import Workshop from "@/components/workshop/Workshop";
import SiteFooter from "@/components/SiteFooter";

// your own builds, kept in this browser: nothing for a search engine to index
export const metadata: Metadata = pageMeta("Your workshop", "The JYSK builds you started on this device, ready to pick up at the step you left.", "/builds", { robots: { index: false } });

export default function Page() {
  return (
    <div className="site">
      <SiteHeader />
      <main>
        <Workshop />
      </main>
      <SiteFooter />
    </div>
  );
}
