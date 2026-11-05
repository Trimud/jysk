import Logo from "./Logo";
import NavLinks from "./NavLinks";
import { ROOMS, type CatNode } from "@/lib/categories";
import type { MenuNode } from "./BrowseMenu";

// the menu needs only names and addresses, not the guides under each category
const slim = (n: CatNode): MenuNode => ({ href: n.href, label: n.label, children: n.children.map(slim) });
const MENU = ROOMS.map(slim);

export default function SiteHeader() {
  return (
    <header className="site-head">
      <div className="head-left">
        <Logo />
        <NavLinks rooms={MENU} />
      </div>
      <a className="nav-link" href="https://a-z.house/" target="_blank" rel="noreferrer" aria-label="House A-Z (opens in a new tab)">
        <span className="az-by">by</span>
        {/* House A-Z's own mark, in its emerald */}
        <svg viewBox="0 0 450 479" width={17} height={18} fill="#10b981" aria-hidden="true">
          <g transform="translate(0,479) scale(0.1,-0.1)">
            <path d="M1117 3672 l-1117 -1117 0 -963 0 -962 1625 0 1625 0 0 200 0 200-1425 0 -1425 0 0 673 0 672 928 928 927 927 928 -928 927 -927 0 -1188 0-1187 195 0 195 0 0 1283 0 1282 -1113 1113 c-735 734 -1119 1112 -1132 1112-13 0 -399 -379 -1138 -1118z" />
            <path d="M1442 3107 l-812 -812 0 -518 0 -517 200 0 200 0 0 433 0 432 613 613 612 612 613 -613 612 -612 0 -868 0 -867 -1740 0 -1740 0 0 -195 0 -195 1940 0 1940 0 0 1148 0 1147 -813 813 -812 812 -813 -813z" />
          </g>
        </svg>
        <span className="az-label">House A-Z</span>
      </a>
    </header>
  );
}
