import Link from "next/link";
import Logo from "./Logo";
import { IArrowOut } from "./art/Icons";
import { TogetherWordmark } from "./art/Together";
import { AI_ENABLED, GITHUB_URL, SCAN_ENABLED } from "@/lib/site";

export default function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="foot-card">
        <div className="foot-brand">
          <Logo size={30} />
          <p>Assembly guides for JYSK furniture you can turn around and follow with your hands full. Free, open source and not affiliated with JYSK.</p>
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
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              Source code <IArrowOut size={14} />
            </a>
            <a href="https://togetherai.link/" target="_blank" rel="noreferrer">
              Together AI <IArrowOut size={14} />
            </a>
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
        {AI_ENABLED && (
        <a className="foot-powered" href="https://togetherai.link/" target="_blank" rel="noreferrer">
          <span>Powered by</span>
          <TogetherWordmark height={19} className="tg-word" />
        </a>
        )}
      </div>
    </footer>
  );
}
