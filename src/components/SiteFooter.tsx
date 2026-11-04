import Link from "next/link";
import Logo from "./Logo";
import { IArrowOut } from "./art/Icons";
import { SCAN_ENABLED } from "@/lib/site";

export default function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="foot-card">
        <div className="foot-brand">
          <Logo size={30} />
          <p>Assembly guides for JYSK furniture you can turn around and follow with your hands full. Free and not affiliated with JYSK.</p>
        </div>

        <nav className="foot-cols" aria-label="Footer">
          <div>
            <h2>Build</h2>
            <Link href="/browse">All guides</Link>
            <Link href="/builds">Workshop</Link>
            {SCAN_ENABLED && <Link href="/scan">Scan a manual</Link>}
          </div>
          <div>
            <h2>Project</h2>
            <Link href="/privacy">Privacy and terms</Link>
          </div>
        </nav>

        <p className="foot-credit">
          Based on{" "}
          <a href="https://github.com/Nutlope/bygga" target="_blank" rel="noreferrer">
            Bygga <IArrowOut size={14} />
          </a>
        </p>
      </div>

      <div className="foot-base">
        <p>assemble.help is an independent, unofficial project. It is not affiliated with, sponsored or endorsed by JYSK A/S or any JYSK company. JYSK and JYSK product names are trademarks of their owners.</p>
      </div>
    </footer>
  );
}
